const std = @import("std");
const zqlite = @import("zqlite");
const Database = @import("../database.zig").Database;
const permissions = @import("permissions.zig");
const Permission = permissions.Permission;
const Role = permissions.Role;
const UserRole = permissions.UserRole;

pub const PermissionRepository = struct {
    db: *Database,
    allocator: std.mem.Allocator,

    pub fn init(db: *Database, allocator: std.mem.Allocator) PermissionRepository {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn getUserPermissions(self: *PermissionRepository, user_id: i64) !std.ArrayList(Permission) {
        var perms: std.ArrayList(Permission) = .empty;
        errdefer {
            for (perms.items) |*perm| perm.deinit(self.allocator);
            perms.deinit(self.allocator);
        }

        const query =
            \\SELECT DISTINCT p.id, p.name, p.description, p.resource, p.action, p.created_at
            \\FROM permissions p
            \\LEFT JOIN role_permissions rp ON p.id = rp.permission_id
            \\LEFT JOIN user_roles ur ON rp.role_id = ur.role_id
            \\WHERE ur.user_id = ?
        ;

        var rows = try self.db.db.rows(query, .{user_id});
        defer rows.deinit();
        while (rows.next()) |row| {
            const perm = try Permission.init(
                self.allocator,
                row.int(0),
                row.text(1),
                row.nullableText(2),
                row.text(3),
                row.text(4),
                row.text(5),
            );
            try perms.append(self.allocator, perm);
        }
        if (rows.err) |err| return err;

        return perms;
    }

    pub fn userHasPermission(self: *PermissionRepository, user_id: i64, permission_name: []const u8) !bool {
        const query =
            \\SELECT COUNT(*)
            \\FROM permissions p
            \\LEFT JOIN role_permissions rp ON p.id = rp.permission_id
            \\LEFT JOIN user_roles ur ON rp.role_id = ur.role_id
            \\WHERE ur.user_id = ? AND p.name = ?
        ;

        const row = try self.db.db.row(query, .{ user_id, permission_name }) orelse return false;
        defer row.deinit();
        return row.int(0) > 0;
    }

    pub fn getUserRoles(self: *PermissionRepository, user_id: i64) !std.ArrayList(Role) {
        var roles: std.ArrayList(Role) = .empty;
        errdefer {
            for (roles.items) |*role| role.deinit(self.allocator);
            roles.deinit(self.allocator);
        }

        const query =
            \\SELECT r.id, r.name, r.description, r.created_at
            \\FROM roles r
            \\INNER JOIN user_roles ur ON r.id = ur.role_id
            \\WHERE ur.user_id = ?
        ;

        var rows = try self.db.db.rows(query, .{user_id});
        defer rows.deinit();
        while (rows.next()) |row| {
            const role = try Role.init(
                self.allocator,
                row.int(0),
                row.text(1),
                row.nullableText(2),
                row.text(3),
            );
            try roles.append(self.allocator, role);
        }
        if (rows.err) |err| return err;

        return roles;
    }

    pub fn assignRoleToUser(self: *PermissionRepository, user_id: i64, role_id: i64) !void {
        try self.db.db.exec(
            "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)",
            .{ user_id, role_id },
        );
    }

    pub fn removeRoleFromUser(self: *PermissionRepository, user_id: i64, role_id: i64) !void {
        try self.db.db.exec(
            "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
            .{ user_id, role_id },
        );
    }

    pub fn getRoleById(self: *PermissionRepository, role_id: i64) !?Role {
        const row = try self.db.db.row(
            "SELECT id, name, description, created_at FROM roles WHERE id = ?",
            .{role_id},
        ) orelse return null;
        defer row.deinit();
        return try Role.init(
            self.allocator,
            row.int(0),
            row.text(1),
            row.nullableText(2),
            row.text(3),
        );
    }

    pub fn getRoleByName(self: *PermissionRepository, name: []const u8) !?Role {
        const row = try self.db.db.row(
            "SELECT id, name, description, created_at FROM roles WHERE name = ?",
            .{name},
        ) orelse return null;
        defer row.deinit();
        return try Role.init(
            self.allocator,
            row.int(0),
            row.text(1),
            row.nullableText(2),
            row.text(3),
        );
    }

    pub fn listRoles(self: *PermissionRepository) !std.ArrayList(Role) {
        var roles: std.ArrayList(Role) = .empty;
        errdefer {
            for (roles.items) |*role| role.deinit(self.allocator);
            roles.deinit(self.allocator);
        }

        var rows = try self.db.db.rows(
            "SELECT id, name, description, created_at FROM roles ORDER BY name",
            .{},
        );
        defer rows.deinit();
        while (rows.next()) |row| {
            const role = try Role.init(
                self.allocator,
                row.int(0),
                row.text(1),
                row.nullableText(2),
                row.text(3),
            );
            try roles.append(self.allocator, role);
        }
        if (rows.err) |err| return err;

        return roles;
    }

    pub fn createPermission(self: *PermissionRepository, name: []const u8, resource: []const u8, action: []const u8, description: ?[]const u8) !i64 {
        const row = try self.db.db.row(
            "INSERT INTO permissions (name, resource, action, description) VALUES (?, ?, ?, ?) RETURNING id",
            .{ name, resource, action, description },
        ) orelse return error.FailedToCreatePermission;
        defer row.deinit();
        return row.int(0);
    }

    pub fn assignPermissionToRole(self: *PermissionRepository, role_id: i64, permission_id: i64) !void {
        try self.db.db.exec(
            "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
            .{ role_id, permission_id },
        );
    }
};
