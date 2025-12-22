const std = @import("std");
const sqlite = @import("sqlite");
const TimerManager = @import("../../timer.zig").TimerManager;

/// Context structure for background tasks
const BackgroundTaskContext = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,
    library_directories: []const []const u8,
};

/// Background task to scan library directories for new books (typed)
fn scanLibraryDirectories(ctx: *BackgroundTaskContext) void {
    std.log.info("Starting library scan...", .{});
    const dirs_env = std.posix.getenv("DUST_DIRS") orelse "";
    if (dirs_env.len == 0) {
        std.log.warn("⚠️  DUST_DIRS environment variable not set, skipping scan", .{});
        return;
    }

    var it = std.mem.splitScalar(u8, dirs_env, ':');
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

/// Scan a single directory for book files
fn scanDirectory(ctx: *BackgroundTaskContext, dir_path: []const u8) !void {
    var dir = if (std.fs.path.isAbsolute(dir_path))
        try std.fs.openDirAbsolute(dir_path, .{ .iterate = true })
    else
        try std.fs.cwd().openDir(dir_path, .{ .iterate = true });
    defer dir.close();

    var walker = try dir.walk(ctx.allocator);
    defer walker.deinit();

    while (try walker.next()) |entry| {
        if (entry.kind != .file) continue;

        // Check for supported ebook formats
        const is_ebook = std.mem.endsWith(u8, entry.basename, ".epub") or
            std.mem.endsWith(u8, entry.basename, ".pdf") or
            std.mem.endsWith(u8, entry.basename, ".mobi") or
            std.mem.endsWith(u8, entry.basename, ".azw") or
            std.mem.endsWith(u8, entry.basename, ".azw3") or
            std.mem.endsWith(u8, entry.basename, ".cbz") or
            std.mem.endsWith(u8, entry.basename, ".cbr") or
            std.mem.endsWith(u8, entry.basename, ".djvu") or
            // Uppercase variants
            std.mem.endsWith(u8, entry.basename, ".EPUB") or
            std.mem.endsWith(u8, entry.basename, ".PDF") or
            std.mem.endsWith(u8, entry.basename, ".MOBI") or
            std.mem.endsWith(u8, entry.basename, ".CBZ") or
            std.mem.endsWith(u8, entry.basename, ".CBR");

        if (is_ebook) {
            const full_path = try std.fs.path.join(ctx.allocator, &.{ dir_path, entry.path });
            defer ctx.allocator.free(full_path);

            std.log.info("📖 Found book: {s}", .{full_path});

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

/// Check if a book already exists in the database
fn checkBookExists(db: *sqlite.Db, path: []const u8) !bool {
    const query = "SELECT COUNT(*) FROM books WHERE file_path = ?";
    var stmt = try db.prepare(query);
    defer stmt.deinit();

    const row = try stmt.one(struct { count: i64 }, .{}, .{path});
    return if (row) |r| r.count > 0 else false;
}

/// Add a new book to the database
fn addBookToDatabase(ctx: *BackgroundTaskContext, path: []const u8) !void {
    const basename = std.fs.path.basename(path);
    const title = if (std.mem.lastIndexOf(u8, basename, ".epub")) |idx|
        basename[0..idx]
    else
        basename;

    const ext = std.fs.path.extension(basename);
    const file_format = if (ext.len > 1) ext[1..] else "unknown";

    const query =
        \\INSERT INTO books (name, filepath, file_format, created_at, updated_at)
        \\VALUES (?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
    ;

    ctx.db.exec(query, .{}, .{ title, path, file_format }) catch |err| {
        std.log.err("Failed to insert book: {}", .{err});
        return err;
    };
}

/// Background task to clean up old archived books (typed)
fn cleanupOldBooks(ctx: *BackgroundTaskContext) void {
    std.log.debug("🧹 Starting cleanup of old archived books (older than 1 year)", .{});

    // First, check if we have any archived books
    const count_query =
        \\SELECT COUNT(*) as count FROM books WHERE status = 'archived'
    ;

    var count_stmt = ctx.db.prepare(count_query) catch |err| {
        std.log.err("❌ Failed to prepare count query: {}", .{err});
        return;
    };
    defer count_stmt.deinit();

    const CountRow = struct { count: i64 };
    const count_result = count_stmt.one(CountRow, .{}, .{}) catch |err| {
        std.log.err("❌ Failed to execute count query: {}", .{err});
        return;
    };

    if (count_result) |row| {
        std.log.debug("Found {d} archived books total", .{row.count});
    }

    // Now check how many are old enough to delete
    const old_count_query =
        \\SELECT COUNT(*) as count FROM books 
        \\WHERE status = 'archived' 
        \\AND archived_at IS NOT NULL 
        \\AND archived_at < datetime('now', '-1 year')
    ;

    var old_count_stmt = ctx.db.prepare(old_count_query) catch |err| {
        std.log.err("❌ Failed to prepare old count query: {}", .{err});
        return;
    };
    defer old_count_stmt.deinit();

    const old_count_result = old_count_stmt.one(CountRow, .{}, .{}) catch |err| {
        std.log.err("❌ Failed to execute old count query: {}", .{err});
        std.log.err("   This suggests there may be an issue with the datetime comparison", .{});
        return;
    };

    if (old_count_result) |row| {
        std.log.debug("Found {d} archived books older than 1 year", .{row.count});
        if (row.count == 0) {
            std.log.debug("No old archived books to delete", .{});
            return;
        }
    }

    // Now perform the actual deletion
    const query =
        \\DELETE FROM books
        \\WHERE status = 'archived'
        \\AND archived_at IS NOT NULL
        \\AND archived_at < datetime('now', '-1 year')
    ;

    std.log.debug("Executing cleanup query: {s}", .{query});

    ctx.db.exec(query, .{}, .{}) catch |err| {
        std.log.err("❌ Failed to cleanup old archived books: {}", .{err});
        std.log.err("   Query was: {s}", .{query});
        std.log.err("   Error type suggests: {s}", .{@errorName(err)});

        // Try to get more info from SQLite
        std.log.err("   Checking table schema...", .{});
        const schema_query = "PRAGMA table_info(books)";
        var schema_stmt = ctx.db.prepare(schema_query) catch {
            std.log.err("   Could not check schema", .{});
            return;
        };
        defer schema_stmt.deinit();

        std.log.err("   If this error persists, the books table may need migration", .{});
        return;
    };

    std.log.info("✅ Cleaned up old archived books", .{});
}

/// Cleanup function for background task context (typed)
fn cleanupBackgroundContext(ctx: *BackgroundTaskContext, allocator: std.mem.Allocator) void {
    allocator.destroy(ctx);
}

/// Wrappers to adapt typed functions to the timer's anyopaque API
fn scanLibraryDirectoriesWrapper(context_ptr: *anyopaque) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context_ptr));
    scanLibraryDirectories(ctx);
}

fn cleanupOldBooksWrapper(context_ptr: *anyopaque) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context_ptr));
    cleanupOldBooks(ctx);
}

fn cleanupBackgroundContextWrapper(context: *anyopaque, allocator: std.mem.Allocator) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context));
    cleanupBackgroundContext(ctx, allocator);
}

/// Register background tasks for scanning library and cleaning up old books
pub const BooksTimerManager = @import("../../timer.zig").TimerManager(BackgroundTaskContext);

/// Create and return a typed TimerManager for background book tasks. Caller owns
/// the returned pointer and must call `deinit` and destroy it when finished.
pub fn createBackgroundTimerManager(allocator: std.mem.Allocator, db: *sqlite.Db, library_directories: []const []const u8) !*BooksTimerManager {
    const mgr = try allocator.create(BooksTimerManager);
    mgr.* = BooksTimerManager.init(allocator);

    // Create separate contexts for each task to avoid double-free
    const scan_ctx = try allocator.create(BackgroundTaskContext);
    scan_ctx.* = .{
        .db = db,
        .allocator = allocator,
        .library_directories = library_directories,
    };

    const cleanup_ctx = try allocator.create(BackgroundTaskContext);
    cleanup_ctx.* = .{
        .db = db,
        .allocator = allocator,
        .library_directories = library_directories,
    };

    // Get scan interval from environment (in minutes, default 5)
    const scan_interval_env = std.posix.getenv("SCAN_INTERVAL_MINUTES") orelse "5";
    const scan_interval_minutes = std.fmt.parseInt(u32, scan_interval_env, 10) catch 5;
    const scan_interval_ms = scan_interval_minutes * 60 * 1000;
    
    // Get cleanup interval from environment (in minutes, default 60)
    const cleanup_interval_env = std.posix.getenv("CLEANUP_INTERVAL_MINUTES") orelse "60";
    const cleanup_interval_minutes = std.fmt.parseInt(u32, cleanup_interval_env, 10) catch 60;
    const cleanup_interval_ms = cleanup_interval_minutes * 60 * 1000;

    // Run library scan every N minutes
    try mgr.registerTimer(scanLibraryDirectories, scan_ctx, scan_interval_ms, cleanupBackgroundContext);

    // Run cleanup every N minutes
    try mgr.registerTimer(cleanupOldBooks, cleanup_ctx, cleanup_interval_ms, cleanupBackgroundContext);

    std.log.info("📅 Registered books background tasks (scan every {}min, cleanup every {}min)", .{ scan_interval_minutes, cleanup_interval_minutes });

    return mgr;
}
