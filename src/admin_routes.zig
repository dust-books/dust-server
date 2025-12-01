const std = @import("std");
const httpz = @import("httpz");
const scanner = @import("scanner.zig");
const user_routes = @import("modules/users/routes.zig");
const ServerContext = user_routes.ServerContext;

pub fn scanLibrary(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    // Get Authorization header
    const auth_header = req.header("authorization") orelse {
        res.status = 401;
        try res.json(.{ .message = "Unauthorized" }, .{});
        return;
    };
    
    // Extract token
    const token_start = if (std.mem.startsWith(u8, auth_header, "Bearer ")) auth_header[7..] else {
        res.status = 401;
        try res.json(.{ .message = "Invalid authorization format" }, .{});
        return;
    };
    
    // Validate token
    const claims = ctx.auth_context.jwt.validate(std.mem.trim(u8, token_start, " \t\r\n")) catch {
        res.status = 401;
        try res.json(.{ .message = "Invalid or expired token" }, .{});
        return;
    };
    
    // Check if user is admin (simplified - user ID 1 is admin)
    if (claims.user_id != 1) {
        res.status = 403;
        try res.json(.{ .message = "Forbidden: Admin access required" }, .{});
        return;
    }
    
    // Parse request body for scan path
    const body_opt = try req.json(struct {
        path: ?[]const u8 = null,
    });
    
    // Use default path if none provided
    const scan_path = if (body_opt) |body| body.path orelse "/library" else "/library";
    
    std.log.info("🔍 Admin user {} initiated library scan at: {s}", .{ claims.user_id, scan_path });
    
    // Create scanner and run scan
    const db = ctx.db orelse {
        res.status = 500;
        try res.json(.{ .message = "Database not available" }, .{});
        return;
    };
    var lib_scanner = scanner.Scanner.init(res.arena, &db.db);
    const result = lib_scanner.scanLibrary(scan_path) catch |err| {
        std.log.err("Scan failed: {}", .{err});
        res.status = 500;
        try res.json(.{ 
            .message = "Library scan failed",
            .@"error" = @errorName(err),
        }, .{});
        return;
    };
    
    // Return scan results
    try res.json(.{
        .success = true,
        .message = "Library scan completed",
        .results = .{
            .books_found = result.books_found,
            .books_added = result.books_added,
            .books_updated = result.books_updated,
            .errors = result.errors,
            .scan_path = result.scan_path,
        },
    }, .{});
}
