const std = @import("std");
const httpz = @import("httpz");
const Database = @import("../../../database.zig").Database;
const User = @import("../model.zig").User;
const JWT = @import("../../../auth/jwt.zig").JWT;
const middleware_helpers = @import("../../../middleware/helpers.zig");

pub fn listUsers(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(allocator);
    
    // TODO: Add pagination support
    _ = try req.query();
    const page: u32 = 1;
    const limit: u32 = 20;
    const offset: u32 = (page - 1) * limit;
    
    // Get users with pagination
    var stmt = try db.db.prepare("SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?");
    defer stmt.deinit();
    
    const users_slice = try stmt.all(User, allocator, .{}, .{ limit, offset });
    
    // Get total count
    const CountResult = struct { count: i64 };
    var count_stmt = try db.db.prepare("SELECT COUNT(*) as count FROM users");
    defer count_stmt.deinit();
    const total = (try count_stmt.one(CountResult, .{}, .{})) orelse CountResult{ .count = 0 };
    
    defer allocator.free(users_slice);
    
    try res.json(.{
        .users = users_slice,
        .pagination = .{
            .page = page,
            .limit = limit,
            .total = total.count,
            .pages = @divTrunc(total.count + @as(i64, @intCast(limit)) - 1, @as(i64, @intCast(limit))),
        },
    }, .{});
}

pub fn getUser(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(allocator);
    
    const user_id = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing user ID" }, .{});
        return;
    };
    
    const id = std.fmt.parseInt(i64, user_id, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid user ID" }, .{});
        return;
    };
    
    var stmt = try db.db.prepare("SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?");
    defer stmt.deinit();
    
    const found_user = try stmt.oneAlloc(User, allocator, .{}, .{id}) orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found" }, .{});
        return;
    };
    
    try res.json(.{ .user = found_user }, .{});
}

pub fn updateUser(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(allocator);
    
    const user_id = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing user ID" }, .{});
        return;
    };
    
    const id = std.fmt.parseInt(i64, user_id, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid user ID" }, .{});
        return;
    };
    
    // Parse request body
    const body_opt = try req.json(struct {
        username: ?[]const u8 = null,
        email: ?[]const u8 = null,
        is_admin: ?bool = null,
    });
    
    const body = body_opt orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid request body" }, .{});
        return;
    };
    
    if (body.username == null and body.email == null and body.is_admin == null) {
        res.status = 400;
        try res.json(.{ .@"error" = "No fields to update" }, .{});
        return;
    }
    
    // Simple update based on what's provided
    if (body.username != null and body.email != null and body.is_admin != null) {
        var stmt = try db.db.prepare("UPDATE users SET username = ?, email = ?, is_admin = ? WHERE id = ?");
        defer stmt.deinit();
        try stmt.exec(.{}, .{ body.username.?, body.email.?, body.is_admin.?, id });
    } else if (body.username != null and body.email != null) {
        var stmt = try db.db.prepare("UPDATE users SET username = ?, email = ? WHERE id = ?");
        defer stmt.deinit();
        try stmt.exec(.{}, .{ body.username.?, body.email.?, id });
    } else if (body.username != null and body.is_admin != null) {
        var stmt = try db.db.prepare("UPDATE users SET username = ?, is_admin = ? WHERE id = ?");
        defer stmt.deinit();
        try stmt.exec(.{}, .{ body.username.?, body.is_admin.?, id });
    } else if (body.email != null and body.is_admin != null) {
        var stmt = try db.db.prepare("UPDATE users SET email = ?, is_admin = ? WHERE id = ?");
        defer stmt.deinit();
        try stmt.exec(.{}, .{ body.email.?, body.is_admin.?, id });
    } else if (body.username != null) {
        var stmt = try db.db.prepare("UPDATE users SET username = ? WHERE id = ?");
        defer stmt.deinit();
        try stmt.exec(.{}, .{ body.username.?, id });
    } else if (body.email != null) {
        var stmt = try db.db.prepare("UPDATE users SET email = ? WHERE id = ?");
        defer stmt.deinit();
        try stmt.exec(.{}, .{ body.email.?, id });
    } else if (body.is_admin != null) {
        var stmt = try db.db.prepare("UPDATE users SET is_admin = ? WHERE id = ?");
        defer stmt.deinit();
        try stmt.exec(.{}, .{ body.is_admin.?, id });
    }
    
    // Fetch updated user
    var get_stmt = try db.db.prepare("SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?");
    defer get_stmt.deinit();
    
    const found_user = try get_stmt.oneAlloc(User, allocator, .{}, .{id}) orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found after update" }, .{});
        return;
    };
    
    try res.json(.{ .user = found_user }, .{});
}

pub fn deleteUser(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user_token = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user_token.deinit(allocator);
    
    // Get auth user details for self-deletion check
    const maybe_user = db.db.oneAlloc(User, allocator, "SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?", .{}, .{auth_user_token.user_id}) catch null;
    const auth_user = maybe_user orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found" }, .{});
        return;
    };
    
    const user_id = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing user ID" }, .{});
        return;
    };
    
    const id = std.fmt.parseInt(i64, user_id, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid user ID" }, .{});
        return;
    };
    
    // Prevent deleting yourself
    if (id == auth_user.id) {
        res.status = 400;
        try res.json(.{ .@"error" = "Cannot delete your own account" }, .{});
        return;
    }
    
    // Check if user exists
    var check_stmt = try db.db.prepare("SELECT id FROM users WHERE id = ?");
    defer check_stmt.deinit();
    
    const exists = try check_stmt.oneAlloc(struct { id: i64 }, allocator, .{}, .{id});
    if (exists == null) {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found" }, .{});
        return;
    }
    
    // Delete user
    var stmt = try db.db.prepare("DELETE FROM users WHERE id = ?");
    defer stmt.deinit();
    try stmt.exec(.{}, .{id});
    
    try res.json(.{ .message = "User deleted successfully" }, .{});
}
