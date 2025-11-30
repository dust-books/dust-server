const std = @import("std");
const httpz = @import("httpz");
const UserRepository = @import("../modules/users/model.zig").UserRepository;
const PermissionService = @import("../auth/permission_service.zig").PermissionService;
const PermissionRepository = @import("../auth/permission_repository.zig").PermissionRepository;
const User = @import("../modules/users/model.zig").User;
const Role = @import("../auth/permissions.zig").Role;
const RoleName = @import("../auth/permissions.zig").RoleName;

pub const AdminController = struct {
    allocator: std.mem.Allocator,
    user_repo: *UserRepository,
    permission_repo: *PermissionRepository,
    permission_service: *PermissionService,

    pub fn init(
        allocator: std.mem.Allocator,
        user_repo: *UserRepository,
        permission_repo: *PermissionRepository,
        permission_service: *PermissionService,
    ) AdminController {
        return .{
            .allocator = allocator,
            .user_repo = user_repo,
            .permission_repo = permission_repo,
            .permission_service = permission_service,
        };
    }

    // GET /admin/users - List all users
    pub fn listUsers(self: *AdminController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        const users = try self.user_repo.listUsers(self.allocator);
        defer {
            for (users) |user| {
                user.deinit(self.allocator);
            }
            self.allocator.free(users);
        }

        var json_users = std.ArrayListUnmanaged(u8){};
        defer json_users.deinit(self.allocator);
        const writer = json_users.writer(self.allocator);

        try writer.writeAll("[");
        for (users, 0..) |user, i| {
            if (i > 0) try writer.writeAll(",");

            const roles = try self.permission_repo.getUserRoles(self.allocator, user.id);
            defer {
                for (roles) |role| {
                    role.deinit(self.allocator);
                }
                self.allocator.free(roles);
            }

            try writer.writeAll("{");
            try writer.print("\"id\":{d},", .{user.id});
            try writer.print("\"username\":\"{s}\",", .{user.username});
            try writer.print("\"email\":\"{s}\",", .{user.email});
            try writer.print("\"created_at\":\"{s}\",", .{user.created_at});

            try writer.writeAll("\"roles\":[");
            for (roles, 0..) |role, j| {
                if (j > 0) try writer.writeAll(",");
                try writer.print("{{\"id\":{d},\"name\":\"{s}\"}}", .{ role.id, role.name });
            }
            try writer.writeAll("]");
            try writer.writeAll("}");
        }
        try writer.writeAll("]");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_users.items);
    }

    // PUT /admin/users/:id - Update user details
    pub fn updateUser(self: *AdminController, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing user ID\"}";
            return;
        };

        const user_id = std.fmt.parseInt(i64, user_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid user ID\"}";
            return;
        };

        const existing_user = self.user_repo.getUserById(self.allocator, user_id) catch |err| {
            if (err == error.UserNotFound) {
                res.status = 404;
                res.body = "{\"error\":\"User not found\"}";
                return;
            }
            return err;
        };
        defer existing_user.deinit(self.allocator);

        const body = req.body() orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing request body\"}";
            return;
        };

        var parsed = std.json.parseFromSlice(
            struct { username: ?[]const u8 = null, email: ?[]const u8 = null },
            self.allocator,
            body,
            .{ .ignore_unknown_fields = true },
        ) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid JSON\"}";
            return;
        };
        defer parsed.deinit();

        const new_username = parsed.value.username orelse existing_user.username;
        const new_email = parsed.value.email orelse existing_user.email;

        try self.user_repo.updateUser(user_id, new_username, new_email);

        var json_response = std.ArrayListUnmanaged(u8){};
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("{\"message\":\"User updated successfully\",\"user\":{");
        try writer.print("\"id\":{d},", .{user_id});
        try writer.print("\"username\":\"{s}\",", .{new_username});
        try writer.print("\"email\":\"{s}\"", .{new_email});
        try writer.writeAll("}}");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // DELETE /admin/users/:id - Delete user
    pub fn deleteUser(self: *AdminController, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing user ID\"}";
            return;
        };

        const user_id = std.fmt.parseInt(i64, user_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid user ID\"}";
            return;
        };

        _ = self.user_repo.getUserById(self.allocator, user_id) catch |err| {
            if (err == error.UserNotFound) {
                res.status = 404;
                res.body = "{\"error\":\"User not found\"}";
                return;
            }
            return err;
        };

        try self.user_repo.deleteUser(user_id);

        res.status = 200;
        res.content_type = .JSON;
        res.body = "{\"message\":\"User deleted successfully\"}";
    }

    // POST /admin/users/:id/roles - Assign role to user
    pub fn assignRole(self: *AdminController, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing user ID\"}";
            return;
        };

        const user_id = std.fmt.parseInt(i64, user_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid user ID\"}";
            return;
        };

        const body = req.body() orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing request body\"}";
            return;
        };

        var parsed = std.json.parseFromSlice(
            struct { role_name: []const u8 },
            self.allocator,
            body,
            .{ .ignore_unknown_fields = true },
        ) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid JSON\"}";
            return;
        };
        defer parsed.deinit();

        const role_name = RoleName.fromString(parsed.value.role_name) orelse {
            res.status = 400;
            res.body = "{\"error\":\"Invalid role name\"}";
            return;
        };

        const role = try self.permission_repo.getRoleByName(self.allocator, role_name);
        defer role.deinit(self.allocator);

        try self.permission_service.assignRoleToUser(user_id, role.id);

        res.status = 200;
        res.content_type = .JSON;
        var json_response = std.ArrayListUnmanaged(u8){};
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.print("{{\"message\":\"Role '{s}' assigned to user successfully\"}}", .{parsed.value.role_name});

        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // DELETE /admin/users/:id/roles/:role_id - Remove role from user
    pub fn removeRole(self: *AdminController, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing user ID\"}";
            return;
        };

        const role_id_str = req.param("role_id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing role ID\"}";
            return;
        };

        const user_id = std.fmt.parseInt(i64, user_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid user ID\"}";
            return;
        };

        const role_id = std.fmt.parseInt(i64, role_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid role ID\"}";
            return;
        };

        try self.permission_service.removeRoleFromUser(user_id, role_id);

        res.status = 200;
        res.content_type = .JSON;
        res.body = "{\"message\":\"Role removed from user successfully\"}";
    }

    // GET /admin/roles - List all roles with their permissions
    pub fn listRoles(self: *AdminController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        const roles = try self.permission_repo.listRoles(self.allocator);
        defer {
            for (roles) |role| {
                role.deinit(self.allocator);
            }
            self.allocator.free(roles);
        }

        var json_roles = std.ArrayListUnmanaged(u8){};
        defer json_roles.deinit(self.allocator);
        const writer = json_roles.writer(self.allocator);

        try writer.writeAll("[");
        for (roles, 0..) |role, i| {
            if (i > 0) try writer.writeAll(",");

            try writer.writeAll("{");
            try writer.print("\"id\":{d},", .{role.id});
            try writer.print("\"name\":\"{s}\",", .{role.name});
            try writer.print("\"description\":\"{s}\",", .{role.description});
            try writer.print("\"created_at\":\"{s}\"", .{role.created_at});
            try writer.writeAll("}");
        }
        try writer.writeAll("]");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_roles.items);
    }

    pub fn deinit(self: *AdminController) void {
        _ = self;
    }
};
