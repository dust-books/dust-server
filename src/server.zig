const std = @import("std");
const httpz = @import("httpz");
const Database = @import("database.zig").Database;
const AuthService = @import("modules/users/auth.zig").AuthService;
const JWT = @import("auth/jwt.zig").JWT;
const user_routes = @import("modules/users/routes.zig");
const context = @import("context.zig");
const ServerContext = context.ServerContext;
const AuthContext = context.AuthContext;
const PermissionService = @import("auth/permission_service.zig").PermissionService;
const PermissionRepository = @import("auth/permission_repository.zig").PermissionRepository;
const PermissionMiddleware = @import("middleware/permission.zig").PermissionMiddleware;
const BookRepository = @import("modules/books/model.zig").BookRepository;
const AuthorRepository = @import("modules/books/model.zig").AuthorRepository;
const TagRepository = @import("modules/books/model.zig").TagRepository;
const admin_users = @import("modules/users/routes/admin_users.zig");
const admin_routes = @import("modules/admin/routes.zig");
const book_routes = @import("modules/books/routes.zig");
const logging = @import("middleware/logging.zig");

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
    /// Book repository for database access
    book_repo: *BookRepository,
    /// Author repository for database access
    author_repo: *AuthorRepository,
    /// Tag repository for database access
    tag_repo: *TagRepository,
    /// Atomic flag to signal server shutdown
    should_shutdown: *std.atomic.Value(bool),

    /// Initialize the DustServer
    pub fn init(allocator: std.mem.Allocator, port: u16, db: *Database, jwt_secret: []const u8, library_directories: []const []const u8, should_shutdown: *std.atomic.Value(bool)) !DustServer {
        const auth_service = try allocator.create(AuthService);
        auth_service.* = AuthService.init(db, allocator);

        const jwt = JWT.init(allocator, jwt_secret);

        // Initialize permission system
        const permission_repo = try allocator.create(PermissionRepository);
        permission_repo.* = PermissionRepository.init(db, allocator);

        const permission_service = try allocator.create(PermissionService);
        permission_service.* = PermissionService.init(permission_repo, allocator);

        // Initialize book repositories
        const book_repo = try allocator.create(BookRepository);
        book_repo.* = BookRepository.init(&db.db, allocator);

        const author_repo = try allocator.create(AuthorRepository);
        author_repo.* = AuthorRepository.init(&db.db, allocator);

        const tag_repo = try allocator.create(TagRepository);
        tag_repo.* = TagRepository.init(&db.db, allocator);

        const context_ptr = try allocator.create(ServerContext);
        context_ptr.* = ServerContext{
            .auth_context = AuthContext{
                .auth_service = auth_service,
                .jwt = jwt,
                .allocator = allocator,
            },
            .permission_service = permission_service,
            .permission_repo = permission_repo,
            .db = db,
            .book_repo = book_repo,
            .author_repo = author_repo,
            .tag_repo = tag_repo,
            .library_directories = library_directories,
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
            .book_repo = book_repo,
            .author_repo = author_repo,
            .tag_repo = tag_repo,
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

        // Clean up repositories
        self.allocator.destroy(self.book_repo);
        self.allocator.destroy(self.author_repo);
        self.allocator.destroy(self.tag_repo);

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
        router.get("/profile", user_routes.getCurrentUser, .{}); // Alias for /users/me for client compatibility

        // Book endpoints
        router.get("/books", booksList, .{});
        router.get("/books/:id", booksGet, .{});
        router.get("/books/:id/stream", booksStream, .{});
        router.post("/books", booksCreate, .{});
        router.put("/books/:id", booksUpdate, .{});
        router.delete("/books/:id", booksDelete, .{});

        // Author endpoints
        router.get("/books/authors", booksAuthors, .{});
        router.get("/books/authors/:id", booksAuthor, .{});

        // Reading progress endpoints
        router.get("/books/:id/progress", booksGetProgress, .{});
        router.put("/books/:id/progress", booksUpdateProgress, .{});
        
        // Reading lists
        router.get("/reading/currently-reading", readingCurrentlyReading, .{});
        router.get("/reading/completed", readingCompleted, .{});

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
    logging.logRequest(req);
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
    logging.logRequest(req);
    res.status = 200;
    try res.json(.{
        .status = "ok",
        .version = "0.1.0",
        .service = "dust-server",
    }, .{});
}

// Book route handlers
fn booksList(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.listBooks(ctx.book_repo.?, ctx.author_repo.?, req, res);
}

fn booksGet(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.getBook(ctx.book_repo.?, ctx.author_repo.?, ctx.tag_repo.?, req, res);
}

fn booksStream(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    const middleware_helpers = @import("middleware/helpers.zig");

    var auth_user = middleware_helpers.requireAuth(&auth_ctx.jwt, auth_ctx.allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(auth_ctx.allocator);

    const book_id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const db = ctx.db orelse {
        res.status = 500;
        try res.json(.{ .@"error" = "Database not available" }, .{});
        return;
    };

    // Get book file path
    const query = "SELECT file_path, file_format FROM books WHERE id = ?";
    var stmt = try db.db.prepare(query);
    defer stmt.deinit();

    const BookRow = struct {
        file_path: []const u8,
        file_format: ?[]const u8,
    };

    const row = try stmt.oneAlloc(BookRow, res.arena, .{}, .{book_id});
    
    if (row == null) {
        res.status = 404;
        try res.json(.{ .@"error" = "Book not found" }, .{});
        return;
    }

    const book = row.?;
    
    // Open and stream file
    const file = std.fs.cwd().openFile(book.file_path, .{}) catch |err| {
        std.log.err("Failed to open book file {s}: {}", .{ book.file_path, err });
        res.status = 404;
        try res.json(.{ .@"error" = "Book file not found" }, .{});
        return;
    };
    defer file.close();

    // Get file size
    const stat = try file.stat();
    
    // Set content type based on format
    if (book.file_format) |format| {
        if (std.mem.eql(u8, format, "pdf")) {
            res.content_type = .PDF;
        } else if (std.mem.eql(u8, format, "epub")) {
            res.header("Content-Type", "application/epub+zip");
        }
    }

    // Read entire file into response arena
    const file_content = try file.readToEndAlloc(res.arena, stat.size);
    
    res.status = 200;
    res.body = file_content;
}

fn booksCreate(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.createBook(ctx.book_repo.?, req, res);
}

fn booksUpdate(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.updateBook(ctx.book_repo.?, req, res);
}

fn booksDelete(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.deleteBook(ctx.book_repo.?, req, res);
}

// Author route handlers
fn booksAuthors(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.listAuthors(ctx.author_repo.?, req, res);
}

fn booksAuthor(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.getAuthor(&ctx.db.?.db, ctx.author_repo.?, req, res);
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
    logging.logRequest(req);
    const db = ctx.db.?;
    const allocator = ctx.auth_context.allocator;
    try admin_routes.scanLibrary(db, allocator, ctx.library_directories, req, res);
}

// Reading progress route handlers
fn booksGetProgress(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    const middleware_helpers = @import("middleware/helpers.zig");

    var auth_user = middleware_helpers.requireAuth(&auth_ctx.jwt, auth_ctx.allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(auth_ctx.allocator);

    const book_id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const db = ctx.db orelse {
        res.status = 500;
        try res.json(.{ .@"error" = "Database not available" }, .{});
        return;
    };

    // Query reading progress
    const query = 
        \\SELECT current_page, total_pages, percentage_complete, last_read_at 
        \\FROM reading_progress 
        \\WHERE user_id = ? AND book_id = ?
    ;

    var stmt = try db.db.prepare(query);
    defer stmt.deinit();

    const ProgressRow = struct {
        current_page: i64,
        total_pages: ?i64,
        percentage_complete: f64,
        last_read_at: []const u8,
    };

    const row = try stmt.oneAlloc(ProgressRow, res.arena, .{}, .{ auth_user.user_id, book_id });

    if (row) |progress| {
        res.status = 200;
        try res.json(.{
            .book = .{ .id = book_id },
            .progress = .{
                .current_page = progress.current_page,
                .total_pages = progress.total_pages,
                .percentage_complete = progress.percentage_complete,
                .last_read_at = progress.last_read_at,
            },
        }, .{});
    } else {
        res.status = 200;
        try res.json(.{
            .book = .{ .id = book_id },
            .progress = null,
        }, .{});
    }
}

fn booksUpdateProgress(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    const middleware_helpers = @import("middleware/helpers.zig");

    var auth_user = middleware_helpers.requireAuth(&auth_ctx.jwt, auth_ctx.allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(auth_ctx.allocator);

    const book_id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const body = req.body() orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing request body" }, .{});
        return;
    };

    const parsed = std.json.parseFromSlice(
        struct {
            current_page: ?i64 = null,
            total_pages: ?i64 = null,
            current_location: ?[]const u8 = null,
            percentage_complete: ?f64 = null,
        },
        auth_ctx.allocator,
        body,
        .{},
    ) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid JSON" }, .{});
        return;
    };
    defer parsed.deinit();

    const data = parsed.value;

    // Validate that we have at least current_page
    const current_page = data.current_page orelse 0;
    
    const db = ctx.db orelse {
        res.status = 500;
        try res.json(.{ .@"error" = "Database not available" }, .{});
        return;
    };

    // Use provided percentage or calculate it
    const percentage: f64 = if (data.percentage_complete) |pct|
        pct
    else if (data.total_pages) |total|
        if (total > 0) @as(f64, @floatFromInt(current_page)) / @as(f64, @floatFromInt(total)) * 100.0 else 0.0
    else
        0.0;

    // Upsert progress
    const upsert_query =
        \\INSERT INTO reading_progress (user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, updated_at)
        \\VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        \\ON CONFLICT(user_id, book_id) DO UPDATE SET
        \\  current_page = excluded.current_page,
        \\  total_pages = excluded.total_pages,
        \\  percentage_complete = excluded.percentage_complete,
        \\  last_read_at = datetime('now'),
        \\  updated_at = datetime('now')
    ;

    try db.db.exec(upsert_query, .{}, .{ auth_user.user_id, book_id, current_page, data.total_pages, percentage });

    res.status = 200;
    try res.json(.{
        .success = true,
        .progress = .{
            .current_page = current_page,
            .total_pages = data.total_pages,
            .percentage_complete = percentage,
        },
    }, .{});
}

// Reading list handlers
fn readingCurrentlyReading(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    const middleware_helpers = @import("middleware/helpers.zig");

    var auth_user = middleware_helpers.requireAuth(&auth_ctx.jwt, auth_ctx.allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(auth_ctx.allocator);

    try book_routes.getCurrentlyReading(&ctx.db.?.db, auth_user.user_id, req, res);
}

fn readingCompleted(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    const auth_ctx = &ctx.auth_context;
    const middleware_helpers = @import("middleware/helpers.zig");

    var auth_user = middleware_helpers.requireAuth(&auth_ctx.jwt, auth_ctx.allocator, req, res) catch |err| {
        return err;
    };
    defer auth_user.deinit(auth_ctx.allocator);

    try book_routes.getCompletedReading(&ctx.db.?.db, auth_user.user_id, req, res);
}

// Tag route handlers
fn booksTags(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.listTags(ctx.tag_repo.?, req, res);
}

fn booksTagsByCategory(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.getTagsByCategory(ctx.tag_repo.?, req, res);
}

fn booksAddTag(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.addTagToBook(ctx.tag_repo.?, req, res);
}

fn booksRemoveTag(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.removeTagFromBook(ctx.tag_repo.?, req, res);
}

// Archive route handlers
fn booksArchived(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.listArchivedBooks(&ctx.db.?.db, ctx.author_repo.?, req, res);
}

fn booksArchive(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.archiveBook(ctx.book_repo.?, req, res);
}

fn booksUnarchive(ctx: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
    logging.logRequest(req);
    try book_routes.unarchiveBook(&ctx.db.?.db, req, res);
}

// CORS preflight handler for OPTIONS requests
