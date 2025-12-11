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

        const allocator = res.arena;
        const books = try self.book_repo.listBooks(allocator);

        const BookItem = struct {
            id: i64,
            name: []const u8,
            author_id: i64,
            author_name: []const u8,
            file_path: []const u8,
            isbn: ?[]const u8 = null,
            description: ?[]const u8 = null,
            page_count: ?i64 = null,
            status: []const u8,
            created_at: []const u8,
        };

        var book_list = try std.ArrayList(BookItem).initCapacity(allocator, books.len);
        for (books) |book| {
            const author = self.author_repo.getAuthorById(allocator, book.author) catch |err| {
                if (err == error.AuthorNotFound) {
                    std.log.warn("Author {d} not found for book {d}", .{ book.author, book.id });
                    continue;
                }
                return err;
            };

            book_list.appendAssumeCapacity(.{
                .id = book.id,
                .name = book.name,
                .author_id = book.author,
                .author_name = author.name,
                .file_path = book.file_path,
                .isbn = book.isbn,
                .description = book.description,
                .page_count = book.page_count,
                .status = book.status,
                .created_at = book.created_at,
            });
        }

        res.status = 200;
        try res.json(book_list.items, .{});
    }

    // GET /books/:id - Get book by ID
    pub fn getBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing book ID" }, .{});
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };

        const allocator = res.arena;

        const book = self.book_repo.getBookById(allocator, book_id) catch |err| {
            if (err == error.BookNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "Book not found" }, .{});
                return;
            }
            return err;
        };

        const author = self.author_repo.getAuthorById(allocator, book.author) catch |err| {
            if (err == error.AuthorNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "Author not found" }, .{});
                return;
            }
            return err;
        };

        const response = .{
            .id = book.id,
            .name = book.name,
            .author_id = book.author,
            .author_name = author.name,
            .file_path = book.file_path,
            .isbn = book.isbn,
            .description = book.description,
            .page_count = book.page_count,
            .status = book.status,
            .created_at = book.created_at,
        };

        res.status = 200;
        try res.json(response, .{});
    }

    // POST /books - Create new book
    pub fn createBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const body = req.body() orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing request body" }, .{});
            return;
        };

        const allocator = res.arena;

        var parsed = std.json.parseFromSlice(
            struct {
                name: []const u8,
                author_name: []const u8,
                file_path: []const u8,
                description: ?[]const u8 = null,
            },
            allocator,
            body,
            .{ .ignore_unknown_fields = true },
        ) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid JSON" }, .{});
            return;
        };
        defer parsed.deinit();

        var author = self.author_repo.getAuthorByName(allocator, parsed.value.author_name) catch |err| blk: {
            if (err == error.AuthorNotFound) {
                const author_id = try self.author_repo.createAuthor(parsed.value.author_name);
                break :blk try self.author_repo.getAuthorById(allocator, author_id);
            } else {
                return err;
            }
        };

        const book_id = try self.book_repo.createBook(parsed.value.name, author.id, parsed.value.file_path);

        if (parsed.value.description) |desc| {
            try self.book_repo.updateBook(book_id, parsed.value.name, desc);
        }

        res.status = 201;
        try res.json(.{
            .message = "Book created successfully",
            .id = book_id,
        }, .{});
    }

    // PUT /books/:id - Update book
    pub fn updateBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing book ID" }, .{});
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };

        const allocator = res.arena;

        const existing_book = self.book_repo.getBookById(allocator, book_id) catch |err| {
            if (err == error.BookNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "Book not found" }, .{});
                return;
            }
            return err;
        };

        const body = req.body() orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing request body" }, .{});
            return;
        };

        var parsed = std.json.parseFromSlice(
            struct {
                name: ?[]const u8 = null,
                description: ?[]const u8 = null,
            },
            allocator,
            body,
            .{ .ignore_unknown_fields = true },
        ) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid JSON" }, .{});
            return;
        };
        defer parsed.deinit();

        const new_name = parsed.value.name orelse existing_book.name;
        const new_description = parsed.value.description orelse existing_book.description;

        try self.book_repo.updateBook(book_id, new_name, new_description);

        res.status = 200;
        try res.json(.{ .message = "Book updated successfully" }, .{});
    }

    // DELETE /books/:id - Delete book
    pub fn deleteBook(self: *BookController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing book ID" }, .{});
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };

        const allocator = res.arena;

        _ = self.book_repo.getBookById(allocator, book_id) catch |err| {
            if (err == error.BookNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "Book not found" }, .{});
                return;
            }
            return err;
        };

        try self.book_repo.deleteBook(book_id);

        res.status = 200;
        try res.json(.{ .message = "Book deleted successfully" }, .{});
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

        const allocator = res.arena;
        const authors = try self.author_repo.listAuthors(allocator);

        const AuthorItem = struct {
            id: i64,
            name: []const u8,
            biography: ?[]const u8 = null,
        };

        var author_list = try std.ArrayList(AuthorItem).initCapacity(allocator, authors.len);
        for (authors) |author| {
            author_list.appendAssumeCapacity(.{
                .id = author.id,
                .name = author.name,
                .biography = author.biography,
            });
        }

        res.status = 200;
        try res.json(author_list.items, .{});
    }

    // GET /authors/:id - Get author by ID
    pub fn getAuthor(self: *AuthorController, req: *httpz.Request, res: *httpz.Response) !void {
        const author_id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing author ID" }, .{});
            return;
        };

        const author_id = std.fmt.parseInt(i64, author_id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid author ID" }, .{});
            return;
        };

        const allocator = res.arena;

        const author = self.author_repo.getAuthorById(allocator, author_id) catch |err| {
            if (err == error.AuthorNotFound) {
                res.status = 404;
                try res.json(.{ .@"error" = "Author not found" }, .{});
                return;
            }
            return err;
        };

        const response = .{
            .id = author.id,
            .name = author.name,
            .biography = author.biography,
        };

        res.status = 200;
        try res.json(response, .{});
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

        const allocator = res.arena;
        const tags = try self.tag_repo.getAllTags(allocator);

        const TagItem = struct {
            id: i64,
            name: []const u8,
            category: []const u8,
            description: ?[]const u8 = null,
            color: ?[]const u8 = null,
            requires_permission: ?[]const u8 = null,
            created_at: []const u8,
        };

        var tag_list = try std.ArrayList(TagItem).initCapacity(allocator, tags.len);
        for (tags) |tag| {
            tag_list.appendAssumeCapacity(.{
                .id = tag.id,
                .name = tag.name,
                .category = tag.category,
                .description = tag.description,
                .color = tag.color,
                .requires_permission = tag.requires_permission,
                .created_at = tag.created_at,
            });
        }

        res.status = 200;
        try res.json(tag_list.items, .{});
    }

    // GET /tags/categories/:category - Get tags by category
    pub fn getTagsByCategory(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const category = req.param("category") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing category" }, .{});
            return;
        };

        const allocator = res.arena;
        const tags = try self.tag_repo.getTagsByCategory(allocator, category);

        const TagItem = struct {
            id: i64,
            name: []const u8,
            category: []const u8,
            description: ?[]const u8 = null,
            color: ?[]const u8 = null,
            requires_permission: ?[]const u8 = null,
            created_at: []const u8,
        };

        var tag_list = try std.ArrayList(TagItem).initCapacity(allocator, tags.len);
        for (tags) |tag| {
            tag_list.appendAssumeCapacity(.{
                .id = tag.id,
                .name = tag.name,
                .category = tag.category,
                .description = tag.description,
                .color = tag.color,
                .requires_permission = tag.requires_permission,
                .created_at = tag.created_at,
            });
        }

        res.status = 200;
        try res.json(tag_list.items, .{});
    }

    // POST /books/:id/tags - Add tag to book
    pub fn addTagToBook(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing book ID" }, .{});
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
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
        const tag_name = self.parseTagName(body) orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid request body or missing tagName" }, .{});
            return;
        };

        const tag = try self.tag_repo.getTagByName(allocator, tag_name);

        if (tag == null) {
            res.status = 404;
            try res.json(.{ .@"error" = "Tag not found" }, .{});
            return;
        }

        try self.tag_repo.addTagToBook(book_id, tag.?.id, null, false);

        res.status = 200;
        try res.json(.{ .success = true }, .{});
    }

    // DELETE /books/:id/tags/:tagName - Remove tag from book
    pub fn removeTagFromBook(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const book_id_str = req.param("id") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing book ID" }, .{});
            return;
        };

        const book_id = std.fmt.parseInt(i64, book_id_str, 10) catch {
            res.status = 400;
            try res.json(.{ .@"error" = "Invalid book ID" }, .{});
            return;
        };

        const tag_name = req.param("tagName") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing tag name" }, .{});
            return;
        };

        const allocator = res.arena;
        const tag = try self.tag_repo.getTagByName(allocator, tag_name);

        if (tag == null) {
            res.status = 404;
            try res.json(.{ .@"error" = "Tag not found" }, .{});
            return;
        }

        try self.tag_repo.removeTagFromBook(book_id, tag.?.id);

        res.status = 200;
        try res.json(.{ .success = true }, .{});
    }

    // GET /books/by-tag/:tagName - Get books with specific tag
    pub fn getBooksByTag(self: *TagController, req: *httpz.Request, res: *httpz.Response) !void {
        const tag_name = req.param("tagName") orelse {
            res.status = 400;
            try res.json(.{ .@"error" = "Missing tag name" }, .{});
            return;
        };

        const allocator = res.arena;
        const tag = try self.tag_repo.getTagByName(allocator, tag_name);

        if (tag == null) {
            res.status = 404;
            try res.json(.{ .@"error" = "Tag not found" }, .{});
            return;
        }

        const query =
            \\SELECT b.id, b.name, b.author, b.file_path, b.isbn, b.description,
            \\       b.page_count, b.status, b.created_at
            \\FROM books b
            \\JOIN book_tags bt ON b.id = bt.book_id
            \\WHERE bt.tag_id = ?
        ;

        var stmt = try self.book_repo.db.prepare(query);
        defer stmt.deinit();

        const books = try stmt.all(Book, allocator, .{}, .{tag.?.id});

        const BookItem = struct {
            id: i64,
            name: []const u8,
            author_id: i64,
            file_path: []const u8,
        };

        var book_list = try std.ArrayList(BookItem).initCapacity(allocator, books.len);
        for (books) |book| {
            book_list.appendAssumeCapacity(.{
                .id = book.id,
                .name = book.name,
                .author_id = book.author,
                .file_path = book.file_path,
            });
        }

        res.status = 200;
        try res.json(book_list.items, .{});
    }

    // Simple JSON parser to extract tagName from request body
    fn parseTagName(self: *TagController, body: []const u8) ?[]const u8 {
        _ = self;
        const needle = "\"tagName\"";
        const start_idx = std.mem.indexOf(u8, body, needle) orelse return null;
        const after_key = body[start_idx + needle.len..];
        
        const colon_idx = std.mem.indexOf(u8, after_key, ":") orelse return null;
        const after_colon = after_key[colon_idx + 1..];
        
        const quote1_idx = std.mem.indexOf(u8, after_colon, "\"") orelse return null;
        const after_quote1 = after_colon[quote1_idx + 1..];
        
        const quote2_idx = std.mem.indexOf(u8, after_quote1, "\"") orelse return null;
        
        return after_quote1[0..quote2_idx];
    }

    pub fn deinit(self: *TagController) void {
        _ = self;
    }
};
