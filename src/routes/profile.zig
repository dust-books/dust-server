const std = @import("std");
const httpz = @import("httpz");
const UserService = @import("../users/user_service.zig").UserService;

pub fn registerRoutes(builder: *httpz.Router.Builder, user_service: *UserService) void {
    var profile_route = builder.group("/profile", .{});
    profile_route.get("/", user_service, getProfile);
}

fn getProfile(user_service: *UserService, req: *httpz.Request, res: *httpz.Response) !void {
    // Extract JWT token from Authorization header
    const auth_header = req.header("authorization") orelse {
        res.status = 401;
        try res.json(.{ .@"error" = "Authentication required" }, .{});
        return;
    };
    
    // Extract Bearer token
    const bearer_prefix = "Bearer ";
    const token = if (std.mem.startsWith(u8, auth_header, bearer_prefix))
        auth_header[bearer_prefix.len..]
    else
        auth_header;
    
    // Validate JWT and get user
    user_service.validateJWT(token) catch {
        res.status = 401;
        try res.json(.{ .@"error" = "Invalid or expired token" }, .{});
        return;
    };
    
    const user = user_service.getUserFromToken(token) catch |err| {
        std.log.err("Profile error: {}", .{err});
        res.status = 500;
        try res.json(.{ .@"error" = "Failed to get user profile" }, .{});
        return;
    };
    defer user_service.allocator.free(user);
    
    try res.json(user, .{});
}
