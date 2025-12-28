const std = @import("std");
const sqlite = @import("sqlite");
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

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        const result = try stmt.one(
            i64,
            .{},
            .{ email, password_hash, username, @as(i64, if (is_admin) 1 else 0) },
        );

        return result orelse error.InsertFailed;
    }

    pub fn findByEmail(self: *UserRepository, email: []const u8) !?User {
        const query =
            \\SELECT id, email, username, password_hash, is_admin, created_at, updated_at
            \\FROM users
            \\WHERE email = ?
        ;

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        const row = try stmt.oneAlloc(
            struct {
                id: i64,
                email: []const u8,
                username: ?[]const u8,
                password_hash: []const u8,
                is_admin: i64,
                created_at: []const u8,
                updated_at: []const u8,
            },
            self.allocator,
            .{},
            .{email},
        );

        if (row) |r| {
            defer {
                self.allocator.free(r.email);
                if (r.username) |username| self.allocator.free(username);
                self.allocator.free(r.password_hash);
                self.allocator.free(r.created_at);
                self.allocator.free(r.updated_at);
            }
            return User{
                .id = r.id,
                .email = try self.allocator.dupe(u8, r.email),
                .username = if (r.username) |un| try self.allocator.dupe(u8, un) else null,
                .password_hash = try self.allocator.dupe(u8, r.password_hash),
                .is_admin = r.is_admin != 0,
                .created_at = try self.allocator.dupe(u8, r.created_at),
                .updated_at = try self.allocator.dupe(u8, r.updated_at),
            };
        }

        return null;
    }

    pub fn findById(self: *UserRepository, id: i64) !?User {
        const query =
            \\SELECT id, email, username, password_hash, is_admin, created_at, updated_at
            \\FROM users
            \\WHERE id = ?
        ;

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        const row = try stmt.oneAlloc(
            struct {
                id: i64,
                email: []const u8,
                username: ?[]const u8,
                password_hash: []const u8,
                is_admin: i64,
                created_at: []const u8,
                updated_at: []const u8,
            },
            self.allocator,
            .{},
            .{id},
        );

        if (row) |r| {
            defer {
                self.allocator.free(r.email);
                if (r.username) |username| self.allocator.free(username);
                self.allocator.free(r.password_hash);
                self.allocator.free(r.created_at);
                self.allocator.free(r.updated_at);
            }
            return User{
                .id = r.id,
                .email = try self.allocator.dupe(u8, r.email),
                .username = if (r.username) |un| try self.allocator.dupe(u8, un) else null,
                .password_hash = try self.allocator.dupe(u8, r.password_hash),
                .is_admin = r.is_admin != 0,
                .created_at = try self.allocator.dupe(u8, r.created_at),
                .updated_at = try self.allocator.dupe(u8, r.updated_at),
            };
        }

        return null;
    }

    pub fn assignRole(self: *UserRepository, user_id: i64, role_name: []const u8) !void {
        const query =
            \\INSERT INTO user_roles (user_id, role_id)
            \\SELECT ?, id FROM roles WHERE name = ?
        ;

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ user_id, role_name });
    }

    pub fn countUsers(self: *UserRepository) !i64 {
        const query = "SELECT COUNT(*) FROM users";

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        const result = try stmt.one(i64, .{}, .{});
        return result orelse 0;
    }

    pub fn listUsers(self: *UserRepository) ![]User {
        const query =
            \\SELECT id, email, username, password_hash, is_admin, created_at, updated_at
            \\FROM users
            \\ORDER BY created_at DESC
        ;

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        var users: std.ArrayList(User) = .empty;
        errdefer {
            for (users.items) |*user| {
                user.deinit(self.allocator);
            }
            users.deinit();
        }

        var iter = try stmt.iterator(struct {
            id: i64,
            email: []const u8,
            username: ?[]const u8,
            password_hash: []const u8,
            is_admin: i64,
            created_at: []const u8,
            updated_at: []const u8,
        }, .{});

        while (try iter.nextAlloc(self.allocator, .{})) |row| {
            try users.append(User{
                .id = row.id,
                .email = try self.allocator.dupe(u8, row.email),
                .username = if (row.username) |un| try self.allocator.dupe(u8, un) else null,
                .password_hash = try self.allocator.dupe(u8, row.password_hash),
                .is_admin = row.is_admin != 0,
                .created_at = try self.allocator.dupe(u8, row.created_at),
                .updated_at = try self.allocator.dupe(u8, row.updated_at),
            });
        }

        return users.toOwnedSlice();
    }

    pub fn updateUser(self: *UserRepository, user_id: i64, username: []const u8, email: []const u8) !void {
        const query =
            \\UPDATE users 
            \\SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP
            \\WHERE id = ?
        ;

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ username, email, user_id });
    }

    pub fn deleteUser(self: *UserRepository, user_id: i64) !void {
        const query = "DELETE FROM users WHERE id = ?";

        var stmt = try self.db.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{user_id});
    }

    pub fn getUserById(self: *UserRepository, user_id: i64) !User {
        const user = try self.findById(user_id);
        return user orelse error.UserNotFound;
    }
};
