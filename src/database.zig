const std = @import("std");
const zqlite = @import("zqlite");

pub const DbContext = @import("database/context.zig").DbContext;
pub const ConnectionPool = @import("database/context.zig").ConnectionPool;

pub const Database = struct {
    db: zqlite.Conn,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Database {
        const path_z = try allocator.dupeZ(u8, path);
        defer allocator.free(path_z);

        const flags = zqlite.OpenFlags.Create | zqlite.OpenFlags.ReadWrite | zqlite.OpenFlags.EXResCode;
        const db = try zqlite.open(path_z, flags);

        return Database{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Database) void {
        self.db.close();
    }

    pub fn runMigrations(self: *Database) !void {
        try self.db.exec("PRAGMA foreign_keys = ON", .{});

        try self.db.execNoArgs(
            \\CREATE TABLE IF NOT EXISTS migrations (
            \\  id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\  name TEXT NOT NULL UNIQUE,
            \\  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            \\)
        );

        std.log.debug("Database migrations initialized", .{});
    }

    pub fn hasMigration(self: *Database, name: []const u8) !bool {
        const query = "SELECT COUNT(*) FROM migrations WHERE name = ?";
        if (try self.db.row(query, .{name})) |row| {
            defer row.deinit();
            return row.int(0) > 0;
        }
        return false;
    }

    pub fn recordMigration(self: *Database, name: []const u8) !void {
        try self.db.exec("INSERT INTO migrations (name) VALUES (?)", .{name});
        std.log.debug("Migration applied: {s}", .{name});
    }

    pub fn execMultiple(self: *Database, sql: []const u8) !void {
        const sql_z = try self.allocator.dupeZ(u8, sql);
        defer self.allocator.free(sql_z);
        try self.db.execNoArgs(sql_z);
    }
};
