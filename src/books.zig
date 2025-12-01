const std = @import("std");
const httpz = @import("httpz");
const sqlite = @import("sqlite");

pub const Book = struct {
    id: i64,
    name: []const u8,
    filepath: []const u8,
    file_format: []const u8,
    author_id: ?i64,
    created_at: i64,
    updated_at: i64,
    archived: bool,
    archived_at: ?i64,
    archive_reason: ?[]const u8,
};

pub const Author = struct {
    id: i64,
    name: []const u8,
    created_at: i64,
};

pub const Tag = struct {
    id: i64,
    name: []const u8,
    category: []const u8,
    description: ?[]const u8,
    color: ?[]const u8,
    created_at: i64,
};

pub const ReadingProgress = struct {
    id: i64,
    user_id: i64,
    book_id: i64,
    current_page: i64,
    total_pages: ?i64,
    percentage_complete: f64,
    last_read_at: i64,
    completed_at: ?i64,
    created_at: i64,
    updated_at: i64,
};

pub fn migrate(database: *sqlite.Db) !void {
    try database.exec(
        \\CREATE TABLE IF NOT EXISTS authors (
        \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
        \\    name TEXT NOT NULL UNIQUE,
        \\    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        \\)
    , .{}, .{});

    try database.exec(
        \\CREATE TABLE IF NOT EXISTS books (
        \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
        \\    name TEXT NOT NULL,
        \\    filepath TEXT NOT NULL UNIQUE,
        \\    file_format TEXT NOT NULL,
        \\    author_id INTEGER,
        \\    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        \\    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        \\    archived INTEGER NOT NULL DEFAULT 0,
        \\    archived_at INTEGER,
        \\    archive_reason TEXT,
        \\    FOREIGN KEY (author_id) REFERENCES authors(id)
        \\)
    , .{}, .{});

    try database.exec(
        \\CREATE TABLE IF NOT EXISTS tags (
        \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
        \\    name TEXT NOT NULL UNIQUE,
        \\    category TEXT NOT NULL DEFAULT 'general',
        \\    description TEXT,
        \\    color TEXT,
        \\    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        \\)
    , .{}, .{});

    try database.exec(
        \\CREATE TABLE IF NOT EXISTS book_tags (
        \\    book_id INTEGER NOT NULL,
        \\    tag_id INTEGER NOT NULL,
        \\    added_by INTEGER NOT NULL,
        \\    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        \\    PRIMARY KEY (book_id, tag_id),
        \\    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        \\    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        \\    FOREIGN KEY (added_by) REFERENCES users(id)
        \\)
    , .{}, .{});

    try database.exec(
        \\CREATE TABLE IF NOT EXISTS reading_progress (
        \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
        \\    user_id INTEGER NOT NULL,
        \\    book_id INTEGER NOT NULL,
        \\    current_page INTEGER NOT NULL DEFAULT 0,
        \\    total_pages INTEGER,
        \\    percentage_complete REAL NOT NULL DEFAULT 0.0,
        \\    last_read_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        \\    completed_at INTEGER,
        \\    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        \\    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        \\    UNIQUE(user_id, book_id),
        \\    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        \\    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        \\)
    , .{}, .{});

    try database.exec(
        \\CREATE TABLE IF NOT EXISTS user_tag_preferences (
        \\    user_id INTEGER NOT NULL,
        \\    tag_id INTEGER NOT NULL,
        \\    preference TEXT NOT NULL CHECK(preference IN ('allowed', 'blocked')),
        \\    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        \\    PRIMARY KEY (user_id, tag_id),
        \\    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        \\    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        \\)
    , .{}, .{});
}

pub fn registerRoutes(server: anytype) !void {
    var routes = server.router();

    // Book routes
    routes.get("/books/", getBooksHandler, .{});
    routes.get("/books/:id", getBookHandler, .{});
    routes.get("/books/:id/stream", streamBookHandler, .{});
    
    // Author routes
    routes.get("/books/authors", getAuthorsHandler, .{});
    routes.get("/books/authors/:id", getAuthorHandler, .{});
    
    // Reading progress routes
    routes.get("/books/:id/progress", getProgressHandler, .{});
    routes.put("/books/:id/progress", updateProgressHandler, .{});
    routes.post("/books/:id/progress/start", startReadingHandler, .{});
    routes.post("/books/:id/progress/complete", completeReadingHandler, .{});
    routes.delete("/books/:id/progress", resetProgressHandler, .{});
    
    routes.get("/reading/progress", getAllProgressHandler, .{});
    routes.get("/reading/recent", getRecentBooksHandler, .{});
    routes.get("/reading/currently-reading", getCurrentlyReadingHandler, .{});
    routes.get("/reading/completed", getCompletedBooksHandler, .{});
    routes.get("/reading/stats", getReadingStatsHandler, .{});
    
    // Tag routes
    routes.get("/tags", getTagsHandler, .{});
    routes.get("/tags/categories/:category", getTagsByCategoryHandler, .{});
    routes.post("/books/:id/tags", addTagToBookHandler, .{});
    routes.delete("/books/:id/tags/:tagName", removeTagFromBookHandler, .{});
    routes.get("/books/by-tag/:tagName", getBooksByTagHandler, .{});
    
    // Archive routes
    routes.get("/books/archive", getArchivedBooksHandler, .{});
    routes.post("/books/:id/archive", archiveBookHandler, .{});
    routes.delete("/books/:id/archive", unarchiveBookHandler, .{});
    routes.get("/books/archive/stats", getArchiveStatsHandler, .{});
    routes.post("/books/archive/validate", validateArchiveHandler, .{});
}

// Handler implementations (stubs for now)
fn getBooksHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    _ = res.arena;
    
    // TODO: Implement database query
    // const query = 
    //     \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at
    //     \\FROM books 
    //     \\WHERE archived = 0
    //     \\ORDER BY name ASC
    // ;
    
    // For now, return empty array with proper structure
    try res.json(.{ 
        .books = &[_]u8{},
        .userPreferences = .{}
    }, .{});
}

fn getBookHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Get book endpoint - not yet implemented" }, .{});
}

fn streamBookHandler(req: *httpz.Request, res: *httpz.Response) !void {
    // TODO: Implement book streaming with proper database integration
    // This requires:
    // 1. Database context to be passed to routes
    // 2. File existence check
    // 3. Proper content-type headers (PDF, EPUB, MOBI, etc.)
    // 4. Streaming large files efficiently
    _ = req;
    try res.json(.{ .@"error" = "Stream endpoint - not yet fully implemented" }, .{});
}

fn getAuthorsHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .authors = .{}, .message = "Authors endpoint - not yet implemented" }, .{});
}

fn getAuthorHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Get author endpoint - not yet implemented" }, .{});
}

fn getProgressHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Get progress endpoint - not yet implemented" }, .{});
}

fn updateProgressHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Update progress endpoint - not yet implemented" }, .{});
}

fn startReadingHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Start reading endpoint - not yet implemented" }, .{});
}

fn completeReadingHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Complete reading endpoint - not yet implemented" }, .{});
}

fn resetProgressHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Reset progress endpoint - not yet implemented" }, .{});
}

fn getAllProgressHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .progress = .{}, .message = "Get all progress endpoint - not yet implemented" }, .{});
}

fn getRecentBooksHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .books = .{}, .message = "Recent books endpoint - not yet implemented" }, .{});
}

fn getCurrentlyReadingHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .books = .{}, .message = "Currently reading endpoint - not yet implemented" }, .{});
}

fn getCompletedBooksHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .books = .{}, .message = "Completed books endpoint - not yet implemented" }, .{});
}

fn getReadingStatsHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .stats = .{}, .message = "Reading stats endpoint - not yet implemented" }, .{});
}

fn getTagsHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .tags = .{}, .message = "Tags endpoint - not yet implemented" }, .{});
}

fn getTagsByCategoryHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .tags = .{}, .message = "Tags by category endpoint - not yet implemented" }, .{});
}

fn addTagToBookHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Add tag endpoint - not yet implemented" }, .{});
}

fn removeTagFromBookHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Remove tag endpoint - not yet implemented" }, .{});
}

fn getBooksByTagHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .books = .{}, .message = "Books by tag endpoint - not yet implemented" }, .{});
}

fn getArchivedBooksHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .books = .{}, .message = "Archived books endpoint - not yet implemented" }, .{});
}

fn archiveBookHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Archive book endpoint - not yet implemented" }, .{});
}

fn unarchiveBookHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Unarchive book endpoint - not yet implemented" }, .{});
}

fn getArchiveStatsHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .stats = .{}, .message = "Archive stats endpoint - not yet implemented" }, .{});
}

fn validateArchiveHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    try res.json(.{ .message = "Validate archive endpoint - not yet implemented" }, .{});
}

// Background Tasks
const TimerManager = @import("timer.zig").TimerManager;

const BackgroundTaskContext = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,
    library_directories: []const []const u8,
};

fn scanLibraryDirectories(context_ptr: *anyopaque) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context_ptr));
    
    std.log.info("📚 Starting library scan...", .{});
    
    // Get directories from DUST_DIRS environment variable
    const dirs_env = std.posix.getenv("DUST_DIRS") orelse "";
    if (dirs_env.len == 0) {
        std.log.warn("⚠️  DUST_DIRS environment variable not set, skipping scan", .{});
        return;
    }
    
    var it = std.mem.split(u8, dirs_env, ":");
    while (it.next()) |dir| {
        if (dir.len == 0) continue;
        std.log.info("🔍 Scanning directory: {s}", .{dir});
        scanDirectory(ctx, dir) catch |err| {
            std.log.err("❌ Failed to scan directory {s}: {}", .{ dir, err });
            continue;
        };
    }
    
    std.log.info("✅ Library scan completed", .{});
}

fn scanDirectory(ctx: *BackgroundTaskContext, dir_path: []const u8) !void {
    var dir = std.fs.openDirAbsolute(dir_path, .{ .iterate = true }) catch |err| {
        std.log.err("Failed to open directory {s}: {}", .{ dir_path, err });
        return err;
    };
    defer dir.close();
    
    var walker = try dir.walk(ctx.allocator);
    defer walker.deinit();
    
    while (try walker.next()) |entry| {
        if (entry.kind != .file) continue;
        
        // Check if it's an epub file
        if (std.mem.endsWith(u8, entry.basename, ".epub")) {
            const full_path = try std.fs.path.join(ctx.allocator, &.{ dir_path, entry.path });
            defer ctx.allocator.free(full_path);
            
            std.log.info("📖 Found book: {s}", .{full_path});
            
            // Check if book already exists in database
            const exists = checkBookExists(ctx.db, full_path) catch |err| {
                std.log.err("Failed to check if book exists: {}", .{err});
                continue;
            };
            
            if (!exists) {
                addBookToDatabase(ctx, full_path) catch |err| {
                    std.log.err("Failed to add book {s}: {}", .{ full_path, err });
                    continue;
                };
                std.log.info("✅ Added book: {s}", .{full_path});
            }
        }
    }
}

fn checkBookExists(db: *sqlite.Db, path: []const u8) !bool {
    const query = "SELECT COUNT(*) FROM books WHERE path = ?";
    var stmt = try db.prepare(query);
    defer stmt.deinit();
    
    const row = try stmt.one(struct { count: i64 }, .{}, .{path});
    return if (row) |r| r.count > 0 else false;
}

fn addBookToDatabase(ctx: *BackgroundTaskContext, path: []const u8) !void {
    // Extract title from filename (remove .epub extension)
    const basename = std.fs.path.basename(path);
    const title = if (std.mem.lastIndexOf(u8, basename, ".epub")) |idx|
        basename[0..idx]
    else
        basename;
    
    const query =
        \\INSERT INTO books (title, path, added_at)
        \\VALUES (?, ?, strftime('%s', 'now'))
    ;
    
    try ctx.db.exec(query, .{}, .{ .title = title, .path = path });
}

fn cleanupOldBooks(context_ptr: *anyopaque) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context_ptr));
    
    // Delete archived books older than 1 year
    const query =
        \\DELETE FROM books
        \\WHERE archived = 1
        \\AND archived_at IS NOT NULL
        \\AND archived_at < strftime('%s', 'now', '-1 year')
    ;
    
    ctx.db.exec(query, .{}, .{}) catch |err| {
        std.log.err("❌ Failed to cleanup old archived books: {}", .{err});
        return;
    };
    
    std.log.info("✅ Cleaned up old archived books", .{});
}

fn cleanupBackgroundContext(context: *anyopaque, allocator: std.mem.Allocator) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context));
    allocator.destroy(ctx);
}

pub fn registerBackgroundTasks(timer_manager: *TimerManager, db: *sqlite.Db, allocator: std.mem.Allocator, library_directories: []const []const u8) !void {
    const ctx = try allocator.create(BackgroundTaskContext);
    ctx.* = .{
        .db = db,
        .allocator = allocator,
        .library_directories = library_directories,
    };
    
    // Run library scan every 5 minutes (300000 ms)
    try timer_manager.registerTimer(scanLibraryDirectories, ctx, 300000, cleanupBackgroundContext);
    
    // Run cleanup every hour (3600000 ms)
    try timer_manager.registerTimer(cleanupOldBooks, ctx, 3600000, cleanupBackgroundContext);
    
    std.log.info("📅 Registered books background tasks (scan every 5min, cleanup every hour)", .{});
}
