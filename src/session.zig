const std = @import("std");
const zqlite = @import("zqlite");
const time_compat = @import("time_compat.zig");

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

pub fn createSession(db: *zqlite.Conn, user_id: i64, token: []const u8, allocator: std.mem.Allocator) !void {
    _ = allocator;

    const now = time_compat.timestamp();
    const expires_at = now + (24 * 60 * 60);

    var buf: [64]u8 = undefined;
    const expires_str = try std.fmt.bufPrint(&buf, "{d}", .{expires_at});

    try db.exec(
        \\INSERT INTO sessions (token, expires_at, user_id) VALUES (?, ?, ?)
    , .{ token, expires_str, user_id });
}

pub fn getUserIdFromSession(db: *zqlite.Conn, token: []const u8, allocator: std.mem.Allocator) !i64 {
    const query =
        \\SELECT user_id, expires_at FROM sessions WHERE token = ?
    ;

    const row = try db.row(query, .{token}) orelse return SessionError.NoValidToken;
    defer row.deinit();

    const user_id = row.int(0);
    const expires_at_str = row.text(1);

    const expires_at = std.fmt.parseInt(i64, expires_at_str, 10) catch {
        _ = allocator;
        return SessionError.InvalidSession;
    };

    const now = time_compat.timestamp();
    if (expires_at <= now) {
        return SessionError.ExpiredToken;
    }

    return user_id;
}

pub fn deleteSession(db: *zqlite.Conn, token: []const u8) !void {
    try db.exec("DELETE FROM sessions WHERE token = ?", .{token});
}

pub fn cleanupExpiredSessions(db: *zqlite.Conn) !void {
    const now = time_compat.timestamp();

    var buf: [64]u8 = undefined;
    const now_str = try std.fmt.bufPrint(&buf, "{d}", .{now});

    try db.exec("DELETE FROM sessions WHERE expires_at <= ?", .{now_str});
}
