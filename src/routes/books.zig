const std = @import("std");
const httpz = @import("httpz");
const BookService = @import("../books/service.zig").BookService;
const UserService = @import("../users/user_service.zig").UserService;
const PermissionService = @import("../users/permission_service.zig").PermissionService;
const BookPermissionService = @import("../books/permission_service.zig").BookPermissionService;
const TagService = @import("../books/tag_service.zig").TagService;
const ReadingProgressService = @import("../books/reading_progress_service.zig").ReadingProgressService;
const ArchiveService = @import("../books/archive_service.zig").ArchiveService;

const PERMISSIONS = @import("../users/permissions.zig").PERMISSIONS;

pub const BookRoutes = struct {
    allocator: std.mem.Allocator,
    book_service: *BookService,
    user_service: *UserService,
    permission_service: *PermissionService,
    book_permission_service: *BookPermissionService,
    tag_service: *TagService,
    reading_progress_service: *ReadingProgressService,
    archive_service: *ArchiveService,
    
    pub fn init(
        allocator: std.mem.Allocator,
        book_service: *BookService,
        user_service: *UserService,
        permission_service: *PermissionService,
        book_permission_service: *BookPermissionService,
        tag_service: *TagService,
        reading_progress_service: *ReadingProgressService,
        archive_service: *ArchiveService,
    ) BookRoutes {
        return .{
            .allocator = allocator,
            .book_service = book_service,
            .user_service = user_service,
            .permission_service = permission_service,
            .book_permission_service = book_permission_service,
            .tag_service = tag_service,
            .reading_progress_service = reading_progress_service,
            .archive_service = archive_service,
        };
    }
    
    pub fn registerRoutes(self: *BookRoutes, builder: *httpz.Router.Builder) void {
        var books_route = builder.group("/books", .{});
        
        // Author routes
        books_route.get("/authors", self, getAllAuthors);
        books_route.get("/authors/:id", self, getAuthorById);
        
        // Book list and detail routes
        books_route.get("/", self, listBooks);
        books_route.get("/:id", self, getBookById);
        books_route.get("/:id/stream", self, streamBook);
        
        // Reading progress routes
        books_route.get("/:id/progress", self, getProgress);
        books_route.put("/:id/progress", self, updateProgress);
        books_route.post("/:id/progress/start", self, startReading);
        books_route.post("/:id/progress/complete", self, completeReading);
        books_route.delete("/:id/progress", self, resetProgress);
        
        // Tag routes
        var tags_route = builder.group("/tags", .{});
        tags_route.get("/", self, getAllTags);
        tags_route.get("/categories/:category", self, getTagsByCategory);
        
        books_route.post("/:id/tags", self, addTagToBook);
        books_route.delete("/:id/tags/:tagName", self, removeTagFromBook);
        books_route.get("/by-tag/:tagName", self, getBooksByTag);
        
        // Reading routes
        var reading_route = builder.group("/reading", .{});
        reading_route.get("/progress", self, getAllProgress);
        reading_route.get("/recent", self, getRecentlyRead);
        reading_route.get("/currently-reading", self, getCurrentlyReading);
        reading_route.get("/completed", self, getCompletedBooks);
        reading_route.get("/stats", self, getReadingStats);
        
        // Archive routes
        books_route.get("/archive", self, getArchivedBooks);
        books_route.post("/:id/archive", self, archiveBook);
        books_route.delete("/:id/archive", self, unarchiveBook);
        books_route.get("/archive/stats", self, getArchiveStats);
        books_route.post("/archive/validate", self, validateArchive);
    }
    
    fn authenticateUser(self: *BookRoutes, req: *httpz.Request) !u64 {
        const auth_header = req.header("authorization") orelse return error.Unauthorized;
        const bearer_prefix = "Bearer ";
        const token = if (std.mem.startsWith(u8, auth_header, bearer_prefix))
            auth_header[bearer_prefix.len..]
        else
            auth_header;
        
        const payload = try self.user_service.validateJWT(token);
        return payload.user_id;
    }
    
    fn checkPermission(self: *BookRoutes, user_id: u64, permission: []const u8) !bool {
        return try self.permission_service.userHasPermission(user_id, permission);
    }
    
    fn getAllAuthors(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        }
        
        const authors = try self.book_service.getAllAuthors();
        defer self.allocator.free(authors);
        
        var authors_with_counts = std.ArrayList(AuthorWithCount).init(self.allocator);
        defer authors_with_counts.deinit();
        
        for (authors) |author| {
            const books = try self.book_service.getBooksByAuthor(author.id);
            defer self.allocator.free(books);
            
            try authors_with_counts.append(.{
                .id = author.id,
                .name = author.name,
                .bookCount = books.len,
            });
        }
        
        try res.json(.{ .authors = authors_with_counts.items }, .{});
    }
    
    const AuthorWithCount = struct {
        id: u64,
        name: []const u8,
        bookCount: usize,
    };
    
    fn getAuthorById(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        }
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Author ID is required" }, .{});
            return;
        };
        
        const author_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid author ID" }, .{});
            return;
        };
        
        const author = self.book_service.getAuthorById(author_id) catch {
            res.status = 404;
            try res.json(.{ .@"error" = "Author not found" }, .{});
            return;
        };
        defer self.allocator.free(author);
        
        const all_books = try self.book_service.getBooksByAuthor(author_id);
        defer self.allocator.free(all_books);
        
        var accessible_books = std.ArrayList(@TypeOf(all_books[0])).init(self.allocator);
        defer accessible_books.deinit();
        
        for (all_books) |book| {
            const can_access = try self.book_permission_service.canUserAccessBook(user_id, book.id);
            if (can_access.can_access) {
                try accessible_books.append(book);
            }
        }
        
        try res.json(.{
            .author = author,
            .books = accessible_books.items,
            .totalBooks = accessible_books.items.len,
        }, .{});
    }
    
    fn listBooks(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        }
        
        // TODO: Parse query params for filtering
        const books = try self.book_permission_service.getBooksForUser(user_id, null);
        
        const preferences = try self.book_permission_service.getUserContentPreferences(user_id);
        
        // Serialize immediately while data is valid
        try res.json(.{
            .books = books,
            .userPreferences = preferences,
        }, .{});
        
        // Clean up after json serialization
        self.allocator.free(preferences);
        self.allocator.free(books);
    }
    
    fn getBookById(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        }
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const access_check = try self.book_permission_service.canUserAccessBook(user_id, book_id);
        if (!access_check.can_access) {
            res.status = 403;
            try res.json(.{ .@"error" = access_check.reason }, .{});
            return;
        }
        
        const book = self.book_service.getBookById(book_id) catch {
            res.status = 500;
            try res.json(.{ .@"error" = "Internal server error" }, .{});
            return;
        };
        defer self.allocator.free(book);
        
        const tags = try self.tag_service.getBookTags(book_id);
        defer self.allocator.free(tags);
        
        std.log.info("📖 Book API: Returning book data - name: \"{s}\", filepath: \"{s}\", file_format: \"{s}\"", .{
            book.name, book.filepath, book.file_format
        });
        
        try res.json(.{
            .book = book,
            .tags = tags,
        }, .{});
    }
    
    fn streamBook(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        };
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        std.log.info("🎬 STREAM: User {} requesting book {}", .{user_id, book_id});
        
        const access_check = try self.book_permission_service.canUserAccessBook(user_id, book_id);
        if (!access_check.can_access) {
            std.log.info("🎬 STREAM: Access denied for user {} to book {}: {s}", .{user_id, book_id, access_check.reason});
            res.status = 403;
            try res.json(.{ .@"error" = access_check.reason }, .{});
            return;
        }
        
        const book = self.book_service.getBookById(book_id) catch {
            res.status = 404;
            try res.json(.{ .@"error" = "Book not found" }, .{});
            return;
        };
        defer self.allocator.free(book);
        
        std.log.info("🎬 STREAM: Found book \"{s}\" at path: {s}", .{book.name, book.filepath});
        
        // Check if file exists
        const file = std.fs.openFileAbsolute(book.filepath, .{}) catch {
            std.log.err("🎬 STREAM: File not found: {s}", .{book.filepath});
            res.status = 404;
            try res.json(.{ .@"error" = "Book file not found" }, .{});
            return;
        };
        defer file.close();
        
        const stat = try file.stat();
        std.log.info("🎬 STREAM: File exists, size: {} bytes", .{stat.size});
        
        // Set appropriate content type
        const ext = std.fs.path.extension(book.filepath);
        if (std.mem.eql(u8, ext, ".pdf")) {
            res.header("Content-Type", "application/pdf");
        } else if (std.mem.eql(u8, ext, ".epub")) {
            res.header("Content-Type", "application/epub+zip");
        }
        
        // Read and stream the file
        const content = try file.readToEndAlloc(self.allocator, stat.size);
        defer self.allocator.free(content);
        
        std.log.info("🎬 STREAM: Streaming {} bytes for book {}", .{content.len, book_id});
        res.body = content;
    }
    
    fn getProgress(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            return;
        };
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const progress = self.reading_progress_service.getProgress(user_id, book_id) catch null;
        
        if (progress) |p| {
            defer self.allocator.free(p);
            try res.json(.{
                .book = .{ .id = book_id },
                .progress = .{
                    .current_page = p.current_page,
                    .total_pages = p.total_pages,
                    .percentage_complete = p.percentage_complete,
                    .last_read_at = p.last_read_at,
                },
            }, .{});
        } else {
            try res.json(.{
                .book = .{ .id = book_id },
                .progress = null,
            }, .{});
        }
    }
    
    fn updateProgress(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            return;
        };
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const body = try req.json(.{});
        const current_page = body.get("current_page") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "current_page is required" }, .{});
            return;
        };
        
        const total_pages = if (body.get("total_pages")) |tp| tp.integer else null;
        
        const progress = try self.reading_progress_service.updateProgress(
            user_id,
            book_id,
            @intCast(current_page.integer),
            if (total_pages) |tp| @intCast(tp) else null,
        );
        defer self.allocator.free(progress);
        
        try res.json(.{ .progress = progress }, .{});
    }
    
    fn startReading(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            return;
        };
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const body = req.json(.{}) catch .{};
        const total_pages = if (body.get("total_pages")) |tp| @as(?u32, @intCast(tp.integer)) else null;
        
        const progress = try self.reading_progress_service.startReading(user_id, book_id, total_pages);
        defer self.allocator.free(progress);
        
        try res.json(.{ .progress = progress }, .{});
    }
    
    fn completeReading(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            return;
        };
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const progress = try self.reading_progress_service.markAsCompleted(user_id, book_id);
        defer self.allocator.free(progress);
        
        try res.json(.{ .progress = progress }, .{});
    }
    
    fn resetProgress(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            return;
        };
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        try self.reading_progress_service.resetProgress(user_id, book_id);
        try res.json(.{ .message = "Reading progress reset" }, .{});
    }
    
    // Tag route implementations
    fn getAllTags(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        _ = user_id;
        
        const tags = try self.tag_service.getAllTags();
        defer self.allocator.free(tags);
        
        try res.json(.{ .tags = tags }, .{});
    }
    
    fn getTagsByCategory(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        _ = user_id;
        
        const category = req.param("category") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Category is required" }, .{});
            return;
        };
        
        const tags = try self.tag_service.getTagsByCategory(category);
        defer self.allocator.free(tags);
        
        try res.json(.{ .tags = tags }, .{});
    }
    
    fn addTagToBook(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_WRITE);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_WRITE required" }, .{});
            return;
        }
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const body = try req.json(.{});
        const tag_name = body.get("tagName") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "tagName is required" }, .{});
            return;
        };
        
        try self.tag_service.addTagToBook(@intCast(book_id), tag_name.string, @intCast(user_id));
        try res.json(.{ .message = "Tag added successfully" }, .{});
    }
    
    fn removeTagFromBook(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_WRITE);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_WRITE required" }, .{});
            return;
        }
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const tag_name = req.param("tagName") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Tag name is required" }, .{});
            return;
        };
        
        try self.tag_service.removeTagFromBook(@intCast(book_id), tag_name);
        try res.json(.{ .message = "Tag removed successfully" }, .{});
    }
    
    fn getBooksByTag(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        }
        
        const tag_name = req.param("tagName") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Tag name is required" }, .{});
            return;
        };
        
        const book_ids = try self.tag_service.getBooksByTag(tag_name);
        defer self.allocator.free(book_ids);
        
        // Fetch books and filter by user access
        var accessible_books = std.ArrayList(@import("../books.zig").Book).init(self.allocator);
        defer accessible_books.deinit();
        
        for (book_ids) |book_id| {
            const can_access = try self.book_permission_service.canUserAccessBook(user_id, @intCast(book_id));
            if (can_access.can_access) {
                if (try self.book_service.getBookById(book_id)) |book| {
                    try accessible_books.append(book);
                }
            }
        }
        
        try res.json(.{ .books = accessible_books.items }, .{});
    }
    
    // Reading progress route implementations
    fn getAllProgress(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const progress_list = try self.reading_progress_service.getAllProgressForUser(user_id);
        defer self.allocator.free(progress_list);
        
        try res.json(.{ .progress = progress_list }, .{});
    }
    
    fn getRecentlyRead(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const limit_str = req.query().get("limit") orelse "10";
        const limit = std.fmt.parseInt(u32, limit_str, 10) catch 10;
        
        const books = try self.reading_progress_service.getRecentlyRead(user_id, limit);
        defer self.allocator.free(books);
        
        try res.json(.{ .books = books }, .{});
    }
    
    fn getCurrentlyReading(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const books = try self.reading_progress_service.getCurrentlyReading(user_id);
        defer self.allocator.free(books);
        
        try res.json(.{ .books = books }, .{});
    }
    
    fn getCompletedBooks(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const books = try self.reading_progress_service.getCompletedBooks(user_id);
        defer self.allocator.free(books);
        
        try res.json(.{ .books = books }, .{});
    }
    
    fn getReadingStats(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const stats = try self.reading_progress_service.getReadingStats(user_id);
        defer self.allocator.free(stats);
        
        const recent_activity = try self.reading_progress_service.getRecentActivity(user_id, 10);
        defer self.allocator.free(recent_activity);
        
        try res.json(.{ 
            .stats = stats,
            .recentActivity = recent_activity,
        }, .{});
    }
    
    // Archive route implementations
    fn getArchivedBooks(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        }
        
        const archived = try self.archive_service.getArchivedBooks();
        defer self.allocator.free(archived);
        
        try res.json(.{ 
            .books = archived,
            .total = archived.len,
        }, .{});
    }
    
    fn archiveBook(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_WRITE);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_WRITE required" }, .{});
            return;
        }
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        const body = req.json(.{}) catch .{};
        const reason = if (body.get("reason")) |r| r.string else "User archived";
        
        try self.archive_service.archiveBook(book_id, reason);
        try res.json(.{ .message = "Book archived successfully" }, .{});
    }
    
    fn unarchiveBook(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_WRITE);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_WRITE required" }, .{});
            return;
        }
        
        const id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Book ID is required" }, .{});
            return;
        };
        
        const book_id = std.fmt.parseInt(u64, id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };
        
        try self.archive_service.restoreBook(book_id);
        try res.json(.{ .message = "Book restored successfully" }, .{});
    }
    
    fn getArchiveStats(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.BOOKS_READ);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: BOOKS_READ required" }, .{});
            return;
        }
        
        const stats = try self.archive_service.getArchiveStats();
        defer self.allocator.free(stats);
        
        try res.json(.{ .stats = stats }, .{});
    }
    
    fn validateArchive(self: *BookRoutes, req: *httpz.Request, res: *httpz.Response) !void {
        const user_id = self.authenticateUser(req) catch {
            res.status = 401;
            try res.json(.{ .@"error" = "Authentication required" }, .{});
            return;
        };
        
        const has_perm = try self.checkPermission(user_id, PERMISSIONS.ADMIN);
        if (!has_perm) {
            res.status = 403;
            try res.json(.{ .@"error" = "Permission denied: ADMIN required" }, .{});
            return;
        }
        
        const result = try self.archive_service.validateArchive();
        defer self.allocator.free(result);
        
        try res.json(.{ 
            .message = "Validation complete",
            .result = result,
        }, .{});
    }
};
