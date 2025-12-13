const std = @import("std");
const httpz = @import("httpz");

/// Format an IP address for logging
fn formatIpAddress(address: std.net.Address, buf: []u8) []const u8 {
    if (address.any.family == std.posix.AF.INET) {
        const ip = address.in.sa.addr;
        const bytes = std.mem.toBytes(ip);
        const result = std.fmt.bufPrint(buf, "{}.{}.{}.{}", .{bytes[0], bytes[1], bytes[2], bytes[3]}) catch return "0.0.0.0";
        return result;
    } else if (address.any.family == std.posix.AF.INET6) {
        return "[IPv6]";
    }
    return "unknown";
}

/// Log HTTP request details
pub fn logRequest(req: *httpz.Request) void {
    var ip_buf: [45]u8 = undefined;
    const ip = formatIpAddress(req.address, &ip_buf);
    std.debug.print("[{any}] {s} - from {s}\n", .{ req.method, req.url.path, ip });
}

/// Middleware wrapper that logs requests
pub fn loggingMiddleware(
    comptime HandlerFn: type,
    comptime handler: HandlerFn,
) fn (*anyopaque, *httpz.Request, *httpz.Response) anyerror!void {
    return struct {
        fn wrapped(ctx: *anyopaque, req: *httpz.Request, res: *httpz.Response) !void {
            logRequest(req);
            try handler(ctx, req, res);
        }
    }.wrapped;
}
