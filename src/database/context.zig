const std = @import("std");
const zqlite = @import("zqlite");
const Database = @import("../database.zig").Database;

pub const DbContext = struct {
    db: *zqlite.Conn,
    allocator: std.mem.Allocator,
    in_transaction: bool = false,

    pub fn init(db: *zqlite.Conn, allocator: std.mem.Allocator) DbContext {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn beginTransaction(self: *DbContext) !void {
        if (self.in_transaction) {
            return error.TransactionAlreadyActive;
        }
        try self.db.transaction();
        self.in_transaction = true;
    }

    pub fn commit(self: *DbContext) !void {
        if (!self.in_transaction) {
            return error.NoActiveTransaction;
        }
        try self.db.commit();
        self.in_transaction = false;
    }

    pub fn rollback(self: *DbContext) void {
        if (!self.in_transaction) return;
        self.db.rollback();
        self.in_transaction = false;
    }

    pub fn exec(self: *DbContext, sql: []const u8, args: anytype) !void {
        try self.db.exec(sql, args);
    }

    pub fn lastInsertRowId(self: *DbContext) i64 {
        return self.db.lastInsertedRowId();
    }

    pub fn transaction(self: *DbContext, context: anytype, comptime func: fn (@TypeOf(context), *DbContext) anyerror!void) !void {
        try self.beginTransaction();
        errdefer self.rollback();

        try func(context, self);
        try self.commit();
    }
};

pub const ConnectionPool = struct {
    database: *Database,
    allocator: std.mem.Allocator,
    io: std.Io,
    max_connections: usize,
    available: std.ArrayList(*zqlite.Conn),
    mutex: std.Io.Mutex,

    pub fn init(allocator: std.mem.Allocator, io: std.Io, database: *Database, max_connections: usize) !ConnectionPool {
        var pool = ConnectionPool{
            .database = database,
            .allocator = allocator,
            .io = io,
            .max_connections = max_connections,
            .available = std.ArrayList(*zqlite.Conn).empty,
            .mutex = std.Io.Mutex.init,
        };

        try pool.available.ensureTotalCapacity(allocator, max_connections);

        for (0..max_connections) |_| {
            try pool.available.append(allocator, &database.db);
        }

        return pool;
    }

    pub fn deinit(self: *ConnectionPool) void {
        self.available.deinit(self.allocator);
    }

    pub fn acquire(self: *ConnectionPool) !*zqlite.Conn {
        self.mutex.lockUncancelable(self.io);
        defer self.mutex.unlock(self.io);

        if (self.available.items.len == 0) {
            return error.NoConnectionsAvailable;
        }

        return self.available.pop();
    }

    pub fn release(self: *ConnectionPool, conn: *zqlite.Conn) !void {
        self.mutex.lockUncancelable(self.io);
        defer self.mutex.unlock(self.io);

        try self.available.append(self.allocator, conn);
    }

    pub fn getContext(self: *ConnectionPool) !DbContext {
        const conn = try self.acquire();
        return DbContext.init(conn, self.allocator);
    }

    pub fn releaseContext(self: *ConnectionPool, ctx: *DbContext) !void {
        if (ctx.in_transaction) {
            ctx.rollback();
        }
        try self.release(ctx.db);
    }
};
