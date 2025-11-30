const std = @import("std");
const httpz = @import("httpz");
const auth = @import("auth.zig");
const db = @import("database.zig");
const UserService = @import("user_service.zig").UserService;
const UserManagementService = @import("user_management.zig").UserManagementService;
const BookService = @import("books/service.zig").BookService;

pub const Routes = struct {
    allocator: std.mem.Allocator,
    db: *db.Database,
    user_service: *UserService,
    user_mgmt: *UserManagementService,
    book_service: BookService,

    pub fn init(allocator: std.mem.Allocator, database: *db.Database) !*Routes {
        const routes = try allocator.create(Routes);
        routes.* = .{
            .allocator = allocator,
            .db = database,
            .user_service = try UserService.init(allocator, database),
            .user_mgmt = try UserManagementService.init(allocator, database),
            .book_service = BookService.init(&database.db, allocator),
        };
        return routes;
    }

    pub fn deinit(self: *Routes) void {
        self.user_service.deinit();
        self.user_mgmt.deinit();
        self.allocator.destroy(self);
    }

    // Auth Routes

    pub fn login(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        std.log.info("🔑 Login attempt received", .{});
        
        const body = try req.json(LoginRequest);
        if (body == null) {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid request body" }, .{});
            return;
        }

        const login_data = body.?;
        const result = self.user_service.handleSignIn(login_data.email, login_data.password) catch |err| {
            std.log.err("Login error: {}", .{err});
            if (err == error.InvalidCredentials) {
                res.status = 401;
                try res.json(.{ .@"error" = "Invalid credentials" }, .{});
                return;
            }
            res.status = 500;
            try res.json(.{ .@"error" = "Login failed" }, .{});
            return;
        };
        defer result.deinit();

        res.status = 200;
        try res.json(.{
            .token = result.token,
            .user = result.user,
        }, .{});
    }

    pub fn register(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        std.log.info("📝 Register attempt received", .{});
        
        const body = try req.json(RegisterRequest);
        if (body == null) {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid request body" }, .{});
            return;
        }

        const reg_data = body.?;
        
        // Generate username if not provided
        const username = if (reg_data.username) |u| u else blk: {
            // Extract from email or use timestamp
            const at_pos = std.mem.indexOf(u8, reg_data.email, "@") orelse reg_data.email.len;
            break :blk reg_data.email[0..at_pos];
        };

        const display_name = reg_data.display_name orelse reg_data.username orelse username;

        const result = self.user_service.handleSignUp(
            username,
            reg_data.email,
            reg_data.password,
            display_name,
        ) catch |err| {
            std.log.err("Registration error: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Registration failed" }, .{});
            return;
        };
        defer result.deinit();

        res.status = 201;
        try res.json(result.user, .{});
    }

    pub fn logout(_: *Routes, _: *httpz.Request, res: *httpz.Response) !void {
        res.status = 200;
        try res.json(.{ .message = "Logged out successfully" }, .{});
    }

    pub fn getProfile(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireAuth(req, res);
        if (user == null) return; // Auth middleware already set error response

        const token = try self.extractToken(req);
        if (token == null) {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        }

        const profile = self.user_service.getUserFromToken(token.?) catch |err| {
            std.log.err("Profile error: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to get user profile" }, .{});
            return;
        };
        defer profile.deinit();

        res.status = 200;
        try res.json(profile.user, .{});
    }

    // Admin User Management Routes

    pub fn listUsers(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireUserManager(req, res);
        if (user == null) return;

        const users = self.user_mgmt.getAllUsers() catch |err| {
            std.log.err("Error fetching users: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch users" }, .{});
            return;
        };
        defer users.deinit();

        res.status = 200;
        try res.json(.{ .users = users.items }, .{});
    }

    pub fn getUser(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const current_user = try self.requireSelfOrAdmin(req, res);
        if (current_user == null) return;

        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "User ID required" }, .{});
            return;
        };

        const user_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid user ID" }, .{});
            return;
        };

        const user = self.user_mgmt.getUserById(user_id) catch |err| {
            if (err == error.UserNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "User not found" }, .{});
                return;
            }
            std.log.err("Error fetching user: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch user" }, .{});
            return;
        };
        defer user.deinit();

        res.status = 200;
        try res.json(.{ .user = user }, .{});
    }

    pub fn createUser(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const current_user = try self.requireAdmin(req, res);
        if (current_user == null) return;

        const body = try req.json(CreateUserRequest);
        if (body == null) {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid request body" }, .{});
            return;
        }

        const create_data = body.?;
        if (create_data.username == null or create_data.email == null or create_data.password == null) {
            res.status = 400;
            try res.json(.{ .@"error" = "username, email, and password are required" }, .{});
            return;
        }

        const user = self.user_mgmt.createUser(
            create_data.username.?,
            create_data.email.?,
            create_data.password.?,
            create_data.display_name,
            create_data.roles,
        ) catch |err| {
            std.log.err("Error creating user: {}", .{err});
            res.status = 500;
            const msg = @errorName(err);
            try res.json(.{ .@"error" = msg }, .{});
            return;
        };
        defer user.deinit();

        res.status = 201;
        try res.json(.{ .user = user }, .{});
    }

    pub fn updateUser(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const current_user = try self.requireSelfOrAdmin(req, res);
        if (current_user == null) return;

        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "User ID required" }, .{});
            return;
        };

        const user_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid user ID" }, .{});
            return;
        };

        const body = try req.json(UpdateUserRequest);
        if (body == null) {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid request body" }, .{});
            return;
        }

        const update_data = body.?;
        const is_self_update = current_user.?.id == user_id;

        // Check if user is trying to modify restricted fields for their own account
        if (is_self_update and (update_data.roles != null or update_data.is_active != null)) {
            res.status = 403;
            try res.json(.{ .@"error" = "Cannot modify roles or account status for your own account" }, .{});
            return;
        }

        const user = self.user_mgmt.updateUser(user_id, update_data) catch |err| {
            std.log.err("Error updating user: {}", .{err});
            res.status = 500;
            const msg = @errorName(err);
            try res.json(.{ .@"error" = msg }, .{});
            return;
        };
        defer user.deinit();

        res.status = 200;
        try res.json(.{ .user = user }, .{});
    }

    pub fn deleteUser(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const current_user = try self.requireAdmin(req, res);
        if (current_user == null) return;

        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "User ID required" }, .{});
            return;
        };

        const user_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid user ID" }, .{});
            return;
        };

        // Prevent self-deletion
        if (current_user.?.id == user_id) {
            res.status = 400;
            try res.json(.{ .@"error" = "Cannot delete your own account" }, .{});
            return;
        }

        self.user_mgmt.deleteUser(user_id) catch |err| {
            std.log.err("Error deleting user: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to delete user" }, .{});
            return;
        };

        res.status = 200;
        try res.json(.{ .message = "User deactivated successfully" }, .{});
    }

    // Role Management Routes

    pub fn listRoles(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireAdmin(req, res);
        if (user == null) return;

        const roles = self.user_mgmt.getAllRoles() catch |err| {
            std.log.err("Error fetching roles: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch roles" }, .{});
            return;
        };
        defer roles.deinit();

        res.status = 200;
        try res.json(.{ .roles = roles.items }, .{});
    }

    pub fn createRole(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireAdmin(req, res);
        if (user == null) return;

        const body = try req.json(CreateRoleRequest);
        if (body == null or body.?.name == null) {
            res.status = 400;
            try res.json(.{ .@"error" = "Role name is required" }, .{});
            return;
        }

        const role_data = body.?;
        const role = self.user_mgmt.createRole(
            role_data.name.?,
            role_data.description,
            role_data.permissions,
        ) catch |err| {
            std.log.err("Error creating role: {}", .{err});
            res.status = 500;
            const msg = @errorName(err);
            try res.json(.{ .@"error" = msg }, .{});
            return;
        };
        defer role.deinit();

        res.status = 201;
        try res.json(.{ .role = role }, .{});
    }

    pub fn updateRole(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireAdmin(req, res);
        if (user == null) return;

        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Role ID required" }, .{});
            return;
        };

        const role_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid role ID" }, .{});
            return;
        };

        const body = try req.json(UpdateRoleRequest);
        if (body == null) {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid request body" }, .{});
            return;
        }

        const role_data = body.?;
        const role = self.user_mgmt.updateRole(
            role_id,
            role_data.name,
            role_data.description,
            role_data.permissions,
        ) catch |err| {
            std.log.err("Error updating role: {}", .{err});
            res.status = 500;
            const msg = @errorName(err);
            try res.json(.{ .@"error" = msg }, .{});
            return;
        };
        defer role.deinit();

        res.status = 200;
        try res.json(.{ .role = role }, .{});
    }

    pub fn deleteRole(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireAdmin(req, res);
        if (user == null) return;

        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Role ID required" }, .{});
            return;
        };

        const role_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid role ID" }, .{});
            return;
        };

        self.user_mgmt.deleteRole(role_id) catch |err| {
            std.log.err("Error deleting role: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to delete role" }, .{});
            return;
        };

        res.status = 200;
        try res.json(.{ .message = "Role deleted successfully" }, .{});
    }

    // Permission Routes

    pub fn listPermissions(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireAdmin(req, res);
        if (user == null) return;

        const permissions = self.user_mgmt.getAllPermissions() catch |err| {
            std.log.err("Error fetching permissions: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch permissions" }, .{});
            return;
        };
        defer permissions.deinit();

        res.status = 200;
        try res.json(.{ .permissions = permissions.items }, .{});
    }

    // Dashboard Route

    pub fn getDashboard(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const user = try self.requireAdmin(req, res);
        if (user == null) return;

        const user_stats = self.user_mgmt.getUserStats() catch |err| {
            std.log.err("Error fetching dashboard data: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch dashboard data" }, .{});
            return;
        };
        defer user_stats.deinit();

        res.status = 200;
        try res.json(.{
            .userStats = user_stats,
            .systemInfo = .{
                .version = "1.0.0",
                .uptime = "N/A",
                .zigVersion = @import("builtin").zig_version_string,
            },
        }, .{});
    }

    // Helper functions for authentication and authorization

    fn extractToken(_: *Routes, req: *httpz.Request) !?[]const u8 {
        const auth_header = req.header("authorization") orelse return null;
        if (auth_header.len < 7 or !std.mem.eql(u8, auth_header[0..7], "Bearer ")) {
            return null;
        }
        return auth_header[7..];
    }

    fn requireAuth(self: *Routes, req: *httpz.Request, res: *httpz.Response) !?auth.User {
        const token = try self.extractToken(req);
        if (token == null) {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return null;
        }

        const user = self.user_service.validateJWT(token.?) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Invalid or expired token" }, .{});
            return null;
        };

        return user;
    }

    fn requireAdmin(self: *Routes, req: *httpz.Request, res: *httpz.Response) !?auth.User {
        const user = try self.requireAuth(req, res);
        if (user == null) return null;

        const has_permission = try self.user_service.hasPermission(user.?.id, "admin");
        if (!has_permission) {
            res.status = 403;
            try res.json(.{ .@"error" = "Admin access required" }, .{});
            return null;
        }

        return user;
    }

    fn requireUserManager(self: *Routes, req: *httpz.Request, res: *httpz.Response) !?auth.User {
        const user = try self.requireAuth(req, res);
        if (user == null) return null;

        const is_admin = try self.user_service.hasPermission(user.?.id, "admin");
        const is_user_manager = try self.user_service.hasPermission(user.?.id, "user_manager");

        if (!is_admin and !is_user_manager) {
            res.status = 403;
            try res.json(.{ .@"error" = "User manager or admin access required" }, .{});
            return null;
        }

        return user;
    }

    fn requireSelfOrAdmin(self: *Routes, req: *httpz.Request, res: *httpz.Response) !?auth.User {
        const user = try self.requireAuth(req, res);
        if (user == null) return null;

        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "User ID required" }, .{});
            return null;
        };

        const target_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid user ID" }, .{});
            return null;
        };

        const is_self = user.?.id == target_id;
        const is_admin = try self.user_service.hasPermission(user.?.id, "admin");

        if (!is_self and !is_admin) {
            res.status = 403;
            try res.json(.{ .@"error" = "Access denied" }, .{});
            return null;
        }

        return user;
    }

    // Book Routes

    pub fn getAllBooks(self: *Routes, _: *httpz.Request, res: *httpz.Response) !void {
        var books = self.book_service.getAllBooks() catch |err| {
            std.log.err("Failed to get books: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch books" }, .{});
            return;
        };
        defer {
            for (books.items) |book| {
                book.deinit(self.allocator);
            }
            books.deinit();
        }

        try res.json(.{ .books = books.items }, .{});
    }

    pub fn getBookById(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing book ID" }, .{});
            return;
        };

        const book_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };

        const book = self.book_service.getBookById(book_id) catch |err| {
            std.log.err("Failed to get book: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch book" }, .{});
            return;
        };

        if (book) |b| {
            defer b.deinit(self.allocator);
            try res.json(.{ .book = b }, .{});
        } else {
            res.status = 404;
            try res.json(.{ .@"error" = "Book not found" }, .{});
        }
    }

    pub fn getAllAuthors(self: *Routes, _: *httpz.Request, res: *httpz.Response) !void {
        var authors = self.book_service.getAllAuthors() catch |err| {
            std.log.err("Failed to get authors: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch authors" }, .{});
            return;
        };
        defer {
            for (authors.items) |author| {
                author.deinit(self.allocator);
            }
            authors.deinit();
        }

        try res.json(.{ .authors = authors.items }, .{});
    }

    pub fn getAuthorById(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing author ID" }, .{});
            return;
        };

        const author_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid author ID" }, .{});
            return;
        };

        const author = self.book_service.getAuthorById(author_id) catch |err| {
            std.log.err("Failed to get author: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch author" }, .{});
            return;
        };

        if (author) |a| {
            defer a.deinit(self.allocator);
            
            var books = self.book_service.getBooksByAuthor(author_id) catch |err| {
                std.log.err("Failed to get author books: {}", .{err});
                res.status = 500;
                try res.json(.{ .@"error" = "Failed to fetch author books" }, .{});
                return;
            };
            defer {
                for (books.items) |book| {
                    book.deinit(self.allocator);
                }
                books.deinit();
            }

            try res.json(.{ .author = a, .books = books.items }, .{});
        } else {
            res.status = 404;
            try res.json(.{ .@"error" = "Author not found" }, .{});
        }
    }

    pub fn getBooksByAuthor(self: *Routes, req: *httpz.Request, res: *httpz.Response) !void {
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing author ID" }, .{});
            return;
        };

        const author_id = std.fmt.parseInt(i64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid author ID" }, .{});
            return;
        };

        var books = self.book_service.getBooksByAuthor(author_id) catch |err| {
            std.log.err("Failed to get books by author: {}", .{err});
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to fetch books" }, .{});
            return;
        };
        defer {
            for (books.items) |book| {
                book.deinit(self.allocator);
            }
            books.deinit();
        }

        try res.json(.{ .books = books.items }, .{});
    }
};

// Request/Response types
const LoginRequest = struct {
    email: []const u8,
    password: []const u8,
};

const RegisterRequest = struct {
    username: ?[]const u8 = null,
    email: []const u8,
    password: []const u8,
    display_name: ?[]const u8 = null,
};

const CreateUserRequest = struct {
    username: ?[]const u8 = null,
    email: ?[]const u8 = null,
    password: ?[]const u8 = null,
    display_name: ?[]const u8 = null,
    roles: ?[]const []const u8 = null,
};

const UpdateUserRequest = struct {
    username: ?[]const u8 = null,
    email: ?[]const u8 = null,
    display_name: ?[]const u8 = null,
    roles: ?[]const []const u8 = null,
    is_active: ?bool = null,
};

const CreateRoleRequest = struct {
    name: ?[]const u8 = null,
    description: ?[]const u8 = null,
    permissions: ?[]const []const u8 = null,
};

const UpdateRoleRequest = struct {
    name: ?[]const u8 = null,
    description: ?[]const u8 = null,
    permissions: ?[]const []const u8 = null,
};
