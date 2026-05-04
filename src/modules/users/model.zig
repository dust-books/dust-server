const std = @import("std");
const zqlite = @import("zqlite");
const Database = @import("../../database.zig").Database;

pub const User = struct {
    id: i64,
    email: []const u8,
    username: ?[]const u8,
    password_hash: []const u8,
    is_admin: bool,
    created_at: []const u8,
    updated_at: []const u8,

    pub fn deinit(self: *User, allocator: std.mem.Allocator) void {
        allocator.free(self.email);
        if (self.username) |username| allocator.free(username);
        allocator.free(self.password_hash);
        allocator.free(self.created_at);
        allocator.free(self.updated_at);
    }
};

pub const UserRepository = struct {
    db: *Database,
    allocator: std.mem.Allocator,

    pub fn init(db: *Database, allocator: std.mem.Allocator) UserRepository {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn create(self: *UserRepository, email: []const u8, password_hash: []const u8, username: ?[]const u8, is_admin: bool) !i64 {
        const query =
            \\INSERT INTO users (email, password_hash, username, is_admin)
            \\VALUES (?, ?, ?, ?)
            \\RETURNING id
        ;

        const row = try self.db.db.row(query, .{ email, password_hash, username, @as(i64, if (is_admin) 1 else 0) }) orelse return error.InsertFailed;
        defer row.deinit();
        return row.int(0);
    }

    pub fn findByEmail(self: *UserRepository, email: []const u8) !?User {
        const query =
            \\SELECT id, email, username, password_hash, is_admin, created_at, updated_at
            \\FROM users WHERE email = ?
        ;

        const row = try self.db.db.row(query, .{email}) orelse return null;
        defer row.deinit();
        return User{
            .id = row.int(0),
            .email = try self.allocator.dupe(u8, row.text(1)),
            .username = if (row.nullableText(2)) |s| try self.allocator.dupe(u8, s) else null,
            .password_hash = try self.allocator.dupe(u8, row.text(3)),
            .is_admin = row.int(4) != 0,
            .created_at = try self.allocator.dupe(u8, row.text(5)),
            .updated_at = try self.allocator.dupe(u8, row.text(6)),
        };
    }

    pub fn findById(self: *UserRepository, id: i64) !?User {
        const query =
            \\SELECT id, email, username, password_hash, is_admin, created_at, updated_at
            \\FROM users WHERE id = ?
        ;

        const row = try self.db.db.row(query, .{id}) orelse return null;
        defer row.deinit();
        return User{
            .id = row.int(0),
            .email = try self.allocator.dupe(u8, row.text(1)),
            .username = if (row.nullableText(2)) |s| try self.allocator.dupe(u8, s) else null,
            .password_hash = try self.allocator.dupe(u8, row.text(3)),
            .is_admin = row.int(4) != 0,
            .created_at = try self.allocator.dupe(u8, row.text(5)),
            .updated_at = try self.allocator.dupe(u8, row.text(6)),
        };
    }

    pub fn assignRole(self: *UserRepository, user_id: i64, role_name: []const u8) !void {
        try self.db.db.exec(
            \\INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?
        , .{ user_id, role_name });
    }

    pub fn countUsers(self: *UserRepository) !i64 {
        const row = try self.db.db.row("SELECT COUNT(*) FROM users", .{}) orelse return 0;
        defer row.deinit();
        return row.int(0);
    }

    pub fn listUsers(self: *UserRepository) ![]User {
        const query =
            \\SELECT id, email, username, password_hash, is_admin, created_at, updated_at
            \\FROM users ORDER BY created_at DESC
        ;

        var users: std.ArrayList(User) = .empty;
        errdefer {
            for (users.items) |*user| user.deinit(self.allocator);
            users.deinit();
        }

        var rows = try self.db.db.rows(query, .{});
        defer rows.deinit();
        while (rows.next()) |row| {
            try users.append(User{
                .id = row.int(0),
                .email = try self.allocator.dupe(u8, row.text(1)),
                .username = if (row.nullableText(2)) |s| try self.allocator.dupe(u8, s) else null,
                .password_hash = try self.allocator.dupe(u8, row.text(3)),
                .is_admin = row.int(4) != 0,
                .created_at = try self.allocator.dupe(u8, row.text(5)),
                .updated_at = try self.allocator.dupe(u8, row.text(6)),
            });
        }
        if (rows.err) |err| return err;

        return users.toOwnedSlice();
    }

    pub fn updateUser(self: *UserRepository, user_id: i64, username: []const u8, email: []const u8) !void {
        try self.db.db.exec(
            \\UPDATE users SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        , .{ username, email, user_id });
    }

    pub fn deleteUser(self: *UserRepository, user_id: i64) !void {
        try self.db.db.exec("DELETE FROM users WHERE id = ?", .{user_id});
    }

    pub fn getUserById(self: *UserRepository, user_id: i64) !User {
        const user = try self.findById(user_id);
        return user orelse error.UserNotFound;
    }
};
