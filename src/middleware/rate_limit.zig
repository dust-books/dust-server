const std = @import("std");
const httpz = @import("httpz");

pub const RateLimitConfig = struct {
    max_requests: u32 = 100,
    window_seconds: u64 = 60,
};

pub const RateLimiter = struct {
    allocator: std.mem.Allocator,
    config: RateLimitConfig,
    requests: std.StringHashMap(RequestCount),
    mutex: std.Thread.Mutex,

    const RequestCount = struct {
        count: u32,
        window_start: i64,
    };

    pub fn init(allocator: std.mem.Allocator, config: RateLimitConfig) !*RateLimiter {
        const limiter = try allocator.create(RateLimiter);
        limiter.* = .{
            .allocator = allocator,
            .config = config,
            .requests = std.StringHashMap(RequestCount).init(allocator),
            .mutex = std.Thread.Mutex{},
        };
        return limiter;
    }

    pub fn deinit(self: *RateLimiter) void {
        var it = self.requests.iterator();
        while (it.next()) |entry| {
            self.allocator.free(entry.key_ptr.*);
        }
        self.requests.deinit();
        self.allocator.destroy(self);
    }

    pub fn checkLimit(self: *RateLimiter, ip: []const u8) !bool {
        self.mutex.lock();
        defer self.mutex.unlock();

        const now = std.time.timestamp();
        
        if (self.requests.get(ip)) |count| {
            const window_elapsed = now - count.window_start;
            
            if (window_elapsed >= self.config.window_seconds) {
                // New window
                try self.requests.put(ip, .{
                    .count = 1,
                    .window_start = now,
                });
                return true;
            } else {
                // Within window
                if (count.count >= self.config.max_requests) {
                    return false;
                }
                try self.requests.put(ip, .{
                    .count = count.count + 1,
                    .window_start = count.window_start,
                });
                return true;
            }
        } else {
            // First request from this IP
            const ip_copy = try self.allocator.dupe(u8, ip);
            try self.requests.put(ip_copy, .{
                .count = 1,
                .window_start = now,
            });
            return true;
        }
    }

    pub fn middleware(self: *RateLimiter) httpz.Middleware {
        return .{
            .handler = handler,
            .data = self,
        };
    }

    fn handler(data: ?*anyopaque, req: *httpz.Request, res: *httpz.Response) !void {
        const limiter: *RateLimiter = @ptrCast(@alignCast(data.?));
        
        const ip = req.address orelse "unknown";
        
        const allowed = try limiter.checkLimit(ip);
        if (!allowed) {
            res.status = 429;
            res.body = "Too many requests";
            return;
        }
    }

    pub fn cleanup(self: *RateLimiter) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const now = std.time.timestamp();
        var to_remove = std.ArrayList([]const u8).init(self.allocator);
        defer to_remove.deinit();

        var it = self.requests.iterator();
        while (it.next()) |entry| {
            const window_elapsed = now - entry.value_ptr.window_start;
            if (window_elapsed >= self.config.window_seconds * 2) {
                to_remove.append(entry.key_ptr.*) catch {};
            }
        }

        for (to_remove.items) |ip| {
            _ = self.requests.remove(ip);
            self.allocator.free(ip);
        }
    }
};
