const std = @import("std");
const sqlite = @import("sqlite");
const TimerManager = @import("../../timer.zig").TimerManager;
const cover = @import("../../cover_manager.zig");
const Scanner = @import("../../scanner.zig").Scanner;
const Config = @import("../../config.zig").Config;

/// Context structure for background tasks
const BackgroundTaskContext = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,
    config: Config,
};

/// Background task to scan library directories for new books (typed)
fn scanLibraryDirectories(ctx: *BackgroundTaskContext) void {
    var arena = std.heap.ArenaAllocator.init(ctx.allocator);
    defer arena.deinit();
    const run_allocator = arena.allocator();

    std.log.info("Starting background library scan...", .{});

    // Create a Scanner instance using the same allocator and db
    var scanner = Scanner.init(run_allocator, ctx.db, ctx.config) catch |err| {
        std.log.err("Failed to init Scanner: {}", .{err});
        return;
    };

    for (ctx.config.library_directories) |dir| {
        if (dir.len == 0) continue;
        // Ensure absolute path
        const abs_dir = if (std.fs.path.isAbsolute(dir)) dir else blk: {
            const cwd = std.fs.cwd().realpathAlloc(run_allocator, ".") catch |err| {
                std.log.err("Failed to get cwd: {}", .{err});
                continue;
            };
            defer run_allocator.free(cwd);
            break :blk std.fs.path.join(run_allocator, &.{ cwd, dir }) catch |err| {
                std.log.err("Failed to join cwd and dir: {}", .{err});
                continue;
            };
        };
        defer if (!std.fs.path.isAbsolute(dir)) run_allocator.free(abs_dir);
        std.log.info("Scanning directory: {s}", .{abs_dir});
        _ = scanner.scanLibrary(abs_dir) catch |err| {
            std.log.err("Failed to scan directory {s}: {}", .{ abs_dir, err });
            continue;
        };
    }

    std.log.info("Background library scan completed", .{});
}

/// Background task to clean up old archived books (typed)
fn cleanupOldBooks(ctx: *BackgroundTaskContext) void {
    std.log.debug("Starting cleanup of old archived books (older than 1 year)", .{});

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
/// Register background tasks for scanning library and cleaning up old books
pub const BooksTimerManager = @import("../../timer.zig").TimerManager(BackgroundTaskContext);

/// Create and return a typed TimerManager for background book tasks. Caller owns
/// the returned pointer and must call `deinit` and destroy it when finished.
pub fn createBackgroundTimerManager(allocator: std.mem.Allocator, db: *sqlite.Db, cfg: Config) !*BooksTimerManager {
    const mgr = try allocator.create(BooksTimerManager);
    mgr.* = BooksTimerManager.init(allocator);

    // Create separate contexts for each task to avoid double-free
    const scan_ctx = try allocator.create(BackgroundTaskContext);
    scan_ctx.* = .{
        .db = db,
        .allocator = allocator,
        .config = cfg,
    };

    const cleanup_ctx = try allocator.create(BackgroundTaskContext);
    cleanup_ctx.* = .{
        .db = db,
        .allocator = allocator,
        .config = cfg,
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
    try mgr.registerTimer(scanLibraryDirectories, scan_ctx, scan_interval_ms, cleanupBackgroundContext, true);

    // Run cleanup every N minutes
    try mgr.registerTimer(cleanupOldBooks, cleanup_ctx, cleanup_interval_ms, cleanupBackgroundContext, false);

    std.log.info("Registered books background tasks (scan every {}min, cleanup every {}min)", .{ scan_interval_minutes, cleanup_interval_minutes });

    return mgr;
}
