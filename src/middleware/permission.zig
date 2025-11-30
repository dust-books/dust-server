const std = @import("std");
const httpz = @import("httpz");
const PermissionService = @import("../auth/permission_service.zig").PermissionService;
const AuthMiddleware = @import("auth.zig").AuthMiddleware;

pub const PermissionMiddleware = struct {
    auth_mw: *AuthMiddleware,
    perm_service: *PermissionService,
    allocator: std.mem.Allocator,
    
    pub fn init(auth_mw: *AuthMiddleware, perm_service: *PermissionService, allocator: std.mem.Allocator) PermissionMiddleware {
        return .{
            .auth_mw = auth_mw,
            .perm_service = perm_service,
            .allocator = allocator,
        };
    }
    
    /// Require a specific permission
    pub fn requirePermission(
        self: *PermissionMiddleware,
        req: *httpz.Request,
        res: *httpz.Response,
        permission_name: []const u8,
    ) !void {
        // First authenticate the user
        var auth_user = self.auth_mw.authenticate(req, res) catch |err| {
            return err;
        };
        defer auth_user.deinit(self.allocator);
        
        // Check if user has the required permission
        const has_perm = self.perm_service.hasPermission(auth_user.user_id, permission_name) catch {
            res.status = 500;
            try res.json(.{ .message = "Failed to check permissions" }, .{});
            return error.PermissionCheckFailed;
        };
        
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ 
                .message = "Forbidden: Insufficient permissions",
                .required_permission = permission_name,
            }, .{});
            return error.Forbidden;
        }
    }
    
    /// Require any of the given permissions
    pub fn requireAnyPermission(
        self: *PermissionMiddleware,
        req: *httpz.Request,
        res: *httpz.Response,
        permission_names: []const []const u8,
    ) !void {
        // First authenticate the user
        var auth_user = self.auth_mw.authenticate(req, res) catch |err| {
            return err;
        };
        defer auth_user.deinit(self.allocator);
        
        // Check if user has any of the required permissions
        const has_perm = self.perm_service.hasAnyPermission(auth_user.user_id, permission_names) catch {
            res.status = 500;
            try res.json(.{ .message = "Failed to check permissions" }, .{});
            return error.PermissionCheckFailed;
        };
        
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ 
                .message = "Forbidden: Insufficient permissions",
                .required_permissions = permission_names,
            }, .{});
            return error.Forbidden;
        }
    }
    
    /// Require all of the given permissions
    pub fn requireAllPermissions(
        self: *PermissionMiddleware,
        req: *httpz.Request,
        res: *httpz.Response,
        permission_names: []const []const u8,
    ) !void {
        // First authenticate the user
        var auth_user = self.auth_mw.authenticate(req, res) catch |err| {
            return err;
        };
        defer auth_user.deinit(self.allocator);
        
        // Check if user has all required permissions
        const has_perm = self.perm_service.hasAllPermissions(auth_user.user_id, permission_names) catch {
            res.status = 500;
            try res.json(.{ .message = "Failed to check permissions" }, .{});
            return error.PermissionCheckFailed;
        };
        
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ 
                .message = "Forbidden: Insufficient permissions",
                .required_permissions = permission_names,
            }, .{});
            return error.Forbidden;
        }
    }
    
    /// Require admin access
    pub fn requireAdmin(
        self: *PermissionMiddleware,
        req: *httpz.Request,
        res: *httpz.Response,
    ) !void {
        // First authenticate the user
        var auth_user = self.auth_mw.authenticate(req, res) catch |err| {
            return err;
        };
        defer auth_user.deinit(self.allocator);
        
        // Check if user is admin
        const is_admin = self.perm_service.isAdmin(auth_user.user_id) catch {
            res.status = 500;
            try res.json(.{ .message = "Failed to check admin status" }, .{});
            return error.PermissionCheckFailed;
        };
        
        if (!is_admin) {
            res.status = 403;
            try res.json(.{ 
                .message = "Forbidden: Admin access required",
            }, .{});
            return error.Forbidden;
        }
    }
};
