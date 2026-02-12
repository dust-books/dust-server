const std = @import("std");
const build = @import("build.zig.zon");
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

    // Parse command line arguments
    var args = try std.process.argsWithAllocator(allocator);
    defer args.deinit();
    _ = args.skip(); // Skip program name

    var stdout_buffer: [1024]u8 = undefined;
    var stdout_writer = std.fs.File.stdout().writer(&stdout_buffer);
    var stdout = &stdout_writer.interface;

    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, "--version") or std.mem.eql(u8, arg, "-v")) {
            try stdout.print("dust-server {s}\n", .{build.version});
            try stdout.flush();
            return;
        } else if (std.mem.eql(u8, arg, "--help") or std.mem.eql(u8, arg, "-h")) {
            try stdout.writeAll(
                \\dust-server - A media server for books and comics
                \\
                \\Usage: dust-server [OPTIONS]
                \\
                \\Options:
                \\  -v, --version    Show version information
                \\  -h, --help       Show this help message
                \\
                \\Environment Variables:
                \\  JWT_SECRET                   JWT secret for authentication (required)
                \\  DUST_DIRS                    Colon-separated directories to scan
                \\  PORT                         Server port (default: 4001)
                \\  DATABASE_URL                 Database file path
                \\  SCAN_INTERVAL_MINUTES        Library scan interval (default: 5)
                \\  CLEANUP_INTERVAL_MINUTES     Old books cleanup interval (default: 60)
                \\  GOOGLE_BOOKS_API_KEY         Google Books API key (optional)
                \\
                \\For more information, visit: https://github.com/dust-books/dust-server
                \\
            );
            try stdout.flush();
            return;
        }
    }

    std.log.info("Dust Server v{s}", .{build.version});

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
    defer cfg.deinit(allocator);

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
    const books_timer = try books.createBackgroundTimerManager(allocator, &db.db, cfg);
    defer books_timer.deinit();
    defer allocator.destroy(books_timer);
    std.log.info("Background tasks registered", .{});

    // Start server
    var server = try DustServer.init(allocator, cfg.port, &db, cfg, &should_shutdown);
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

    // Invitation token tests
    _ = @import("modules/users/invitation.zig");
}
