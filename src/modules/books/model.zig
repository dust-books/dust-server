const std = @import("std");
const zqlite = @import("zqlite");
const cover = @import("../../cover_manager.zig");
const MetadataExtractor = @import("../../metadata_extractor.zig").MetadataExtractor;
const CoverManager = @import("../../cover_manager.zig").CoverManager;
const time_compat = @import("../../time_compat.zig");
const Config = @import("../../config.zig").Config;

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
    aliases: ?[]const u8,
    genres: ?[]const u8,
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

pub const BookWithAuthorRow = struct {
    id: i64,
    name: []const u8,
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
    author_id: i64,
    author_name: []const u8,
};

fn rowToBook(row: anytype, allocator: std.mem.Allocator) !Book {
    return Book{
        .id = row.int(0),
        .name = try allocator.dupe(u8, row.text(1)),
        .author = row.int(2),
        .file_path = try allocator.dupe(u8, row.text(3)),
        .isbn = if (row.nullableText(4)) |s| try allocator.dupe(u8, s) else null,
        .publication_date = if (row.nullableText(5)) |s| try allocator.dupe(u8, s) else null,
        .publisher = if (row.nullableText(6)) |s| try allocator.dupe(u8, s) else null,
        .description = if (row.nullableText(7)) |s| try allocator.dupe(u8, s) else null,
        .page_count = row.nullableInt(8),
        .file_size = row.nullableInt(9),
        .file_format = if (row.nullableText(10)) |s| try allocator.dupe(u8, s) else null,
        .cover_image_path = if (row.nullableText(11)) |s| try allocator.dupe(u8, s) else null,
        .status = try allocator.dupe(u8, row.text(12)),
        .archived_at = if (row.nullableText(13)) |s| try allocator.dupe(u8, s) else null,
        .archive_reason = if (row.nullableText(14)) |s| try allocator.dupe(u8, s) else null,
        .created_at = try allocator.dupe(u8, row.text(15)),
        .updated_at = try allocator.dupe(u8, row.text(16)),
    };
}

fn rowToAuthor(row: anytype, allocator: std.mem.Allocator) !Author {
    return Author{
        .id = row.int(0),
        .name = try allocator.dupe(u8, row.text(1)),
        .biography = if (row.nullableText(2)) |s| try allocator.dupe(u8, s) else null,
        .birth_date = if (row.nullableText(3)) |s| try allocator.dupe(u8, s) else null,
        .death_date = if (row.nullableText(4)) |s| try allocator.dupe(u8, s) else null,
        .nationality = if (row.nullableText(5)) |s| try allocator.dupe(u8, s) else null,
        .image_url = if (row.nullableText(6)) |s| try allocator.dupe(u8, s) else null,
        .wikipedia_url = if (row.nullableText(7)) |s| try allocator.dupe(u8, s) else null,
        .goodreads_url = if (row.nullableText(8)) |s| try allocator.dupe(u8, s) else null,
        .website = if (row.nullableText(9)) |s| try allocator.dupe(u8, s) else null,
        .aliases = if (row.nullableText(10)) |s| try allocator.dupe(u8, s) else null,
        .genres = if (row.nullableText(11)) |s| try allocator.dupe(u8, s) else null,
        .created_at = if (row.nullableText(12)) |s| try allocator.dupe(u8, s) else null,
        .updated_at = if (row.nullableText(13)) |s| try allocator.dupe(u8, s) else null,
    };
}

fn rowToTag(row: anytype, allocator: std.mem.Allocator) !Tag {
    return Tag{
        .id = row.int(0),
        .name = try allocator.dupe(u8, row.text(1)),
        .category = try allocator.dupe(u8, row.text(2)),
        .description = if (row.nullableText(3)) |s| try allocator.dupe(u8, s) else null,
        .color = if (row.nullableText(4)) |s| try allocator.dupe(u8, s) else null,
        .requires_permission = if (row.nullableText(5)) |s| try allocator.dupe(u8, s) else null,
        .created_at = try allocator.dupe(u8, row.text(6)),
    };
}

fn rowToBookWithAuthor(row: anytype, allocator: std.mem.Allocator) !BookWithAuthorRow {
    return BookWithAuthorRow{
        .id = row.int(0),
        .name = try allocator.dupe(u8, row.text(1)),
        .file_path = try allocator.dupe(u8, row.text(2)),
        .isbn = if (row.nullableText(3)) |s| try allocator.dupe(u8, s) else null,
        .publication_date = if (row.nullableText(4)) |s| try allocator.dupe(u8, s) else null,
        .publisher = if (row.nullableText(5)) |s| try allocator.dupe(u8, s) else null,
        .description = if (row.nullableText(6)) |s| try allocator.dupe(u8, s) else null,
        .page_count = row.nullableInt(7),
        .file_size = row.nullableInt(8),
        .file_format = if (row.nullableText(9)) |s| try allocator.dupe(u8, s) else null,
        .cover_image_path = if (row.nullableText(10)) |s| try allocator.dupe(u8, s) else null,
        .status = try allocator.dupe(u8, row.text(11)),
        .archived_at = if (row.nullableText(12)) |s| try allocator.dupe(u8, s) else null,
        .archive_reason = if (row.nullableText(13)) |s| try allocator.dupe(u8, s) else null,
        .created_at = try allocator.dupe(u8, row.text(14)),
        .updated_at = try allocator.dupe(u8, row.text(15)),
        .author_id = row.int(16),
        .author_name = try allocator.dupe(u8, row.text(17)),
    };
}

pub const BookRepository = struct {
    db: *zqlite.Conn,
    config: Config,

    pub fn init(db: *zqlite.Conn, config: Config) BookRepository {
        return .{
            .db = db,
            .config = config,
        };
    }

    pub fn getBookById(self: *BookRepository, allocator: std.mem.Allocator, id: i64) !Book {
        const query =
            \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
            \\       description, page_count, file_size, file_format, cover_image_path,
            \\       status, archived_at, archive_reason, created_at, updated_at
            \\FROM books WHERE id = ?
        ;

        const row = try self.db.row(query, .{id}) orelse return error.BookNotFound;
        defer row.deinit();
        return rowToBook(row, allocator);
    }

    pub fn listBooksWithAuthors(self: *BookRepository, allocator: std.mem.Allocator) ![]BookWithAuthorRow {
        const query =
            \\SELECT b.id, b.name, b.file_path, b.isbn, b.publication_date, b.publisher,
            \\       b.description, b.page_count, b.file_size, b.file_format, b.cover_image_path,
            \\       b.status, b.archived_at, b.archive_reason, b.created_at, b.updated_at,
            \\       a.id AS author_id, a.name AS author_name
            \\FROM books b
            \\INNER JOIN authors a ON b.author = a.id
            \\WHERE b.status = 'active'
            \\ORDER BY b.created_at DESC
        ;

        var list = std.ArrayList(BookWithAuthorRow).empty;
        errdefer list.deinit(allocator);

        var rows = try self.db.rows(query, .{});
        defer rows.deinit();
        while (rows.next()) |row| {
            try list.append(allocator, try rowToBookWithAuthor(row, allocator));
        }
        if (rows.err) |err| return err;

        return list.toOwnedSlice(allocator);
    }

    pub fn listArchivedBooksWithAuthors(self: *BookRepository, allocator: std.mem.Allocator) ![]BookWithAuthorRow {
        const query =
            \\SELECT b.id, b.name, b.file_path, b.isbn, b.publication_date, b.publisher,
            \\       b.description, b.page_count, b.file_size, b.file_format, b.cover_image_path,
            \\       b.status, b.archived_at, b.archive_reason, b.created_at, b.updated_at,
            \\       a.id AS author_id, a.name AS author_name
            \\FROM books b
            \\INNER JOIN authors a ON b.author = a.id
            \\WHERE b.status = 'archived'
            \\ORDER BY b.archived_at DESC
        ;

        var list = std.ArrayList(BookWithAuthorRow).empty;
        errdefer list.deinit(allocator);

        var rows = try self.db.rows(query, .{});
        defer rows.deinit();
        while (rows.next()) |row| {
            try list.append(allocator, try rowToBookWithAuthor(row, allocator));
        }
        if (rows.err) |err| return err;

        return list.toOwnedSlice(allocator);
    }

    pub fn unarchiveBook(self: *BookRepository, id: i64) !void {
        try self.db.exec(
            \\UPDATE books
            \\SET status = 'active', archived_at = NULL,
            \\    archive_reason = NULL, updated_at = CURRENT_TIMESTAMP
            \\WHERE id = ?
        , .{id});
    }

    pub fn archiveBook(self: *BookRepository, id: i64, reason: ?[]const u8) !void {
        try self.db.exec(
            \\UPDATE books
            \\SET status = 'archived', archived_at = CURRENT_TIMESTAMP,
            \\    archive_reason = ?, updated_at = CURRENT_TIMESTAMP
            \\WHERE id = ?
        , .{ reason, id });
    }

    pub fn refreshMetadata(self: *BookRepository, allocator: std.mem.Allocator, io: std.Io, id: i64) !void {
        const book = try self.getBookById(allocator, id);

        var metadata_extractor = try MetadataExtractor.init(allocator, io, true, self.config);

        var metadata = try metadata_extractor.extractMetadata(io, book.file_path);
        defer metadata.deinit(allocator);

        var cover_manager = CoverManager.init(allocator);
        const cover_path = cover_manager.ensureCover(io, book.file_path, metadata.cover_image_url) catch |err| blk: {
            std.log.warn("Failed to resolve cover for book {d}: {}", .{ id, err });
            break :blk null;
        };
        defer if (cover_path) |cp| allocator.free(cp);

        var author_id: ?i64 = null;
        if (metadata.author) |author_name| {
            var author_repo = AuthorRepository.init(self.db);
            author_id = author_repo.getOrCreateAuthorByName(author_name) catch |err| blk: {
                std.log.warn("Failed to get/create author: {}", .{err});
                break :blk null;
            };
        }

        const file = try std.Io.Dir.openFileAbsolute(io, book.file_path, .{});
        defer file.close(io);
        const stat = try file.stat(io);

        try self.db.exec(
            \\UPDATE books
            \\SET name = COALESCE(?, name),
            \\    author = COALESCE(?, author),
            \\    isbn = COALESCE(?, isbn),
            \\    publisher = COALESCE(?, publisher),
            \\    publication_date = COALESCE(?, publication_date),
            \\    description = COALESCE(?, description),
            \\    page_count = COALESCE(?, page_count),
            \\    file_size = ?,
            \\    file_format = COALESCE(?, file_format),
            \\    cover_image_path = COALESCE(?, cover_image_path),
            \\    updated_at = CURRENT_TIMESTAMP
            \\WHERE id = ?
        , .{
            metadata.title,
            author_id,
            metadata.isbn,
            metadata.publisher,
            metadata.publication_date,
            metadata.description,
            if (metadata.page_count) |pc| @as(?i64, @intCast(pc)) else @as(?i64, null),
            @as(i64, @intCast(stat.size)),
            metadata.file_format,
            cover_path,
            id,
        });
    }
};

pub const AuthorRepository = struct {
    db: *zqlite.Conn,

    pub fn init(db: *zqlite.Conn) AuthorRepository {
        return .{ .db = db };
    }

    pub fn getAuthorById(self: *AuthorRepository, allocator: std.mem.Allocator, id: i64) !Author {
        const query =
            \\SELECT id, name, biography, birth_date, death_date, nationality,
            \\       image_url, wikipedia_url, goodreads_url, website, aliases, genres,
            \\       created_at, updated_at
            \\FROM authors WHERE id = ?
        ;

        const row = try self.db.row(query, .{id}) orelse return error.AuthorNotFound;
        defer row.deinit();
        return rowToAuthor(row, allocator);
    }

    pub fn listAuthors(self: *AuthorRepository, allocator: std.mem.Allocator) ![]Author {
        const query =
            \\SELECT id, name, biography, birth_date, death_date, nationality,
            \\       image_url, wikipedia_url, goodreads_url, website, aliases, genres,
            \\       created_at, updated_at
            \\FROM authors ORDER BY name ASC
        ;

        var list = std.ArrayList(Author).empty;
        errdefer list.deinit(allocator);

        var rows = try self.db.rows(query, .{});
        defer rows.deinit();
        while (rows.next()) |row| {
            try list.append(allocator, try rowToAuthor(row, allocator));
        }
        if (rows.err) |err| return err;

        return list.toOwnedSlice(allocator);
    }

    pub fn createAuthor(self: *AuthorRepository, name: []const u8) !i64 {
        try self.db.exec("INSERT INTO authors (name) VALUES (?)", .{name});
        return self.db.lastInsertedRowId();
    }

    pub fn getBooksByAuthor(self: *AuthorRepository, allocator: std.mem.Allocator, author_id: i64) ![]Book {
        const query =
            \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
            \\       description, page_count, file_size, file_format, cover_image_path,
            \\       status, archived_at, archive_reason, created_at, updated_at
            \\FROM books WHERE author = ? AND status = 'active'
        ;

        var list = std.ArrayList(Book).empty;
        errdefer list.deinit(allocator);

        var rows = try self.db.rows(query, .{author_id});
        defer rows.deinit();
        while (rows.next()) |row| {
            try list.append(allocator, try rowToBook(row, allocator));
        }
        if (rows.err) |err| return err;

        return list.toOwnedSlice(allocator);
    }

    pub fn getAuthorByName(self: *AuthorRepository, allocator: std.mem.Allocator, name: []const u8) !Author {
        const query =
            \\SELECT id, name, biography, birth_date, death_date, nationality,
            \\       image_url, wikipedia_url, goodreads_url, website, aliases, genres,
            \\       created_at, updated_at
            \\FROM authors WHERE name = ?
        ;

        const row = try self.db.row(query, .{name}) orelse return error.AuthorNotFound;
        defer row.deinit();
        return rowToAuthor(row, allocator);
    }

    pub fn getOrCreateAuthorByName(self: *AuthorRepository, name: []const u8) !i64 {
        if (try self.db.row("SELECT id FROM authors WHERE name = ?", .{name})) |row| {
            defer row.deinit();
            return row.int(0);
        }

        try self.db.exec(
            "INSERT INTO authors (name, created_at) VALUES (?, datetime('now'))",
            .{name},
        );
        return self.db.lastInsertedRowId();
    }
};

pub const TagRepository = struct {
    db: *zqlite.Conn,

    pub fn init(db: *zqlite.Conn) TagRepository {
        return .{ .db = db };
    }

    pub fn getAllTags(self: *TagRepository, allocator: std.mem.Allocator) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, requires_permission, created_at
            \\FROM tags ORDER BY category, name
        ;

        var list = std.ArrayList(Tag).empty;
        errdefer list.deinit(allocator);

        var rows = try self.db.rows(query, .{});
        defer rows.deinit();
        while (rows.next()) |row| {
            try list.append(allocator, try rowToTag(row, allocator));
        }
        if (rows.err) |err| return err;

        return list.toOwnedSlice(allocator);
    }

    pub fn getTagsByCategory(self: *TagRepository, allocator: std.mem.Allocator, category: []const u8) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, requires_permission, created_at
            \\FROM tags WHERE category = ? ORDER BY name
        ;

        var list = std.ArrayList(Tag).empty;
        errdefer list.deinit(allocator);

        var rows = try self.db.rows(query, .{category});
        defer rows.deinit();
        while (rows.next()) |row| {
            try list.append(allocator, try rowToTag(row, allocator));
        }
        if (rows.err) |err| return err;

        return list.toOwnedSlice(allocator);
    }

    pub fn getBookTags(self: *TagRepository, allocator: std.mem.Allocator, book_id: i64) ![]Tag {
        const query =
            \\SELECT t.id, t.name, t.category, t.description, t.color, t.requires_permission, t.created_at
            \\FROM tags t
            \\JOIN book_tags bt ON t.id = bt.tag_id
            \\WHERE bt.book_id = ?
            \\ORDER BY t.category, t.name
        ;

        var list = std.ArrayList(Tag).empty;
        errdefer list.deinit(allocator);

        var rows = try self.db.rows(query, .{book_id});
        defer rows.deinit();
        while (rows.next()) |row| {
            try list.append(allocator, try rowToTag(row, allocator));
        }
        if (rows.err) |err| return err;

        return list.toOwnedSlice(allocator);
    }

    pub fn getTagByName(self: *TagRepository, allocator: std.mem.Allocator, name: []const u8) !?Tag {
        const query =
            \\SELECT id, name, category, description, color, requires_permission, created_at
            \\FROM tags WHERE name = ?
        ;

        const row = try self.db.row(query, .{name}) orelse return null;
        defer row.deinit();
        return try rowToTag(row, allocator);
    }

    pub fn addTagToBook(self: *TagRepository, book_id: i64, tag_id: i64, applied_by: ?i64, auto_applied: bool) !void {
        const now = time_compat.timestamp();
        try self.db.exec(
            \\INSERT INTO book_tags (book_id, tag_id, applied_by, auto_applied, applied_at)
            \\VALUES (?, ?, ?, ?, ?)
        , .{
            book_id,
            tag_id,
            applied_by,
            @as(i64, if (auto_applied) 1 else 0),
            now,
        });
    }

    pub fn removeTagFromBook(self: *TagRepository, book_id: i64, tag_id: i64) !void {
        try self.db.exec(
            "DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?",
            .{ book_id, tag_id },
        );
    }
};
