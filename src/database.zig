const std = @import("std");
const sqlite = @import("sqlite");

pub const DbContext = @import("database/context.zig").DbContext;
pub const ConnectionPool = @import("database/context.zig").ConnectionPool;

/// Database wrapper with migration support
pub const Database = struct {
    db: sqlite.Db,
    allocator: std.mem.Allocator,

    /// Initialize the Database with the given file path
    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Database {
        const path_z = try allocator.dupeZ(u8, path);
        defer allocator.free(path_z);

        const db = try sqlite.Db.init(.{
            .mode = .{ .File = path_z },
            .open_flags = .{
                .write = true,
                .create = true,
            },
            .threading_mode = .MultiThread,
        });

        return Database{
            .db = db,
            .allocator = allocator,
        };
    }

    /// Deinitialize the Database and close the connection
    pub fn deinit(self: *Database) void {
        self.db.deinit();
    }

    /// Run initial migrations to set up the database schema
    pub fn runMigrations(self: *Database) !void {
        // Enable foreign keys
        try self.db.exec("PRAGMA foreign_keys = ON", .{}, .{});

        // Create migrations table
        try self.db.exec(
            \\CREATE TABLE IF NOT EXISTS migrations (
            \\  id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\  name TEXT NOT NULL UNIQUE,
            \\  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            \\)
        , .{}, .{});

        std.log.debug("Database migrations initialized\n", .{});
    }

    /// Check if a migration has been applied
    pub fn hasMigration(self: *Database, name: []const u8) !bool {
        const query = "SELECT COUNT(*) FROM migrations WHERE name = ?";
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        const row = try stmt.one(i64, .{}, .{name});
        return if (row) |count| count > 0 else false;
    }

    /// Record a migration as applied
    pub fn recordMigration(self: *Database, name: []const u8) !void {
        const query = "INSERT INTO migrations (name) VALUES (?)";
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{name});
        std.log.debug("Migration applied: {s}\n", .{name});
    }

    ///
    pub fn execMultiple(self: *Database, sql: []const u8) !void {
        var stmt = try self.db.prepareDynamic(sql);
        defer stmt.deinit();
        try stmt.exec(.{}, .{});
    }

    // Note: For most database operations, access the raw sqlite.Db via db.db
    // The wrapper provides migration tracking and lifecycle management
    // Use .db.db.prepare(), .db.db.exec(), etc. for queries
};
