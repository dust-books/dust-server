const std = @import("std");
const httpz = @import("httpz");

pub fn logRequest(req: *httpz.Request) void {
    std.debug.print("[{any}] {s}\n", .{ req.method, req.url.path });
}

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
