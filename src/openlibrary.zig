const std = @import("std");
const httpz = @import("httpz");
const testing = std.testing;

pub const ExternalBookMetadata = struct {
    isbn: ?[]const u8 = null,
    title: ?[]const u8 = null,
    subtitle: ?[]const u8 = null,
    authors: ?[][]const u8 = null,
    publisher: ?[]const u8 = null,
    published_date: ?[]const u8 = null,
    description: ?[]const u8 = null,
    page_count: ?u32 = null,
    categories: ?[][]const u8 = null,
    language: ?[]const u8 = null,
    cover_image_url: ?[]const u8 = null,
    small_cover_image_url: ?[]const u8 = null,

    pub fn deinit(self: *ExternalBookMetadata, allocator: std.mem.Allocator) void {
        if (self.isbn) |i| allocator.free(i);
        if (self.title) |t| allocator.free(t);
        if (self.subtitle) |s| allocator.free(s);
        if (self.authors) |authors| {
            for (authors) |author| allocator.free(author);
            allocator.free(authors);
        }
        if (self.publisher) |p| allocator.free(p);
        if (self.published_date) |pd| allocator.free(pd);
        if (self.description) |d| allocator.free(d);
        if (self.categories) |cats| {
            for (cats) |cat| allocator.free(cat);
            allocator.free(cats);
        }
        if (self.language) |l| allocator.free(l);
        if (self.cover_image_url) |c| allocator.free(c);
        if (self.small_cover_image_url) |s| allocator.free(s);
    }
};

pub const OpenLibraryClient = struct {
    allocator: std.mem.Allocator,
    base_url: []const u8 = "https://openlibrary.org",

    pub fn init(allocator: std.mem.Allocator) OpenLibraryClient {
        return .{ .allocator = allocator };
    }

    /// Lookup book by ISBN from OpenLibrary
    pub fn lookupByISBN(self: *OpenLibraryClient, isbn: []const u8) !?ExternalBookMetadata {
        // Clean ISBN (remove non-alphanumeric characters)
        var clean_isbn = try self.allocator.alloc(u8, isbn.len);
        defer self.allocator.free(clean_isbn);

        var clean_len: usize = 0;
        for (isbn) |c| {
            if (std.ascii.isAlphanumeric(c)) {
                clean_isbn[clean_len] = c;
                clean_len += 1;
            }
        }
        const clean = clean_isbn[0..clean_len];

        if (clean.len < 10) {
            std.log.warn("Invalid ISBN: {s}", .{isbn});
            return null;
        }

        // Build URL
        const url = try std.fmt.allocPrint(
            self.allocator,
            "{s}/api/books?bibkeys=ISBN:{s}&format=json&jscmd=data",
            .{ self.base_url, clean },
        );
        defer self.allocator.free(url);

        std.log.info("📚 Looking up ISBN {s} via OpenLibrary...", .{clean});

        // Make HTTP request
        var client = std.http.Client{ .allocator = self.allocator };
        defer client.deinit();

        const uri = try std.Uri.parse(url);

        var req = try client.request(.GET, uri, .{});
        defer req.deinit();

        try req.sendBodiless();
        var response = try req.receiveHead(&.{});

        if (response.head.status != .ok) {
            std.log.warn("OpenLibrary API error: {}", .{response.head.status});
            return null;
        }

        // Read response body
        var reader_buffer: [4096]u8 = undefined;
        const body_reader = response.reader(&reader_buffer);

        const max_size = 1024 * 1024; // 1MB max
        const body = try body_reader.allocRemaining(self.allocator, std.Io.Limit.limited(max_size));
        defer self.allocator.free(body);

        // Parse JSON response
        const parsed = try std.json.parseFromSlice(
            std.json.Value,
            self.allocator,
            body,
            .{},
        );
        defer parsed.deinit();

        // Build the key: "ISBN:xxxxx"
        const book_key = try std.fmt.allocPrint(self.allocator, "ISBN:{s}", .{clean});
        defer self.allocator.free(book_key);

        // Check if book exists in response
        if (parsed.value != .object) return null;
        const book_obj = parsed.value.object.get(book_key) orelse {
            std.log.info("📚 No results found for ISBN {s}", .{clean});
            return null;
        };

        if (book_obj != .object) return null;

        return try self.parseLookupBook(clean, &book_obj.object);
    }

    fn parseLookupBook(self: *OpenLibraryClient, clean_isbn: []const u8, book_obj: *const std.json.ObjectMap) !ExternalBookMetadata {
        var metadata = ExternalBookMetadata{};
        metadata.isbn = try self.allocator.dupe(u8, clean_isbn);

        if (book_obj.get("title")) |title_val| {
            if (title_val == .string) {
                metadata.title = try self.allocator.dupe(u8, title_val.string);
            }
        }

        if (book_obj.get("subtitle")) |subtitle_val| {
            if (subtitle_val == .string) {
                metadata.subtitle = try self.allocator.dupe(u8, subtitle_val.string);
            }
        }

        if (book_obj.get("authors")) |authors_val| {
            if (authors_val == .array) {
                var authors = try std.ArrayList([]const u8).initCapacity(self.allocator, authors_val.array.items.len);
                for (authors_val.array.items) |author_obj| {
                    if (author_obj == .object) {
                        if (author_obj.object.get("name")) |name_val| {
                            if (name_val == .string) {
                                const name = try self.allocator.dupe(u8, name_val.string);
                                try authors.append(self.allocator, name);
                            }
                        }
                    }
                }
                if (authors.items.len > 0) {
                    metadata.authors = try authors.toOwnedSlice(self.allocator);
                } else {
                    authors.deinit(self.allocator);
                }
            }
        }

        if (book_obj.get("publishers")) |pubs_val| {
            if (pubs_val == .array and pubs_val.array.items.len > 0) {
                const first_pub = pubs_val.array.items[0];
                if (first_pub == .object) {
                    if (first_pub.object.get("name")) |name_val| {
                        if (name_val == .string) {
                            metadata.publisher = try self.allocator.dupe(u8, name_val.string);
                        }
                    }
                }
            }
        }

        if (book_obj.get("publish_date")) |date_val| {
            if (date_val == .string) {
                metadata.published_date = try self.allocator.dupe(u8, date_val.string);
            }
        }

        if (book_obj.get("description")) |desc_val| {
            if (desc_val == .string) {
                metadata.description = try self.allocator.dupe(u8, desc_val.string);
            } else if (desc_val == .object) {
                if (desc_val.object.get("value")) |value_val| {
                    if (value_val == .string) {
                        metadata.description = try self.allocator.dupe(u8, value_val.string);
                    }
                }
            }
        }

        if (book_obj.get("number_of_pages")) |pages_val| {
            if (pages_val == .integer) {
                metadata.page_count = @intCast(pages_val.integer);
            }
        }

        if (book_obj.get("subjects")) |subjects_val| {
            if (subjects_val == .array) {
                var categories = try std.ArrayList([]const u8).initCapacity(self.allocator, subjects_val.array.items.len);
                for (subjects_val.array.items) |subj_obj| {
                    if (subj_obj == .object) {
                        if (subj_obj.object.get("name")) |name_val| {
                            if (name_val == .string) {
                                const name = try self.allocator.dupe(u8, name_val.string);
                                try categories.append(self.allocator, name);
                            }
                        }
                    }
                }
                if (categories.items.len > 0) {
                    metadata.categories = try categories.toOwnedSlice(self.allocator);
                } else {
                    categories.deinit(self.allocator);
                }
            }
        }

        if (book_obj.get("cover")) |cover_val| {
            if (cover_val == .object) {
                if (cover_val.object.get("large")) |large_val| {
                    if (large_val == .string) {
                        metadata.cover_image_url = try self.allocator.dupe(u8, large_val.string);
                    }
                } else if (cover_val.object.get("medium")) |medium_val| {
                    if (medium_val == .string) {
                        metadata.cover_image_url = try self.allocator.dupe(u8, medium_val.string);
                    }
                }

                if (cover_val.object.get("small")) |small_val| {
                    if (small_val == .string) {
                        metadata.small_cover_image_url = try self.allocator.dupe(u8, small_val.string);
                    }
                }
            }
        }

        if (metadata.title) |title| {
            if (metadata.authors) |authors| {
                if (authors.len > 0) {
                    std.log.info("📚 ✓ Found: \"{s}\" by {s}", .{ title, authors[0] });
                }
            }
        }

        return metadata;
    }

    /// Search for books by title and optional author
    pub fn searchByTitle(self: *OpenLibraryClient, title: []const u8, author: ?[]const u8) ![]ExternalBookMetadata {
        // Build query
        var query: std.ArrayList(u8) = .empty;
        defer query.deinit(self.allocator);

        try query.writer().print("title:\"{s}\"", .{title});

        if (author) |a| {
            try query.writer().print(" author:\"{s}\"", .{a});
        }

        // URL encode the query
        const encoded_query = try std.Uri.Component.percentEncode(self.allocator, query.items);
        defer self.allocator.free(encoded_query);

        const url = try std.fmt.allocPrint(
            self.allocator,
            "{s}/search.json?q={s}&limit=5",
            .{ self.base_url, encoded_query },
        );
        defer self.allocator.free(url);

        std.log.info("📚 Searching \"{s}\" by {s} via OpenLibrary...", .{ title, author orelse "unknown author" });

        // Make HTTP request
        var client = std.http.Client{ .allocator = self.allocator };
        defer client.deinit();

        const uri = try std.Uri.parse(url);

        var req = try client.request(.GET, uri, .{});
        defer req.deinit();

        try req.sendBodiless();
        var response = try req.receiveHead(&.{});

        if (response.head.status != .ok) {
            std.log.warn("OpenLibrary API error: {}", .{response.head.status});
            return &[_]ExternalBookMetadata{};
        }

        // Read response body
        var reader_buffer: [4096]u8 = undefined;
        const body_reader = response.reader(&reader_buffer);

        const max_size = 1024 * 1024; // 1MB max
        const body = try body_reader.allocRemaining(self.allocator, std.Io.Limit.limited(max_size));
        defer self.allocator.free(body);

        // Parse JSON response
        const parsed = try std.json.parseFromSlice(
            std.json.Value,
            self.allocator,
            body,
            .{},
        );
        defer parsed.deinit();

        if (parsed.value != .object) return &[_]ExternalBookMetadata{};

        const docs = parsed.value.object.get("docs") orelse return &[_]ExternalBookMetadata{};
        if (docs != .array or docs.array.items.len == 0) {
            std.log.info("📚 No results found for title \"{s}\"", .{title});
            return &[_]ExternalBookMetadata{};
        }

        // Parse up to 3 results
        var results: std.ArrayList(ExternalBookMetadata) = .empty;
        const max_results = @min(3, docs.array.items.len);

        for (docs.array.items[0..max_results]) |book_obj| {
            if (book_obj != .object) continue;

            var metadata = ExternalBookMetadata{};

            // Title
            if (book_obj.object.get("title")) |title_val| {
                if (title_val == .string) {
                    metadata.title = try self.allocator.dupe(u8, title_val.string);
                }
            }

            // Authors
            if (book_obj.object.get("author_name")) |authors_val| {
                if (authors_val == .array) {
                    var authors: std.ArrayList([]const u8) = .initCapacity(self.allocator, authors_val.array.items.len);
                    for (authors_val.array.items) |author_val| {
                        if (author_val == .string) {
                            const name = try self.allocator.dupe(u8, author_val.string);
                            try authors.append(self.allocator, name);
                        }
                    }
                    if (authors.items.len > 0) {
                        metadata.authors = try authors.toOwnedSlice(self.allocator);
                    } else {
                        authors.deinit(self.allocator);
                    }
                }
            }

            // Publisher
            if (book_obj.object.get("publisher")) |pubs_val| {
                if (pubs_val == .array and pubs_val.array.items.len > 0) {
                    const first_pub = pubs_val.array.items[0];
                    if (first_pub == .string) {
                        metadata.publisher = try self.allocator.dupe(u8, first_pub.string);
                    }
                }
            }

            // Published date
            if (book_obj.object.get("first_publish_year")) |year_val| {
                if (year_val == .integer) {
                    const year_str = try std.fmt.allocPrint(self.allocator, "{d}", .{year_val.integer});
                    metadata.published_date = year_str;
                }
            }

            // Page count
            if (book_obj.object.get("number_of_pages_median")) |pages_val| {
                if (pages_val == .integer) {
                    metadata.page_count = @intCast(pages_val.integer);
                }
            }

            // ISBN
            if (book_obj.object.get("isbn")) |isbn_val| {
                if (isbn_val == .array and isbn_val.array.items.len > 0) {
                    const first_isbn = isbn_val.array.items[0];
                    if (first_isbn == .string) {
                        metadata.isbn = try self.allocator.dupe(u8, first_isbn.string);
                    }
                }
            }

            // Language
            if (book_obj.object.get("language")) |lang_val| {
                if (lang_val == .array and lang_val.array.items.len > 0) {
                    const first_lang = lang_val.array.items[0];
                    if (first_lang == .string) {
                        metadata.language = try self.allocator.dupe(u8, first_lang.string);
                    }
                }
            }

            // Cover image
            if (book_obj.object.get("cover_i")) |cover_id_val| {
                if (cover_id_val == .integer) {
                    const large_url = try std.fmt.allocPrint(
                        self.allocator,
                        "https://covers.openlibrary.org/b/id/{d}-L.jpg",
                        .{cover_id_val.integer},
                    );
                    metadata.cover_image_url = large_url;

                    const small_url = try std.fmt.allocPrint(
                        self.allocator,
                        "https://covers.openlibrary.org/b/id/{d}-S.jpg",
                        .{cover_id_val.integer},
                    );
                    metadata.small_cover_image_url = small_url;
                }
            }

            try results.append(self.allocator, metadata);
        }

        const result_count = results.items.len;
        std.log.info("📚 ✓ Found {d} results for \"{s}\"", .{ result_count, title });
        return try results.toOwnedSlice(self.allocator);
    }
};

const sample_lookup_response_with_large_cover =
    \\{
    \\  "ISBN:9781098100963": {
    \\    "title": "Securing AI Systems",
    \\    "subtitle": "Defensive Playbook",
    \\    "authors": [
    \\      {"name": "Ada Lovelace"},
    \\      {"name": "Grace Hopper"}
    \\    ],
    \\    "publishers": [
    \\      {"name": "Dust Books"}
    \\    ],
    \\    "publish_date": "2024",
    \\    "description": "A field guide for defensive LLM engineering.",
    \\    "number_of_pages": 256,
    \\    "subjects": [
    \\      {"name": "Security"},
    \\      {"name": "Artificial intelligence"}
    \\    ],
    \\    "cover": {
    \\      "large": "https://covers.openlibrary.org/b/id/12345-L.jpg",
    \\      "small": "https://covers.openlibrary.org/b/id/12345-S.jpg"
    \\    }
    \\  }
    \\}
;

const sample_lookup_response_with_medium_cover =
    \\{
    \\  "ISBN:9781492094936": {
    \\    "title": "LLM Security Essentials",
    \\    "authors": [
    \\      {"name": "Steve Wilson"}
    \\    ],
    \\    "publishers": [
    \\      {"name": "O'Reilly Media"}
    \\    ],
    \\    "publish_date": "2023",
    \\    "description": {"value": "Deep dive into securing large language models."},
    \\    "number_of_pages": 312,
    \\    "subjects": [
    \\      {"name": "Computers"}
    \\    ],
    \\    "cover": {
    \\      "medium": "https://covers.openlibrary.org/b/id/67890-M.jpg",
    \\      "small": "https://covers.openlibrary.org/b/id/67890-S.jpg"
    \\    }
    \\  }
    \\}
;

test "OpenLibraryClient parses lookup metadata" {
    var client = OpenLibraryClient.init(testing.allocator);
    const parsed = try std.json.parseFromSlice(std.json.Value, testing.allocator, sample_lookup_response_with_large_cover, .{});
    defer parsed.deinit();

    const key = "ISBN:9781098100963";
    const book_val = parsed.value.object.get(key) orelse unreachable;
    try testing.expect(book_val == .object);

    var metadata = try client.parseLookupBook("9781098100963", &book_val.object);
    defer metadata.deinit(testing.allocator);

    try testing.expect(metadata.title != null);
    try testing.expectEqualStrings("Securing AI Systems", metadata.title.?);
    try testing.expectEqual(@as(?u32, 256), metadata.page_count);
    try testing.expect(metadata.authors != null and metadata.authors.?.len == 2);
    try testing.expectEqualStrings("https://covers.openlibrary.org/b/id/12345-L.jpg", metadata.cover_image_url.?);
    try testing.expectEqualStrings("https://covers.openlibrary.org/b/id/12345-S.jpg", metadata.small_cover_image_url.?);
}

test "OpenLibraryClient handles description objects and cover fallbacks" {
    var client = OpenLibraryClient.init(testing.allocator);
    const parsed = try std.json.parseFromSlice(std.json.Value, testing.allocator, sample_lookup_response_with_medium_cover, .{});
    defer parsed.deinit();

    const key = "ISBN:9781492094936";
    const book_val = parsed.value.object.get(key) orelse unreachable;
    try testing.expect(book_val == .object);

    var metadata = try client.parseLookupBook("9781492094936", &book_val.object);
    defer metadata.deinit(testing.allocator);

    try testing.expectEqualStrings("LLM Security Essentials", metadata.title.?);
    try testing.expectEqual(@as(?u32, 312), metadata.page_count);
    try testing.expect(metadata.description != null);
    try testing.expectEqualStrings("Deep dive into securing large language models.", metadata.description.?);
    try testing.expectEqualStrings("https://covers.openlibrary.org/b/id/67890-M.jpg", metadata.cover_image_url.?);
    try testing.expectEqualStrings("https://covers.openlibrary.org/b/id/67890-S.jpg", metadata.small_cover_image_url.?);
}
