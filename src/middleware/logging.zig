const std = @import("std");
const httpz = @import("httpz");

pub fn logRequest(req: *httpz.Request, res: *httpz.Response) !void {
    const start_time = std.time.milliTimestamp();
    
    // Log incoming request
    std.log.info("{s} {s} from {any}", .{
        @tagName(req.method),
        req.url.path,
        req.address,
    });
    
    // Store start time in response for later logging
    // Note: httpz doesn't have built-in middleware chaining, 
    // so this is a simplified version
    _ = res;
    _ = start_time;
}

pub fn logResponse(req: *httpz.Request, res: *httpz.Response, status_code: u16) void {
    const end_time = std.time.milliTimestamp();
    _ = end_time;
    
    std.log.info("{s} {s} -> {d}", .{
        @tagName(req.method),
        req.url.path,
        status_code,
    });
    
    _ = res;
}
