const std = @import("std");
const sqlite = @import("sqlite");
const TimerManager = @import("../../timer.zig").TimerManager;
const cover = @import("../../cover_manager.zig");

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
    // Convert to absolute path if needed
    const abs_dir_path = if (std.fs.path.isAbsolute(dir_path))
        dir_path
    else blk: {
        const cwd_path = try std.fs.cwd().realpathAlloc(ctx.allocator, ".");
        defer ctx.allocator.free(cwd_path);
        const result = try std.fs.path.join(ctx.allocator, &.{ cwd_path, dir_path });
        break :blk result;
    };
    defer if (!std.fs.path.isAbsolute(dir_path)) ctx.allocator.free(abs_dir_path);

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
            const full_path = try std.fs.path.join(ctx.allocator, &.{ abs_dir_path, entry.path });
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
    std.log.debug("[ISBN] addBookToDatabase called for: {s}", .{path});
    const basename = std.fs.path.basename(path);
    std.log.debug("[ISBN] Basename: {s}", .{basename});

    // Extract title from parent directory (not filename which is often ISBN)
    const parent_dir = std.fs.path.dirname(path) orelse "";
    const title = std.fs.path.basename(parent_dir);

    // Extract author from grandparent directory
    const grandparent_dir = std.fs.path.dirname(parent_dir) orelse "";
    const author_name = std.fs.path.basename(grandparent_dir);

    const ext = std.fs.path.extension(basename);
    const file_format = if (ext.len > 1) ext[1..] else "unknown";

    // Extract ISBN from filename (often the filename is just the ISBN)
    std.log.debug("[ISBN] Attempting to extract ISBN from filename: {s}", .{basename});
    const isbn = try deriveIsbnFromFilename(ctx.allocator, basename);
    if (isbn) |i| {
        std.log.debug("[ISBN] ✅ Extracted ISBN: {s}", .{i});
    } else {
        std.log.debug("[ISBN] ⚠️  No ISBN found in filename", .{});
    }
    defer if (isbn) |i| ctx.allocator.free(i);

    // First, ensure the author exists (using a simple insert or ignore approach)
    const author_query =
        \\INSERT OR IGNORE INTO authors (name, created_at, updated_at)
        \\VALUES (?, datetime('now'), datetime('now'))
    ;

    ctx.db.exec(author_query, .{}, .{author_name}) catch |err| {
        std.log.err("Failed to insert/get author: {}", .{err});
        return err;
    };

    // Get the author ID
    const author_id_query = "SELECT id FROM authors WHERE name = ?";
    var stmt = try ctx.db.prepare(author_id_query);
    defer stmt.deinit();

    const AuthorRow = struct { id: i64 };
    const author_row = try stmt.one(AuthorRow, .{}, .{author_name});
    const author_id = if (author_row) |row| row.id else return error.AuthorNotFound;

    // Get file size
    const file = if (std.fs.path.isAbsolute(path))
        std.fs.openFileAbsolute(path, .{}) catch |err| {
            std.log.err("Failed to open file for size: {}", .{err});
            return err;
        }
    else
        std.fs.cwd().openFile(path, .{}) catch |err| {
            std.log.err("Failed to open file for size: {}", .{err});
            return err;
        };
    defer file.close();

    const file_size = file.getEndPos() catch 0;

    var cover_manager = cover.CoverManager.init(ctx.allocator);
    const cover_path = cover_manager.findLocalCover(path) catch |err| blk: {
        std.log.warn("Failed to locate cover for {s}: {}", .{ path, err });
        break :blk null;
    };
    defer if (cover_path) |cp| ctx.allocator.free(cp);

    std.log.debug("[ISBN] Preparing INSERT query with ISBN: {s}", .{isbn orelse "<null>"});
    const query =
        \\INSERT INTO books (name, author, file_path, file_format, file_size, isbn, cover_image_path, created_at, updated_at)
        \\VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ;

    ctx.db.exec(query, .{}, .{ title, author_id, path, file_format, file_size, isbn, cover_path }) catch |err| {
        std.log.err("Failed to insert book: {}", .{err});
        std.log.err("[ISBN] Failed to insert with ISBN: {s}", .{isbn orelse "<null>"});
        return err;
    };

    std.log.debug("[ISBN] ✅ Book inserted successfully with ISBN: {s}", .{isbn orelse "<none>"});
}

/// Extract ISBN from filename - supports ISBN-10 (with optional X) and ISBN-13
fn deriveIsbnFromFilename(allocator: std.mem.Allocator, filename: []const u8) !?[]const u8 {
    std.log.debug("[ISBN] deriveIsbnFromFilename parsing: {s}", .{filename});

    // Remove extension first
    const name_without_ext = if (std.mem.lastIndexOfScalar(u8, filename, '.')) |dot_index|
        filename[0..dot_index]
    else
        filename;

    std.log.debug("[ISBN] Filename without extension: {s}", .{name_without_ext});

    var digit_buffer: [20]u8 = undefined;
    var digit_count: usize = 0;

    for (name_without_ext) |c| {
        if (std.ascii.isDigit(c)) {
            if (digit_count < digit_buffer.len) {
                digit_buffer[digit_count] = c;
                digit_count += 1;
            }
            continue;
        }

        // Support ISBN-10 with trailing X (check digit)
        if ((c == 'x' or c == 'X') and digit_count == 9) {
            if (digit_count < digit_buffer.len) {
                digit_buffer[digit_count] = 'X';
                digit_count += 1;
            }
            continue;
        }

        // Skip separators (hyphens, underscores, spaces, dots)
        if (c == '-' or c == '_' or c == ' ' or c == '.') {
            continue;
        }

        // Non-separator, non-digit character - check if we have a complete ISBN
        if (digit_count == 10 or digit_count == 13) {
            const isbn = try allocator.dupe(u8, digit_buffer[0..digit_count]);
            std.log.debug("[ISBN] Found ISBN (mid-string): {s}", .{isbn});
            return isbn;
        }
        digit_count = 0;
    }

    // Check final sequence
    if (digit_count == 10 or digit_count == 13) {
        const isbn = try allocator.dupe(u8, digit_buffer[0..digit_count]);
        std.log.debug("[ISBN] Found ISBN (at end): {s}", .{isbn});
        return isbn;
    }

    std.log.debug("[ISBN] No valid ISBN found (had {d} digits)", .{digit_count});
    return null;
}

/// Background task to clean up old archived books (typed)
fn cleanupOldBooks(ctx: *BackgroundTaskContext) void {
    std.log.debug("🧹 Starting cleanup of old archived books (older than 1 year)", .{});

    // First, check if we have any archived books
    const count_query =
        \\SELECT COUNT(*) as count FROM books WHERE status = 'archived'
    ;

    var count_stmt = ctx.db.prepare(count_query) catch |err| {
        std.log.err("Failed to prepare count query: {}", .{err});
        return;
    };
    defer count_stmt.deinit();

    const CountRow = struct { count: i64 };
    const count_result = count_stmt.one(CountRow, .{}, .{}) catch |err| {
        std.log.err("Failed to execute count query: {}", .{err});
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
        std.log.err("Failed to prepare old count query: {}", .{err});
        return;
    };
    defer old_count_stmt.deinit();

    const old_count_result = old_count_stmt.one(CountRow, .{}, .{}) catch |err| {
        std.log.err("Failed to execute old count query: {}", .{err});
        std.log.err("This suggests there may be an issue with the datetime comparison", .{});
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
        std.log.err("Failed to cleanup old archived books: {}", .{err});
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

    std.log.info("Registered books background tasks (scan every {}min, cleanup every {}min)", .{ scan_interval_minutes, cleanup_interval_minutes });

    return mgr;
}
