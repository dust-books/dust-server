const std = @import("std");
const sqlite = @import("sqlite");

const Book = @import("../books.zig").Book;
const Author = @import("../books.zig").Author;

pub const BookService = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) BookService {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn getBookById(self: *BookService, id: i64) !?Book {
        const query =
            \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at, archived, archived_at, archive_reason
            \\FROM books WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{id});

        if (try stmt.step()) {
            return Book{
                .id = stmt.columnInt64(0),
                .name = try self.allocator.dupe(u8, stmt.columnText(1)),
                .filepath = try self.allocator.dupe(u8, stmt.columnText(2)),
                .file_format = try self.allocator.dupe(u8, stmt.columnText(3)),
                .author_id = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .created_at = stmt.columnInt64(5),
                .updated_at = stmt.columnInt64(6),
                .archived = stmt.columnInt64(7) != 0,
                .archived_at = if (stmt.columnType(8) == .Null) null else stmt.columnInt64(8),
                .archive_reason = if (stmt.columnType(9) == .Null) null else try self.allocator.dupe(u8, stmt.columnText(9)),
            };
        }

        return null;
    }

    pub fn getAllBooks(self: *BookService) !std.ArrayList(Book) {
        var books = std.ArrayList(Book).init(self.allocator);
        errdefer books.deinit();

        const query =
            \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at, archived, archived_at, archive_reason
            \\FROM books WHERE archived = 0
            \\ORDER BY name ASC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        while (try stmt.step()) {
            try books.append(Book{
                .id = stmt.columnInt64(0),
                .name = try self.allocator.dupe(u8, stmt.columnText(1)),
                .filepath = try self.allocator.dupe(u8, stmt.columnText(2)),
                .file_format = try self.allocator.dupe(u8, stmt.columnText(3)),
                .author_id = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .created_at = stmt.columnInt64(5),
                .updated_at = stmt.columnInt64(6),
                .archived = stmt.columnInt64(7) != 0,
                .archived_at = if (stmt.columnType(8) == .Null) null else stmt.columnInt64(8),
                .archive_reason = if (stmt.columnType(9) == .Null) null else try self.allocator.dupe(u8, stmt.columnText(9)),
            });
        }

        return books;
    }

    pub fn getAllAuthors(self: *BookService) !std.ArrayList(Author) {
        var authors = std.ArrayList(Author).init(self.allocator);
        errdefer authors.deinit();

        const query =
            \\SELECT id, name, created_at FROM authors ORDER BY name ASC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        while (try stmt.step()) {
            try authors.append(Author{
                .id = stmt.columnInt64(0),
                .name = try self.allocator.dupe(u8, stmt.columnText(1)),
                .created_at = stmt.columnInt64(2),
            });
        }

        return authors;
    }

    pub fn getAuthorById(self: *BookService, id: i64) !?Author {
        const query =
            \\SELECT id, name, created_at FROM authors WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{id});

        if (try stmt.step()) {
            return Author{
                .id = stmt.columnInt64(0),
                .name = try self.allocator.dupe(u8, stmt.columnText(1)),
                .created_at = stmt.columnInt64(2),
            };
        }

        return null;
    }

    pub fn getBooksByAuthor(self: *BookService, author_id: i64) !std.ArrayList(Book) {
        var books = std.ArrayList(Book).init(self.allocator);
        errdefer books.deinit();

        const query =
            \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at, archived, archived_at, archive_reason
            \\FROM books WHERE author_id = ? AND archived = 0
            \\ORDER BY name ASC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{author_id});

        while (try stmt.step()) {
            try books.append(Book{
                .id = stmt.columnInt64(0),
                .name = try self.allocator.dupe(u8, stmt.columnText(1)),
                .filepath = try self.allocator.dupe(u8, stmt.columnText(2)),
                .file_format = try self.allocator.dupe(u8, stmt.columnText(3)),
                .author_id = if (stmt.columnType(4) == .Null) null else stmt.columnInt64(4),
                .created_at = stmt.columnInt64(5),
                .updated_at = stmt.columnInt64(6),
                .archived = stmt.columnInt64(7) != 0,
                .archived_at = if (stmt.columnType(8) == .Null) null else stmt.columnInt64(8),
                .archive_reason = if (stmt.columnType(9) == .Null) null else try self.allocator.dupe(u8, stmt.columnText(9)),
            });
        }

        return books;
    }

    pub fn createBook(self: *BookService, allocator: std.mem.Allocator, name: []const u8, filepath: []const u8, file_format: []const u8, author_id: ?i64) !Book {
        const query =
            \\INSERT INTO books (name, filepath, file_format, author_id)
            \\VALUES (?, ?, ?, ?)
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(.{ name, filepath, file_format, author_id });
        try stmt.exec();

        const id = self.db.lastInsertRowId();
        
        return (try self.getBookById(id)) orelse error.BookNotFound;
    }

    pub fn updateBook(self: *BookService, allocator: std.mem.Allocator, id: i64, name: ?[]const u8, filepath: ?[]const u8, file_format: ?[]const u8, author_id: ?i64) !?Book {
        _ = allocator;
        
        var query_buf: [512]u8 = undefined;
        var parts = std.ArrayList([]const u8).init(self.allocator);
        defer parts.deinit();
        
        try parts.append("UPDATE books SET ");
        
        var has_field = false;
        if (name) |_| {
            if (has_field) try parts.append(", ");
            try parts.append("name = ?");
            has_field = true;
        }
        if (filepath) |_| {
            if (has_field) try parts.append(", ");
            try parts.append("filepath = ?");
            has_field = true;
        }
        if (file_format) |_| {
            if (has_field) try parts.append(", ");
            try parts.append("file_format = ?");
            has_field = true;
        }
        if (author_id) |_| {
            if (has_field) try parts.append(", ");
            try parts.append("author_id = ?");
            has_field = true;
        }
        
        if (!has_field) {
            return try self.getBookById(id);
        }
        
        try parts.append(", updated_at = strftime('%s', 'now') WHERE id = ?");
        
        var query_str = std.ArrayList(u8).init(self.allocator);
        defer query_str.deinit();
        
        for (parts.items) |part| {
            try query_str.appendSlice(part);
        }
        
        var stmt = try self.db.prepare(query_str.items);
        defer stmt.deinit();
        
        var bind_idx: usize = 1;
        if (name) |n| {
            try stmt.bindText(bind_idx, n);
            bind_idx += 1;
        }
        if (filepath) |f| {
            try stmt.bindText(bind_idx, f);
            bind_idx += 1;
        }
        if (file_format) |ff| {
            try stmt.bindText(bind_idx, ff);
            bind_idx += 1;
        }
        if (author_id) |a| {
            try stmt.bindInt64(bind_idx, a);
            bind_idx += 1;
        }
        try stmt.bindInt64(bind_idx, id);
        
        try stmt.exec();
        
        return try self.getBookById(id);
    }

    pub fn deleteBook(self: *BookService, id: i64) !bool {
        const query = "DELETE FROM books WHERE id = ?";
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        try stmt.bind(.{id});
        try stmt.exec();
        
        return self.db.rowsAffected() > 0;
    }

    pub fn createOrGetAuthor(self: *BookService, name: []const u8) !i64 {
        // Try to get existing author
        const query_get =
            \\SELECT id FROM authors WHERE name = ?
        ;

        var stmt_get = try self.db.prepare(query_get);
        defer stmt_get.deinit();

        try stmt_get.bind(.{name});

        if (try stmt_get.step()) {
            return stmt_get.columnInt64(0);
        }

        // Create new author
        const query_insert =
            \\INSERT INTO authors (name) VALUES (?)
        ;

        var stmt_insert = try self.db.prepare(query_insert);
        defer stmt_insert.deinit();

        try stmt_insert.bind(.{name});
        try stmt_insert.exec();

        return self.db.lastInsertRowId();
    }
};
