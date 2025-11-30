const std = @import("std");

pub const TimerTask = struct {
    func: *const fn (*anyopaque) void,
    context: *anyopaque,
    interval_ms: u64,
    last_run: i64,
    thread: ?std.Thread = null,
    cleanup: ?*const fn (*anyopaque, std.mem.Allocator) void = null,
};

pub const TimerManager = struct {
    allocator: std.mem.Allocator,
    tasks: std.ArrayListUnmanaged(TimerTask),
    running: std.atomic.Value(bool),
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) TimerManager {
        return .{
            .allocator = allocator,
            .tasks = .{},
            .running = std.atomic.Value(bool).init(true),
            .mutex = .{},
        };
    }

    pub fn deinit(self: *TimerManager) void {
        self.stop();
        
        // Clean up contexts if cleanup function provided
        for (self.tasks.items) |task| {
            if (task.cleanup) |cleanup_fn| {
                cleanup_fn(task.context, self.allocator);
            }
        }
        
        self.tasks.deinit(self.allocator);
    }

    /// Register a timer that runs a function periodically
    pub fn registerTimer(
        self: *TimerManager,
        func: *const fn (*anyopaque) void,
        context: *anyopaque,
        interval_ms: u64,
        cleanup: ?*const fn (*anyopaque, std.mem.Allocator) void,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const task = TimerTask{
            .func = func,
            .context = context,
            .interval_ms = interval_ms,
            .last_run = std.time.milliTimestamp(),
            .cleanup = cleanup,
        };

        try self.tasks.append(self.allocator, task);
        
        // Spawn thread for this task
        const task_index = self.tasks.items.len - 1;
        const thread = try std.Thread.spawn(.{}, taskLoop, .{ self, task_index });
        self.tasks.items[task_index].thread = thread;
        
        std.log.info("✅ Registered timer task (interval: {}ms)", .{interval_ms});
    }

    pub fn stop(self: *TimerManager) void {
        if (!self.running.load(.acquire)) return;

        self.running.store(false, .release);
        
        self.mutex.lock();
        defer self.mutex.unlock();
        
        for (self.tasks.items) |task| {
            if (task.thread) |thread| {
                thread.join();
            }
        }
        
        std.log.info("⏹️  Timer manager stopped", .{});
    }

    fn taskLoop(self: *TimerManager, task_index: usize) void {
        while (self.running.load(.acquire)) {
            const now = std.time.milliTimestamp();

            self.mutex.lock();
            const task = &self.tasks.items[task_index];
            const elapsed = @as(u64, @intCast(now - task.last_run));
            
            if (elapsed >= task.interval_ms) {
                task.func(task.context);
                task.last_run = now;
            }
            self.mutex.unlock();

            // Sleep to avoid busy-waiting
            std.Thread.sleep(std.time.ns_per_s);
        }
    }
};
