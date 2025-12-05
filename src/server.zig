const std = @import("std");
const httpz = @import("httpz");
const Database = @import("database.zig").Database;
const AuthService = @import("modules/users/auth.zig").AuthService;
const JWT = @import("auth/jwt.zig").JWT;
const user_routes = @import("modules/users/routes.zig");
const ServerContext = user_routes.ServerContext;
const AuthContext = user_routes.AuthContext;
const PermissionService = @import("auth/permission_service.zig").PermissionService;
const PermissionRepository = @import("auth/permission_repository.zig").PermissionRepository;
const PermissionMiddleware = @import("middleware/permission.zig").PermissionMiddleware;
const BookController = @import("modules/books/controller.zig").BookController;
const BookRepository = @import("modules/books/model.zig").BookRepository;
const AuthorRepository = @import("modules/books/model.zig").AuthorRepository;
const TagRepository = @import("modules/books/model.zig").TagRepository;
const admin_users = @import("modules/users/routes/admin_users.zig");
const AdminController = @import("modules/admin/controller.zig").AdminController;

pub const DustServer = struct {
    /// The underlying HTTP server
    httpz_server: httpz.Server(*ServerContext),
    /// Pointer to the server context
    context_ptr: *ServerContext,
    /// Allocator for dynamic memory allocations
    allocator: std.mem.Allocator,
    /// Permission service for access control
    permission_service: *PermissionService,
    /// Permission repository for database access
    permission_repo: *PermissionRepository,
    /// Book controller for handling book-related requests
    book_controller: *BookController,
    /// Admin controller for handling admin-related requests
    admin_controller: *AdminController,
    /// Atomic flag to signal server shutdown
    should_shutdown: *std.atomic.Value(bool),

    /// Initialize the DustServer
    pub fn init(allocator: std.mem.Allocator, port: u16, db: *Database, jwt_secret: []const u8, should_shutdown: *std.atomic.Value(bool)) !DustServer {
        const auth_service = try allocator.create(AuthService);
        auth_service.* = AuthService.init(db, allocator);

        const jwt = JWT.init(allocator, jwt_secret);

        // Initialize permission system
        const permission_repo = try allocator.create(PermissionRepository);
        permission_repo.* = PermissionRepository.init(db, allocator);

        const permission_service = try allocator.create(PermissionService);
        permission_service.* = PermissionService.init(permission_repo, allocator);

        // Initialize book repositories and controllers
        const book_repo = try allocator.create(BookRepository);
        book_repo.* = BookRepository.init(&db.db, allocator);

        const author_repo = try allocator.create(AuthorRepository);
        author_repo.* = AuthorRepository.init(&db.db, allocator);

        const tag_repo = try allocator.create(TagRepository);
        tag_repo.* = TagRepository.init(&db.db, allocator);

        const book_controller = try allocator.create(BookController);
        book_controller.* = BookController.init(&db.db, book_repo, author_repo, tag_repo, allocator);

        const admin_controller = try allocator.create(AdminController);
        admin_controller.* = AdminController.init(db, allocator);

        const context_ptr = try allocator.create(ServerContext);
        context_ptr.* = ServerContext{
            .auth_context = AuthContext{
                .auth_service = auth_service,
                .jwt = jwt,
                .allocator = allocator,
            },
            .permission_service = permission_service,
            .permission_repo = permission_repo,
            .admin_controller = admin_controller,
            .book_controller = book_controller,
            .db = db,
        };

        const httpz_server = try httpz.Server(*ServerContext).init(allocator, .{
            .port = port,
        }, context_ptr);

        return .{
            .httpz_server = httpz_server,
            .context_ptr = context_ptr,
            .allocator = allocator,
            .permission_service = permission_service,
            .permission_repo = permission_repo,
            .book_controller = book_controller,
            .admin_controller = admin_controller,
            .should_shutdown = should_shutdown,
        };
    }

    /// Deinitialize the DustServer and free resources
    pub fn deinit(self: *DustServer) void {
        // Clean up httpz server first
        self.httpz_server.deinit();

        // Clean up services
        self.permission_service.deinit();
        self.allocator.destroy(self.permission_service);
        self.allocator.destroy(self.permission_repo);

        // Clean up controllers and their repositories
        self.book_controller.deinit();
        self.allocator.destroy(self.book_controller);
        self.allocator.destroy(self.admin_controller);

        // Clean up auth service
        self.allocator.destroy(self.context_ptr.auth_context.auth_service);

        // Clean up context pointer
        self.allocator.destroy(self.context_ptr);
    }

    /// Set up routes and middleware for the server
    pub fn setupRoutes(self: *DustServer) !void {
        // Setup CORS middleware
        const cors_middleware = try self.httpz_server.middleware(httpz.middleware.Cors, .{
            .origin = "https://client.dustbooks.org, http://localhost:3000, http://localhost:5173",
            .methods = "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            .headers = "authorization,content-type",
            .max_age = "86400",
            .credentials = "true",
        });

        var router = try self.httpz_server.router(.{ .middlewares = &.{cors_middleware} });

        // Root endpoint - fun Giphy embed
        router.get("/", index, .{});

        // Health check endpoint
        router.get("/health", health, .{});

        // Auth endpoints
        router.post("/auth/register", user_routes.register, .{});
        router.post("/auth/login", user_routes.login, .{});
        router.post("/auth/logout", user_routes.logout, .{});

        // Protected user endpoints
        router.get("/users/me", user_routes.getCurrentUser, .{});

        // Book endpoints
        router.get("/books", booksList, .{});
        router.get("/books/:id", booksGet, .{});
        router.post("/books", booksCreate, .{});
        router.put("/books/:id", booksUpdate, .{});
        router.delete("/books/:id", booksDelete, .{});

        // Author endpoints
        router.get("/books/authors", booksAuthors, .{});
        router.get("/books/authors/:id", booksAuthor, .{});

        // Tag endpoints
        router.get("/tags", booksTags, .{});
        router.get("/tags/categories/:category", booksTagsByCategory, .{});
        router.post("/books/:id/tags", booksAddTag, .{});
        router.delete("/books/:id/tags/:tagName", booksRemoveTag, .{});

        // Archive endpoints
        router.get("/books/archive", booksArchived, .{});
        router.post("/books/:id/archive", booksArchive, .{});
        router.delete("/books/:id/archive", booksUnarchive, .{});

        // Admin endpoints - require admin access
        router.get("/admin/users", adminListUsers, .{});
        router.get("/admin/users/:id", adminGetUser, .{});
        router.put("/admin/users/:id", adminUpdateUser, .{});
        router.delete("/admin/users/:id", adminDeleteUser, .{});
        router.post("/admin/scan", adminScanLibrary, .{});
    }

    /// Start listening for incoming HTTP requests
    pub fn listen(self: *DustServer) !void {
        try self.setupRoutes();

        std.log.info("🚀 Dust is bookin' it on port {}\n", .{self.httpz_server.config.port.?});

        // Start server in a separate thread
        const thread = try std.Thread.spawn(.{}, listenThread, .{&self.httpz_server});

        // Poll shutdown flag
        while (!self.should_shutdown.load(.seq_cst)) {
            std.Thread.sleep(100 * std.time.ns_per_ms);
        }

        // Stop server and wait for thread
        self.httpz_server.stop();
        thread.join();
    }

    /// Thread function to run the HTTP server
    fn listenThread(server: *httpz.Server(*ServerContext)) void {
        server.listen() catch |err| {
            std.log.err("Server error: {}\n", .{err});
        };
    }
};

// Route handlers
fn index(_: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    std.debug.print("[{any}] {s} - from {any}\n", .{ req.method, req.url.path, req.address });
    res.status = 200;
    res.header("content-type", "text/html");
    res.body =
        \\<!DOCTYPE html>
        \\<html lang="en">
        \\<head>
        \\  <meta charset="UTF-8">
        \\  <title>Dust Server</title>
        \\</head>
        \\<body>
        \\  <iframe src="https://giphy.com/embed/2wKbtCMHTVoOY" 
        \\          width="480" height="480" 
        \\          frameBorder="0" 
        \\          class="giphy-embed" 
        \\          allowFullScreen>
        \\  </iframe>
        \\</body>
        \\</html>
    ;
}

/// Health check handler
fn health(_: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    std.debug.print("[{any}] {s} - from {any}\n", .{ req.method, req.url.path, req.address });
    res.status = 200;
    try res.json(.{
        .status = "ok",
        .version = "0.1.0",
        .service = "dust-server",
    }, .{});
}

// Book route handlers
fn booksList(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    std.debug.print("[{any}] {s} - from {any}\n", .{ req.method, req.url.path, req.address });
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.listBooks(req, res);
}

fn booksGet(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    std.debug.print("[{any}] {s} - from {any}\n", .{ req.method, req.url.path, req.address });
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.getBook(req, res);
}

fn booksCreate(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.createBook(req, res);
}

fn booksUpdate(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.updateBook(req, res);
}

fn booksDelete(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.deleteBook(req, res);
}

// Author route handlers
fn booksAuthors(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.listAuthors(req, res);
}

fn booksAuthor(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.getAuthor(req, res);
}

// Admin route handlers
fn adminListUsers(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    try admin_users.listUsers(ctx.auth_context.auth_service.user_repo.db, &ctx.auth_context.jwt, ctx.auth_context.allocator, req, res);
}

fn adminGetUser(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    try admin_users.getUser(ctx.auth_context.auth_service.user_repo.db, &ctx.auth_context.jwt, ctx.auth_context.allocator, req, res);
}

fn adminUpdateUser(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    try admin_users.updateUser(ctx.auth_context.auth_service.user_repo.db, &ctx.auth_context.jwt, ctx.auth_context.allocator, req, res);
}

fn adminDeleteUser(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    try admin_users.deleteUser(ctx.auth_context.auth_service.user_repo.db, &ctx.auth_context.jwt, ctx.auth_context.allocator, req, res);
}

fn adminScanLibrary(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *AdminController = @ptrCast(@alignCast(ctx.admin_controller.?));
    try controller.scanLibrary(req, res);
}

// Tag route handlers
fn booksTags(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.listTags(req, res);
}

fn booksTagsByCategory(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.getTagsByCategory(req, res);
}

fn booksAddTag(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.addTagToBook(req, res);
}

fn booksRemoveTag(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.removeTagFromBook(req, res);
}

// Archive route handlers
fn booksArchived(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.listArchivedBooks(req, res);
}

fn booksArchive(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.archiveBook(req, res);
}

fn booksUnarchive(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const controller: *BookController = @ptrCast(@alignCast(ctx.book_controller.?));
    try controller.unarchiveBook(req, res);
}

// CORS preflight handler for OPTIONS requests
