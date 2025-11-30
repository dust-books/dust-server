const std = @import("std");
const httpz = @import("httpz");
const Database = @import("../../database.zig").Database;
const AuthService = @import("auth.zig").AuthService;
const JWT = @import("../../auth/jwt.zig").JWT;
const Claims = @import("../../auth/jwt.zig").Claims;
const auth_middleware = @import("../../middleware/auth.zig");
const AuthUser = auth_middleware.AuthUser;
const PermissionService = @import("../../auth/permission_service.zig").PermissionService;
const PermissionRepository = @import("../../auth/permission_repository.zig").PermissionRepository;
const session = @import("../../session.zig");

pub const AuthContext = struct {
    auth_service: *AuthService,
    jwt: JWT,
    allocator: std.mem.Allocator,
};

pub const ServerContext = struct {
    auth_context: AuthContext,
    permission_service: ?*PermissionService = null,
    permission_repo: ?*PermissionRepository = null,
    admin_controller: ?*anyopaque = null,  // Use anyopaque to avoid circular dependency
    book_controller: ?*anyopaque = null,
    
    // httpz special handlers
    pub fn notFound(_: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
        std.debug.print("🔍 404 Not Found: {s}\n", .{req.url.path});
        res.status = 404;
        res.body = "Not Found";
    }
    
    pub fn uncaughtError(_: *ServerContext, req: *httpz.Request, res: *httpz.Response, err: anyerror) void {
        std.debug.print("❌ Uncaught error at {s}: {}\n", .{req.url.path, err});
        res.status = 500;
        res.body = "Internal Server Error";
    }
};

pub fn register(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    
    // Parse JSON body
    const body = req.body() orelse {
        res.status = 400;
        try res.json(.{ .message = "Missing request body" }, .{});
        return;
    };
    
    const parsed = std.json.parseFromSlice(
        struct {
            email: []const u8,
            password: []const u8,
            username: ?[]const u8 = null,
        },
        auth_ctx.allocator,
        body,
        .{},
    ) catch {
        res.status = 400;
        try res.json(.{ .message = "Invalid JSON" }, .{});
        return;
    };
    defer parsed.deinit();
    
    const data = parsed.value;
    
    // Validate input
    if (data.email.len == 0 or data.password.len == 0) {
        res.status = 400;
        try res.json(.{ .message = "Email and password are required" }, .{});
        return;
    }
    
    // Register user
    const user_id = auth_ctx.auth_service.register(
        data.email,
        data.password,
        data.username,
    ) catch |err| {
        if (err == error.UserAlreadyExists) {
            res.status = 409;
            try res.json(.{ .message = "User already exists" }, .{});
            return;
        }
        res.status = 500;
        try res.json(.{ .message = "Failed to register user" }, .{});
        return;
    };
    
    res.status = 201;
    try res.json(.{
        .message = "User registered successfully",
        .user_id = user_id,
    }, .{});
}

pub fn login(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    
    // Parse JSON body
    const body = req.body() orelse {
        res.status = 400;
        try res.json(.{ .message = "Missing request body" }, .{});
        return;
    };
    
    const parsed = std.json.parseFromSlice(
        struct {
            email: []const u8,
            password: []const u8,
        },
        auth_ctx.allocator,
        body,
        .{},
    ) catch {
        res.status = 400;
        try res.json(.{ .message = "Invalid JSON" }, .{});
        return;
    };
    defer parsed.deinit();
    
    const data = parsed.value;
    
    // Validate input
    if (data.email.len == 0 or data.password.len == 0) {
        res.status = 400;
        try res.json(.{ .message = "Email and password are required" }, .{});
        return;
    }
    
    // Login user
    const maybe_user = auth_ctx.auth_service.login(data.email, data.password) catch {
        res.status = 500;
        try res.json(.{ .message = "Failed to login" }, .{});
        return;
    };
    
    if (maybe_user == null) {
        res.status = 401;
        try res.json(.{ .message = "Invalid credentials" }, .{});
        return;
    }
    
    var user = maybe_user.?;
    defer user.deinit(auth_ctx.allocator);
    
    // Generate JWT token
    const claims = Claims.init(user.id, user.email, user.username);
    const token = auth_ctx.jwt.create(claims) catch {
        res.status = 500;
        try res.json(.{ .message = "Failed to generate token" }, .{});
        return;
    };
    defer auth_ctx.allocator.free(token);
    
    // Create session in database
    session.createSession(&auth_ctx.auth_service.user_repo.db.db, user.id, token, auth_ctx.allocator) catch |err| {
        std.log.err("Failed to create session: {}", .{err});
        res.status = 500;
        try res.json(.{ .message = "Failed to create session" }, .{});
        return;
    };
    
    // Return token and user info
    res.status = 200;
    try res.json(.{
        .message = "Login successful",
        .token = token,
        .user = .{
            .id = user.id,
            .email = user.email,
            .username = user.username,
        },
    }, .{});
}

pub fn getCurrentUser(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    
    // Create auth middleware and authenticate
    var auth_mw = auth_middleware.AuthMiddleware.init(&auth_ctx.jwt, auth_ctx.allocator);
    
    // Validate token and get user
    var auth_user = auth_mw.authenticate(req, res) catch |err| {
        // Error response already sent by middleware
        return err;
    };
    defer auth_user.deinit(auth_ctx.allocator);
    
    // Fetch full user details from database
    const maybe_user = auth_ctx.auth_service.user_repo.findById(auth_user.user_id) catch {
        res.status = 500;
        try res.json(.{ .message = "Failed to fetch user details" }, .{});
        return;
    };
    
    if (maybe_user == null) {
        res.status = 404;
        try res.json(.{ .message = "User not found" }, .{});
        return;
    }
    
    var user = maybe_user.?;
    defer user.deinit(auth_ctx.allocator);
    
    // Return user info
    res.status = 200;
    try res.json(.{
        .user = .{
            .id = user.id,
            .email = user.email,
            .username = user.username,
            .created_at = user.created_at,
        },
    }, .{});
}

pub fn logout(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    
    // Get the token from Authorization header
    const auth_header = req.header("Authorization") orelse {
        res.status = 401;
        try res.json(.{ .message = "Missing authorization header" }, .{});
        return;
    };
    
    // Extract bearer token
    if (!std.mem.startsWith(u8, auth_header, "Bearer ")) {
        res.status = 401;
        try res.json(.{ .message = "Invalid authorization header format" }, .{});
        return;
    }
    
    const token = auth_header[7..]; // Skip "Bearer "
    
    // Delete the session
    session.deleteSession(&auth_ctx.auth_service.user_repo.db.db, token) catch {
        res.status = 500;
        try res.json(.{ .message = "Failed to logout" }, .{});
        return;
    };
    
    res.status = 200;
    try res.json(.{ .message = "Logged out successfully" }, .{});
}
