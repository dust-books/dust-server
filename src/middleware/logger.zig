const std = @import("std");
const httpz = @import("httpz");

/// Request logging middleware - logs all requests with timing
pub fn requestLogger(comptime T: type) httpz.Middleware(T) {
    return struct {
        pub fn execute(_: T, req: *httpz.Request, res: *httpz.Response, next: anytype) !void {
            const start = std.time.milliTimestamp();
            
            // Execute the request
            try next();
            
            const duration = std.time.milliTimestamp() - start;
            
            // Log the request
            std.log.info("{s} {s} {} {} {}ms", .{
                req.method,
                req.url.path,
                res.status,
                res.body.len,
                duration,
            });
        }
    };
}
