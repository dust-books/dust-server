const std = @import("std");
const httpz = @import("httpz");
const BookRepository = @import("model.zig").BookRepository;
const AuthorRepository = @import("model.zig").AuthorRepository;
const TagRepository = @import("model.zig").TagRepository;
const Book = @import("model.zig").Book;
const Author = @import("model.zig").Author;
const Tag = @import("model.zig").Tag;

pub const BookController = struct {
    allocator: std.mem.Allocator,
    book_repo: *BookRepository,
    author_repo: *AuthorRepository,

    pub fn init(
        allocator: std.mem.Allocator,
        book_repo: *BookRepository,
        author_repo: *AuthorRepository,
    ) BookController {
        return .{
            .allocator = allocator,
            .book_repo = book_repo,
            .author_repo = author_repo,
        };
    }

    // GET /books - List all books
    pub fn listBooks(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        const books = try self.book_repo.listBooks(self.allocator);
        defer {
            for (books) |book| {
                book.deinit(self.allocator);
            }
            self.allocator.free(books);
        }

        var json_response: std.ArrayList(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("[");
        for (books, 0..) |book, i| {
            if (i > 0) try writer.writeAll(",");

            // Get author name
            const author = self.author_repo.getAuthorById(self.allocator, book.author) catch |err| {
                if (err == error.AuthorNotFound) {
                    std.log.warn("Author {d} not found for book {d}", .{ book.author, book.id });
                    continue;
                }
                return err;
            };
            defer author.deinit(self.allocator);

            try writer.writeAll("{");
            try writer.print("\"id\":{d},", .{book.id});
            try writer.print("\"name\":\"{s}\",", .{book.name});
            try writer.print("\"author_id\":{d},", .{book.author});
            try writer.print("\"author_name\":\"{s}\",", .{author.name});
            try writer.print("\"file_path\":\"{s}\",", .{book.file_path});
            
            if (book.isbn) |isbn| {
                try writer.print("\"isbn\":\"{s}\",", .{isbn});
            } else {
                try writer.writeAll("\"isbn\":null,");
            }

            if (book.description) |desc| {
                // Escape quotes in description
                try writer.writeAll("\"description\":\"");
                for (desc) |c| {
                    if (c == '"') {
                        try writer.writeAll("\\\"");
                    } else if (c == '\\') {
                        try writer.writeAll("\\\\");
                    } else if (c == '\n') {
                        try writer.writeAll("\\n");
                    } else {
                        try writer.writeByte(c);
                    }
                }
                try writer.writeAll("\",");
            } else {
                try writer.writeAll("\"description\":null,");
            }

            if (book.page_count) |pc| {
                try writer.print("\"page_count\":{d},", .{pc});
            } else {
                try writer.writeAll("\"page_count\":null,");
            }

            try writer.print("\"status\":\"{s}\",", .{book.status});
            try writer.print("\"created_at\":\"{s}\"", .{book.created_at});
            try writer.writeAll("}");
        }
        try writer.writeAll("]");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // GET /books/:id - Get book by ID
    pub fn getBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing book ID\"}";
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid book ID\"}";
            return;
        };

        const book = self.book_repo.getBookById(self.allocator, book_id) catch |err| {
            if (err == error.BookNotFound) {
                res.status = 404;
                res.body = "{\"error\":\"Book not found\"}";
                return;
            }
            return err;
        };
        defer book.deinit(self.allocator);

        const author = self.author_repo.getAuthorById(self.allocator, book.author) catch |err| {
            if (err == error.AuthorNotFound) {
                res.status = 404;
                res.body = "{\"error\":\"Author not found\"}";
                return;
            }
            return err;
        };
        defer author.deinit(self.allocator);

        var json_response: std.ArrayList(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("{");
        try writer.print("\"id\":{d},", .{book.id});
        try writer.print("\"name\":\"{s}\",", .{book.name});
        try writer.print("\"author_id\":{d},", .{book.author});
        try writer.print("\"author_name\":\"{s}\",", .{author.name});
        try writer.print("\"file_path\":\"{s}\",", .{book.file_path});
        
        if (book.isbn) |isbn| {
            try writer.print("\"isbn\":\"{s}\",", .{isbn});
        } else {
            try writer.writeAll("\"isbn\":null,");
        }

        if (book.description) |desc| {
            try writer.writeAll("\"description\":\"");
            for (desc) |c| {
                if (c == '"') {
                    try writer.writeAll("\\\"");
                } else if (c == '\\') {
                    try writer.writeAll("\\\\");
                } else if (c == '\n') {
                    try writer.writeAll("\\n");
                } else {
                    try writer.writeByte(c);
                }
            }
            try writer.writeAll("\",");
        } else {
            try writer.writeAll("\"description\":null,");
        }

        if (book.page_count) |pc| {
            try writer.print("\"page_count\":{d},", .{pc});
        } else {
            try writer.writeAll("\"page_count\":null,");
        }

        try writer.print("\"status\":\"{s}\",", .{book.status});
        try writer.print("\"created_at\":\"{s}\"", .{book.created_at});
        try writer.writeAll("}");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // POST /books - Create new book
    pub fn createBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const body = req.body() orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing request body\"}";
            return;
        };

        var parsed = std.json.parseFromSlice(
            struct {
                name: []const u8,
                author_name: []const u8,
                file_path: []const u8,
                description: ?[]const u8 = null,
            },
            self.allocator,
            body,
            .{ .ignore_unknown_fields = true },
        ) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid JSON\"}";
            return;
        };
        defer parsed.deinit();

        // Get or create author
        var author = self.author_repo.getAuthorByName(self.allocator, parsed.value.author_name) catch |err| blk: {
            if (err == error.AuthorNotFound) {
                // Create new author
                const author_id = try self.author_repo.createAuthor(parsed.value.author_name);
                break :blk try self.author_repo.getAuthorById(self.allocator, author_id);
            } else {
                return err;
            }
        };
        defer author.deinit(self.allocator);

        const book_id = try self.book_repo.createBook(parsed.value.name, author.id, parsed.value.file_path);

        // Update description if provided
        if (parsed.value.description) |desc| {
            try self.book_repo.updateBook(book_id, parsed.value.name, desc);
        }

        var json_response: std.ArrayList(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.print("{{\"message\":\"Book created successfully\",\"id\":{d}}}", .{book_id});

        res.status = 201;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // PUT /books/:id - Update book
    pub fn updateBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing book ID\"}";
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid book ID\"}";
            return;
        };

        const existing_book = self.book_repo.getBookById(self.allocator, book_id) catch |err| {
            if (err == error.BookNotFound) {
                res.status = 404;
                res.body = "{\"error\":\"Book not found\"}";
                return;
            }
            return err;
        };
        defer existing_book.deinit(self.allocator);

        const body = req.body() orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing request body\"}";
            return;
        };

        var parsed = std.json.parseFromSlice(
            struct {
                name: ?[]const u8 = null,
                description: ?[]const u8 = null,
            },
            self.allocator,
            body,
            .{ .ignore_unknown_fields = true },
        ) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid JSON\"}";
            return;
        };
        defer parsed.deinit();

        const new_name = parsed.value.name orelse existing_book.name;
        const new_description = parsed.value.description orelse existing_book.description;

        try self.book_repo.updateBook(book_id, new_name, new_description);

        res.status = 200;
        res.content_type = .JSON;
        res.body = "{\"message\":\"Book updated successfully\"}";
    }

    // DELETE /books/:id - Delete book
    pub fn deleteBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing book ID\"}";
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid book ID\"}";
            return;
        };

        _ = self.book_repo.getBookById(self.allocator, book_id) catch |err| {
            if (err == error.BookNotFound) {
                res.status = 404;
                res.body = "{\"error\":\"Book not found\"}";
                return;
            }
            return err;
        };

        try self.book_repo.deleteBook(book_id);

        res.status = 200;
        res.content_type = .JSON;
        res.body = "{\"message\":\"Book deleted successfully\"}";
    }

    pub fn deinit(self: *BookController) void {
        _ = self;
    }
};

pub const AuthorController = struct {
    allocator: std.mem.Allocator,
    author_repo: *AuthorRepository,

    pub fn init(allocator: std.mem.Allocator, author_repo: *AuthorRepository) AuthorController {
        return .{
            .allocator = allocator,
            .author_repo = author_repo,
        };
    }

    // GET /authors - List all authors
    pub fn listAuthors(self: *AuthorController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        const authors = try self.author_repo.listAuthors(self.allocator);
        defer {
            for (authors) |author| {
                author.deinit(self.allocator);
            }
            self.allocator.free(authors);
        }

        var json_response: std.ArrayList(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("[");
        for (authors, 0..) |author, i| {
            if (i > 0) try writer.writeAll(",");

            try writer.writeAll("{");
            try writer.print("\"id\":{d},", .{author.id});
            try writer.print("\"name\":\"{s}\"", .{author.name});
            
            if (author.biography) |bio| {
                try writer.writeAll(",\"biography\":\"");
                for (bio) |c| {
                    if (c == '"') {
                        try writer.writeAll("\\\"");
                    } else if (c == '\\') {
                        try writer.writeAll("\\\\");
                    } else if (c == '\n') {
                        try writer.writeAll("\\n");
                    } else {
                        try writer.writeByte(c);
                    }
                }
                try writer.writeAll("\"");
            }

            try writer.writeAll("}");
        }
        try writer.writeAll("]");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // GET /authors/:id - Get author by ID
    pub fn getAuthor(self: *AuthorController, req: *httpz.Request, res: *httpz.Response) !void {
        const author_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing author ID\"}";
            return;
        };

        const author_id = std.fmt.parseInt(i64, author_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid author ID\"}";
            return;
        };

        const author = self.author_repo.getAuthorById(self.allocator, author_id) catch |err| {
            if (err == error.AuthorNotFound) {
                res.status = 404;
                res.body = "{\"error\":\"Author not found\"}";
                return;
            }
            return err;
        };
        defer author.deinit(self.allocator);

        var json_response: std.ArrayList(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("{");
        try writer.print("\"id\":{d},", .{author.id});
        try writer.print("\"name\":\"{s}\"", .{author.name});
        
        if (author.biography) |bio| {
            try writer.writeAll(",\"biography\":\"");
            for (bio) |c| {
                if (c == '"') {
                    try writer.writeAll("\\\"");
                } else if (c == '\\') {
                    try writer.writeAll("\\\\");
                } else if (c == '\n') {
                    try writer.writeAll("\\n");
                } else {
                    try writer.writeByte(c);
                }
            }
            try writer.writeAll("\"");
        }

        try writer.writeAll("}");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    pub fn deinit(self: *AuthorController) void {
        _ = self;
    }
};

// Tag Controller
pub const TagController = struct {
    allocator: std.mem.Allocator,
    tag_repo: *TagRepository,
    book_repo: *BookRepository,

    pub fn init(
        allocator: std.mem.Allocator,
        tag_repo: *TagRepository,
        book_repo: *BookRepository,
    ) TagController {
        return .{
            .allocator = allocator,
            .tag_repo = tag_repo,
            .book_repo = book_repo,
        };
    }

    // GET /tags - List all tags
    pub fn listTags(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        const tags = try self.tag_repo.getAllTags(self.allocator);
        defer {
            for (tags) |tag| {
                tag.deinit(self.allocator);
            }
            self.allocator.free(tags);
        }

        var json_response: std.ArrayListUnmanaged(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("[");
        for (tags, 0..) |tag, i| {
            if (i > 0) try writer.writeAll(",");
            try self.writeTagJSON(&writer, tag);
        }
        try writer.writeAll("]");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // GET /tags/categories/:category - Get tags by category
    pub fn getTagsByCategory(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const category = req.param("category") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing category\"}";
            return;
        };

        const tags = try self.tag_repo.getTagsByCategory(self.allocator, category);
        defer {
            for (tags) |tag| {
                tag.deinit(self.allocator);
            }
            self.allocator.free(tags);
        }

        var json_response: std.ArrayListUnmanaged(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("[");
        for (tags, 0..) |tag, i| {
            if (i > 0) try writer.writeAll(",");
            try self.writeTagJSON(&writer, tag);
        }
        try writer.writeAll("]");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // POST /books/:id/tags - Add tag to book
    pub fn addTagToBook(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing book ID\"}";
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid book ID\"}";
            return;
        };

        // Parse request body for tag name
        const body = req.body() orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing request body\"}";
            return;
        };

        // Simple JSON parsing for {"tagName": "value"}
        const tag_name = self.parseTagName(body) orelse {
            res.status = 400;
            res.body = "{\"error\":\"Invalid request body or missing tagName\"}";
            return;
        };

        // Get tag by name
        const tag = try self.tag_repo.getTagByName(self.allocator, tag_name);
        defer if (tag) |t| t.deinit(self.allocator);

        if (tag == null) {
            res.status = 404;
            res.body = "{\"error\":\"Tag not found\"}";
            return;
        }

        // Add tag to book
        try self.tag_repo.addTagToBook(book_id, tag.?.id, null, false);

        res.status = 200;
        res.body = "{\"success\":true}";
    }

    // DELETE /books/:id/tags/:tagName - Remove tag from book
    pub fn removeTagFromBook(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing book ID\"}";
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            res.body = "{\"error\":\"Invalid book ID\"}";
            return;
        };

        const tag_name = req.param("tagName") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing tag name\"}";
            return;
        };

        // Get tag by name
        const tag = try self.tag_repo.getTagByName(self.allocator, tag_name);
        defer if (tag) |t| t.deinit(self.allocator);

        if (tag == null) {
            res.status = 404;
            res.body = "{\"error\":\"Tag not found\"}";
            return;
        }

        // Remove tag from book
        try self.tag_repo.removeTagFromBook(book_id, tag.?.id);

        res.status = 200;
        res.body = "{\"success\":true}";
    }

    // GET /books/by-tag/:tagName - Get books with specific tag
    pub fn getBooksByTag(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const tag_name = req.param("tagName") orelse {
            res.status = 400;
            res.body = "{\"error\":\"Missing tag name\"}";
            return;
        };

        // Get tag by name
        const tag = try self.tag_repo.getTagByName(self.allocator, tag_name);
        defer if (tag) |t| t.deinit(self.allocator);

        if (tag == null) {
            res.status = 404;
            res.body = "{\"error\":\"Tag not found\"}";
            return;
        }

        // Query books with this tag
        const query =
            \\SELECT b.id, b.name, b.author, b.file_path, b.isbn, b.description,
            \\       b.page_count, b.status, b.created_at
            \\FROM books b
            \\JOIN book_tags bt ON b.id = bt.book_id
            \\WHERE bt.tag_id = ?
        ;

        var stmt = try self.book_repo.db.prepare(query);
        defer stmt.deinit();

        const books = try stmt.all(Book, self.allocator, .{}, .{tag.?.id});
        defer {
            for (books) |book| {
                book.deinit(self.allocator);
            }
            self.allocator.free(books);
        }

        var json_response: std.ArrayListUnmanaged(u8) = .empty;
        defer json_response.deinit(self.allocator);
        const writer = json_response.writer(self.allocator);

        try writer.writeAll("[");
        for (books, 0..) |book, i| {
            if (i > 0) try writer.writeAll(",");
            try writer.writeAll("{");
            try writer.print("\"id\":{d},", .{book.id});
            try writer.print("\"name\":\"{s}\",", .{book.name});
            try writer.print("\"author_id\":{d},", .{book.author});
            try writer.print("\"file_path\":\"{s}\"", .{book.file_path});
            try writer.writeAll("}");
        }
        try writer.writeAll("]");

        res.status = 200;
        res.content_type = .JSON;
        res.body = try self.allocator.dupe(u8, json_response.items);
    }

    // Helper function to write tag as JSON
    fn writeTagJSON(self: *TagController, writer: anytype, tag: Tag) !void {
        _ = self;
        try writer.writeAll("{");
        try writer.print("\"id\":{d},", .{tag.id});
        try writer.print("\"name\":\"{s}\",", .{tag.name});
        try writer.print("\"category\":\"{s}\",", .{tag.category});
        
        if (tag.description) |desc| {
            try writer.writeAll("\"description\":\"");
            for (desc) |c| {
                if (c == '"') try writer.writeAll("\\\"")
                else if (c == '\\') try writer.writeAll("\\\\")
                else if (c == '\n') try writer.writeAll("\\n")
                else try writer.writeByte(c);
            }
            try writer.writeAll("\",");
        } else {
            try writer.writeAll("\"description\":null,");
        }

        if (tag.color) |color| {
            try writer.print("\"color\":\"{s}\",", .{color});
        } else {
            try writer.writeAll("\"color\":null,");
        }

        if (tag.requires_permission) |perm| {
            try writer.print("\"requires_permission\":\"{s}\",", .{perm});
        } else {
            try writer.writeAll("\"requires_permission\":null,");
        }

        try writer.print("\"created_at\":\"{s}\"", .{tag.created_at});
        try writer.writeAll("}");
    }

    // Simple JSON parser to extract tagName from request body
    fn parseTagName(self: *TagController, body: []const u8) ?[]const u8 {
        _ = self;
        // Look for "tagName": "value"
        const needle = "\"tagName\"";
        const start_idx = std.mem.indexOf(u8, body, needle) orelse return null;
        const after_key = body[start_idx + needle.len..];
        
        // Find the colon
        const colon_idx = std.mem.indexOf(u8, after_key, ":") orelse return null;
        const after_colon = after_key[colon_idx + 1..];
        
        // Find the opening quote
        const quote1_idx = std.mem.indexOf(u8, after_colon, "\"") orelse return null;
        const after_quote1 = after_colon[quote1_idx + 1..];
        
        // Find the closing quote
        const quote2_idx = std.mem.indexOf(u8, after_quote1, "\"") orelse return null;
        
        return after_quote1[0..quote2_idx];
    }

    pub fn deinit(self: *TagController) void {
        _ = self;
    }
};
