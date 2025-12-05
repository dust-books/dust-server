const std = @import("std");

/// TimerTask represents a single scheduled task
pub const TimerTask = struct {
    /// Function to execute for the timer task
    func: *const fn (*anyopaque) void,
    /// Context to pass to the function
    context: *anyopaque,
    /// Interval in milliseconds between executions
    interval_ms: u64,
    /// Timestamp of the last execution
    last_run: i64,
    /// Thread running the timer task
    thread: ?std.Thread = null,
    /// Optional cleanup function for the context
    cleanup: ?*const fn (*anyopaque, std.mem.Allocator) void = null,
};

/// TimerManager manages multiple timer tasks
pub const TimerManager = struct {
    allocator: std.mem.Allocator,
    /// List of registered timer tasks
    tasks: std.ArrayListUnmanaged(TimerTask),
    /// Flag to indicate if the timer manager is running
    running: std.atomic.Value(bool),
    /// Mutex for thread safety
    mutex: std.Thread.Mutex,

    /// Initialize the TimerManager
    pub fn init(allocator: std.mem.Allocator) TimerManager {
        return .{
            .allocator = allocator,
            .tasks = .{},
            .running = std.atomic.Value(bool).init(true),
            .mutex = .{},
        };
    }

    /// Deinitialize the TimerManager and stop all tasks
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
        /// Function to execute
        func: *const fn (*anyopaque) void,
        /// Context to pass to the function
        context: *anyopaque,
        /// Interval in milliseconds
        interval_ms: u64,
        /// Optional cleanup function for the context
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

    /// Stop all timer tasks and the timer manager
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

    /// Loop function for each timer task thread
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
