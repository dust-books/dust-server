const std = @import("std");
const time_compat = @import("time_compat.zig");

/// TODO:: Rewrite this whole module using IO  async/await model
/// Generic TimerTask for a specific context type `Ctx`.
pub fn TimerTask(comptime Ctx: type) type {
    return struct {
        func: *const fn (*Ctx) void,
        context: *Ctx,
        interval_ms: u64,
        last_run: i64,
        thread: ?std.Thread = null,
        cleanup: ?*const fn (*Ctx, std.mem.Allocator) void = null,
    };
}

/// Generic TimerManager that schedules tasks which receive a typed context `Ctx`.
pub fn TimerManager(comptime Ctx: type) type {
    return struct {
        const Self = @This();
        const Task = TimerTask(Ctx);

        allocator: std.mem.Allocator,
        io: std.Io,
        tasks: std.ArrayListUnmanaged(Task),
        running: std.atomic.Value(bool),
        mutex: std.Io.Mutex,

        pub fn init(allocator: std.mem.Allocator, io: std.Io) Self {
            return .{
                .allocator = allocator,
                .io = io,
                .tasks = .{ .items = &.{}, .capacity = 0 },
                .running = std.atomic.Value(bool).init(true),
                .mutex = std.Io.Mutex.init,
            };
        }

        pub fn deinit(self: *Self) void {
            self.stop();

            for (self.tasks.items) |task| {
                if (task.cleanup) |cleanup_fn| cleanup_fn(task.context, self.allocator);
            }

            self.tasks.deinit(self.allocator);
        }

        pub fn registerTimer(
            self: *Self,
            func: *const fn (*Ctx) void,
            context: *Ctx,
            interval_ms: u64,
            cleanup: ?*const fn (*Ctx, std.mem.Allocator) void,
            startFirstTaskImmediately: bool,
        ) !void {
            self.mutex.lockUncancelable(self.io);
            defer self.mutex.unlock(self.io);

            const task = Task{
                .func = func,
                .context = context,
                .interval_ms = interval_ms,
                .last_run = if (startFirstTaskImmediately) time_compat.milliTimestamp() - @as(i64, @intCast(interval_ms)) else time_compat.milliTimestamp(),
                .cleanup = cleanup,
            };

            try self.tasks.append(self.allocator, task);

            const task_index = self.tasks.items.len - 1;
            const thread = try std.Thread.spawn(.{}, taskLoop, .{ self, task_index });
            self.tasks.items[task_index].thread = thread;

            std.log.debug("Registered timer task (interval: {}ms)", .{interval_ms});
        }

        pub fn stop(self: *Self) void {
            if (!self.running.load(.acquire)) return;

            self.running.store(false, .release);

            self.mutex.lockUncancelable(self.io);
            defer self.mutex.unlock(self.io);

            for (self.tasks.items) |task| {
                if (task.thread) |thread| thread.join();
            }

            std.log.debug("Timer manager stopped", .{});
        }

        fn taskLoop(self: *Self, task_index: usize) void {
            while (self.running.load(.acquire)) {
                const now = time_compat.milliTimestamp();

                self.mutex.lockUncancelable(self.io);
                const task = &self.tasks.items[task_index];
                const elapsed = @as(u64, @intCast(now - task.last_run));

                if (elapsed >= task.interval_ms) {
                    task.func(task.context);
                    task.last_run = now;
                }
                self.mutex.unlock(self.io);

                time_compat.sleep(std.time.ns_per_s);
            }
        }
    };
}
