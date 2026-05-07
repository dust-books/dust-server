const std = @import("std");
const httpz = @import("httpz");
const Database = @import("../../../database.zig").Database;
const JWT = @import("../../../auth/jwt.zig").JWT;
const middleware_helpers = @import("../../../middleware/helpers.zig");
const invitation = @import("../invitation.zig");

const AdminUser = struct {
    id: i64,
    username: ?[]const u8,
    email: []const u8,
    is_admin: bool,
    created_at: []const u8,
};

pub fn listUsers(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(allocator);

    _ = try req.query();
    const page: u32 = 1;
    const limit: u32 = 20;
    const offset: u32 = (page - 1) * limit;

    var users = std.ArrayList(AdminUser).empty;

    var rows = try db.db.rows(
        "SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
        .{ limit, offset },
    );
    defer rows.deinit();
    while (rows.next()) |row| {
        try users.append(res.arena, .{
            .id = row.int(0),
            .username = row.nullableText(1),
            .email = row.text(2),
            .is_admin = row.int(3) != 0,
            .created_at = row.text(4),
        });
    }
    if (rows.err) |err| return err;

    const total = blk: {
        const row = try db.db.row("SELECT COUNT(*) FROM users", .{}) orelse break :blk @as(i64, 0);
        defer row.deinit();
        break :blk row.int(0);
    };

    try res.json(.{
        .users = users.items,
        .pagination = .{
            .page = page,
            .limit = limit,
            .total = total,
            .pages = @divTrunc(total + @as(i64, @intCast(limit)) - 1, @as(i64, @intCast(limit))),
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

    const row = try db.db.row(
        "SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?",
        .{id},
    ) orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found" }, .{});
        return;
    };
    defer row.deinit();

    try res.json(.{ .user = AdminUser{
        .id = row.int(0),
        .username = row.nullableText(1),
        .email = row.text(2),
        .is_admin = row.int(3) != 0,
        .created_at = row.text(4),
    } }, .{});
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

    if (body.username != null and body.email != null and body.is_admin != null) {
        try db.db.exec("UPDATE users SET username = ?, email = ?, is_admin = ? WHERE id = ?", .{ body.username.?, body.email.?, body.is_admin.?, id });
    } else if (body.username != null and body.email != null) {
        try db.db.exec("UPDATE users SET username = ?, email = ? WHERE id = ?", .{ body.username.?, body.email.?, id });
    } else if (body.username != null and body.is_admin != null) {
        try db.db.exec("UPDATE users SET username = ?, is_admin = ? WHERE id = ?", .{ body.username.?, body.is_admin.?, id });
    } else if (body.email != null and body.is_admin != null) {
        try db.db.exec("UPDATE users SET email = ?, is_admin = ? WHERE id = ?", .{ body.email.?, body.is_admin.?, id });
    } else if (body.username != null) {
        try db.db.exec("UPDATE users SET username = ? WHERE id = ?", .{ body.username.?, id });
    } else if (body.email != null) {
        try db.db.exec("UPDATE users SET email = ? WHERE id = ?", .{ body.email.?, id });
    } else if (body.is_admin != null) {
        try db.db.exec("UPDATE users SET is_admin = ? WHERE id = ?", .{ body.is_admin.?, id });
    }

    const row = try db.db.row(
        "SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?",
        .{id},
    ) orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found after update" }, .{});
        return;
    };
    defer row.deinit();

    try res.json(.{ .user = AdminUser{
        .id = row.int(0),
        .username = row.nullableText(1),
        .email = row.text(2),
        .is_admin = row.int(3) != 0,
        .created_at = row.text(4),
    } }, .{});
}

pub fn deleteUser(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user_token = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user_token.deinit(allocator);

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

    if (id == auth_user_token.user_id) {
        res.status = 400;
        try res.json(.{ .@"error" = "Cannot delete your own account" }, .{});
        return;
    }

    const exists = try db.db.row("SELECT id FROM users WHERE id = ?", .{id});
    if (exists) |row| {
        row.deinit();
    } else {
        res.status = 404;
        try res.json(.{ .@"error" = "User not found" }, .{});
        return;
    }

    try db.db.exec("DELETE FROM users WHERE id = ?", .{id});

    try res.json(.{ .message = "User deleted successfully" }, .{});
}

pub fn createInvitationToken(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(allocator);

    const Body = struct {
        email: []const u8,
    };

    const body_opt = try req.json(Body);
    const body = body_opt orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid request body" }, .{});
        return;
    };

    if (body.email.len == 0) {
        res.status = 400;
        try res.json(.{ .@"error" = "Email is required" }, .{});
        return;
    }

    const token = invitation.generateToken(allocator, jwt.secret, body.email) catch |err| {
        std.log.err("Failed to generate invitation token: {} ({s})", .{ err, @errorName(err) });
        res.status = 500;
        try res.json(.{ .@"error" = "Failed to generate invitation token" }, .{});
        return;
    };
    defer allocator.free(token);

    try res.json(.{ .token = token }, .{});
}

pub fn getAuthSettings(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(allocator);

    const row = try db.db.row("SELECT auth_flow FROM server_settings WHERE id = 1", .{});

    if (row) |r| {
        defer r.deinit();
        try res.json(.{ .auth_flow = r.text(0) }, .{});
    } else {
        try res.json(.{ .auth_flow = "signup" }, .{});
    }
}

pub fn updateAuthSettings(db: *Database, jwt: *const JWT, allocator: std.mem.Allocator, req: *httpz.Request, res: *httpz.Response) !void {
    var auth_user = middleware_helpers.requireAdmin(db, jwt, allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(allocator);

    const Body = struct {
        auth_flow: []const u8,
    };

    const body_opt = try req.json(Body);
    const body = body_opt orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid request body" }, .{});
        return;
    };

    if (!std.mem.eql(u8, body.auth_flow, "signup") and !std.mem.eql(u8, body.auth_flow, "invitation")) {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid auth_flow value" }, .{});
        return;
    }

    try db.db.exec(
        \\INSERT INTO server_settings (id, auth_flow, updated_at)
        \\VALUES (1, ?, CURRENT_TIMESTAMP)
        \\ON CONFLICT(id) DO UPDATE SET
        \\  auth_flow = excluded.auth_flow,
        \\  updated_at = excluded.updated_at
    , .{body.auth_flow});

    try res.json(.{ .auth_flow = body.auth_flow }, .{});
}
