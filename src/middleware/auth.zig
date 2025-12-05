const std = @import("std");
const httpz = @import("httpz");
const JWT = @import("../auth/jwt.zig").JWT;
const Claims = @import("../auth/jwt.zig").Claims;

/// Authenticated user context that gets attached to requests
pub const AuthUser = struct {
    user_id: i64,
    email: []const u8,
    username: ?[]const u8,
    
    pub fn deinit(self: *AuthUser, allocator: std.mem.Allocator) void {
        allocator.free(self.email);
        if (self.username) |un| {
            allocator.free(un);
        }
    }
};

/// Extract JWT token from Authorization header
fn extractToken(auth_header: []const u8) ?[]const u8 {
    // Expected format: "Bearer <token>"
    if (auth_header.len < 8) return null; // "Bearer " is 7 chars
    
    if (!std.mem.startsWith(u8, auth_header, "Bearer ")) return null;
    
    const token = std.mem.trim(u8, auth_header[7..], " \t\r\n");
    if (token.len == 0) return null;
    
    return token;
}

/// Authentication middleware helper
pub const AuthMiddleware = struct {
    jwt: *const JWT,
    allocator: std.mem.Allocator,
    
    pub fn init(jwt: *const JWT, allocator: std.mem.Allocator) AuthMiddleware {
        return .{
            .jwt = jwt,
            .allocator = allocator,
        };
    }
    
    /// Validate JWT and return authenticated user
    pub fn authenticate(
        self: *AuthMiddleware,
        req: *httpz.Request,
        res: *httpz.Response,
    ) !AuthUser {
        // Get Authorization header
        const auth_header = req.header("authorization") orelse {
            res.status = 401;
            try res.json(.{ .message = "Authorization header missing" }, .{});
            return error.Unauthorized;
        };
        
        // Extract token
        const token = extractToken(auth_header) orelse {
            res.status = 401;
            try res.json(.{ .message = "Invalid authorization format. Expected: Bearer <token>" }, .{});
            return error.Unauthorized;
        };
        
        // Validate token
        const claims = self.jwt.validate(token) catch |err| {
            const msg = switch (err) {
                error.InvalidToken => "Invalid token format",
                error.InvalidSignature => "Invalid token signature",
                error.TokenExpired => "Token has expired",
                else => "Token validation failed",
            };
            res.status = 401;
            try res.json(.{ .message = msg }, .{});
            return error.Unauthorized;
        };
        
        // Return authenticated user
        return AuthUser{
            .user_id = claims.user_id,
            .email = claims.email,
            .username = claims.username,
        };
    }
};
