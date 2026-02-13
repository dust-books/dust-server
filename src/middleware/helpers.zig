const std = @import("std");
const httpz = @import("httpz");
const JWT = @import("../auth/jwt.zig").JWT;
const AuthMiddleware = @import("auth.zig").AuthMiddleware;
const AuthUser = @import("auth.zig").AuthUser;
const Database = @import("../database.zig").Database;
const User = @import("../modules/users/model.zig").User;

/// Helper to authenticate and verify admin access
pub fn requireAdmin(
    db: *Database,
    jwt: *const JWT,
    allocator: std.mem.Allocator,
    req: *httpz.Request,
    res: *httpz.Response,
) !AuthUser {
    var auth_mw = AuthMiddleware.init(jwt, allocator);
    var auth_user = auth_mw.authenticate(req, res) catch |err| {
        return err;
    };
    errdefer auth_user.deinit(allocator);
    
    // Check admin status using a minimal row struct to avoid schema mismatches
    // This is a fix for a bug that surfaced once we a call to requireAdmin from the admin-users route.
    const Row = struct {
        id: i64,
        is_admin: i64, // since SQLite does not have a BOOLEAN storage class, we use INTEGER 0/1
    };

    const maybe_row = db.db.oneAlloc(
        Row,
        allocator,
        "SELECT id, is_admin FROM users WHERE id = ?",
        .{},
        .{auth_user.user_id},
    ) catch null;
    
    const row = maybe_row orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found" }, .{});
        return error.UserNotFound;
    };

    if (row.is_admin == 0) {
        res.status = 403;
        try res.json(.{ .@"error" = "Forbidden: Admin access required" }, .{});
        return error.Forbidden;
    }
    
    return auth_user;
}

/// Helper to just authenticate a user
pub fn requireAuth(
    jwt: *const JWT,
    allocator: std.mem.Allocator,
    req: *httpz.Request,
    res: *httpz.Response,
) !AuthUser {
    var auth_mw = AuthMiddleware.init(jwt, allocator);
    return try auth_mw.authenticate(req, res);
}
