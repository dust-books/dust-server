const std = @import("std");

/// Permission structure representing a specific action on a resource
pub const Permission = struct {
    id: i64,
    name: []const u8,
    description: ?[]const u8,
    resource: []const u8,
    action: []const u8,
    created_at: []const u8,
    
    pub fn deinit(self: *Permission, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        if (self.description) |desc| {
            allocator.free(desc);
        }
        allocator.free(self.resource);
        allocator.free(self.action);
        allocator.free(self.created_at);
    }
};

/// Role structure representing a named collection of permissions
pub const Role = struct {
    id: i64,
    name: []const u8,
    description: ?[]const u8,
    created_at: []const u8,
    
    pub fn deinit(self: *Role, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        if (self.description) |desc| {
            allocator.free(desc);
        }
        allocator.free(self.created_at);
    }
};

/// Junction table linking users to roles
pub const UserRole = struct {
    user_id: i64,
    role_id: i64,
    granted_at: []const u8,
    
    pub fn deinit(self: *UserRole, allocator: std.mem.Allocator) void {
        allocator.free(self.granted_at);
    }
};

/// Junction table linking roles to permissions
pub const RolePermission = struct {
    role_id: i64,
    permission_id: i64,
};

/// Direct user permission grants (overrides or special cases)
pub const UserPermission = struct {
    user_id: i64,
    permission_id: i64,
    resource_id: ?i64,
    granted_at: []const u8,
    
    pub fn deinit(self: *UserPermission, allocator: std.mem.Allocator) void {
        allocator.free(self.granted_at);
    }
};

/// Predefined permission names for type safety
pub const PermissionName = enum {
    // Books
    books_read,
    books_write,
    books_delete,
    books_manage,
    
    // Genres
    genres_read,
    genres_write,
    genres_manage,
    
    // Users
    users_read,
    users_write,
    users_delete,
    users_manage,
    
    // Admin
    admin_full,
    admin_users,
    admin_roles,
    system_admin,
    system_config,
    
    // Content filtering
    content_nsfw,
    content_restricted,
    
    pub fn toString(self: PermissionName) []const u8 {
        return switch (self) {
            .books_read => "books.read",
            .books_write => "books.write",
            .books_delete => "books.delete",
            .books_manage => "books.manage",
            .genres_read => "genres.read",
            .genres_write => "genres.write",
            .genres_manage => "genres.manage",
            .users_read => "users.read",
            .users_write => "users.write",
            .users_delete => "users.delete",
            .users_manage => "users.manage",
            .admin_full => "admin.full",
            .admin_users => "admin.users",
            .admin_roles => "admin.roles",
            .system_admin => "system.admin",
            .system_config => "system.config",
            .content_nsfw => "content.nsfw",
            .content_restricted => "content.restricted",
        };
    }
    
    pub fn fromString(str: []const u8) ?PermissionName {
        const map = std.ComptimeStringMap(PermissionName, .{
            .{ "books.read", .books_read },
            .{ "books.write", .books_write },
            .{ "books.delete", .books_delete },
            .{ "books.manage", .books_manage },
            .{ "genres.read", .genres_read },
            .{ "genres.write", .genres_write },
            .{ "genres.manage", .genres_manage },
            .{ "users.read", .users_read },
            .{ "users.write", .users_write },
            .{ "users.delete", .users_delete },
            .{ "users.manage", .users_manage },
            .{ "admin.full", .admin_full },
            .{ "admin.users", .admin_users },
            .{ "admin.roles", .admin_roles },
            .{ "system.admin", .system_admin },
            .{ "system.config", .system_config },
            .{ "content.nsfw", .content_nsfw },
            .{ "content.restricted", .content_restricted },
        });
        return map.get(str);
    }
};

/// Resource types that permissions can apply to
pub const ResourceType = enum {
    book,
    genre,
    user,
    system,
    content,
    
    pub fn toString(self: ResourceType) []const u8 {
        return switch (self) {
            .book => "book",
            .genre => "genre",
            .user => "user",
            .system => "system",
            .content => "content",
        };
    }
    
    pub fn fromString(str: []const u8) ?ResourceType {
        const map = std.ComptimeStringMap(ResourceType, .{
            .{ "book", .book },
            .{ "genre", .genre },
            .{ "user", .user },
            .{ "system", .system },
            .{ "content", .content },
        });
        return map.get(str);
    }
};

/// Predefined role names
pub const RoleName = enum {
    admin,
    librarian,
    user,
    guest,
    
    pub fn toString(self: RoleName) []const u8 {
        return switch (self) {
            .admin => "admin",
            .librarian => "librarian",
            .user => "user",
            .guest => "guest",
        };
    }
    
    pub fn fromString(str: []const u8) ?RoleName {
        const map = std.ComptimeStringMap(RoleName, .{
            .{ "admin", .admin },
            .{ "librarian", .librarian },
            .{ "user", .user },
            .{ "guest", .guest },
        });
        return map.get(str);
    }
};
