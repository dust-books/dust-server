const std = @import("std");
const sqlite = @import("sqlite");
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

    /// Get all permissions for a user (via roles and direct grants)
    pub fn getUserPermissions(self: *PermissionRepository, user_id: i64) !std.ArrayList(Permission) {
        var perms: std.ArrayList(Permission) = .empty;
        errdefer perms.deinit(self.allocator);

        const query =
            \\SELECT DISTINCT p.id, p.name, p.description, p.resource, p.action, p.created_at
            \\FROM permissions p
            \\LEFT JOIN role_permissions rp ON p.id = rp.permission_id
            \\LEFT JOIN user_roles ur ON rp.role_id = ur.role_id
            \\WHERE ur.user_id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, user_id);

        while (try stmt.step()) {
            const perm = try Permission.init(
                self.allocator,
                stmt.columnInt64(0),
                stmt.columnText(1),
                if (stmt.columnIsNull(2)) null else stmt.columnText(2),
                stmt.columnText(3),
                stmt.columnText(4),
                stmt.columnText(5),
            );
            try perms.append(self.allocator, perm);
        }

        return perms;
    }

    /// Check if user has a specific permission
    pub fn userHasPermission(self: *PermissionRepository, user_id: i64, permission_name: []const u8) !bool {
        const query =
            \\SELECT COUNT(*) 
            \\FROM permissions p
            \\LEFT JOIN role_permissions rp ON p.id = rp.permission_id
            \\LEFT JOIN user_roles ur ON rp.role_id = ur.role_id
            \\WHERE ur.user_id = ? AND p.name = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, user_id);
        try stmt.bind(2, permission_name);

        if (try stmt.step()) {
            return stmt.columnInt64(0) > 0;
        }

        return false;
    }

    /// Get all roles for a user
    pub fn getUserRoles(self: *PermissionRepository, user_id: i64) !std.ArrayList(Role) {
        var roles: std.ArrayList(Role) = .empty;
        errdefer roles.deinit(self.allocator);

        const query =
            \\SELECT r.id, r.name, r.description, r.created_at
            \\FROM roles r
            \\INNER JOIN user_roles ur ON r.id = ur.role_id
            \\WHERE ur.user_id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, user_id);

        while (try stmt.step()) {
            const role = try Role.init(
                self.allocator,
                stmt.columnInt64(0),
                stmt.columnText(1),
                if (stmt.columnIsNull(2)) null else stmt.columnText(2),
                stmt.columnText(3),
            );
            try roles.append(self.allocator, role);
        }

        return roles;
    }

    /// Assign a role to a user
    pub fn assignRoleToUser(self: *PermissionRepository, user_id: i64, role_id: i64) !void {
        const query = "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, user_id);
        try stmt.bind(2, role_id);
        try stmt.exec();
    }

    /// Remove a role from a user
    pub fn removeRoleFromUser(self: *PermissionRepository, user_id: i64, role_id: i64) !void {
        const query = "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, user_id);
        try stmt.bind(2, role_id);
        try stmt.exec();
    }

    /// Get role by ID
    pub fn getRoleById(self: *PermissionRepository, role_id: i64) !?Role {
        const query = "SELECT id, name, description, created_at FROM roles WHERE id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, role_id);

        if (try stmt.step()) {
            return try Role.init(
                self.allocator,
                stmt.columnInt64(0),
                stmt.columnText(1),
                if (stmt.columnIsNull(2)) null else stmt.columnText(2),
                stmt.columnText(3),
            );
        }

        return null;
    }

    /// Get role by name
    pub fn getRoleByName(self: *PermissionRepository, name: []const u8) !?Role {
        const query = "SELECT id, name, description, created_at FROM roles WHERE name = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, name);

        if (try stmt.step()) {
            return try Role.init(
                self.allocator,
                stmt.columnInt64(0),
                stmt.columnText(1),
                if (stmt.columnIsNull(2)) null else stmt.columnText(2),
                stmt.columnText(3),
            );
        }

        return null;
    }

    /// List all roles
    pub fn listRoles(self: *PermissionRepository) !std.ArrayList(Role) {
        var roles: std.ArrayList(Role) = .empty;
        errdefer roles.deinit(self.allocator);

        const query = "SELECT id, name, description, created_at FROM roles ORDER BY name";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        while (try stmt.step()) {
            const role = try Role.init(
                self.allocator,
                stmt.columnInt64(0),
                stmt.columnText(1),
                if (stmt.columnIsNull(2)) null else stmt.columnText(2),
                stmt.columnText(3),
            );
            try roles.append(self.allocator, role);
        }

        return roles;
    }

    /// Create a new permission
    pub fn createPermission(self: *PermissionRepository, name: []const u8, resource: []const u8, action: []const u8, description: ?[]const u8) !i64 {
        const query = "INSERT INTO permissions (name, resource, action, description) VALUES (?, ?, ?, ?) RETURNING id";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, name);
        try stmt.bind(2, resource);
        try stmt.bind(3, action);
        if (description) |desc| {
            try stmt.bind(4, desc);
        } else {
            try stmt.bindNull(4);
        }

        if (try stmt.step()) {
            return stmt.columnInt64(0);
        }

        return error.FailedToCreatePermission;
    }

    /// Assign permission to role
    pub fn assignPermissionToRole(self: *PermissionRepository, role_id: i64, permission_id: i64) !void {
        const query = "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, role_id);
        try stmt.bind(2, permission_id);
        try stmt.exec();
    }
};
