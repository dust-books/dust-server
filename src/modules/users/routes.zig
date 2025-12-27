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
const middleware_helpers = @import("../../middleware/helpers.zig");

const context = @import("../../context.zig");
const ServerContext = context.ServerContext;
const AuthContext = context.AuthContext;

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
            display_name: ?[]const u8 = null,
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

    // Use username as displayName, or email if username is null
    const display_name = user.username orelse user.email;

    // Return token and user info (matching Deno format)
    res.status = 200;
    try res.json(.{
        .token = token,
        .user = .{
            .id = user.id,
            .email = user.email,
            .username = user.username,
            .displayName = display_name,
        },
    }, .{});
}

pub fn getCurrentUser(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;

    var auth_user = middleware_helpers.requireAuth(&auth_ctx.jwt, auth_ctx.allocator, req, res) catch |err| {
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

    // Build permissions array (simplified for now - TODO: implement proper permissions)
    var permission_list: std.ArrayList([]const u8) = .empty;
    defer permission_list.deinit(auth_ctx.allocator);
    try permission_list.append(auth_ctx.allocator, "books:read");
    if (user.is_admin) {
        try permission_list.append(auth_ctx.allocator, "books:download");
        try permission_list.append(auth_ctx.allocator, "books:upload");
        try permission_list.append(auth_ctx.allocator, "books:delete");
    }

    // Build roles array
    var role_list: std.ArrayList([]const u8) = .empty;
    defer role_list.deinit(auth_ctx.allocator);

    if (user.is_admin) try role_list.append(auth_ctx.allocator, "admin");
    try role_list.append(auth_ctx.allocator, "user");

    // Use username as displayName, or email if username is null
    const display_name = user.username orelse user.email;

    // Return user info (not nested under .user for client compatibility)
    res.status = 200;
    try res.json(.{
        .id = user.id,
        .email = user.email,
        .username = user.username,
        .displayName = display_name,
        .roles = role_list.items,
        .permissions = permission_list.items,
        .created = user.created_at,
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
