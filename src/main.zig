const std = @import("std");
const Config = @import("config.zig").Config;
const DustServer = @import("server.zig").DustServer;
const Database = @import("database.zig").Database;
const TimerManager = @import("timer.zig").TimerManager;
const users = @import("users.zig");
const books = @import("books.zig");
const genres = @import("genres.zig");

// Global flag for shutdown signal
var should_shutdown = std.atomic.Value(bool).init(false);

fn handleShutdown(sig: c_int) callconv(.c) void {
    _ = sig;
    should_shutdown.store(true, .seq_cst);
    std.debug.print("\nReceived shutdown signal, cleaning up...\n", .{});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.debug.print("🚀 Dust Server (Zig Edition) - Version 0.1.0\n", .{});

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
        std.debug.print("Failed to load config: {}\n", .{err});
        return err;
    };
    defer cfg.deinit();

    std.debug.print("Library directories: {d} configured\n", .{cfg.library_directories.len});
    std.debug.print("Port: {}\n", .{cfg.port});
    std.debug.print("Database: {s}\n", .{cfg.database_url});

    // Initialize database
    const db_path = if (std.mem.startsWith(u8, cfg.database_url, "file:"))
        cfg.database_url[5..]
    else
        cfg.database_url;

    var db = try Database.init(allocator, db_path);
    defer db.deinit();

    // Run migrations
    std.debug.print("\nRunning database migrations...\n", .{});
    try db.runMigrations();
    try users.migrate(&db);
    try books.migrate(&db);
    try genres.migrate(&db.db);
    std.debug.print("All migrations completed\n\n", .{});

    // Initialize timer manager for background tasks
    var timer_manager = TimerManager.init(allocator);
    defer timer_manager.deinit();

    // Register background tasks
    std.debug.print("Registering background tasks...\n", .{});
    try books.registerBackgroundTasks(&timer_manager, &db.db, allocator, cfg.library_directories);
    std.debug.print("Background tasks registered\n\n", .{});

    // Start server
    var server = try DustServer.init(allocator, cfg.port, &db, cfg.jwt_secret, &should_shutdown);
    defer server.deinit();

    std.debug.print("Starting HTTP server on port {d}...\n", .{cfg.port});
    std.debug.print("Listening for connections...\n", .{});

    try server.listen();

    std.debug.print("Server shutdown complete\n", .{});
}
