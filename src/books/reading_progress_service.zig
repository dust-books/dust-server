const std = @import("std");
const sqlite = @import("sqlite");

const ReadingProgress = @import("../books.zig").ReadingProgress;

pub const ReadingProgressService = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) ReadingProgressService {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn getProgress(self: *ReadingProgressService, user_id: i64, book_id: i64) !?ReadingProgress {
        const query =
            \\SELECT id, user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, completed_at, created_at, updated_at
            \\FROM reading_progress
            \\WHERE user_id = ? AND book_id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{ user_id, book_id });

        if (try stmt.step()) {
            return ReadingProgress{
                .id = stmt.columnInt64(0),
                .user_id = stmt.columnInt64(1),
                .book_id = stmt.columnInt64(2),
                .current_page = stmt.columnInt64(3),
                .total_pages = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .percentage_complete = stmt.columnDouble(5),
                .last_read_at = stmt.columnInt64(6),
                .completed_at = if (stmt.columnType(7) == .Null) null else stmt.columnInt64(7),
                .created_at = stmt.columnInt64(8),
                .updated_at = stmt.columnInt64(9),
            };
        }

        return null;
    }

    pub fn updateProgress(self: *ReadingProgressService, user_id: i64, book_id: i64, current_page: i64, total_pages: ?i64) !ReadingProgress {
        const now = std.time.timestamp();
        
        const percentage: f64 = if (total_pages) |total| 
            @as(f64, @floatFromInt(current_page)) / @as(f64, @floatFromInt(total)) * 100.0 
        else 
            0.0;

        // Upsert the progress
        const query =
            \\INSERT INTO reading_progress (user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, updated_at)
            \\VALUES (?, ?, ?, ?, ?, ?, ?)
            \\ON CONFLICT(user_id, book_id) DO UPDATE SET
            \\  current_page = excluded.current_page,
            \\  total_pages = excluded.total_pages,
            \\  percentage_complete = excluded.percentage_complete,
            \\  last_read_at = excluded.last_read_at,
            \\  updated_at = excluded.updated_at
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{ user_id, book_id, current_page, total_pages, percentage, now, now });
        try stmt.exec();

        return (try self.getProgress(user_id, book_id)).?;
    }

    pub fn startReading(self: *ReadingProgressService, user_id: i64, book_id: i64, total_pages: ?i64) !ReadingProgress {
        return self.updateProgress(user_id, book_id, 0, total_pages);
    }

    pub fn markAsCompleted(self: *ReadingProgressService, user_id: i64, book_id: i64) !ReadingProgress {
        const now = std.time.timestamp();

        const query =
            \\UPDATE reading_progress 
            \\SET percentage_complete = 100.0, completed_at = ?, last_read_at = ?, updated_at = ?
            \\WHERE user_id = ? AND book_id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{ now, now, now, user_id, book_id });
        try stmt.exec();

        return (try self.getProgress(user_id, book_id)).?;
    }

    pub fn resetProgress(self: *ReadingProgressService, user_id: i64, book_id: i64) !void {
        const query =
            \\DELETE FROM reading_progress WHERE user_id = ? AND book_id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{ user_id, book_id });
        try stmt.exec();
    }

    pub fn getAllProgress(self: *ReadingProgressService, user_id: i64) !std.ArrayList(ReadingProgress) {
        var progress_list = std.ArrayList(ReadingProgress).init(self.allocator);
        errdefer progress_list.deinit();

        const query =
            \\SELECT id, user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, completed_at, created_at, updated_at
            \\FROM reading_progress
            \\WHERE user_id = ?
            \\ORDER BY last_read_at DESC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{user_id});

        while (try stmt.step()) {
            try progress_list.append(ReadingProgress{
                .id = stmt.columnInt64(0),
                .user_id = stmt.columnInt64(1),
                .book_id = stmt.columnInt64(2),
                .current_page = stmt.columnInt64(3),
                .total_pages = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .percentage_complete = stmt.columnDouble(5),
                .last_read_at = stmt.columnInt64(6),
                .completed_at = if (stmt.columnType(7) == .Null) null else stmt.columnInt64(7),
                .created_at = stmt.columnInt64(8),
                .updated_at = stmt.columnInt64(9),
            });
        }

        return progress_list;
    }

    pub fn getRecentlyRead(self: *ReadingProgressService, user_id: i64, limit: i64) !std.ArrayList(ReadingProgress) {
        var progress_list = std.ArrayList(ReadingProgress).init(self.allocator);
        errdefer progress_list.deinit();

        const query =
            \\SELECT id, user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, completed_at, created_at, updated_at
            \\FROM reading_progress
            \\WHERE user_id = ?
            \\ORDER BY last_read_at DESC
            \\LIMIT ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{ user_id, limit });

        while (try stmt.step()) {
            try progress_list.append(ReadingProgress{
                .id = stmt.columnInt64(0),
                .user_id = stmt.columnInt64(1),
                .book_id = stmt.columnInt64(2),
                .current_page = stmt.columnInt64(3),
                .total_pages = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .percentage_complete = stmt.columnDouble(5),
                .last_read_at = stmt.columnInt64(6),
                .completed_at = if (stmt.columnType(7) == .Null) null else stmt.columnInt64(7),
                .created_at = stmt.columnInt64(8),
                .updated_at = stmt.columnInt64(9),
            });
        }

        return progress_list;
    }

    pub fn getCurrentlyReading(self: *ReadingProgressService, user_id: i64) !std.ArrayList(ReadingProgress) {
        var progress_list = std.ArrayList(ReadingProgress).init(self.allocator);
        errdefer progress_list.deinit();

        const query =
            \\SELECT id, user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, completed_at, created_at, updated_at
            \\FROM reading_progress
            \\WHERE user_id = ? AND completed_at IS NULL AND current_page > 0
            \\ORDER BY last_read_at DESC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{user_id});

        while (try stmt.step()) {
            try progress_list.append(ReadingProgress{
                .id = stmt.columnInt64(0),
                .user_id = stmt.columnInt64(1),
                .book_id = stmt.columnInt64(2),
                .current_page = stmt.columnInt64(3),
                .total_pages = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .percentage_complete = stmt.columnDouble(5),
                .last_read_at = stmt.columnInt64(6),
                .completed_at = if (stmt.columnType(7) == .Null) null else stmt.columnInt64(7),
                .created_at = stmt.columnInt64(8),
                .updated_at = stmt.columnInt64(9),
            });
        }

        return progress_list;
    }

    pub fn getCompletedBooks(self: *ReadingProgressService, user_id: i64) !std.ArrayList(ReadingProgress) {
        var progress_list = std.ArrayList(ReadingProgress).init(self.allocator);
        errdefer progress_list.deinit();

        const query =
            \\SELECT id, user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, completed_at, created_at, updated_at
            \\FROM reading_progress
            \\WHERE user_id = ? AND completed_at IS NOT NULL
            \\ORDER BY completed_at DESC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{user_id});

        while (try stmt.step()) {
            try progress_list.append(ReadingProgress{
                .id = stmt.columnInt64(0),
                .user_id = stmt.columnInt64(1),
                .book_id = stmt.columnInt64(2),
                .current_page = stmt.columnInt64(3),
                .total_pages = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .percentage_complete = stmt.columnDouble(5),
                .last_read_at = stmt.columnInt64(6),
                .completed_at = if (stmt.columnType(7) == .Null) null else stmt.columnInt64(7),
                .created_at = stmt.columnInt64(8),
                .updated_at = stmt.columnInt64(9),
            });
        }

        return progress_list;
    }

    pub const ReadingStats = struct {
        total_books: i64,
        completed_books: i64,
        currently_reading: i64,
        total_pages_read: i64,
    };

    pub fn getReadingStats(self: *ReadingProgressService, user_id: i64) !ReadingStats {
        const query =
            \\SELECT 
            \\  COUNT(*) as total_books,
            \\  SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed_books,
            \\  SUM(CASE WHEN completed_at IS NULL AND current_page > 0 THEN 1 ELSE 0 END) as currently_reading,
            \\  SUM(current_page) as total_pages_read
            \\FROM reading_progress
            \\WHERE user_id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{user_id});

        if (try stmt.step()) {
            return ReadingStats{
                .total_books = stmt.columnInt64(0),
                .completed_books = stmt.columnInt64(1),
                .currently_reading = stmt.columnInt64(2),
                .total_pages_read = stmt.columnInt64(3),
            };
        }

        return ReadingStats{
            .total_books = 0,
            .completed_books = 0,
            .currently_reading = 0,
            .total_pages_read = 0,
        };
    }
};
