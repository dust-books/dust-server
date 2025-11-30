const std = @import("std");
const sqlite = @import("sqlite");

pub const SessionError = error{
    NoValidToken,
    ExpiredToken,
    InvalidSession,
    DatabaseError,
};

pub const Session = struct {
    session_token: []const u8,
    expires_at: []const u8,
    user_id: i64,
};

pub fn createSession(db: *sqlite.Db, user_id: i64, token: []const u8, allocator: std.mem.Allocator) !void {
    _ = allocator;
    
    // Calculate expiration (24 hours from now)
    const now = std.time.timestamp();
    const expires_at = now + (24 * 60 * 60); // 24 hours in seconds
    
    // Format timestamp as ISO 8601
    var buf: [64]u8 = undefined;
    const expires_str = try std.fmt.bufPrint(&buf, "{d}", .{expires_at});
    
    const query =
        \\INSERT INTO sessions (token, expires_at, user_id) 
        \\VALUES (?, ?, ?)
    ;
    
    var stmt = try db.prepare(query);
    defer stmt.deinit();
    
    try stmt.exec(.{}, .{ token, expires_str, user_id });
}

pub fn getUserIdFromSession(db: *sqlite.Db, token: []const u8, allocator: std.mem.Allocator) !i64 {
    const query =
        \\SELECT user_id, expires_at FROM sessions 
        \\WHERE token = ?
    ;
    
    var stmt = try db.prepare(query);
    defer stmt.deinit();
    
    const SessionRow = struct {
        user_id: i64,
        expires_at: []const u8,
    };
    
    const row = try stmt.oneAlloc(SessionRow, allocator, .{}, .{token});
    if (row == null) {
        return SessionError.NoValidToken;
    }
    
    defer if (row) |r| {
        allocator.free(r.expires_at);
    };
    
    const result = row.?;
    
    // Parse expiration timestamp and check if expired
    const expires_at = std.fmt.parseInt(i64, result.expires_at, 10) catch {
        return SessionError.InvalidSession;
    };
    
    const now = std.time.timestamp();
    if (expires_at <= now) {
        return SessionError.ExpiredToken;
    }
    
    return result.user_id;
}

pub fn deleteSession(db: *sqlite.Db, token: []const u8) !void {
    const query =
        \\DELETE FROM sessions WHERE token = ?
    ;
    
    var stmt = try db.prepare(query);
    defer stmt.deinit();
    
    try stmt.exec(.{}, .{token});
}

pub fn cleanupExpiredSessions(db: *sqlite.Db) !void {
    const now = std.time.timestamp();
    
    var buf: [64]u8 = undefined;
    const now_str = try std.fmt.bufPrint(&buf, "{d}", .{now});
    
    const query =
        \\DELETE FROM sessions WHERE expires_at <= ?
    ;
    
    var stmt = try db.prepare(query);
    defer stmt.deinit();
    
    try stmt.exec(.{}, .{now_str});
}
