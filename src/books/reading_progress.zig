const std = @import("std");
const sqlite = @import("sqlite");

pub const ReadingProgress = struct {
    user_id: i64,
    book_id: i64,
    current_page: i64,
    total_pages: ?i64,
    percentage_complete: f64,
    last_read_at: []const u8,
    completed_at: ?[]const u8,
};

pub const ReadingStats = struct {
    total_books: i64,
    books_in_progress: i64,
    books_completed: i64,
    total_pages_read: i64,
    average_progress: f64,
};

pub const ReadingActivity = struct {
    date: []const u8,
    pages_read: i64,
    books_read: i64,
};

pub const ReadingProgressService = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) ReadingProgressService {
        return .{
            .allocator = allocator,
            .db = db,
        };
    }
    
    pub fn updateProgress(
        self: *ReadingProgressService,
        user_id: i64,
        book_id: i64,
        current_page: i64,
        total_pages: ?i64,
    ) !void {
        if (current_page < 0) {
            return error.InvalidCurrentPage;
        }
        
        if (total_pages) |tp| {
            if (tp <= 0) return error.InvalidTotalPages;
            if (current_page > tp) return error.CurrentPageExceedsTotalPages;
        }
        
        const percentage = if (total_pages) |tp|
            @as(f64, @floatFromInt(current_page)) / @as(f64, @floatFromInt(tp)) * 100.0
        else
            0.0;
        
        const query =
            \\INSERT INTO reading_progress (user_id, book_id, current_page, total_pages, percentage_complete, last_read_at)
            \\VALUES (?, ?, ?, ?, ?, datetime('now'))
            \\ON CONFLICT(user_id, book_id) DO UPDATE SET
            \\  current_page = excluded.current_page,
            \\  total_pages = excluded.total_pages,
            \\  percentage_complete = excluded.percentage_complete,
            \\  last_read_at = excluded.last_read_at,
            \\  completed_at = CASE WHEN excluded.percentage_complete >= 100 THEN datetime('now') ELSE completed_at END
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, user_id);
        try stmt.bind(2, book_id);
        try stmt.bind(3, current_page);
        if (total_pages) |tp| {
            try stmt.bind(4, tp);
        } else {
            try stmt.bind(4, null);
        }
        try stmt.bind(5, percentage);
        
        try stmt.exec();
    }
    
    pub fn getProgress(
        self: *ReadingProgressService,
        user_id: i64,
        book_id: i64,
    ) !?ReadingProgress {
        const query =
            \\SELECT user_id, book_id, current_page, total_pages, percentage_complete, 
            \\       last_read_at, completed_at
            \\FROM reading_progress
            \\WHERE user_id = ? AND book_id = ?
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, user_id);
        try stmt.bind(2, book_id);
        
        if (try stmt.step()) {
            return ReadingProgress{
                .user_id = stmt.column(i64, 0),
                .book_id = stmt.column(i64, 1),
                .current_page = stmt.column(i64, 2),
                .total_pages = stmt.columnOpt(i64, 3),
                .percentage_complete = stmt.column(f64, 4),
                .last_read_at = stmt.column([]const u8, 5),
                .completed_at = stmt.columnOpt([]const u8, 6),
            };
        }
        
        return null;
    }
    
    pub fn markAsCompleted(
        self: *ReadingProgressService,
        user_id: i64,
        book_id: i64,
    ) !void {
        const query =
            \\UPDATE reading_progress 
            \\SET percentage_complete = 100,
            \\    completed_at = datetime('now'),
            \\    last_read_at = datetime('now')
            \\WHERE user_id = ? AND book_id = ?
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, user_id);
        try stmt.bind(2, book_id);
        
        try stmt.exec();
    }
    
    pub fn deleteProgress(
        self: *ReadingProgressService,
        user_id: i64,
        book_id: i64,
    ) !void {
        const query = "DELETE FROM reading_progress WHERE user_id = ? AND book_id = ?";
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, user_id);
        try stmt.bind(2, book_id);
        
        try stmt.exec();
    }
    
    pub fn getReadingStats(
        self: *ReadingProgressService,
        user_id: i64,
    ) !ReadingStats {
        const query =
            \\SELECT 
            \\  COUNT(*) as total_books,
            \\  SUM(CASE WHEN percentage_complete > 0 AND percentage_complete < 100 THEN 1 ELSE 0 END) as books_in_progress,
            \\  SUM(CASE WHEN percentage_complete >= 100 THEN 1 ELSE 0 END) as books_completed,
            \\  COALESCE(SUM(current_page), 0) as total_pages_read,
            \\  COALESCE(AVG(percentage_complete), 0) as average_progress
            \\FROM reading_progress
            \\WHERE user_id = ?
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, user_id);
        
        if (try stmt.step()) {
            return ReadingStats{
                .total_books = stmt.column(i64, 0),
                .books_in_progress = stmt.column(i64, 1),
                .books_completed = stmt.column(i64, 2),
                .total_pages_read = stmt.column(i64, 3),
                .average_progress = stmt.column(f64, 4),
            };
        }
        
        return ReadingStats{
            .total_books = 0,
            .books_in_progress = 0,
            .books_completed = 0,
            .total_pages_read = 0,
            .average_progress = 0.0,
        };
    }
    
    pub fn getReadingStreak(
        self: *ReadingProgressService,
        user_id: i64,
    ) !i64 {
        const query =
            \\WITH daily_reading AS (
            \\    SELECT DISTINCT DATE(last_read_at) as read_date
            \\    FROM reading_progress 
            \\    WHERE user_id = ?
            \\    ORDER BY read_date DESC
            \\),
            \\consecutive_days AS (
            \\    SELECT 
            \\        read_date,
            \\        ROW_NUMBER() OVER (ORDER BY read_date DESC) as row_num
            \\    FROM daily_reading
            \\)
            \\SELECT COUNT(*) as streak
            \\FROM consecutive_days
            \\WHERE DATE(read_date, '+' || (row_num - 1) || ' days') = (SELECT read_date FROM daily_reading LIMIT 1)
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, user_id);
        
        if (try stmt.step()) {
            return stmt.column(i64, 0);
        }
        
        return 0;
    }
};
