const std = @import("std");
const sqlite = @import("sqlite");
const cover = @import("../../cover_manager.zig");

pub const Book = struct {
    id: i64,
    name: []const u8,
    author: i64,
    file_path: []const u8,
    isbn: ?[]const u8,
    publication_date: ?[]const u8,
    publisher: ?[]const u8,
    description: ?[]const u8,
    page_count: ?i64,
    file_size: ?i64,
    file_format: ?[]const u8,
    cover_image_path: ?[]const u8,
    status: []const u8,
    archived_at: ?[]const u8,
    archive_reason: ?[]const u8,
    created_at: []const u8,
    updated_at: []const u8,

    pub fn deinit(self: Book, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        allocator.free(self.file_path);
        if (self.isbn) |isbn| allocator.free(isbn);
        if (self.publication_date) |pd| allocator.free(pd);
        if (self.publisher) |pub_| allocator.free(pub_);
        if (self.description) |desc| allocator.free(desc);
        if (self.file_format) |ff| allocator.free(ff);
        if (self.cover_image_path) |cip| allocator.free(cip);
        allocator.free(self.status);
        if (self.archived_at) |aa| allocator.free(aa);
        if (self.archive_reason) |ar| allocator.free(ar);
        allocator.free(self.created_at);
        allocator.free(self.updated_at);
    }
};

pub const Author = struct {
    id: i64,
    name: []const u8,
    biography: ?[]const u8,
    birth_date: ?[]const u8,
    death_date: ?[]const u8,
    nationality: ?[]const u8,
    image_url: ?[]const u8,
    wikipedia_url: ?[]const u8,
    goodreads_url: ?[]const u8,
    website: ?[]const u8,
    aliases: ?[]const u8, // JSON string
    genres: ?[]const u8, // JSON string
    created_at: ?[]const u8,
    updated_at: ?[]const u8,

    pub fn deinit(self: Author, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        if (self.biography) |bio| allocator.free(bio);
        if (self.birth_date) |bd| allocator.free(bd);
        if (self.death_date) |dd| allocator.free(dd);
        if (self.nationality) |nat| allocator.free(nat);
        if (self.image_url) |iu| allocator.free(iu);
        if (self.wikipedia_url) |wu| allocator.free(wu);
        if (self.goodreads_url) |gu| allocator.free(gu);
        if (self.website) |web| allocator.free(web);
        if (self.aliases) |ali| allocator.free(ali);
        if (self.genres) |gen| allocator.free(gen);
        if (self.created_at) |ca| allocator.free(ca);
        if (self.updated_at) |ua| allocator.free(ua);
    }
};

pub const Tag = struct {
    id: i64,
    name: []const u8,
    category: []const u8,
    description: ?[]const u8,
    color: ?[]const u8,
    requires_permission: ?[]const u8,
    created_at: []const u8,

    pub fn deinit(self: Tag, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        allocator.free(self.category);
        if (self.description) |desc| allocator.free(desc);
        if (self.color) |color| allocator.free(color);
        if (self.requires_permission) |perm| allocator.free(perm);
        allocator.free(self.created_at);
    }
};

pub const ReadingProgress = struct {
    id: i64,
    user_id: i64,
    book_id: i64,
    current_page: i64,
    total_pages: ?i64,
    percentage_complete: f64,
    last_read_at: []const u8,
    created_at: []const u8,
    updated_at: []const u8,

    pub fn deinit(self: ReadingProgress, allocator: std.mem.Allocator) void {
        allocator.free(self.last_read_at);
        allocator.free(self.created_at);
        allocator.free(self.updated_at);
    }
};

// Repository for Book operations
pub const BookRepository = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) BookRepository {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn getBookById(self: *BookRepository, allocator: std.mem.Allocator, id: i64) !Book {
        const query =
            \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
            \\       description, page_count, file_size, file_format, cover_image_path,
            \\       status, archived_at, archive_reason, created_at, updated_at
            \\FROM books WHERE id = ?
        ;

        const result = try self.db.oneAlloc(Book, allocator, query, .{}, .{id});
        return result orelse error.BookNotFound;
    }

    pub fn listBooks(self: *BookRepository, allocator: std.mem.Allocator) ![]Book {
        const query =
            \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
            \\       description, page_count, file_size, file_format, cover_image_path,
            \\       status, archived_at, archive_reason, created_at, updated_at
            \\FROM books WHERE status = 'active'
            \\ORDER BY created_at DESC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.all(Book, allocator, .{}, .{});
    }

    pub fn createBook(self: *BookRepository, name: []const u8, author_id: i64, file_path: []const u8) !i64 {
        var cover_manager = cover.CoverManager.init(self.allocator);
        const cover_path = cover_manager.findLocalCover(file_path) catch |err| blk: {
            std.log.warn("Failed to locate cover for {s}: {}", .{ file_path, err });
            break :blk null;
        };
        defer if (cover_path) |cp| self.allocator.free(cp);

        const query =
            \\INSERT INTO books (name, author, file_path, cover_image_path, status)
            \\VALUES (?, ?, ?, ?, 'active')
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ name, author_id, file_path, cover_path });

        return self.db.getLastInsertRowID();
    }

    pub fn create(self: *BookRepository, allocator: std.mem.Allocator, name: []const u8, filepath: []const u8, file_format: []const u8, author_id: ?i64) !Book {
        const author = author_id orelse 1; // Default author if none provided

        var cover_manager = cover.CoverManager.init(self.allocator);
        const cover_path = cover_manager.findLocalCover(filepath) catch |err| blk: {
            std.log.warn("Failed to locate cover for {s}: {}", .{ filepath, err });
            break :blk null;
        };
        defer if (cover_path) |cp| self.allocator.free(cp);

        const query =
            \\INSERT INTO books (name, author, file_path, file_format, cover_image_path, status)
            \\VALUES (?, ?, ?, ?, ?, 'active')
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ name, author, filepath, file_format, cover_path });
        
        const id = self.db.getLastInsertRowID();
        return try self.getBookById(allocator, id);
    }

    pub fn updateBook(self: *BookRepository, id: i64, name: []const u8, description: ?[]const u8) !void {
        const query =
            \\UPDATE books 
            \\SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            \\WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ name, description, id });
    }

    pub fn update(self: *BookRepository, allocator: std.mem.Allocator, id: i64, name: ?[]const u8, filepath: ?[]const u8, file_format: ?[]const u8, author_id: ?i64) !?Book {
        const existing = try self.getBookById(allocator, id);
        
        const final_name = name orelse existing.name;
        const final_filepath = filepath orelse existing.file_path;
        const final_format = file_format orelse existing.file_format orelse "";
        const final_author = author_id orelse existing.author;
        
        var cover_manager = cover.CoverManager.init(self.allocator);
        const cover_path = cover_manager.findLocalCover(final_filepath) catch |err| blk: {
            std.log.warn("Failed to refresh cover for {s}: {}", .{ final_filepath, err });
            break :blk null;
        };
        defer if (cover_path) |cp| self.allocator.free(cp);

        const update_query =
            \\UPDATE books 
            \\SET name = ?, file_path = ?, file_format = ?, author = ?, cover_image_path = ?, updated_at = CURRENT_TIMESTAMP
            \\WHERE id = ?
        ;
        
        var stmt = try self.db.prepare(update_query);
        defer stmt.deinit();
        
        try stmt.exec(.{}, .{ final_name, final_filepath, final_format, final_author, cover_path, id });
        
        return try self.getBookById(allocator, id);
    }

    pub fn deleteBook(self: *BookRepository, id: i64) !void {
        const query = "UPDATE books SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{id});
    }

    pub fn delete(self: *BookRepository, id: i64) !bool {
        const query = "UPDATE books SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{id});
        
        return self.db.rowsAffected() > 0;
    }

    pub fn archiveBook(self: *BookRepository, id: i64, reason: ?[]const u8) !void {
        const query =
            \\UPDATE books 
            \\SET status = 'archived', archived_at = CURRENT_TIMESTAMP, 
            \\    archive_reason = ?, updated_at = CURRENT_TIMESTAMP
            \\WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ reason, id });
    }
};

// Repository for Author operations
pub const AuthorRepository = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) AuthorRepository {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn getAuthorById(self: *AuthorRepository, allocator: std.mem.Allocator, id: i64) !Author {
        const query =
            \\SELECT id, name, biography, birth_date, death_date, nationality,
            \\       image_url, wikipedia_url, goodreads_url, website, aliases, genres,
            \\       created_at, updated_at
            \\FROM authors WHERE id = ?
        ;

        const result = try self.db.oneAlloc(Author, allocator, query, .{}, .{id});
        return result orelse error.AuthorNotFound;
    }

    pub fn listAuthors(self: *AuthorRepository, allocator: std.mem.Allocator) ![]Author {
        const query =
            \\SELECT id, name, biography, birth_date, death_date, nationality,
            \\       image_url, wikipedia_url, goodreads_url, website, aliases, genres,
            \\       created_at, updated_at
            \\FROM authors
            \\ORDER BY name ASC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.all(Author, allocator, .{}, .{});
    }

    pub fn createAuthor(self: *AuthorRepository, name: []const u8) !i64 {
        const query = "INSERT INTO authors (name) VALUES (?)";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{name});

        return self.db.getLastInsertRowID();
    }

    pub fn getAuthorByName(self: *AuthorRepository, allocator: std.mem.Allocator, name: []const u8) !Author {
        const query =
            \\SELECT id, name, biography, birth_date, death_date, nationality,
            \\       image_url, wikipedia_url, goodreads_url, website, aliases, genres,
            \\       created_at, updated_at
            \\FROM authors WHERE name = ?
        ;

        const result = try self.db.oneAlloc(Author, allocator, query, .{}, .{name});
        return result orelse error.AuthorNotFound;
    }
};

// Repository for Tag operations
pub const TagRepository = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) TagRepository {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn getAllTags(self: *TagRepository, allocator: std.mem.Allocator) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, requires_permission, created_at
            \\FROM tags
            \\ORDER BY category, name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.all(Tag, allocator, .{}, .{});
    }

    pub fn getTagsByCategory(self: *TagRepository, allocator: std.mem.Allocator, category: []const u8) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, requires_permission, created_at
            \\FROM tags
            \\WHERE category = ?
            \\ORDER BY name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.all(Tag, allocator, .{}, .{category});
    }

    pub fn getBookTags(self: *TagRepository, allocator: std.mem.Allocator, book_id: i64) ![]Tag {
        const query =
            \\SELECT t.id, t.name, t.category, t.description, t.color, t.requires_permission, t.created_at
            \\FROM tags t
            \\JOIN book_tags bt ON t.id = bt.tag_id
            \\WHERE bt.book_id = ?
            \\ORDER BY t.category, t.name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        return try stmt.all(Tag, allocator, .{}, .{book_id});
    }

    pub fn getTagByName(self: *TagRepository, allocator: std.mem.Allocator, name: []const u8) !?Tag {
        const query =
            \\SELECT id, name, category, description, color, requires_permission, created_at
            \\FROM tags
            \\WHERE name = ?
        ;

        const result = try self.db.oneAlloc(Tag, allocator, query, .{}, .{name});
        return result;
    }

    pub fn addTagToBook(self: *TagRepository, book_id: i64, tag_id: i64, applied_by: ?i64, auto_applied: bool) !void {
        const query =
            \\INSERT INTO book_tags (book_id, tag_id, applied_by, auto_applied, applied_at)
            \\VALUES (?, ?, ?, ?, ?)
        ;

        const now = std.time.timestamp();
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            book_id,
            tag_id,
            applied_by,
            @as(i64, if (auto_applied) 1 else 0),
            now,
        });
    }

    pub fn removeTagFromBook(self: *TagRepository, book_id: i64, tag_id: i64) !void {
        const query = "DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ book_id, tag_id });
    }
};
