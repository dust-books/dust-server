# Zig Migration Guide for Dust Server

> Practical guide for reimplementing Dust server in Zig

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Mapping](#architecture-mapping)
3. [Technology Stack Equivalents](#technology-stack-equivalents)
4. [Implementation Phases](#implementation-phases)
5. [Database Layer](#database-layer)
6. [HTTP Server Layer](#http-server-layer)
7. [Authentication Layer](#authentication-layer)
8. [Business Logic Layer](#business-logic-layer)
9. [Testing Strategy](#testing-strategy)
10. [Performance Targets](#performance-targets)
11. [Migration Checklist](#migration-checklist)

---

## Overview

This guide provides a structured approach to reimplementing the Dust server in Zig while preserving all existing functionality and improving performance.

### Goals

1. **100% API compatibility** with existing client applications
2. **Improved performance** through Zig's compile-time optimizations
3. **Lower memory footprint** through manual memory management
4. **Better error handling** through Zig's error types
5. **Simplified deployment** through single binary compilation

### Non-Goals

- Rewriting the client application
- Changing the API surface
- Modifying the database schema
- Changing authentication mechanisms

---

## Architecture Mapping

### Current TypeScript Architecture

```
main.ts (DustService)
  ├─ Router (Oak)
  ├─ Database (libsql)
  ├─ Config (environment vars)
  ├─ TimerManager
  └─ Modules
      ├─ UsersModule
      │   ├─ Routes
      │   ├─ Middleware
      │   ├─ Services (UserService, PermissionService)
      │   └─ Data Layer
      ├─ BooksModule
      │   ├─ Routes
      │   ├─ Services (BookService, TagService, etc.)
      │   └─ Data Layer
      └─ GenresModule
          ├─ Routes
          └─ Data Layer
```

### Proposed Zig Architecture

```
src/main.zig
  ├─ server.zig (HTTP server)
  ├─ router.zig (Route matching)
  ├─ database.zig (SQLite wrapper)
  ├─ config.zig (Configuration)
  ├─ timer.zig (Periodic tasks)
  └─ modules/
      ├─ users/
      │   ├─ routes.zig
      │   ├─ middleware.zig
      │   ├─ service.zig
      │   ├─ permission.zig
      │   └─ data.zig
      ├─ books/
      │   ├─ routes.zig
      │   ├─ service.zig
      │   ├─ crawler.zig
      │   ├─ metadata.zig
      │   ├─ tags.zig
      │   ├─ progress.zig
      │   ├─ archive.zig
      │   └─ data.zig
      └─ genres/
          ├─ routes.zig
          └─ data.zig
```

---

## Technology Stack Equivalents

### HTTP Server

**Current**: Oak (Deno web framework)

**Zig Options**:
1. **httpz** - Modern HTTP server library
   - Pros: Clean API, good performance, well-maintained
   - Cons: Relatively new
   - Recommendation: **Use this**

2. **zap** - Facil.io binding
   - Pros: Very fast, battle-tested C library
   - Cons: C interop overhead, FFI complexity

3. **std.http** - Zig standard library
   - Pros: No dependencies, stable
   - Cons: Lower-level API, more boilerplate

**Recommendation**: Use **httpz** for balance of performance and developer experience.

```zig
const httpz = @import("httpz");

pub fn main() !void {
    var server = try httpz.Server().init(allocator, .{
        .port = 4001,
    });
    defer server.deinit();
    
    var router = server.router();
    router.get("/health", healthCheck);
    
    try server.listen();
}
```

### Database

**Current**: libsql (SQLite-compatible)

**Zig Options**:
1. **sqlite.zig** - Pure Zig SQLite bindings
   - Pros: Native Zig, type-safe
   - Cons: Newer library

2. **C SQLite** - Direct C bindings
   - Pros: Battle-tested, full feature set
   - Cons: C interop, less type-safe

**Recommendation**: Use **C SQLite bindings** for stability and compatibility.

```zig
const sqlite = @import("sqlite");

pub const Database = struct {
    db: *sqlite.sqlite3,
    
    pub fn init(path: []const u8) !Database {
        var db: ?*sqlite.sqlite3 = null;
        const rc = sqlite.sqlite3_open(path.ptr, &db);
        if (rc != sqlite.SQLITE_OK) {
            return error.DatabaseOpenFailed;
        }
        return Database{ .db = db.? };
    }
    
    pub fn deinit(self: *Database) void {
        _ = sqlite.sqlite3_close(self.db);
    }
};
```

### JSON Parsing

**Current**: Built-in Deno JSON

**Zig Options**:
1. **std.json** - Zig standard library
   - Pros: No dependencies, compile-time parsing
   - Cons: More verbose API

2. **zig-json** - Community library
   - Pros: Easier API
   - Cons: External dependency

**Recommendation**: Use **std.json** for zero dependencies.

```zig
const std = @import("std");

const User = struct {
    email: []const u8,
    password: []const u8,
};

pub fn parseLoginRequest(json_str: []const u8) !User {
    var parser = std.json.Parser.init(allocator, false);
    defer parser.deinit();
    
    var tree = try parser.parse(json_str);
    defer tree.deinit();
    
    return try std.json.parseFromValue(User, allocator, tree.root, .{});
}
```

### JWT

**Current**: jose library

**Zig Options**:
1. **jwt-zig** - Pure Zig JWT implementation
   - Pros: Native Zig, good API
   - Cons: Smaller ecosystem

2. **libjwt** - C library bindings
   - Pros: Battle-tested
   - Cons: C interop

**Recommendation**: Use **jwt-zig** for native implementation.

```zig
const jwt = @import("jwt");

pub fn createToken(user_id: i64, email: []const u8) ![]const u8 {
    var claims = jwt.Claims.init(allocator);
    defer claims.deinit();
    
    try claims.put("user_id", user_id);
    try claims.put("email", email);
    try claims.put("exp", std.time.timestamp() + 86400); // 24 hours
    
    return try jwt.encode(claims, secret_key, .HS256);
}

pub fn validateToken(token: []const u8) !jwt.Claims {
    return try jwt.decode(allocator, token, secret_key, .HS256);
}
```

### Password Hashing

**Current**: bcrypt via @ts-rex/bcrypt

**Zig Options**:
1. **zig-bcrypt** - Pure Zig implementation
   - Pros: Native Zig
   - Cons: Less battle-tested

2. **libsodium** - C library (argon2)
   - Pros: Modern, recommended by OWASP
   - Cons: Different algorithm (migration needed)

3. **bcrypt C library** - Original C implementation
   - Pros: Battle-tested, compatible
   - Cons: C interop

**Recommendation**: Use **bcrypt C library** for compatibility during migration, consider Argon2 for new installations.

```zig
const bcrypt = @cImport({
    @cInclude("bcrypt.h");
});

pub fn hashPassword(password: []const u8) ![61]u8 {
    var salt: [29]u8 = undefined;
    if (bcrypt.bcrypt_gensalt(12, &salt) != 0) {
        return error.SaltGenerationFailed;
    }
    
    var hash: [61]u8 = undefined;
    if (bcrypt.bcrypt_hashpw(password.ptr, &salt, &hash) != 0) {
        return error.HashingFailed;
    }
    
    return hash;
}

pub fn verifyPassword(password: []const u8, hash: []const u8) bool {
    return bcrypt.bcrypt_checkpw(password.ptr, hash.ptr) == 0;
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Basic HTTP server with health check

Tasks:
- [ ] Set up Zig project structure
- [ ] Implement basic HTTP server
- [ ] Implement router
- [ ] Add health check endpoint
- [ ] Add root endpoint
- [ ] Implement configuration loading
- [ ] Add CORS middleware
- [ ] Add error handling middleware

**Deliverable**: Server that responds to `/` and `/health`

### Phase 2: Database Layer (Weeks 3-4)

**Goal**: Database connectivity and migrations

Tasks:
- [ ] Implement database wrapper
- [ ] Port migration system
- [ ] Create data access layer for users table
- [ ] Create data access layer for books table
- [ ] Create data access layer for authors table
- [ ] Create data access layer for tags table
- [ ] Add transaction support
- [ ] Add prepared statement caching

**Deliverable**: Full database layer with migrations

### Phase 3: Authentication (Weeks 5-6)

**Goal**: User authentication working

Tasks:
- [ ] Implement JWT generation
- [ ] Implement JWT validation
- [ ] Implement bcrypt password hashing
- [ ] Port user service
- [ ] Port authentication routes
- [ ] Implement auth middleware
- [ ] Add session management

**Deliverable**: Login/register/logout working

### Phase 4: Authorization (Weeks 7-8)

**Goal**: Permission system working

Tasks:
- [ ] Port permission data layer
- [ ] Port permission service
- [ ] Port role management
- [ ] Implement permission middleware
- [ ] Port admin user routes
- [ ] Port admin role routes

**Deliverable**: Full permission system

### Phase 5: Books Module (Weeks 9-12)

**Goal**: Core book functionality

Tasks:
- [ ] Port book data layer
- [ ] Port book service
- [ ] Implement file system walker
- [ ] Implement book crawler
- [ ] Port metadata extractor
- [ ] Port external metadata service
- [ ] Port book routes
- [ ] Port tag service
- [ ] Port tag routes
- [ ] Implement book streaming

**Deliverable**: Book listing, details, streaming

### Phase 6: Reading Progress (Weeks 13-14)

**Goal**: Reading progress tracking

Tasks:
- [ ] Port progress data layer
- [ ] Port progress service
- [ ] Port progress routes
- [ ] Implement statistics calculation
- [ ] Implement streak calculation

**Deliverable**: Full reading progress tracking

### Phase 7: Archive Management (Week 15)

**Goal**: Archive system working

Tasks:
- [ ] Port archive service
- [ ] Port archive routes
- [ ] Implement validation timer

**Deliverable**: Archive management

### Phase 8: Genres Module (Week 16)

**Goal**: Genre filtering

Tasks:
- [ ] Port genre routes
- [ ] Implement genre filtering with permissions

**Deliverable**: Genre system

### Phase 9: Periodic Tasks (Week 17)

**Goal**: Background scanning

Tasks:
- [ ] Implement timer manager
- [ ] Port book scanning timer
- [ ] Port archive validation timer

**Deliverable**: Automated background tasks

### Phase 10: Testing & Optimization (Weeks 18-20)

**Goal**: Production-ready system

Tasks:
- [ ] Write integration tests
- [ ] Write unit tests
- [ ] Load testing
- [ ] Memory profiling
- [ ] Optimize database queries
- [ ] Implement connection pooling
- [ ] Add caching where appropriate
- [ ] Documentation

**Deliverable**: Production-ready server

---

## Database Layer

### Connection Management

```zig
const std = @import("std");
const sqlite = @import("sqlite");

pub const Database = struct {
    db: *sqlite.sqlite3,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Database {
        var db: ?*sqlite.sqlite3 = null;
        const rc = sqlite.sqlite3_open(path.ptr, &db);
        if (rc != sqlite.SQLITE_OK) {
            return error.DatabaseOpenFailed;
        }
        
        return Database{
            .db = db.?,
            .allocator = allocator,
        };
    }
    
    pub fn deinit(self: *Database) void {
        _ = sqlite.sqlite3_close(self.db);
    }
    
    pub fn execute(self: *Database, sql: []const u8) !void {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        defer if (stmt != null) _ = sqlite.sqlite3_finalize(stmt);
        
        const rc = sqlite.sqlite3_prepare_v2(
            self.db,
            sql.ptr,
            @intCast(sql.len),
            &stmt,
            null
        );
        
        if (rc != sqlite.SQLITE_OK) {
            return error.PrepareStatementFailed;
        }
        
        const step_rc = sqlite.sqlite3_step(stmt);
        if (step_rc != sqlite.SQLITE_DONE and step_rc != sqlite.SQLITE_ROW) {
            return error.ExecuteFailed;
        }
    }
};
```

### Prepared Statements

```zig
pub const Statement = struct {
    stmt: *sqlite.sqlite3_stmt,
    
    pub fn bind(self: *Statement, index: u32, value: anytype) !void {
        const T = @TypeOf(value);
        
        if (T == []const u8) {
            const rc = sqlite.sqlite3_bind_text(
                self.stmt,
                @intCast(index),
                value.ptr,
                @intCast(value.len),
                sqlite.SQLITE_TRANSIENT
            );
            if (rc != sqlite.SQLITE_OK) return error.BindFailed;
        } else if (T == i64 or T == i32) {
            const rc = sqlite.sqlite3_bind_int64(
                self.stmt,
                @intCast(index),
                @intCast(value)
            );
            if (rc != sqlite.SQLITE_OK) return error.BindFailed;
        }
        // Add more types as needed
    }
    
    pub fn step(self: *Statement) !bool {
        const rc = sqlite.sqlite3_step(self.stmt);
        if (rc == sqlite.SQLITE_ROW) return true;
        if (rc == sqlite.SQLITE_DONE) return false;
        return error.StepFailed;
    }
    
    pub fn columnText(self: *Statement, index: u32) []const u8 {
        const ptr = sqlite.sqlite3_column_text(self.stmt, @intCast(index));
        const len = sqlite.sqlite3_column_bytes(self.stmt, @intCast(index));
        return ptr[0..@intCast(len)];
    }
    
    pub fn columnInt64(self: *Statement, index: u32) i64 {
        return sqlite.sqlite3_column_int64(self.stmt, @intCast(index));
    }
};
```

### Transactions

```zig
pub fn transaction(self: *Database, comptime func: anytype, args: anytype) !@TypeOf(func(args)) {
    try self.execute("BEGIN TRANSACTION");
    errdefer self.execute("ROLLBACK") catch {};
    
    const result = try @call(.auto, func, args);
    
    try self.execute("COMMIT");
    return result;
}
```

---

## HTTP Server Layer

### Request Context

```zig
pub const Context = struct {
    request: *httpz.Request,
    response: *httpz.Response,
    allocator: std.mem.Allocator,
    database: *Database,
    
    // Authentication state
    user: ?User = null,
    
    pub fn json(self: *Context, data: anytype) !void {
        var string = std.ArrayList(u8).init(self.allocator);
        defer string.deinit();
        
        try std.json.stringify(data, .{}, string.writer());
        
        self.response.headers.add("Content-Type", "application/json");
        self.response.body = try self.allocator.dupe(u8, string.items);
    }
    
    pub fn parseJson(self: *Context, comptime T: type) !T {
        const body = self.request.body orelse return error.NoBody;
        return try std.json.parseFromSlice(T, self.allocator, body, .{});
    }
};
```

### Router

```zig
pub const Router = struct {
    routes: std.StringHashMap(Route),
    allocator: std.mem.Allocator,
    
    const Route = struct {
        method: Method,
        handler: *const fn(*Context) anyerror!void,
        middleware: []const Middleware,
    };
    
    pub fn get(self: *Router, path: []const u8, handler: anytype) !void {
        try self.addRoute(.GET, path, handler, &.{});
    }
    
    pub fn post(self: *Router, path: []const u8, handler: anytype) !void {
        try self.addRoute(.POST, path, handler, &.{});
    }
    
    pub fn handle(self: *Router, ctx: *Context) !void {
        const key = try std.fmt.allocPrint(
            self.allocator,
            "{s}:{s}",
            .{ @tagName(ctx.request.method), ctx.request.path }
        );
        defer self.allocator.free(key);
        
        const route = self.routes.get(key) orelse {
            ctx.response.status = 404;
            try ctx.json(.{ .error = "Not found" });
            return;
        };
        
        // Run middleware chain
        for (route.middleware) |middleware| {
            try middleware(ctx);
        }
        
        // Run handler
        try route.handler(ctx);
    }
};
```

### Middleware

```zig
pub const Middleware = *const fn(*Context) anyerror!void;

pub fn cors(ctx: *Context) !void {
    ctx.response.headers.add("Access-Control-Allow-Origin", "*");
    ctx.response.headers.add("Access-Control-Allow-Credentials", "true");
    ctx.response.headers.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    ctx.response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    
    if (ctx.request.method == .OPTIONS) {
        ctx.response.status = 200;
        return error.StopChain; // Custom error to stop middleware chain
    }
}

pub fn errorHandler(ctx: *Context) !void {
    ctx.handle() catch |err| {
        std.log.err("Request error: {any}", .{err});
        
        ctx.response.status = switch (err) {
            error.Unauthorized => 401,
            error.Forbidden => 403,
            error.NotFound => 404,
            else => 500,
        };
        
        try ctx.json(.{
            .error = @errorName(err),
        });
    };
}
```

---

## Authentication Layer

### JWT Implementation

```zig
const jwt = @import("jwt");
const std = @import("std");

pub const JwtPayload = struct {
    user_id: i64,
    email: []const u8,
    display_name: []const u8,
    iat: i64,
    exp: i64,
    iss: []const u8,
    aud: []const u8,
};

pub fn createToken(allocator: std.mem.Allocator, user_id: i64, email: []const u8, display_name: []const u8) ![]const u8 {
    const now = std.time.timestamp();
    
    const payload = JwtPayload{
        .user_id = user_id,
        .email = email,
        .display_name = display_name,
        .iat = now,
        .exp = now + 86400, // 24 hours
        .iss = "urn:dust:server",
        .aud = "urn:dust:client",
    };
    
    return try jwt.encode(allocator, payload, secret_key, .HS256);
}

pub fn validateToken(allocator: std.mem.Allocator, token: []const u8) !JwtPayload {
    const payload = try jwt.decode(allocator, JwtPayload, token, secret_key, .HS256);
    
    // Verify expiration
    const now = std.time.timestamp();
    if (payload.exp < now) {
        return error.TokenExpired;
    }
    
    // Verify issuer and audience
    if (!std.mem.eql(u8, payload.iss, "urn:dust:server")) {
        return error.InvalidIssuer;
    }
    if (!std.mem.eql(u8, payload.aud, "urn:dust:client")) {
        return error.InvalidAudience;
    }
    
    return payload;
}
```

### Authentication Middleware

```zig
pub fn requireAuth(ctx: *Context) !void {
    const auth_header = ctx.request.headers.get("Authorization") orelse {
        ctx.response.status = 401;
        try ctx.json(.{ .error = "Authentication required" });
        return error.Unauthorized;
    };
    
    if (!std.mem.startsWith(u8, auth_header, "Bearer ")) {
        ctx.response.status = 401;
        try ctx.json(.{ .error = "Invalid authorization header" });
        return error.Unauthorized;
    }
    
    const token = auth_header[7..]; // Skip "Bearer "
    
    const payload = validateToken(ctx.allocator, token) catch {
        ctx.response.status = 401;
        try ctx.json(.{ .error = "Invalid or expired token" });
        return error.Unauthorized;
    };
    
    // Load user from database
    ctx.user = try getUserById(ctx.database, payload.user_id);
}

pub fn requirePermission(comptime permission: []const u8) Middleware {
    const middleware = struct {
        fn handler(ctx: *Context) !void {
            const user = ctx.user orelse return error.Unauthorized;
            
            const has_permission = try checkUserPermission(
                ctx.database,
                user.id,
                permission
            );
            
            if (!has_permission) {
                ctx.response.status = 403;
                try ctx.json(.{
                    .error = std.fmt.allocPrint(
                        ctx.allocator,
                        "Permission denied: {s} required",
                        .{permission}
                    ) catch return error.OutOfMemory,
                });
                return error.Forbidden;
            }
        }
    }.handler;
    
    return middleware;
}
```

---

## Business Logic Layer

### Service Pattern

```zig
pub const BookService = struct {
    database: *Database,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, database: *Database) BookService {
        return .{
            .database = database,
            .allocator = allocator,
        };
    }
    
    pub fn getBookById(self: *BookService, id: i64) !Book {
        const query = "SELECT * FROM books WHERE id = ?";
        var stmt = try self.database.prepare(query);
        defer stmt.deinit();
        
        try stmt.bind(1, id);
        
        if (!try stmt.step()) {
            return error.NotFound;
        }
        
        return Book{
            .id = stmt.columnInt64(0),
            .name = try self.allocator.dupe(u8, stmt.columnText(1)),
            .author = stmt.columnInt64(2),
            .filepath = try self.allocator.dupe(u8, stmt.columnText(3)),
            // ... more fields
        };
    }
    
    pub fn getAllBooks(self: *BookService) ![]Book {
        const query = "SELECT * FROM books WHERE status = 'active'";
        var stmt = try self.database.prepare(query);
        defer stmt.deinit();
        
        var books = std.ArrayList(Book).init(self.allocator);
        errdefer books.deinit();
        
        while (try stmt.step()) {
            try books.append(Book{
                .id = stmt.columnInt64(0),
                .name = try self.allocator.dupe(u8, stmt.columnText(1)),
                // ... more fields
            });
        }
        
        return books.toOwnedSlice();
    }
};
```

---

## Testing Strategy

### Unit Tests

```zig
const std = @import("std");
const testing = std.testing;

test "JWT token creation and validation" {
    const allocator = testing.allocator;
    
    const token = try createToken(allocator, 1, "test@example.com", "Test User");
    defer allocator.free(token);
    
    const payload = try validateToken(allocator, token);
    
    try testing.expectEqual(@as(i64, 1), payload.user_id);
    try testing.expectEqualStrings("test@example.com", payload.email);
}

test "Password hashing and verification" {
    const password = "test123";
    const hash = try hashPassword(password);
    
    try testing.expect(verifyPassword(password, &hash));
    try testing.expect(!verifyPassword("wrong", &hash));
}
```

### Integration Tests

```zig
test "User registration flow" {
    const allocator = testing.allocator;
    
    // Setup test database
    var db = try Database.init(allocator, ":memory:");
    defer db.deinit();
    
    try db.migrate(); // Run migrations
    
    // Create test server
    var server = try createTestServer(allocator, &db);
    defer server.deinit();
    
    // Make request
    const response = try server.post("/auth/register", .{
        .username = "testuser",
        .email = "test@example.com",
        .password = "test123",
        .displayName = "Test User",
    });
    
    try testing.expectEqual(@as(u16, 201), response.status);
    
    const body = try std.json.parseFromSlice(
        User,
        allocator,
        response.body,
        .{}
    );
    defer body.deinit();
    
    try testing.expectEqualStrings("testuser", body.value.username);
}
```

---

## Performance Targets

### Response Time Targets

| Endpoint Category | Target (p95) | Target (p99) |
|------------------|--------------|--------------|
| Health check | < 1ms | < 2ms |
| Authentication | < 50ms | < 100ms |
| Book listing | < 100ms | < 200ms |
| Book details | < 50ms | < 100ms |
| Book streaming | N/A | N/A |
| Progress update | < 50ms | < 100ms |

### Memory Targets

- **Idle memory**: < 10MB
- **Peak memory** (under load): < 100MB
- **Per-request memory**: < 1MB

### Throughput Targets

- **Concurrent connections**: 1000+
- **Requests per second**: 5000+
- **Book streams**: 100+ concurrent

### Improvements Over TypeScript

Expected improvements:
- **20-50% faster response times**
- **50-70% lower memory usage**
- **Better CPU utilization** (no GC pauses)
- **Lower latency variance** (no GC pauses)

---

## Migration Checklist

### Pre-Migration

- [ ] Document all existing API endpoints
- [ ] Document all database queries
- [ ] Document authentication flow
- [ ] Document permission system
- [ ] Set up Zig development environment
- [ ] Set up test environment
- [ ] Create performance baseline of current system

### Implementation

- [ ] Phase 1: Foundation
- [ ] Phase 2: Database
- [ ] Phase 3: Authentication
- [ ] Phase 4: Authorization
- [ ] Phase 5: Books
- [ ] Phase 6: Progress
- [ ] Phase 7: Archive
- [ ] Phase 8: Genres
- [ ] Phase 9: Timers
- [ ] Phase 10: Testing

### Testing

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] API compatibility verified
- [ ] Load testing completed
- [ ] Memory profiling completed
- [ ] Performance targets met

### Deployment

- [ ] Build release binary
- [ ] Create Docker image
- [ ] Test database migration
- [ ] Test data compatibility
- [ ] Create deployment guide
- [ ] Create rollback plan

### Post-Migration

- [ ] Monitor performance metrics
- [ ] Monitor error rates
- [ ] Gather user feedback
- [ ] Document lessons learned
- [ ] Plan optimizations

---

## Additional Considerations

### Memory Management

Zig requires manual memory management. Key patterns:

1. **Use ArenaAllocator for request-scoped allocations**
   ```zig
   var arena = std.heap.ArenaAllocator.init(allocator);
   defer arena.deinit(); // Frees all at once
   const request_allocator = arena.allocator();
   ```

2. **Use GeneralPurposeAllocator for long-lived data**
   ```zig
   var gpa = std.heap.GeneralPurposeAllocator(.{}){};
   defer _ = gpa.deinit();
   const allocator = gpa.allocator();
   ```

3. **Always defer deallocation**
   ```zig
   const data = try allocator.alloc(u8, 100);
   defer allocator.free(data);
   ```

### Error Handling

Zig's error handling is explicit:

```zig
pub const BookError = error{
    NotFound,
    AccessDenied,
    InvalidFormat,
};

pub fn getBook(id: i64) BookError!Book {
    const book = try queryDatabase(id); // Propagate error
    
    if (book.status != .active) {
        return error.NotFound;
    }
    
    return book;
}
```

### Compile-Time Features

Leverage Zig's compile-time features:

```zig
pub fn defineRoute(
    comptime method: Method,
    comptime path: []const u8,
    comptime handler: anytype,
) Route {
    return Route{
        .method = method,
        .path = path,
        .handler = handler,
        .pattern = comptime parsePattern(path), // Computed at compile time
    };
}
```

---

*Migration Guide Version: 1.0*
*Last Updated: 2025-11-23*
