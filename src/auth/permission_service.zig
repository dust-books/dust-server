const std = @import("std");
const permissions = @import("permissions.zig");
const Permission = permissions.Permission;
const Role = permissions.Role;
const PermissionRepository = @import("permission_repository.zig").PermissionRepository;

/// Cache key for user permissions
const CacheKey = struct {
    user_id: i64,
    
    pub fn hash(self: CacheKey) u64 {
        return @intCast(@as(u64, @bitCast(self.user_id)));
    }
    
    pub fn eql(self: CacheKey, other: CacheKey) bool {
        return self.user_id == other.user_id;
    }
};

/// Cached permission set for a user
const PermissionCache = struct {
    permissions: std.StringHashMap(void),
    cached_at: i64,
    
    pub fn deinit(self: *PermissionCache, allocator: std.mem.Allocator) void {
        freePermissionMap(&self.permissions, allocator);
    }
};

fn freePermissionMap(map: *std.StringHashMap(void), allocator: std.mem.Allocator) void {
    var it = map.iterator();
    while (it.next()) |entry| {
        allocator.free(entry.key_ptr.*);
    }
    map.deinit();
}

pub const PermissionService = struct {
    repo: *PermissionRepository,
    allocator: std.mem.Allocator,
    cache: std.AutoHashMap(i64, PermissionCache),
    cache_ttl_seconds: i64,
    
    pub fn init(repo: *PermissionRepository, allocator: std.mem.Allocator) PermissionService {
        return .{
            .repo = repo,
            .allocator = allocator,
            .cache = std.AutoHashMap(i64, PermissionCache).init(allocator),
            .cache_ttl_seconds = 300, // 5 minutes default
        };
    }
    
    pub fn deinit(self: *PermissionService) void {
        var it = self.cache.valueIterator();
        while (it.next()) |cache_entry| {
            cache_entry.deinit(self.allocator);
        }
        self.cache.deinit();
    }
    
    /// Check if user has permission (with caching)
    pub fn hasPermission(self: *PermissionService, user_id: i64, permission_name: []const u8) !bool {
        // Try cache first
        if (try self.getCachedPermissions(user_id)) |perm_set| {
            return perm_set.contains(permission_name);
        }
        
        // Cache miss - load from database
        const perms = try self.repo.getUserPermissions(user_id);
        defer {
            for (perms.items) |*perm| {
                perm.deinit(self.allocator);
            }
            perms.deinit();
        }
        
        // Build cache
        var perm_set = std.StringHashMap(void).init(self.allocator);
        errdefer freePermissionMap(&perm_set, self.allocator);
        
        for (perms.items) |perm| {
            const name_copy = try self.allocator.dupe(u8, perm.name);
            try perm_set.put(name_copy, {});
        }
        
        const has_perm = perm_set.contains(permission_name);
        
        // Store in cache
        const now = std.time.timestamp();
        try self.cache.put(user_id, .{
            .permissions = perm_set,
            .cached_at = now,
        });
        
        return has_perm;
    }
    
    /// Get cached permissions if still valid
    fn getCachedPermissions(self: *PermissionService, user_id: i64) !?std.StringHashMap(void) {
        if (self.cache.get(user_id)) |cache_entry| {
            const now = std.time.timestamp();
            const age = now - cache_entry.cached_at;
            
            if (age < self.cache_ttl_seconds) {
                return cache_entry.permissions;
            }
            
            // Cache expired - remove it
            var entry = self.cache.fetchRemove(user_id).?;
            entry.value.deinit(self.allocator);
        }
        
        return null;
    }
    
    /// Invalidate cache for a user
    pub fn invalidateCache(self: *PermissionService, user_id: i64) void {
        if (self.cache.fetchRemove(user_id)) |entry| {
            var cache_entry = entry.value;
            cache_entry.deinit(self.allocator);
        }
    }
    
    /// Get all user permissions (bypasses cache, returns fresh data)
    pub fn getUserPermissions(self: *PermissionService, user_id: i64) !std.ArrayList(Permission) {
        return self.repo.getUserPermissions(user_id);
    }
    
    /// Get user roles
    pub fn getUserRoles(self: *PermissionService, user_id: i64) !std.ArrayList(Role) {
        return self.repo.getUserRoles(user_id);
    }
    
    /// Assign role to user and invalidate cache
    pub fn assignRoleToUser(self: *PermissionService, user_id: i64, role_id: i64) !void {
        try self.repo.assignRoleToUser(user_id, role_id);
        self.invalidateCache(user_id);
    }
    
    /// Remove role from user and invalidate cache
    pub fn removeRoleFromUser(self: *PermissionService, user_id: i64, role_id: i64) !void {
        try self.repo.removeRoleFromUser(user_id, role_id);
        self.invalidateCache(user_id);
    }
    
    /// Check if user has any of the given permissions
    pub fn hasAnyPermission(self: *PermissionService, user_id: i64, permission_names: []const []const u8) !bool {
        for (permission_names) |perm_name| {
            if (try self.hasPermission(user_id, perm_name)) {
                return true;
            }
        }
        return false;
    }
    
    /// Check if user has all of the given permissions
    pub fn hasAllPermissions(self: *PermissionService, user_id: i64, permission_names: []const []const u8) !bool {
        for (permission_names) |perm_name| {
            if (!try self.hasPermission(user_id, perm_name)) {
                return false;
            }
        }
        return true;
    }
    
    /// Check if user is admin (has admin.full or system.admin)
    pub fn isAdmin(self: *PermissionService, user_id: i64) !bool {
        return try self.hasAnyPermission(user_id, &.{ "admin.full", "system.admin" });
    }
};
