const std = @import("std");
const zqlite = @import("zqlite");
const TimerManager = @import("../../timer.zig").TimerManager;
const cover = @import("../../cover_manager.zig");
const Scanner = @import("../../scanner.zig").Scanner;
const Config = @import("../../config.zig").Config;

const BackgroundTaskContext = struct {
    db: *zqlite.Conn,
    allocator: std.mem.Allocator,
    config: Config,
    io: std.Io,
};

fn scanLibraryDirectories(ctx: *BackgroundTaskContext) void {
    var arena = std.heap.ArenaAllocator.init(ctx.allocator);
    defer arena.deinit();
    const run_allocator = arena.allocator();

    std.log.info("Starting background library scan...", .{});

    var scanner = Scanner.init(ctx.io, run_allocator, ctx.db, ctx.config) catch |err| {
        std.log.err("Failed to init Scanner: {}", .{err});
        return;
    };

    for (ctx.config.library_directories) |dir| {
        if (dir.len == 0) continue;
        const abs_dir = if (std.fs.path.isAbsolute(dir)) dir else blk: {
            var cwd_buf: [std.Io.Dir.max_path_bytes]u8 = undefined;
            const cwd = if (std.c.realpath(".", &cwd_buf)) |p| std.mem.span(p) else {
                std.log.err("Failed to get cwd", .{});
                continue;
            };
            break :blk std.fs.path.join(run_allocator, &.{ cwd, dir }) catch |err| {
                std.log.err("Failed to join cwd and dir: {}", .{err});
                continue;
            };
        };
        defer if (!std.fs.path.isAbsolute(dir)) run_allocator.free(abs_dir);
        std.log.info("Scanning directory: {s}", .{abs_dir});
        _ = scanner.scanLibrary(ctx.io, abs_dir) catch |err| {
            std.log.err("Failed to scan directory {s}: {}", .{ abs_dir, err });
            continue;
        };
    }

    std.log.info("Background library scan completed", .{});
}

fn cleanupOldBooks(ctx: *BackgroundTaskContext) void {
    std.log.debug("Starting cleanup of old archived books (older than 1 year)", .{});

    const count_query = "SELECT COUNT(*) FROM books WHERE status = 'archived'";
    if (ctx.db.row(count_query, .{}) catch null) |row| {
        defer row.deinit();
        std.log.debug("Found {d} archived books total", .{row.int(0)});
    }

    const old_count_query =
        \\SELECT COUNT(*) FROM books
        \\WHERE status = 'archived'
        \\AND archived_at IS NOT NULL
        \\AND archived_at < datetime('now', '-1 year')
    ;

    const old_count = blk: {
        const row = ctx.db.row(old_count_query, .{}) catch |err| {
            std.log.err("Failed to execute old count query: {}", .{err});
            return;
        } orelse break :blk @as(i64, 0);
        defer row.deinit();
        break :blk row.int(0);
    };

    std.log.debug("Found {d} archived books older than 1 year", .{old_count});
    if (old_count == 0) {
        std.log.debug("No old archived books to delete", .{});
        return;
    }

    ctx.db.exec(
        \\DELETE FROM books
        \\WHERE status = 'archived'
        \\AND archived_at IS NOT NULL
        \\AND archived_at < datetime('now', '-1 year')
    , .{}) catch |err| {
        std.log.err("Failed to cleanup old archived books: {}", .{err});
        return;
    };

    std.log.info("Cleaned up old archived books", .{});
}

fn cleanupBackgroundContext(ctx: *BackgroundTaskContext, allocator: std.mem.Allocator) void {
    allocator.destroy(ctx);
}

pub const BooksTimerManager = @import("../../timer.zig").TimerManager(BackgroundTaskContext);

pub fn createBackgroundTimerManager(io: std.Io, allocator: std.mem.Allocator, db: *zqlite.Conn, cfg: Config) !*BooksTimerManager {
    const mgr = try allocator.create(BooksTimerManager);
    mgr.* = BooksTimerManager.init(io, allocator);

    const scan_ctx = try allocator.create(BackgroundTaskContext);
    scan_ctx.* = .{
        .db = db,
        .allocator = allocator,
        .config = cfg,
        .io = io,
    };

    const cleanup_ctx = try allocator.create(BackgroundTaskContext);
    cleanup_ctx.* = .{
        .db = db,
        .allocator = allocator,
        .config = cfg,
        .io = io,
    };

    const scan_interval_env = if (std.c.getenv("SCAN_INTERVAL_MINUTES")) |v| std.mem.span(v) else "5";
    const scan_interval_minutes = std.fmt.parseInt(u32, scan_interval_env, 10) catch 5;
    const scan_interval_ms = scan_interval_minutes * 60 * 1000;

    const cleanup_interval_env = if (std.c.getenv("CLEANUP_INTERVAL_MINUTES")) |v| std.mem.span(v) else "60";
    const cleanup_interval_minutes = std.fmt.parseInt(u32, cleanup_interval_env, 10) catch 60;
    const cleanup_interval_ms = cleanup_interval_minutes * 60 * 1000;

    try mgr.registerTimer(scanLibraryDirectories, scan_ctx, scan_interval_ms, cleanupBackgroundContext, true);
    try mgr.registerTimer(cleanupOldBooks, cleanup_ctx, cleanup_interval_ms, cleanupBackgroundContext, false);

    std.log.info("Registered books background tasks (scan every {}min, cleanup every {}min)", .{ scan_interval_minutes, cleanup_interval_minutes });

    return mgr;
}
