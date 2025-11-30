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

    // Get all books (non-archived)
    pub fn getAllBooks(self: *BookService) ![]Book {
        const query =
            \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at, 
            \\       archived, archived_at, archive_reason
            \\FROM books
            \\WHERE archived = 0
            \\ORDER BY name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var books = std.ArrayList(Book).init(self.allocator);
        errdefer books.deinit();

        const iter = try stmt.iterator(Book, .{});
        while (try iter.next(.{})) |book| {
            try books.append(book);
        }

        return books.toOwnedSlice();
    }

    // Get book by ID
    pub fn getBookById(self: *BookService, id: i64) !?Book {
        const query =
            \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at,
            \\       archived, archived_at, archive_reason
            \\FROM books
            \\WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.oneAlloc(Book, self.allocator, .{}, .{ .id = id });
    }

    // Create a new book
    pub fn createBook(
        self: *BookService,
        name: []const u8,
        filepath: []const u8,
        file_format: []const u8,
        author_id: ?i64,
    ) !i64 {
        const query =
            \\INSERT INTO books (name, filepath, file_format, author_id, created_at, updated_at, archived)
            \\VALUES (?, ?, ?, ?, ?, ?, 0)
        ;

        const now = std.time.timestamp();
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            .name = name,
            .filepath = filepath,
            .file_format = file_format,
            .author_id = author_id,
            .created_at = now,
            .updated_at = now,
        });

        return self.db.getLastInsertRowID();
    }

    // Update a book
    pub fn updateBook(
        self: *BookService,
        id: i64,
        name: []const u8,
        filepath: []const u8,
        file_format: []const u8,
        author_id: ?i64,
    ) !void {
        const query =
            \\UPDATE books
            \\SET name = ?, filepath = ?, file_format = ?, author_id = ?, updated_at = ?
            \\WHERE id = ?
        ;

        const now = std.time.timestamp();
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            .name = name,
            .filepath = filepath,
            .file_format = file_format,
            .author_id = author_id,
            .updated_at = now,
            .id = id,
        });
    }

    // Delete a book
    pub fn deleteBook(self: *BookService, id: i64) !void {
        const query = "DELETE FROM books WHERE id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ .id = id });
    }

    // Get books by author
    pub fn getBooksByAuthor(self: *BookService, author_id: i64) ![]Book {
        const query =
            \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at,
            \\       archived, archived_at, archive_reason
            \\FROM books
            \\WHERE author_id = ? AND archived = 0
            \\ORDER BY name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var books = std.ArrayList(Book).init(self.allocator);
        errdefer books.deinit();

        const iter = try stmt.iterator(Book, .{ .author_id = author_id });
        while (try iter.next(.{})) |book| {
            try books.append(book);
        }

        return books.toOwnedSlice();
    }

    // Archive a book
    pub fn archiveBook(self: *BookService, id: i64, reason: ?[]const u8) !void {
        const query =
            \\UPDATE books
            \\SET archived = 1, archived_at = ?, archive_reason = ?
            \\WHERE id = ?
        ;

        const now = std.time.timestamp();
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            .archived_at = now,
            .archive_reason = reason,
            .id = id,
        });
    }

    // Unarchive a book
    pub fn unarchiveBook(self: *BookService, id: i64) !void {
        const query =
            \\UPDATE books
            \\SET archived = 0, archived_at = NULL, archive_reason = NULL
            \\WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ .id = id });
    }

    // Get all archived books
    pub fn getArchivedBooks(self: *BookService) ![]Book {
        const query =
            \\SELECT id, name, filepath, file_format, author_id, created_at, updated_at,
            \\       archived, archived_at, archive_reason
            \\FROM books
            \\WHERE archived = 1
            \\ORDER BY archived_at DESC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var books = std.ArrayList(Book).init(self.allocator);
        errdefer books.deinit();

        const iter = try stmt.iterator(Book, .{});
        while (try iter.next(.{})) |book| {
            try books.append(book);
        }

        return books.toOwnedSlice();
    }
};

// Author Service
pub const AuthorService = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) AuthorService {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    // Get all authors
    pub fn getAllAuthors(self: *AuthorService) ![]Author {
        const query =
            \\SELECT id, name, created_at
            \\FROM authors
            \\ORDER BY name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var authors = std.ArrayList(Author).init(self.allocator);
        errdefer authors.deinit();

        const iter = try stmt.iterator(Author, .{});
        while (try iter.next(.{})) |author| {
            try authors.append(author);
        }

        return authors.toOwnedSlice();
    }

    // Get author by ID
    pub fn getAuthorById(self: *AuthorService, id: i64) !?Author {
        const query =
            \\SELECT id, name, created_at
            \\FROM authors
            \\WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.oneAlloc(Author, self.allocator, .{}, .{ .id = id });
    }

    // Get author by name
    pub fn getAuthorByName(self: *AuthorService, name: []const u8) !?Author {
        const query =
            \\SELECT id, name, created_at
            \\FROM authors
            \\WHERE name = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.oneAlloc(Author, self.allocator, .{}, .{ .name = name });
    }

    // Create a new author
    pub fn createAuthor(self: *AuthorService, name: []const u8) !i64 {
        const query =
            \\INSERT INTO authors (name, created_at)
            \\VALUES (?, ?)
        ;

        const now = std.time.timestamp();
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            .name = name,
            .created_at = now,
        });

        return self.db.getLastInsertRowID();
    }

    // Get or create author by name
    pub fn getOrCreateAuthor(self: *AuthorService, name: []const u8) !i64 {
        if (try self.getAuthorByName(name)) |author| {
            return author.id;
        }

        return try self.createAuthor(name);
    }

    // Update author
    pub fn updateAuthor(self: *AuthorService, id: i64, name: []const u8) !void {
        const query =
            \\UPDATE authors
            \\SET name = ?
            \\WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            .name = name,
            .id = id,
        });
    }

    // Delete author (only if no books reference it)
    pub fn deleteAuthor(self: *AuthorService, id: i64) !void {
        const query = "DELETE FROM authors WHERE id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ .id = id });
    }

    // Count books for an author
    pub fn countBooksForAuthor(self: *AuthorService, author_id: i64) !i64 {
        const query =
            \\SELECT COUNT(*) as count
            \\FROM books
            \\WHERE author_id = ? AND archived = 0
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        const row = try stmt.one(struct { count: i64 }, .{}, .{ .author_id = author_id });
        return if (row) |r| r.count else 0;
    }
};
