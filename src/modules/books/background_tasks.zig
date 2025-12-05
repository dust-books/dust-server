const std = @import("std");
const sqlite = @import("sqlite");
const TimerManager = @import("../../timer.zig").TimerManager;

/// Context structure for background tasks
const BackgroundTaskContext = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,
    library_directories: []const []const u8,
};

/// Background task to scan library directories for new books
fn scanLibraryDirectories(context_ptr: *anyopaque) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context_ptr));
    std.log.info("📚 Starting library scan...", .{});
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
    var dir = std.fs.openDirAbsolute(dir_path, .{ .iterate = true }) catch |err| {
        std.log.err("Failed to open directory {s}: {}", .{ dir_path, err });
        return err;
    };
    defer dir.close();

    var walker = try dir.walk(ctx.allocator);
    defer walker.deinit();

    while (try walker.next()) |entry| {
        if (entry.kind != .file) continue;

        if (std.mem.endsWith(u8, entry.basename, ".epub")) {
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
    const query = "SELECT COUNT(*) FROM books WHERE filepath = ?";
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

/// Background task to clean up old archived books
fn cleanupOldBooks(context_ptr: *anyopaque) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context_ptr));

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

/// Cleanup function for background task context
fn cleanupBackgroundContext(context: *anyopaque, allocator: std.mem.Allocator) void {
    const ctx: *BackgroundTaskContext = @ptrCast(@alignCast(context));
    allocator.destroy(ctx);
}

/// Register background tasks for scanning library and cleaning up old books
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
