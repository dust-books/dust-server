const std = @import("std");
const sqlite = @import("sqlite");
const Database = @import("../database.zig").Database;

/// DbContext provides request-scoped database access with transaction support.
/// Each HTTP request should get its own context via the connection pool.
pub const DbContext = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,
    in_transaction: bool = false,
    
    /// Creates a new database context for a request
    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) DbContext {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }
    
    /// Begin a transaction - all subsequent operations are atomic
    pub fn beginTransaction(self: *DbContext) !void {
        if (self.in_transaction) {
            return error.TransactionAlreadyActive;
        }
        try self.db.exec("BEGIN TRANSACTION", .{}, .{});
        self.in_transaction = true;
    }
    
    /// Commit the current transaction - makes all changes permanent
    pub fn commit(self: *DbContext) !void {
        if (!self.in_transaction) {
            return error.NoActiveTransaction;
        }
        try self.db.exec("COMMIT", .{}, .{});
        self.in_transaction = false;
    }
    
    /// Rollback the current transaction - discards all changes
    pub fn rollback(self: *DbContext) !void {
        if (!self.in_transaction) {
            return error.NoActiveTransaction;
        }
        try self.db.exec("ROLLBACK", .{}, .{});
        self.in_transaction = false;
    }
    
    /// Execute a query and return a single result
    pub fn queryOne(self: *DbContext, comptime T: type, sql: []const u8, args: anytype) !?T {
        var stmt = try self.db.prepare(sql);
        defer stmt.deinit();
        return try stmt.one(T, .{}, args);
    }
    
    /// Execute a query and return all results
    pub fn queryAll(self: *DbContext, comptime T: type, sql: []const u8, args: anytype) ![]T {
        var stmt = try self.db.prepare(sql);
        defer stmt.deinit();
        return try stmt.all(T, self.allocator, .{}, args);
    }
    
    /// Execute a statement (INSERT, UPDATE, DELETE)
    pub fn exec(self: *DbContext, sql: []const u8, args: anytype) !void {
        var stmt = try self.db.prepare(sql);
        defer stmt.deinit();
        try stmt.exec(.{}, args);
    }
    
    /// Get the last inserted row ID (useful after INSERT)
    pub fn lastInsertRowId(self: *DbContext) i64 {
        return self.db.getLastInsertRowId();
    }
    
    /// Execute within a transaction - automatically commits on success, rolls back on error
    pub fn transaction(self: *DbContext, context: anytype, comptime func: fn (@TypeOf(context), *DbContext) anyerror!void) !void {
        try self.beginTransaction();
        errdefer self.rollback() catch {};
        
        try func(context, self);
        try self.commit();
    }
};

/// Connection pool for managing database connections across requests
pub const ConnectionPool = struct {
    database: *Database,
    allocator: std.mem.Allocator,
    max_connections: usize,
    available: std.ArrayList(*sqlite.Db),
    mutex: std.Thread.Mutex,
    
    pub fn init(allocator: std.mem.Allocator, database: *Database, max_connections: usize) !ConnectionPool {
        var pool = ConnectionPool{
            .database = database,
            .allocator = allocator,
            .max_connections = max_connections,
            .available = std.ArrayList(*sqlite.Db).init(allocator),
            .mutex = .{},
        };
        
        // Pre-allocate connections
        try pool.available.ensureTotalCapacity(max_connections);
        
        // For now, we'll share the single database connection
        // In a production system, you'd create multiple connections here
        for (0..max_connections) |_| {
            try pool.available.append(&database.db);
        }
        
        return pool;
    }
    
    pub fn deinit(self: *ConnectionPool) void {
        self.available.deinit();
    }
    
    /// Acquire a connection from the pool
    pub fn acquire(self: *ConnectionPool) !*sqlite.Db {
        self.mutex.lock();
        defer self.mutex.unlock();
        
        if (self.available.items.len == 0) {
            return error.NoConnectionsAvailable;
        }
        
        return self.available.pop();
    }
    
    /// Release a connection back to the pool
    pub fn release(self: *ConnectionPool, conn: *sqlite.Db) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        
        try self.available.append(conn);
    }
    
    /// Get a DbContext for the current request
    pub fn getContext(self: *ConnectionPool) !DbContext {
        const conn = try self.acquire();
        return DbContext.init(conn, self.allocator);
    }
    
    /// Release a context back to the pool
    pub fn releaseContext(self: *ConnectionPool, ctx: *DbContext) !void {
        // Rollback any uncommitted transaction
        if (ctx.in_transaction) {
            ctx.rollback() catch {};
        }
        try self.release(ctx.db);
    }
};
