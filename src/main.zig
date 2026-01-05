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
    std.log.debug("Received shutdown signal, cleaning up...", .{});
}

pub fn main() !void {
    var gpa = std.heap.DebugAllocator(.{ .stack_trace_frames = 30 }){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    std.log.info("🚀 Dust Server", .{});

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
        if (err == error.MissingJWTSecret) {
            std.log.err("Failed to load config: missing JWT secret. Set the JWT_SECRET environment variable (e.g. `export JWT_SECRET=openssl rand -base64 32`).", .{});
        } else {
            std.log.err("Failed to load config: {}", .{err});
        }
        return err;
    };
    defer cfg.deinit();

    std.log.info("Library directories: {d} configured", .{cfg.library_directories.len});
    std.log.info("Port: {}", .{cfg.port});
    std.log.info("Database: {s}", .{cfg.database_url});

    // Initialize database
    const db_path = if (std.mem.startsWith(u8, cfg.database_url, "file:"))
        cfg.database_url[5..]
    else
        cfg.database_url;

    var db = try Database.init(allocator, db_path);
    defer db.deinit();

    // Run migrations
    std.log.info("Running database migrations...", .{});
    try db.runMigrations();
    try users.migrate(&db);
    try books.migrate(&db);
    try genres.migrate(&db.db);
    std.log.info("All migrations completed", .{});

    // Create typed timer manager for books background tasks
    const books_timer = try books.createBackgroundTimerManager(allocator, &db.db, cfg.library_directories);
    defer books_timer.deinit();
    defer allocator.destroy(books_timer);
    std.log.info("Background tasks registered", .{});

    // Start server
    var server = try DustServer.init(allocator, cfg.port, &db, cfg.jwt_secret, cfg.library_directories, &should_shutdown);
    defer server.deinit();

    std.log.info("Starting HTTP server on port {d}...", .{cfg.port});
    std.log.info("Listening for connections...", .{});

    try server.listen();

    std.log.info("Server shutdown complete", .{});
}

// Import test modules to ensure they're included in the test build
test {
    // Core functionality tests
    _ = @import("scanner.zig");
    _ = @import("metadata_extractor.zig");
    _ = @import("openlibrary.zig");
    _ = @import("cover_manager.zig");
    _ = @import("validation.zig");

    // Auth module tests
    _ = @import("auth/jwt.zig");
    _ = @import("auth/permissions.zig");
}
