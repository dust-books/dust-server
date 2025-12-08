const std = @import("std");
const httpz = @import("httpz");
const sqlite = @import("sqlite");
const BookRepository = @import("model.zig").BookRepository;
const AuthorRepository = @import("model.zig").AuthorRepository;
const TagRepository = @import("model.zig").TagRepository;
const Book = @import("model.zig").Book;
const Author = @import("model.zig").Author;
const Tag = @import("model.zig").Tag;
pub const BookController = struct {
    book_repo: *BookRepository,
    author_repo: *AuthorRepository,
    tag_repo: *TagRepository,
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(
        db: *sqlite.Db,
        book_repo: *BookRepository,
        author_repo: *AuthorRepository,
        tag_repo: *TagRepository,
        allocator: std.mem.Allocator,
    ) BookController {
        return .{
            .db = db,
            .book_repo = book_repo,
            .author_repo = author_repo,
            .tag_repo = tag_repo,
            .allocator = allocator,
        };
    }
    
    pub fn deinit(self: *BookController) void {
        self.allocator.destroy(self.book_repo);
        self.allocator.destroy(self.author_repo);
        self.allocator.destroy(self.tag_repo);
    }

    // GET /books - List all books
    pub fn listBooks(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;
        
        // Use the response arena for all allocations
        const arena = res.arena;
        
        const books = try self.book_repo.listBooks(arena);
        
        res.status = 200;
        try res.json(.{ .books = books }, .{});
    }

    // GET /books/:id - Get specific book
    pub fn getBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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

        // Use res.arena so memory stays alive for the response
        const allocator = res.arena;

        const book = self.book_repo.getBookById(allocator, id) catch |err| {
            if (err == error.BookNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "Book not found" }, .{});
                return;
            }
            return err;
        };

        const author = try self.author_repo.getAuthorById(allocator, book.author);
        const tags = try self.tag_repo.getBookTags(allocator, book.id);

        var list = std.ArrayList(u8){};
        defer list.deinit(allocator);
        const writer = list.writer(allocator);

        // Wrap in "book" field for client compatibility
        try writer.writeAll("{\"book\":{");
        
        try std.fmt.format(writer,
            \\"id":{d},"name":"{s}","author":{{"id":{d},"name":"{s}"}},"file_path":"{s}","status":"{s}"
        , .{ book.id, book.name, author.id, author.name, book.file_path, book.status });

        if (book.isbn) |isbn| try std.fmt.format(writer, ",\"isbn\":\"{s}\"", .{isbn});
        if (book.description) |desc| try std.fmt.format(writer, ",\"description\":\"{s}\"", .{desc});
        if (book.page_count) |pc| try std.fmt.format(writer, ",\"page_count\":{d}", .{pc});
        if (book.file_size) |fs| try std.fmt.format(writer, ",\"file_size\":{d}", .{fs});
        if (book.file_format) |ff| try std.fmt.format(writer, ",\"file_format\":\"{s}\"", .{ff});

        try writer.writeAll("},\"tags\":[");
        for (tags, 0..) |tag, i| {
            if (i > 0) try writer.writeAll(",");
            try std.fmt.format(writer, "{{\"id\":{d},\"name\":\"{s}\",\"category\":\"{s}\"}}", .{ tag.id, tag.name, tag.category });
        }
        try writer.writeAll("]}");

        res.status = 200;
        res.content_type = httpz.ContentType.JSON;
        res.body = try allocator.dupe(u8, list.items);
    }

    // GET /books/authors - List all authors
    pub fn listAuthors(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

        const authors = try self.author_repo.listAuthors(allocator);

        var list = std.ArrayList(u8){};
        defer list.deinit(allocator);
        const writer = list.writer(allocator);

        try writer.writeAll("{\"authors\":[");
        for (authors, 0..) |author, i| {
            if (i > 0) try writer.writeAll(",");

            try std.fmt.format(writer,
                \\{{"id":{d},"name":"{s}"
            , .{ author.id, author.name });

            if (author.biography) |bio| try std.fmt.format(writer, ",\"biography\":\"{s}\"", .{bio});
            if (author.birth_date) |bd| try std.fmt.format(writer, ",\"birth_date\":\"{s}\"", .{bd});
            if (author.nationality) |nat| try std.fmt.format(writer, ",\"nationality\":\"{s}\"", .{nat});

            try writer.writeAll("}");
        }
        try writer.writeAll("]}");

        res.status = 200;
        res.content_type = httpz.ContentType.JSON;
        res.body = try allocator.dupe(u8, list.items);
    }

    // GET /books/authors/:id - Get specific author
    pub fn getAuthor(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

        const author = self.author_repo.getAuthorById(allocator, id) catch |err| {
            if (err == error.AuthorNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "Author not found" }, .{});
                return;
            }
            return err;
        };

        // Get books by this author
        const query =
            \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
            \\       description, page_count, file_size, file_format, cover_image_path,
            \\       status, archived_at, archive_reason, created_at, updated_at
            \\FROM books WHERE author = ? AND status = 'active'
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        const books = try stmt.all(Book, allocator, .{}, .{id});

        var list = std.ArrayList(u8){};
        defer list.deinit(allocator);
        const writer = list.writer(allocator);

        try std.fmt.format(writer,
            \\{{"id":{d},"name":"{s}"
        , .{ author.id, author.name });

        if (author.biography) |bio| try std.fmt.format(writer, ",\"biography\":\"{s}\"", .{bio});

        try writer.writeAll(",\"books\":[");
        for (books, 0..) |book, i| {
            if (i > 0) try writer.writeAll(",");
            try std.fmt.format(writer,
                \\{{"id":{d},"name":"{s}","status":"{s}"}}
            , .{ book.id, book.name, book.status });
        }
        try writer.writeAll("]}");

        res.status = 200;
        res.content_type = httpz.ContentType.JSON;
        res.body = try allocator.dupe(u8, list.items);
    }

    // GET /tags - List all tags
    pub fn listTags(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

        const tags = try self.tag_repo.getAllTags(allocator);

        var list = std.ArrayList(u8){};
        defer list.deinit(allocator);
        const writer = list.writer(allocator);

        try writer.writeAll("{\"tags\":[");
        for (tags, 0..) |tag, i| {
            if (i > 0) try writer.writeAll(",");
            try std.fmt.format(writer,
                \\{{"id":{d},"name":"{s}","category":"{s}"
            , .{ tag.id, tag.name, tag.category });

            if (tag.description) |desc| try std.fmt.format(writer, ",\"description\":\"{s}\"", .{desc});
            if (tag.color) |color| try std.fmt.format(writer, ",\"color\":\"{s}\"", .{color});

            try writer.writeAll("}");
        }
        try writer.writeAll("]}");

        res.status = 200;
        res.content_type = httpz.ContentType.JSON;
        res.body = try allocator.dupe(u8, list.items);
    }

    // GET /tags/categories/:category - Get tags by category
    pub fn getTagsByCategory(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const category = req.param("category") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing category" }, .{});
            return;
        };

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

        const tags = try self.tag_repo.getTagsByCategory(allocator, category);

        var list = std.ArrayList(u8){};
        defer list.deinit(allocator);
        const writer = list.writer(allocator);

        try writer.writeAll("{\"tags\":[");
        for (tags, 0..) |tag, i| {
            if (i > 0) try writer.writeAll(",");
            try std.fmt.format(writer,
                \\{{"id":{d},"name":"{s}","category":"{s}"}}
            , .{ tag.id, tag.name, tag.category });
        }
        try writer.writeAll("]}");

        res.status = 200;
        res.content_type = httpz.ContentType.JSON;
        res.body = try allocator.dupe(u8, list.items);
    }

    // POST /books/:id/tags - Add tag to book
    pub fn addTagToBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        // For now, use a placeholder user ID since we need authentication middleware
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

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

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

        // Get tag by name
        const maybe_tag = try self.tag_repo.getTagByName(allocator, tag_name);
        const tag = maybe_tag orelse {
            res.status = 404;
            try res.json(.{ .@"error" = "Tag not found" }, .{});
            return;
        };

        // Add tag to book
        try self.tag_repo.addTagToBook(book_id, tag.id, user_id, false);

        res.status = 200;
        try res.json(.{ .message = "Tag added successfully" }, .{});
    }

    // DELETE /books/:id/tags/:tagName - Remove tag from book
    pub fn removeTagFromBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

        // Get tag by name
        const maybe_tag = try self.tag_repo.getTagByName(allocator, tag_name);
        const tag = maybe_tag orelse {
            res.status = 404;
            try res.json(.{ .@"error" = "Tag not found" }, .{});
            return;
        };

        // Remove tag from book
        try self.tag_repo.removeTagFromBook(book_id, tag.id);

        res.status = 200;
        try res.json(.{ .message = "Tag removed successfully" }, .{});
    }

    // POST /books/:id/archive - Archive a book
    pub fn archiveBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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
            try self.book_repo.archiveBook(book_id, null);
            res.status = 200;
            try res.json(.{ .message = "Book archived successfully" }, .{});
            return;
        };

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

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

        try self.book_repo.archiveBook(book_id, parsed.value.reason);

        res.status = 200;
        try res.json(.{ .message = "Book archived successfully" }, .{});
    }

    // DELETE /books/:id/archive - Unarchive a book
    pub fn unarchiveBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{book_id});

        res.status = 200;
        try res.json(.{ .message = "Book unarchived successfully" }, .{});
    }

    // GET /books/archive - List archived books
    pub fn listArchivedBooks(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

        const query =
            \\SELECT id, name, author, file_path, isbn, publication_date, publisher,
            \\       description, page_count, file_size, file_format, cover_image_path,
            \\       status, archived_at, archive_reason, created_at, updated_at
            \\FROM books WHERE status = 'archived'
            \\ORDER BY archived_at DESC
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        const books = try stmt.all(Book, allocator, .{}, .{});

        var list = std.ArrayList(u8){};
        defer list.deinit(allocator);
        const writer = list.writer(allocator);

        try writer.writeAll("{\"books\":[");
        for (books, 0..) |book, i| {
            if (i > 0) try writer.writeAll(",");

            const author = try self.author_repo.getAuthorById(allocator, book.author);

            try std.fmt.format(writer,
                \\{{"id":{d},"name":"{s}","author":{{"id":{d},"name":"{s}"}},
            , .{ book.id, book.name, author.id, author.name });

            try std.fmt.format(writer, "\"status\":\"{s}\"", .{book.status});

            if (book.archived_at) |archived_at| {
                try std.fmt.format(writer, ",\"archived_at\":\"{s}\"", .{archived_at});
            }
            if (book.archive_reason) |reason| {
                try std.fmt.format(writer, ",\"archive_reason\":\"{s}\"", .{reason});
            }

            try writer.writeAll("}");
        }
        try writer.writeAll("]}");

        res.status = 200;
        res.content_type = httpz.ContentType.JSON;
        res.body = try allocator.dupe(u8, list.items);
    }

    pub fn createBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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

        const book = try self.book_repo.create(allocator, body.name, body.filepath, body.file_format, body.author_id);
        res.status = 201;
        try res.json(book, .{});
    }

    pub fn updateBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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

        const book = try self.book_repo.update(allocator, id, body.name, body.filepath, body.file_format, body.author_id);
        if (book) |b| {
            try res.json(b, .{});
        } else {
            res.status = 404;
            try res.json(.{ .@"error" = "Book not found" }, .{});
        }
    }

    pub fn deleteBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
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

        const deleted = try self.book_repo.delete(id);
        if (deleted) {
            res.status = 204;
        } else {
            res.status = 404;
            try res.json(.{ .@"error" = "Book not found" }, .{});
        }
    }
};
