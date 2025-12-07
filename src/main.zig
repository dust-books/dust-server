const std = @import("std");
const Config = @import("config.zig").Config;
const DustServer = @import("server.zig").DustServer;
const Database = @import("database.zig").Database;
// TimerManager is created per-module now (typed); books exposes a factory.
const users = @import("users.zig");
const books = @import("books.zig");
const genres = @import("genres.zig");

// Global flag for shutdown signal
var should_shutdown = std.atomic.Value(bool).init(false);

/// Signal handler to set the shutdown flag
fn handleShutdown(sig: c_int) callconv(.c) void {
    _ = sig;
    should_shutdown.store(true, .seq_cst);
    std.log.debug("\nReceived shutdown signal, cleaning up...\n", .{});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.log.info("🚀 Dust Server (Zig Edition) - Version 0.1.0\n", .{});

    // Set up signal handling for graceful shutdown
    const posix = std.posix;
    const act = posix.Sigaction{
        .handler = .{ .handler = handleShutdown },
        .mask = posix.sigemptyset(),
        .flags = 0,
    };
    posix.sigaction(posix.SIG.INT, &act, null);
    posix.sigaction(posix.SIG.TERM, &act, null);

    // Load configuration
    var cfg = Config.load(allocator) catch |err| {
        std.log.err("Failed to load config: {}\n", .{err});
        return err;
    };
    defer cfg.deinit();

    std.log.info("Library directories: {d} configured\n", .{cfg.library_directories.len});
    std.log.info("Port: {}\n", .{cfg.port});
    std.log.info("Database: {s}\n", .{cfg.database_url});

    // Initialize database
    const db_path = if (std.mem.startsWith(u8, cfg.database_url, "file:"))
        cfg.database_url[5..]
    else
        cfg.database_url;

    var db = try Database.init(allocator, db_path);
    defer db.deinit();

    // Run migrations
    std.log.info("\nRunning database migrations...\n", .{});
    try db.runMigrations();
    try users.migrate(&db);
    try books.migrate(&db);
    try genres.migrate(&db.db);
    std.log.info("All migrations completed\n\n", .{});

    // Create typed timer manager for books background tasks
    const books_timer = try books.createBackgroundTimerManager(allocator, &db.db, cfg.library_directories);
    defer books_timer.deinit();
    defer allocator.destroy(books_timer);
    std.log.info("Background tasks registered\n\n", .{});

    // Start server
    var server = try DustServer.init(allocator, cfg.port, &db, cfg.jwt_secret, cfg.library_directories, &should_shutdown);
    defer server.deinit();

    std.log.info("Starting HTTP server on port {d}...\n", .{cfg.port});
    std.log.info("Listening for connections...\n", .{});

    try server.listen();

    std.log.info("Server shutdown complete\n", .{});
}
