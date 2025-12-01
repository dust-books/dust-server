const std = @import("std");
const httpz = @import("httpz");
const UserService = @import("../users/user_service.zig").UserService;

pub fn registerRoutes(builder: *httpz.Router.Builder, user_service: *UserService) void {
    var auth_route = builder.group("/auth", .{});
    auth_route.post("/login", user_service, login);
    auth_route.post("/register", user_service, register);
    auth_route.post("/logout", user_service, logout);
}

fn login(user_service: *UserService, req: *httpz.Request, res: *httpz.Response) !void {
    // Add CORS headers
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    std.log.info("🔑 Login attempt received", .{});
    
    const body = try req.json(.{});
    const email = body.get("email") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Email is required" }, .{});
        return;
    };
    const password = body.get("password") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Password is required" }, .{});
        return;
    };
    
    const token = user_service.handleSignIn(email.string, password.string) catch |err| {
        if (err == error.InvalidCredentials) {
            res.status = 401;
            try res.json(.{ .@"error" = "Invalid credentials" }, .{});
            return;
        }
        std.log.err("Login error: {}", .{err});
        res.status = 500;
        try res.json(.{ .@"error" = "Login failed" }, .{});
        return;
    };
    defer user_service.allocator.free(token);
    
    const user = try user_service.getUserFromToken(token);
    defer user_service.allocator.free(user);
    
    try res.json(.{
        .token = token,
        .user = user,
    }, .{});
}

fn register(user_service: *UserService, req: *httpz.Request, res: *httpz.Response) !void {
    // Add CORS headers
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    std.log.info("📝 Register attempt received", .{});
    
    const body = req.json(.{}) catch |err| {
        std.log.err("Failed to parse JSON: {}", .{err});
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid JSON" }, .{});
        return;
    };
    
    std.log.info("Body parsed successfully", .{});
    
    const email = body.get("email") orelse {
        std.log.err("Email missing from request", .{});
        res.status = 400;
        try res.json(.{ .@"error" = "Email is required" }, .{});
        return;
    };
    std.log.info("Email: {s}", .{email.string});
    
    const password = body.get("password") orelse {
        std.log.err("Password missing from request", .{});
        res.status = 400;
        try res.json(.{ .@"error" = "Password is required" }, .{});
        return;
    };
    std.log.info("Password received (length: {})", .{password.string.len});
    
    // Extract or generate username and display name
    const username = if (body.get("username")) |u| u.string else blk: {
        // Generate username from email or timestamp
        const at_pos = std.mem.indexOf(u8, email.string, "@") orelse email.string.len;
        break :blk email.string[0..at_pos];
    };
    
    const display_name = if (body.get("display_name")) |d| d.string else if (body.get("displayName")) |d| d.string else username;
    
    const user_data = .{
        .username = username,
        .display_name = display_name,
        .email = email.string,
        .password = password.string,
    };
    
    std.log.info("Calling handleSignUp with username={s}, email={s}", .{username, email.string});
    
    const token = user_service.handleSignUp(user_data) catch |err| {
        std.log.err("Registration error: {}", .{err});
        res.status = 500;
        try res.json(.{ .@"error" = "Registration failed" }, .{});
        return;
    };
    defer user_service.allocator.free(token);
    
    std.log.info("Token generated: {s}", .{token});
    
    const user = try user_service.getUserFromToken(token);
    defer user_service.allocator.free(user);
    
    res.status = 201;
    try res.json(user, .{});
}

fn logout(_: *UserService, _: *httpz.Request, res: *httpz.Response) !void {
    try res.json(.{ .message = "Logged out successfully" }, .{});
}
