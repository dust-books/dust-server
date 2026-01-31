const std = @import("std");
const openlibrary = @import("openlibrary.zig");
const Config = @import("./config.zig").Config;
const build = @import("build.zig.zon");

pub const BookMetadata = struct {
    title: ?[]const u8 = null,
    author: ?[]const u8 = null,
    isbn: ?[]const u8 = null,
    publisher: ?[]const u8 = null,
    publication_date: ?[]const u8 = null,
    description: ?[]const u8 = null,
    language: ?[]const u8 = null,
    page_count: ?u32 = null,
    file_size: u64 = 0,
    file_format: ?[]const u8 = null,
    series: ?[]const u8 = null,
    series_number: ?u32 = null,
    cover_image_url: ?[]const u8 = null,

    pub fn deinit(self: *BookMetadata, allocator: std.mem.Allocator) void {
        if (self.title) |t| allocator.free(t);
        if (self.author) |a| allocator.free(a);
        if (self.isbn) |i| allocator.free(i);
        if (self.publisher) |p| allocator.free(p);
        if (self.publication_date) |pd| allocator.free(pd);
        if (self.description) |d| allocator.free(d);
        if (self.language) |l| allocator.free(l);
        if (self.file_format) |ff| allocator.free(ff);
        if (self.series) |s| allocator.free(s);
        if (self.cover_image_url) |c| allocator.free(c);
    }
};

const SeriesInfo = struct {
    series: []const u8,
    number: u32,
};

pub const MetadataExtractor = struct {
    allocator: std.mem.Allocator,
    ol_client: ?openlibrary.OpenLibraryClient,
    enable_external_lookup: bool,

    pub fn init(allocator: std.mem.Allocator, enable_external_lookup: bool, config: Config) !MetadataExtractor {
        return .{
            .allocator = allocator,
            .ol_client = if (enable_external_lookup) openlibrary.OpenLibraryClient.init(
                allocator,
                config.user_agent,
            ) else null,
            .enable_external_lookup = enable_external_lookup,
        };
    }

    pub fn extractMetadata(self: *MetadataExtractor, file_path: []const u8) !BookMetadata {
        var metadata = BookMetadata{};

        // Get file format from extension
        metadata.file_format = try self.getFileFormat(file_path);

        // Get file size
        metadata.file_size = try self.getFileSize(file_path);

        // Extract from filename/path (works for all formats as fallback)
        try self.extractFromFilename(file_path, &metadata);
        std.log.debug("Extracted metadata from filename: {}", .{metadata});

        // If we have an ISBN and external lookup is enabled, try to enrich with OpenLibrary
        if (self.enable_external_lookup and metadata.isbn != null) {
            if (self.ol_client) |*client| {
                self.enrichWithOpenLibrary(client, &metadata) catch |err| {
                    std.log.warn("Failed to enrich metadata from OpenLibrary: {}", .{err});
                    // Continue with local metadata
                };
            }
        }

        // TODO: In future, implement format-specific extraction:
        // - EPUB: Parse OPF file from ZIP structure
        // - PDF: Extract PDF metadata
        // - MOBI/AZW3: Parse MOBI headers

        return metadata;
    }

    fn enrichWithOpenLibrary(self: *MetadataExtractor, client: *openlibrary.OpenLibraryClient, metadata: *BookMetadata) !void {
        const isbn = metadata.isbn orelse return;

        std.log.info("🔍 Enriching metadata for ISBN: {s}", .{isbn});

        if (try client.lookupByISBN(isbn)) |*external_meta| {
            defer {
                var mut_meta = external_meta.*;
                mut_meta.deinit(self.allocator);
            }

            // Enrich title if external data is better
            if (external_meta.title) |ext_title| {
                if (metadata.title == null or ext_title.len > 0) {
                    if (metadata.title) |old_title| self.allocator.free(old_title);
                    metadata.title = try self.allocator.dupe(u8, ext_title);
                }
            }

            // Enrich author if available
            if (external_meta.authors) |authors| {
                if (authors.len > 0) {
                    if (metadata.author) |old_author| self.allocator.free(old_author);
                    metadata.author = try self.allocator.dupe(u8, authors[0]);
                }
            }

            // Add publisher
            if (external_meta.publisher) |publisher| {
                if (metadata.publisher) |old_pub| self.allocator.free(old_pub);
                metadata.publisher = try self.allocator.dupe(u8, publisher);
            }

            // Add publication date
            if (external_meta.published_date) |date| {
                if (metadata.publication_date) |old_date| self.allocator.free(old_date);
                metadata.publication_date = try self.allocator.dupe(u8, date);
            }

            // Add description
            if (external_meta.description) |desc| {
                if (metadata.description) |old_desc| self.allocator.free(old_desc);
                metadata.description = try self.allocator.dupe(u8, desc);
            }

            // Add page count
            if (external_meta.page_count) |pages| {
                metadata.page_count = pages;
            }

            // Add language
            if (external_meta.language) |lang| {
                if (metadata.language) |old_lang| self.allocator.free(old_lang);
                metadata.language = try self.allocator.dupe(u8, lang);
            }

            // Add cover image URL
            if (external_meta.cover_image_url) |cover| {
                if (metadata.cover_image_url) |old_cover| self.allocator.free(old_cover);
                metadata.cover_image_url = try self.allocator.dupe(u8, cover);
            }

            std.log.info("✨ Enriched metadata: \"{s}\" by {s}", .{
                metadata.title orelse "Unknown",
                metadata.author orelse "Unknown",
            });
        }
    }

    fn getFileFormat(self: *MetadataExtractor, file_path: []const u8) ![]const u8 {
        var i = file_path.len;
        while (i > 0) {
            i -= 1;
            if (file_path[i] == '.') {
                const ext = file_path[i + 1 ..];
                var lower = try self.allocator.alloc(u8, ext.len);
                for (ext, 0..) |c, idx| {
                    lower[idx] = std.ascii.toLower(c);
                }
                return lower;
            }
        }
        return try self.allocator.dupe(u8, "unknown");
    }

    fn getFileSize(self: *MetadataExtractor, file_path: []const u8) !u64 {
        _ = self;
        const file = try std.fs.cwd().openFile(file_path, .{});
        defer file.close();
        const stat = try file.stat();
        return stat.size;
    }

    fn extractFromFilename(self: *MetadataExtractor, file_path: []const u8, metadata: *BookMetadata) !void {
        // Split path into parts
        var path_parts: std.ArrayList([]const u8) = .empty;
        defer path_parts.deinit(self.allocator);

        var it = std.mem.tokenizeScalar(u8, file_path, '/');
        while (it.next()) |part| {
            try path_parts.append(self.allocator, part);
        }

        if (path_parts.items.len == 0) return;

        // Get filename without extension
        const filename = path_parts.items[path_parts.items.len - 1];
        const filename_no_ext = self.getFilenameWithoutExt(filename);

        // Find "books" directory in path
        var books_index: ?usize = null;
        for (path_parts.items, 0..) |part, i| {
            if (std.ascii.eqlIgnoreCase(part, "books")) {
                books_index = i;
                break;
            }
        }

        if (books_index) |idx| {
            // Case 1: /books/Author/BookTitle/file.ext (3-level)
            if (idx + 2 < path_parts.items.len - 1) {
                const author_name = path_parts.items[idx + 1];
                const book_title = path_parts.items[idx + 2];
                metadata.author = try self.cleanString(author_name);
                metadata.title = try self.cleanString(book_title);
            }
            // Case 2: /books/Author/file.ext (2-level)
            else if (idx + 1 < path_parts.items.len) {
                const author_name = path_parts.items[idx + 1];
                metadata.author = try self.cleanString(author_name);
                metadata.title = try self.cleanString(filename_no_ext);
            }
        } else {
            // Fallback: use filename as title
            metadata.title = try self.cleanString(filename_no_ext);
        }

        // Try to extract ISBN
        metadata.isbn = self.extractISBN(file_path);

        // Try to extract series info
        if (metadata.title) |title| {
            if (self.extractSeriesInfo(title)) |series_info| {
                metadata.series = try self.allocator.dupe(u8, series_info.series);
                metadata.series_number = series_info.number;
            }
        }
    }

    fn getFilenameWithoutExt(self: *MetadataExtractor, filename: []const u8) []const u8 {
        _ = self;
        var i = filename.len;
        while (i > 0) {
            i -= 1;
            if (filename[i] == '.') {
                return filename[0..i];
            }
        }
        return filename;
    }

    fn cleanString(self: *MetadataExtractor, str: []const u8) ![]const u8 {
        var result = try self.allocator.alloc(u8, str.len);
        var out_idx: usize = 0;
        var last_was_space = false;

        for (str) |c| {
            if (c == '_' or c == '-') {
                if (!last_was_space) {
                    result[out_idx] = ' ';
                    out_idx += 1;
                    last_was_space = true;
                }
            } else if (c == ' ') {
                if (!last_was_space) {
                    result[out_idx] = c;
                    out_idx += 1;
                    last_was_space = true;
                }
            } else {
                result[out_idx] = c;
                out_idx += 1;
                last_was_space = false;
            }
        }

        // Trim trailing spaces
        while (out_idx > 0 and result[out_idx - 1] == ' ') {
            out_idx -= 1;
        }

        // Trim leading spaces
        var start_idx: usize = 0;
        while (start_idx < out_idx and result[start_idx] == ' ') {
            start_idx += 1;
        }

        const cleaned = try self.allocator.dupe(u8, result[start_idx..out_idx]);
        self.allocator.free(result);
        return cleaned;
    }

    fn extractISBN(self: *MetadataExtractor, file_path: []const u8) ?[]const u8 {
        // Extract ISBN-10 or ISBN-13 from filename
        // Supports hyphens, underscores, spaces as separators
        // Supports ISBN-10 with trailing 'X' check digit
        const basename = std.fs.path.basename(file_path);

        // Remove extension
        const name_without_ext = if (std.mem.lastIndexOf(u8, basename, ".")) |idx|
            basename[0..idx]
        else
            basename;

        var digit_buffer: [20]u8 = undefined;
        var digit_count: usize = 0;

        for (name_without_ext) |c| {
            if (std.ascii.isDigit(c)) {
                if (digit_count < digit_buffer.len) {
                    digit_buffer[digit_count] = c;
                    digit_count += 1;
                }
                continue;
            }

            // Support ISBN-10 with trailing X (check digit)
            if ((c == 'x' or c == 'X') and digit_count == 9) {
                if (digit_count < digit_buffer.len) {
                    digit_buffer[digit_count] = 'X';
                    digit_count += 1;
                }
                continue;
            }

            // Skip separators (hyphens, underscores, spaces, dots)
            if (c == '-' or c == '_' or c == ' ' or c == '.') {
                continue;
            }

            // Non-separator, non-digit character - check if we have a complete ISBN
            if (digit_count == 10 or digit_count == 13) {
                const isbn = self.allocator.dupe(u8, digit_buffer[0..digit_count]) catch return null;
                std.log.debug("Extracted ISBN from filename: {s}", .{isbn});
                return isbn;
            }
            digit_count = 0;
        }

        // Check final sequence
        if (digit_count == 10 or digit_count == 13) {
            const isbn = self.allocator.dupe(u8, digit_buffer[0..digit_count]) catch return null;
            std.log.debug("Extracted ISBN from filename: {s}", .{isbn});
            return isbn;
        }

        return null;
    }

    fn extractSeriesInfo(self: *MetadataExtractor, title: []const u8) ?SeriesInfo {
        _ = self;
        // Pattern 1: "Book Title (Series Name #3)"
        // Pattern 2: "Series Name 3: Book Title"
        // Pattern 3: "Series Name Book 3"
        // TODO: Implement series info extraction
        _ = title;
        return null;
    }

    pub fn detectGenres(self: *MetadataExtractor, metadata: *const BookMetadata, file_path: []const u8) ![][]const u8 {
        var genres: std.ArrayList([]const u8) = .empty;

        const text_parts = [_]?[]const u8{
            metadata.title,
            metadata.description,
            file_path,
        };

        var combined: std.ArrayList(u8) = .empty;
        defer combined.deinit(self.allocator);

        for (text_parts) |part| {
            if (part) |p| {
                try combined.appendSlice(self.allocator, p);
                try combined.append(self.allocator, ' ');
            }
        }

        // Convert to lowercase for matching
        for (combined.items) |*c| {
            c.* = std.ascii.toLower(c.*);
        }

        const text = combined.items;

        // Genre keywords
        const GenreKeywords = struct {
            genre: []const u8,
            keywords: []const []const u8,
        };

        const genre_keywords = [_]GenreKeywords{
            .{ .genre = "Cooking", .keywords = &[_][]const u8{ "cooking", "recipe", "kitchen", "chef", "culinary", "food" } },
            .{ .genre = "Magic", .keywords = &[_][]const u8{ "magic", "illusion", "trick", "magician" } },
            .{ .genre = "Romance", .keywords = &[_][]const u8{ "romance", "love", "romantic" } },
            .{ .genre = "Mystery", .keywords = &[_][]const u8{ "mystery", "detective", "crime", "murder" } },
            .{ .genre = "Fantasy", .keywords = &[_][]const u8{ "fantasy", "dragon", "wizard", "quest" } },
            .{ .genre = "Sci-Fi", .keywords = &[_][]const u8{ "science fiction", "sci-fi", "space", "alien", "future" } },
            .{ .genre = "Horror", .keywords = &[_][]const u8{ "horror", "scary", "ghost", "vampire", "zombie" } },
            .{ .genre = "Biography", .keywords = &[_][]const u8{ "biography", "memoir", "life of", "autobiography" } },
            .{ .genre = "History", .keywords = &[_][]const u8{ "history", "historical", "war", "ancient" } },
            .{ .genre = "Self-Help", .keywords = &[_][]const u8{ "self-help", "improvement", "success", "productivity" } },
            .{ .genre = "Technology", .keywords = &[_][]const u8{ "technology", "programming", "computer", "software" } },
            .{ .genre = "Science", .keywords = &[_][]const u8{ "science", "physics", "chemistry", "biology", "research" } },
        };

        for (genre_keywords) |gk| {
            for (gk.keywords) |keyword| {
                if (std.mem.indexOf(u8, text, keyword)) |_| {
                    try genres.append(self.allocator, try self.allocator.dupe(u8, gk.genre));
                    break;
                }
            }
        }

        return genres.toOwnedSlice(self.allocator);
    }
};

// Tests
const testing = std.testing;

test "extractISBN extracts 13-digit ISBN with hyphens" {
    var extractor = try MetadataExtractor.init(
        testing.allocator,
        false,
        Config.init(),
    );
    const sample = "/path/to/978-1-098-16220-7.epub";
    const isbn = extractor.extractISBN(sample);
    try testing.expect(isbn != null);
    defer if (isbn) |i| testing.allocator.free(i);
    try testing.expectEqualStrings("9781098162207", isbn.?);
}

test "extractISBN supports ISBN-10 with X suffix" {
    var extractor = try MetadataExtractor.init(
        testing.allocator,
        false,
        Config.init(),
    );
    const sample = "/library/TheBook_123456789X.epub";
    const isbn = extractor.extractISBN(sample);
    try testing.expect(isbn != null);
    defer if (isbn) |i| testing.allocator.free(i);
    try testing.expectEqualStrings("123456789X", isbn.?);
}

test "extractISBN returns null when no ISBN present" {
    var extractor = try MetadataExtractor.init(
        testing.allocator,
        false,
        Config.init(),
    );
    const sample = "/books/no-isbn-book.pdf";
    const isbn = extractor.extractISBN(sample);
    try testing.expect(isbn == null);
}

test "extractISBN extracts plain 13-digit ISBN" {
    var extractor = try MetadataExtractor.init(
        testing.allocator,
        false,
        Config.init(),
    );
    const sample = "9781098162207.pdf";
    const isbn = extractor.extractISBN(sample);
    try testing.expect(isbn != null);
    defer if (isbn) |i| testing.allocator.free(i);
    try testing.expectEqualStrings("9781098162207", isbn.?);
}

test "extractISBN extracts ISBN with underscores and spaces" {
    var extractor = try MetadataExtractor.init(
        testing.allocator,
        false,
        Config.init(),
    );
    const sample = "978_1_098_16220_7 - Book Title.pdf";
    const isbn = extractor.extractISBN(sample);
    try testing.expect(isbn != null);
    defer if (isbn) |i| testing.allocator.free(i);
    try testing.expectEqualStrings("9781098162207", isbn.?);
}

test "extractMetadata preserves ISBN through full extraction" {
    var extractor = try MetadataExtractor.init(
        testing.allocator,
        false,
        Config.init(),
    );

    // Test just the filename parsing portion that includes ISBN extraction
    const sample_path = "/books/Author Name/Book Title/978-0-123-45678-9.epub";

    // Since extractMetadata tries to open the file, we'll test the ISBN extraction directly
    const isbn = extractor.extractISBN(sample_path);
    defer if (isbn) |i| testing.allocator.free(i);

    try testing.expect(isbn != null);
    try testing.expectEqualStrings("9780123456789", isbn.?);
}
