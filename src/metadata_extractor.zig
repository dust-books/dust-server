const std = @import("std");

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
    }
};

const SeriesInfo = struct {
    series: []const u8,
    number: u32,
};

pub const MetadataExtractor = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) MetadataExtractor {
        return .{ .allocator = allocator };
    }

    pub fn extractMetadata(self: *MetadataExtractor, file_path: []const u8) !BookMetadata {
        var metadata = BookMetadata{};

        // Get file format from extension
        metadata.file_format = try self.getFileFormat(file_path);

        // Get file size
        metadata.file_size = try self.getFileSize(file_path);

        // Extract from filename/path (works for all formats as fallback)
        try self.extractFromFilename(file_path, &metadata);

        // TODO: In future, implement format-specific extraction:
        // - EPUB: Parse OPF file from ZIP structure
        // - PDF: Extract PDF metadata
        // - MOBI/AZW3: Parse MOBI headers

        return metadata;
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
        var path_parts = std.ArrayList([]const u8).init(self.allocator);
        defer path_parts.deinit();

        var it = std.mem.tokenizeScalar(u8, file_path, '/');
        while (it.next()) |part| {
            try path_parts.append(part);
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
        // Look for ISBN-10 or ISBN-13 patterns
        // Simplified: look for 10 or 13 digit sequences (possibly with dashes/spaces)
        _ = self;
        _ = file_path;
        // TODO: Implement ISBN extraction using regex or pattern matching
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
        var genres = std.ArrayList([]const u8).init(self.allocator);

        const text_parts = [_]?[]const u8{
            metadata.title,
            metadata.description,
            file_path,
        };

        var combined = std.ArrayList(u8).init(self.allocator);
        defer combined.deinit();

        for (text_parts) |part| {
            if (part) |p| {
                try combined.appendSlice(p);
                try combined.append(' ');
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
                    try genres.append(try self.allocator.dupe(u8, gk.genre));
                    break;
                }
            }
        }

        return genres.toOwnedSlice();
    }
};
