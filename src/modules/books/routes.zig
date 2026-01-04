const std = @import("std");
const httpz = @import("httpz");
const sqlite = @import("sqlite");
const BookRepository = @import("model.zig").BookRepository;
const AuthorRepository = @import("model.zig").AuthorRepository;
const TagRepository = @import("model.zig").TagRepository;
const Book = @import("model.zig").Book;

fn sanitizeCoverPath(path: ?[]const u8) ?[]const u8 {
    if (path) |p| {
        return std.fs.path.basename(p);
    }
    return null;
}

// GET /books - List all books
pub fn listBooks(
    book_repo: *BookRepository,
    author_repo: *AuthorRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;

    const arena = res.arena;
    const books = try book_repo.listBooks(arena);

    const BookWithAuthor = struct {
        id: i64,
        name: []const u8,
        author: struct {
            id: i64,
            name: []const u8,
        },
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
    };

    var books_with_authors = try std.ArrayList(BookWithAuthor).initCapacity(arena, books.len);
    for (books) |book| {
        const author = try author_repo.getAuthorById(arena, book.author);
        var cover_path: ?[]const u8 = null;
        if (book.cover_image_path != null) {
            cover_path = try std.fmt.allocPrint(arena, "covers/{d}", .{book.id});
        }
        try books_with_authors.append(arena, .{
            .id = book.id,
            .name = book.name,
            .author = .{
                .id = author.id,
                .name = author.name,
            },
            .isbn = book.isbn,
            .publication_date = book.publication_date,
            .publisher = book.publisher,
            .description = book.description,
            .page_count = book.page_count,
            .file_size = book.file_size,
            .file_format = book.file_format,
            .cover_image_path = cover_path,
            .status = book.status,
            .archived_at = book.archived_at,
            .archive_reason = book.archive_reason,
            .created_at = book.created_at,
            .updated_at = book.updated_at,
        });
    }

    res.status = 200;
    try res.json(.{ .books = books_with_authors.items }, .{});
}

// GET /books/:id - Get specific book
pub fn getBook(
    book_repo: *BookRepository,
    author_repo: *AuthorRepository,
    tag_repo: *TagRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const allocator = res.arena;

    const book = book_repo.getBookById(allocator, id) catch |err| {
        if (err == error.BookNotFound) {
            res.status = 404;
            try res.json(.{ .@"error" = "Book not found" }, .{});
            return;
        }
        return err;
    };

    const author = try author_repo.getAuthorById(allocator, book.author);
    const tags = try tag_repo.getBookTags(allocator, book.id);

    const TagItem = struct {
        id: i64,
        name: []const u8,
        category: []const u8,
    };

    var tag_list = try std.ArrayList(TagItem).initCapacity(allocator, tags.len);
    for (tags) |tag| {
        tag_list.appendAssumeCapacity(.{
            .id = tag.id,
            .name = tag.name,
            .category = tag.category,
        });
    }

    var cover_path: ?[]const u8 = null;
    if (book.cover_image_path != null) {
        cover_path = try std.fmt.allocPrint(allocator, "covers/{d}", .{book.id});
    }
    const response = .{
        .book = .{
            .id = book.id,
            .name = book.name,
            .author = .{
                .id = author.id,
                .name = author.name,
            },
            .status = book.status,
            .isbn = book.isbn,
            .description = book.description,
            .page_count = book.page_count,
            .file_size = book.file_size,
            .file_format = book.file_format,
            .cover_image_path = cover_path,
        },
        .tags = tag_list.items,
    };

    res.status = 200;
    try res.json(response, .{});
}

// POST /books - Create book
pub fn createBook(
    book_repo: *BookRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const allocator = res.arena;

    const body = try req.json(struct {
        name: []const u8,
        filepath: []const u8,
        file_format: []const u8,
        author_id: ?i64 = null,
    }) orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid JSON body" }, .{});
        return;
    };

    const book = try book_repo.create(allocator, body.name, body.filepath, body.file_format, body.author_id);
    res.status = 201;
    try res.json(book, .{});
}

// PUT /books/:id - Update book
pub fn updateBook(
    book_repo: *BookRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const allocator = res.arena;

    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book id" }, .{});
        return;
    };

    const id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book id" }, .{});
        return;
    };

    const body = try req.json(struct {
        name: ?[]const u8 = null,
        filepath: ?[]const u8 = null,
        file_format: ?[]const u8 = null,
        author_id: ?i64 = null,
    }) orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid JSON body" }, .{});
        return;
    };

    const book = try book_repo.update(allocator, id, body.name, body.filepath, body.file_format, body.author_id);
    if (book) |b| {
        try res.json(b, .{});
    } else {
        res.status = 404;
        try res.json(.{ .@"error" = "Book not found" }, .{});
    }
}

// DELETE /books/:id - Delete book
pub fn deleteBook(
    book_repo: *BookRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book id" }, .{});
        return;
    };

    const id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book id" }, .{});
        return;
    };

    const deleted = try book_repo.delete(id);
    if (deleted) {
        res.status = 204;
    } else {
        res.status = 404;
        try res.json(.{ .@"error" = "Book not found" }, .{});
    }
}

// GET /books/authors - List all authors
pub fn listAuthors(
    author_repo: *AuthorRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;

    const allocator = res.arena;
    const authors = try author_repo.listAuthors(allocator);

    const AuthorItem = struct {
        id: i64,
        name: []const u8,
        biography: ?[]const u8 = null,
        birth_date: ?[]const u8 = null,
        nationality: ?[]const u8 = null,
    };

    var author_list = try std.ArrayList(AuthorItem).initCapacity(allocator, authors.len);
    for (authors) |author| {
        author_list.appendAssumeCapacity(.{
            .id = author.id,
            .name = author.name,
            .biography = author.biography,
            .birth_date = author.birth_date,
            .nationality = author.nationality,
        });
    }

    res.status = 200;
    try res.json(.{ .authors = author_list.items }, .{});
}

// GET /books/authors/:id - Get specific author with books
pub fn getAuthor(
    db: *sqlite.Db,
    author_repo: *AuthorRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing author ID" }, .{});
        return;
    };

    const id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid author ID" }, .{});
        return;
    };

    const allocator = res.arena;

    const author = author_repo.getAuthorById(allocator, id) catch |err| {
        if (err == error.AuthorNotFound) {
            res.status = 404;
            try res.json(.{ .@"error" = "Author not found" }, .{});
            return;
        }
        return err;
    };

    const query =
        \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
        \\       description, page_count, file_size, file_format, cover_image_path,
        \\       status, archived_at, archive_reason, created_at, updated_at
        \\FROM books WHERE author = ? AND status = 'active'
    ;

    var stmt = try db.prepare(query);
    defer stmt.deinit();

    const books = try stmt.all(Book, allocator, .{}, .{id});

    const BookItem = struct {
        id: i64,
        name: []const u8,
        status: []const u8,
    };

    var book_list = try std.ArrayList(BookItem).initCapacity(allocator, books.len);
    for (books) |book| {
        book_list.appendAssumeCapacity(.{
            .id = book.id,
            .name = book.name,
            .status = book.status,
        });
    }

    const response = .{
        .id = author.id,
        .name = author.name,
        .biography = author.biography,
        .books = book_list.items,
    };

    res.status = 200;
    try res.json(response, .{});
}

// GET /tags - List all tags
pub fn listTags(
    tag_repo: *TagRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;

    const allocator = res.arena;
    const tags = try tag_repo.getAllTags(allocator);

    const TagItem = struct {
        id: i64,
        name: []const u8,
        category: []const u8,
        description: ?[]const u8 = null,
        color: ?[]const u8 = null,
    };

    var tag_list = try std.ArrayList(TagItem).initCapacity(allocator, tags.len);
    for (tags) |tag| {
        tag_list.appendAssumeCapacity(.{
            .id = tag.id,
            .name = tag.name,
            .category = tag.category,
            .description = tag.description,
            .color = tag.color,
        });
    }

    res.status = 200;
    try res.json(.{ .tags = tag_list.items }, .{});
}

// GET /tags/categories/:category - Get tags by category
pub fn getTagsByCategory(
    tag_repo: *TagRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const category = req.param("category") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing category" }, .{});
        return;
    };

    const allocator = res.arena;
    const tags = try tag_repo.getTagsByCategory(allocator, category);

    const TagItem = struct {
        id: i64,
        name: []const u8,
        category: []const u8,
    };

    var tag_list = try std.ArrayList(TagItem).initCapacity(allocator, tags.len);
    for (tags) |tag| {
        tag_list.appendAssumeCapacity(.{
            .id = tag.id,
            .name = tag.name,
            .category = tag.category,
        });
    }

    res.status = 200;
    try res.json(.{ .tags = tag_list.items }, .{});
}

// POST /books/:id/tags - Add tag to book
pub fn addTagToBook(
    tag_repo: *TagRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const user_id: i64 = 1;

    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const body = req.body() orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing request body" }, .{});
        return;
    };

    const allocator = res.arena;

    const parsed = std.json.parseFromSlice(
        struct { tag_name: []const u8 },
        allocator,
        body,
        .{},
    ) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid JSON" }, .{});
        return;
    };
    defer parsed.deinit();

    const tag_name = parsed.value.tag_name;

    const maybe_tag = try tag_repo.getTagByName(allocator, tag_name);
    const tag = maybe_tag orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "Tag not found" }, .{});
        return;
    };

    try tag_repo.addTagToBook(book_id, tag.id, user_id, false);

    res.status = 200;
    try res.json(.{ .message = "Tag added successfully" }, .{});
}

// DELETE /books/:id/tags/:tagName - Remove tag from book
pub fn removeTagFromBook(
    tag_repo: *TagRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const tag_name = req.param("tagName") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing tag name" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const allocator = res.arena;

    const maybe_tag = try tag_repo.getTagByName(allocator, tag_name);
    const tag = maybe_tag orelse {
        res.status = 404;
        try res.json(.{ .@"error" = "Tag not found" }, .{});
        return;
    };

    try tag_repo.removeTagFromBook(book_id, tag.id);

    res.status = 200;
    try res.json(.{ .message = "Tag removed successfully" }, .{});
}

// POST /books/:id/archive - Archive a book
pub fn archiveBook(
    book_repo: *BookRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const body = req.body() orelse {
        try book_repo.archiveBook(book_id, null);
        res.status = 200;
        try res.json(.{ .message = "Book archived successfully" }, .{});
        return;
    };

    const allocator = res.arena;

    const parsed = std.json.parseFromSlice(
        struct { reason: ?[]const u8 = null },
        allocator,
        body,
        .{},
    ) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid JSON" }, .{});
        return;
    };
    defer parsed.deinit();

    try book_repo.archiveBook(book_id, parsed.value.reason);

    res.status = 200;
    try res.json(.{ .message = "Book archived successfully" }, .{});
}

// DELETE /books/:id/archive - Unarchive a book
pub fn unarchiveBook(
    db: *sqlite.Db,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    const query =
        \\UPDATE books 
        \\SET status = 'active', archived_at = NULL, 
        \\    archive_reason = NULL, updated_at = CURRENT_TIMESTAMP
        \\WHERE id = ?
    ;

    var stmt = try db.prepare(query);
    defer stmt.deinit();

    try stmt.exec(.{}, .{book_id});

    res.status = 200;
    try res.json(.{ .message = "Book unarchived successfully" }, .{});
}

// GET /books/archive - List archived books
pub fn listArchivedBooks(
    db: *sqlite.Db,
    author_repo: *AuthorRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;

    const allocator = res.arena;

    const query =
        \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
        \\       description, page_count, file_size, file_format, cover_image_path,
        \\       status, archived_at, archive_reason, created_at, updated_at
        \\FROM books WHERE status = 'archived'
        \\ORDER BY archived_at DESC
    ;

    var stmt = try db.prepare(query);
    defer stmt.deinit();

    const books = try stmt.all(Book, allocator, .{}, .{});

    const BookItem = struct {
        id: i64,
        name: []const u8,
        author: struct {
            id: i64,
            name: []const u8,
        },
        status: []const u8,
        archived_at: ?[]const u8 = null,
        archive_reason: ?[]const u8 = null,
    };

    var book_list = try std.ArrayList(BookItem).initCapacity(allocator, books.len);
    for (books) |book| {
        const author = try author_repo.getAuthorById(allocator, book.author);
        book_list.appendAssumeCapacity(.{
            .id = book.id,
            .name = book.name,
            .author = .{
                .id = author.id,
                .name = author.name,
            },
            .status = book.status,
            .archived_at = book.archived_at,
            .archive_reason = book.archive_reason,
        });
    }

    res.status = 200;
    try res.json(.{ .books = book_list.items }, .{});
}

// GET /reading/currently-reading - Get books currently being read
pub fn getCurrentlyReading(
    db: *sqlite.Db,
    user_id: i64,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;
    const allocator = res.arena;

    const query =
        \\SELECT b.id, b.name, b.file_format, b.isbn,
        \\       b.description, b.page_count, b.file_size, b.status,
        \\       a.id as author_id, a.name as author_name,
        \\       rp.current_page, rp.total_pages,
        \\       rp.percentage_complete * 100.0 as percentage_complete,
        \\       strftime('%Y-%m-%dT%H:%M:%SZ', rp.last_read_at) as last_read_at
        \\FROM books b
        \\INNER JOIN reading_progress rp ON b.id = rp.book_id
        \\INNER JOIN authors a ON b.author = a.id
        \\WHERE rp.user_id = ? AND rp.percentage_complete > 0 AND rp.percentage_complete < 1
        \\ORDER BY rp.last_read_at DESC
    ;

    var stmt = try db.prepare(query);
    defer stmt.deinit();

    const BookProgressRow = struct {
        id: i64,
        name: []const u8,
        file_format: ?[]const u8,
        isbn: ?[]const u8,
        description: ?[]const u8,
        page_count: ?i64,
        file_size: ?i64,
        status: []const u8,
        author_id: i64,
        author_name: []const u8,
        current_page: i64,
        total_pages: ?i64,
        percentage_complete: f64,
        last_read_at: []const u8,
    };

    const BookWithProgress = struct {
        id: i64,
        name: []const u8,
        author: struct {
            id: i64,
            name: []const u8,
        },
        status: []const u8,
        isbn: ?[]const u8 = null,
        file_format: ?[]const u8 = null,
        description: ?[]const u8 = null,
        page_count: ?i64 = null,
        file_size: ?i64 = null,
        progress: struct {
            current_page: i64,
            total_pages: ?i64,
            percentage_complete: f64,
            last_read_at: []const u8,
        },
    };

    var book_list: std.ArrayList(BookWithProgress) = .empty;
    defer book_list.deinit(allocator);
    var iter = try stmt.iterator(BookProgressRow, .{user_id});

    while (try iter.nextAlloc(allocator, .{})) |row| {
        try book_list.append(allocator, .{
            .id = row.id,
            .name = row.name,
            .author = .{
                .id = row.author_id,
                .name = row.author_name,
            },
            .status = row.status,
            .isbn = row.isbn,
            .file_format = row.file_format,
            .description = row.description,
            .page_count = row.page_count,
            .file_size = row.file_size,
            .progress = .{
                .current_page = row.current_page,
                .total_pages = row.total_pages,
                .percentage_complete = row.percentage_complete,
                .last_read_at = row.last_read_at,
            },
        });
    }

    res.status = 200;
    try res.json(.{ .books = book_list.items }, .{});
}

// GET /reading/completed - Get completed books
pub fn getCompletedReading(
    db: *sqlite.Db,
    user_id: i64,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;
    const allocator = res.arena;

    const query =
        \\SELECT b.id, b.name, b.file_format, b.isbn,
        \\       b.description, b.page_count, b.file_size, b.status,
        \\       a.id as author_id, a.name as author_name,
        \\       rp.current_page, rp.total_pages,
        \\       rp.percentage_complete * 100.0 as percentage_complete,
        \\       strftime('%Y-%m-%dT%H:%M:%SZ', rp.last_read_at) as last_read_at
        \\FROM books b
        \\INNER JOIN reading_progress rp ON b.id = rp.book_id
        \\INNER JOIN authors a ON b.author = a.id
        \\WHERE rp.user_id = ? AND rp.percentage_complete >= 1
        \\ORDER BY rp.last_read_at DESC
    ;

    var stmt = try db.prepare(query);
    defer stmt.deinit();

    const BookProgressRow = struct {
        id: i64,
        name: []const u8,
        file_format: ?[]const u8,
        isbn: ?[]const u8,
        description: ?[]const u8,
        page_count: ?i64,
        file_size: ?i64,
        status: []const u8,
        author_id: i64,
        author_name: []const u8,
        current_page: i64,
        total_pages: ?i64,
        percentage_complete: f64,
        last_read_at: []const u8,
    };

    const BookWithProgress = struct {
        id: i64,
        name: []const u8,
        author: struct {
            id: i64,
            name: []const u8,
        },
        status: []const u8,
        isbn: ?[]const u8 = null,
        file_format: ?[]const u8 = null,
        description: ?[]const u8 = null,
        page_count: ?i64 = null,
        file_size: ?i64 = null,
        progress: struct {
            current_page: i64,
            total_pages: ?i64,
            percentage_complete: f64,
            last_read_at: []const u8,
        },
    };

    var book_list: std.ArrayList(BookWithProgress) = .empty;
    defer book_list.deinit(allocator);
    var iter = try stmt.iterator(BookProgressRow, .{user_id});

    while (try iter.nextAlloc(allocator, .{})) |row| {
        try book_list.append(allocator, .{
            .id = row.id,
            .name = row.name,
            .author = .{
                .id = row.author_id,
                .name = row.author_name,
            },
            .status = row.status,
            .isbn = row.isbn,
            .file_format = row.file_format,
            .description = row.description,
            .page_count = row.page_count,
            .file_size = row.file_size,
            .progress = .{
                .current_page = row.current_page,
                .total_pages = row.total_pages,
                .percentage_complete = row.percentage_complete,
                .last_read_at = row.last_read_at,
            },
        });
    }

    res.status = 200;
    try res.json(.{ .books = book_list.items }, .{});
}

// GET /covers/isbn - Get completed books
pub fn getCover(
    db: *sqlite.Db,
    book_id: i64,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;
    const allocator = res.arena;
    var book_repo = @import("model.zig").BookRepository.init(db, allocator);
    const book = book_repo.getBookById(allocator, book_id) catch |err| {
        if (err == error.BookNotFound) {
            res.status = 404;
            try res.json(.{ .@"error" = "Book not found" }, .{});
            return;
        }
        return err;
    };

    var cover_manager = @import("../../cover_manager.zig").CoverManager.init(allocator);
    std.log.debug("Looking for cover for book {d} at path: {s}", .{ book_id, book.file_path });
    const cover_path = cover_manager.findLocalCover(book.file_path) catch |err| blk: {
        std.log.warn("Failed to locate cover for book {d} ({s}): {} ({s})", .{ book_id, book.file_path, err, @errorName(err) });
        break :blk null;
    };
    if (cover_path) |path| {
        std.log.debug("Found cover for book {d}: {s} (absolute: {})", .{ book_id, path, std.fs.path.isAbsolute(path) });
        // Guess content type from extension
        const ext = std.fs.path.extension(path);
        const content_type = if (std.ascii.eqlIgnoreCase(ext, ".png")) "image/png" else if (std.ascii.eqlIgnoreCase(ext, ".webp")) "image/webp" else if (std.ascii.eqlIgnoreCase(ext, ".jpeg")) "image/jpeg" else "image/jpeg";
        res.header("Content-Type", content_type);
        // Read file and send
        const file = if (std.fs.path.isAbsolute(path))
            std.fs.openFileAbsolute(path, .{}) catch |err| {
                std.log.err("Failed to open absolute cover path '{s}' for book {d}: {} ({s})", .{ path, book_id, err, @errorName(err) });
                return err;
            }
        else
            std.fs.cwd().openFile(path, .{}) catch |err| {
                std.log.err("Failed to open relative cover path '{s}' for book {d}: {} ({s})", .{ path, book_id, err, @errorName(err) });
                return err;
            };
        defer file.close();
        const stat = try file.stat();
        const bytes = try allocator.alloc(u8, stat.size);
        _ = try file.readAll(bytes);
        std.log.debug("Successfully served cover for book {d} ({d} bytes)", .{ book_id, bytes.len });
        res.status = 200;
        res.body = bytes;
        return;
    } else {
        std.log.info("No cover found for book {d} ({s})", .{ book_id, book.file_path });
        res.status = 404;
        try res.json(.{ .@"error" = "Cover not found" }, .{});
        return;
    }
}
