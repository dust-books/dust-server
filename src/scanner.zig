const std = @import("std");
const sqlite = @import("sqlite");
const MetadataExtractor = @import("metadata_extractor.zig").MetadataExtractor;
const CoverManager = @import("cover_manager.zig").CoverManager;
const testing = std.testing;

pub const ScanResult = struct {
    books_found: u32 = 0,
    books_added: u32 = 0,
    books_updated: u32 = 0,
    errors: u32 = 0,
    scan_path: []const u8,

    pub fn format(
        self: ScanResult,
        comptime fmt: []const u8,
        options: std.fmt.FormatOptions,
        writer: anytype,
    ) !void {
        _ = fmt;
        _ = options;
        try writer.print("ScanResult{{ found={}, added={}, updated={}, errors={}, path=\"{s}\" }}", .{
            self.books_found,
            self.books_added,
            self.books_updated,
            self.errors,
            self.scan_path,
        });
    }
};

pub const Scanner = struct {
    allocator: std.mem.Allocator,
    db: *sqlite.Db,
    scan_dirs: std.ArrayList([]const u8),
    metadata_extractor: MetadataExtractor,
    cover_manager: CoverManager,

    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) !Scanner {
        // Get directories from environment variable
        const dirs_env = std.posix.getenv("DUST_DIRS") orelse "";
        var dirs: std.ArrayList([]const u8) = .empty;

        if (dirs_env.len > 0) {
            var it = std.mem.splitScalar(u8, dirs_env, ':');
            while (it.next()) |dir| {
                const dir_copy = try allocator.dupe(u8, dir);
                try dirs.append(allocator, dir_copy);
            }
        }

        // Enable external metadata lookup by default
        const metadata_extractor = MetadataExtractor.init(allocator, true);

        return .{
            .allocator = allocator,
            .db = db,
            .scan_dirs = dirs,
            .metadata_extractor = metadata_extractor,
            .cover_manager = CoverManager.init(allocator),
        };
    }

    pub fn deinit(self: *Scanner) void {
        for (self.scan_dirs.items) |dir| {
            self.allocator.free(dir);
        }
        self.scan_dirs.deinit(self.allocator);
    }

    pub fn scanLibrary(self: *Scanner, path: []const u8) !ScanResult {
        std.log.info("Starting library scan at: {s}", .{path});

        var result = ScanResult{
            .scan_path = path,
        };

        // Check if path exists and open directory (handle both absolute and relative paths)
        var dir = if (std.fs.path.isAbsolute(path))
            std.fs.openDirAbsolute(path, .{ .iterate = true }) catch |err| {
                std.log.err("Failed to open directory {s}: {}", .{ path, err });
                result.errors += 1;
                return result;
            }
        else
            std.fs.cwd().openDir(path, .{ .iterate = true }) catch |err| {
                std.log.err("Failed to open directory {s}: {}", .{ path, err });
                result.errors += 1;
                return result;
            };
        defer dir.close();

        // Iterate through directory
        var walker = try dir.walk(self.allocator);
        defer walker.deinit();

        while (try walker.next()) |entry| {
            if (entry.kind != .file) continue;

            // Check if it's an ebook file
            if (self.isEbookFile(entry.basename)) {
                result.books_found += 1;

                // Try to add/update the book
                const full_path = try std.fs.path.join(self.allocator, &[_][]const u8{ path, entry.path });
                defer self.allocator.free(full_path);

                self.processBookFile(full_path, &result) catch |err| {
                    std.log.err("Error processing {s}: {}", .{ full_path, err });
                    result.errors += 1;
                };
            }
        }

        std.log.info(
            \\ Library Scan Complete: Books Found - {d}, Books Added - {d}, Books Updated - {d}, Errors - {d}, Scan Paths - {s}
        , .{ result.books_found, result.books_added, result.books_updated, result.errors, result.scan_path });
        return result;
    }

    fn isEbookFile(self: *Scanner, filename: []const u8) bool {
        _ = self;

        const extensions = [_][]const u8{
            ".epub",
            ".pdf",
            ".mobi",
            ".azw",
            ".azw3",
            ".cbz",
            ".cbr",
            ".djvu",
        };

        for (extensions) |ext| {
            if (std.mem.endsWith(u8, filename, ext)) {
                return true;
            }
            // Check uppercase extension
            var upper_buf: [10]u8 = undefined;
            if (ext.len < upper_buf.len) {
                const upper_ext = std.ascii.upperString(&upper_buf, ext);
                if (std.mem.endsWith(u8, filename, upper_ext)) {
                    return true;
                }
            }
        }

        return false;
    }

    fn processBookFile(self: *Scanner, path: []const u8, result: *ScanResult) !void {
        // Check if book already exists
        const check_query =
            \\SELECT id FROM books WHERE file_path = ?
        ;

        var stmt = try self.db.prepare(check_query);
        defer stmt.deinit();

        const row = try stmt.one(
            struct { id: i64 },
            .{},
            .{path},
        );

        if (row) |_| {
            // Book exists, update metadata
            try self.updateBookMetadata(path);
            result.books_updated += 1;
        } else {
            // New book, add it
            try self.addNewBook(path);
            result.books_added += 1;
        }
    }

    fn addNewBook(self: *Scanner, path: []const u8) !void {
        std.log.debug("📖 Adding new book: {s}", .{path});
        std.log.debug("[ISBN] Starting metadata extraction for: {s}", .{path});

        // Extract metadata using the enhanced extractor (includes OpenLibrary enrichment)
        var metadata = try self.metadata_extractor.extractMetadata(path);

        std.log.debug("[ISBN] After metadata extraction - ISBN: {s}", .{metadata.isbn orelse "<null>"});

        if (metadata.isbn == null) {
            std.log.debug("[ISBN] No ISBN found in metadata, attempting to derive from path...", .{});
            metadata.isbn = try self.deriveIsbnFromPath(path);
            if (metadata.isbn) |isbn| {
                std.log.debug("[ISBN] ✅ Successfully derived ISBN from path: {s}", .{isbn});
            } else {
                std.log.debug("[ISBN] ⚠️  Failed to derive ISBN from path", .{});
            }
        } else {
            std.log.debug("[ISBN] ✅ ISBN already present in metadata: {s}", .{metadata.isbn.?});
        }
        defer metadata.deinit(self.allocator);

        std.log.debug("Metadata extracted - title: {s}, author: {s}, isbn: {s}", .{ metadata.title orelse "null", metadata.author orelse "null", metadata.isbn orelse "null" });

        const title = metadata.title orelse blk: {
            const basename = std.fs.path.basename(path);
            break :blk try self.extractTitle(basename);
        };

        const file_format = metadata.file_format orelse "unknown";

        // Handle author
        var author_id: i64 = undefined;
        if (metadata.author) |author_name| {
            std.log.debug("Getting or creating author: {s}", .{author_name});
            author_id = try self.getOrCreateAuthor(author_name);
        } else {
            std.log.debug("No author found, using unknown author", .{});
            author_id = try self.getOrCreateUnknownAuthor();
        }

        std.log.debug("Author ID: {d}", .{author_id});
        std.log.debug("Cover image URL: {s}", .{metadata.cover_image_url orelse "<none>"});

        const cover_path = self.cover_manager.ensureCover(path, metadata.cover_image_url) catch |err| blk: {
            std.log.warn("Failed to resolve cover for {s}: {} ({s})", .{ path, err, @errorName(err) });
            break :blk null;
        };
        defer if (cover_path) |cp| self.allocator.free(cp);

        // Insert book with enriched metadata (including ISBN)
        const insert_query =
            \\INSERT INTO books (name, file_path, file_size, file_format, author, isbn,
            \\                   publisher, publication_date, description, page_count,
            \\                   cover_image_path, created_at, updated_at)
            \\VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ;

        std.log.debug("[ISBN] Preparing to insert book into database...", .{});
        std.log.debug("[ISBN] Final ISBN value being inserted: {s}", .{metadata.isbn orelse "<NULL>"});
        std.log.debug("Executing INSERT query...", .{});
        std.log.debug("Values: title={s}, path={s}, size={d}, format={s}, author_id={d}, isbn={s}", .{
            if (metadata.title != null) metadata.title.? else title,
            path,
            @as(i64, @intCast(metadata.file_size)),
            file_format,
            author_id,
            metadata.isbn orelse "null",
        });
        std.log.debug("       publisher={s}, pub_date={s}, desc={s}, pages={any}", .{
            metadata.publisher orelse "null",
            metadata.publication_date orelse "null",
            if (metadata.description) |d| d[0..@min(50, d.len)] else "null",
            if (metadata.page_count) |pc| @as(i64, @intCast(pc)) else null,
        });

        self.db.exec(insert_query, .{}, .{
            if (metadata.title != null) metadata.title.? else title,
            path,
            @as(i64, @intCast(metadata.file_size)),
            file_format,
            author_id,
            metadata.isbn,
            metadata.publisher,
            metadata.publication_date,
            metadata.description,
            if (metadata.page_count) |pc| @as(i64, @intCast(pc)) else null,
            cover_path,
        }) catch |err| {
            std.log.err("Failed to insert book into database: {}", .{err});
            std.log.err("[ISBN] ISBN value that failed to insert: {s}", .{metadata.isbn orelse "<NULL>"});
            std.log.err("SQLite error details - Check if column count matches. Query expects 10 values.", .{});
            return err;
        };

        std.log.info("Added book: {s}", .{if (metadata.title != null) metadata.title.? else title});
        std.log.debug("[ISBN] ✅ Book inserted successfully with ISBN: {s}", .{metadata.isbn orelse "<none>"});

        // Cleanup temporary title if allocated
        if (metadata.title == null) {
            self.allocator.free(title);
        }
    }

    fn updateBookMetadata(self: *Scanner, path: []const u8) !void {
        // Update file size and updated_at timestamp
        const file = try std.fs.openFileAbsolute(path, .{});
        defer file.close();
        const stat = try file.stat();

        const cover_path = self.cover_manager.findLocalCover(path) catch |err| blk: {
            std.log.warn("Failed to refresh cover for {s}: {}", .{ path, err });
            break :blk null;
        };
        defer if (cover_path) |cp| self.allocator.free(cp);

        const update_query =
            \\UPDATE books 
            \\SET file_size = ?, cover_image_path = ?, updated_at = datetime('now')
            \\WHERE file_path = ?
        ;

        try self.db.exec(update_query, .{}, .{
            .file_size = @as(i64, @intCast(stat.size)),
            .cover_image_path = cover_path,
            .file_path = path,
        });
    }

    fn getOrCreateAuthor(self: *Scanner, name: []const u8) !i64 {
        const check_query =
            \\SELECT id FROM authors WHERE name = ?
        ;

        var stmt = try self.db.prepare(check_query);
        defer stmt.deinit();

        const row = try stmt.one(
            struct { id: i64 },
            .{},
            .{name},
        );

        if (row) |r| {
            return r.id;
        }

        // Create new author
        const insert_query =
            \\INSERT INTO authors (name, created_at) VALUES (?, datetime('now'))
        ;

        try self.db.exec(insert_query, .{}, .{name});

        return self.db.getLastInsertRowID();
    }

    fn getOrCreateUnknownAuthor(self: *Scanner) !i64 {
        return self.getOrCreateAuthor("Unknown");
    }

    fn extractTitle(self: *Scanner, filename: []const u8) ![]const u8 {
        // Remove extension
        var title = filename;
        if (std.mem.lastIndexOfScalar(u8, filename, '.')) |dot_index| {
            title = filename[0..dot_index];
        }

        // Replace underscores and hyphens with spaces
        var result = try self.allocator.alloc(u8, title.len);
        for (title, 0..) |c, i| {
            result[i] = if (c == '_' or c == '-') ' ' else c;
        }

        return result;
    }

    fn deriveIsbnFromPath(self: *Scanner, path: []const u8) !?[]const u8 {
        const basename = std.fs.path.basename(path);
        std.log.debug("[ISBN] deriveIsbnFromPath called for basename: {s}", .{basename});

        const candidate = try deriveIsbnFromText(self.allocator, basename);
        if (candidate) |isbn| {
            std.log.debug("[ISBN] Found ISBN in full basename: {s}", .{isbn});
            return isbn;
        }
        std.log.debug("[ISBN] No ISBN found in full basename, trying without extension...", .{});

        const name_without_ext = if (std.mem.lastIndexOfScalar(u8, basename, '.')) |dot_index|
            basename[0..dot_index]
        else
            basename;

        const result = try deriveIsbnFromText(self.allocator, name_without_ext);
        if (result) |isbn| {
            std.log.debug("[ISBN] Found ISBN in basename without extension: {s}", .{isbn});
        } else {
            std.log.debug("[ISBN] No ISBN found in basename without extension", .{});
        }
        return result;
    }
};

fn deriveIsbnFromText(allocator: std.mem.Allocator, input: []const u8) !?[]const u8 {
    var digit_buffer: [20]u8 = undefined;
    var digit_count: usize = 0;

    for (input) |c| {
        if (std.ascii.isDigit(c)) {
            if (digit_count < digit_buffer.len) {
                digit_buffer[digit_count] = c;
                digit_count += 1;
            }
            continue;
        }

        if ((c == 'x' or c == 'X') and digit_count == 9) {
            digit_buffer[digit_count] = 'X';
            digit_count += 1;
            continue;
        }

        if (c == '-' or c == '_' or c == ' ' or c == '.') {
            continue;
        }

        if (digit_count == 10 or digit_count == 13) {
            return try allocator.dupe(u8, digit_buffer[0..digit_count]);
        }
        digit_count = 0;
    }

    if (digit_count == 10 or digit_count == 13) {
        return try allocator.dupe(u8, digit_buffer[0..digit_count]);
    }

    return null;
}

test "deriveIsbnFromText extracts 13-digit ISBN with separators" {
    const sample = "978-1-098-16220-7 - The Developer.pdf";
    const extracted = (try deriveIsbnFromText(testing.allocator, sample)) orelse return testing.expect(false);
    defer testing.allocator.free(extracted);
    try testing.expectEqualStrings("9781098162207", extracted);
}

test "deriveIsbnFromText supports ISBN-10 with X suffix" {
    const sample = "TheBook_123456789X.epub";
    const extracted = (try deriveIsbnFromText(testing.allocator, sample)) orelse return testing.expect(false);
    defer testing.allocator.free(extracted);
    try testing.expectEqualStrings("123456789X", extracted);
}

test "deriveIsbnFromText returns null when digits missing" {
    const sample = "book-without-isbn.pdf";
    const extracted = try deriveIsbnFromText(testing.allocator, sample);
    try testing.expect(extracted == null);
}

test "deriveIsbnFromText extracts plain 13-digit ISBN" {
    const sample = "9781098162207.pdf";
    const extracted = (try deriveIsbnFromText(testing.allocator, sample)) orelse return testing.expect(false);
    defer testing.allocator.free(extracted);
    try testing.expectEqualStrings("9781098162207", extracted);
}

test "deriveIsbnFromText extracts plain 10-digit ISBN" {
    const sample = "1234567890.epub";
    const extracted = (try deriveIsbnFromText(testing.allocator, sample)) orelse return testing.expect(false);
    defer testing.allocator.free(extracted);
    try testing.expectEqualStrings("1234567890", extracted);
}
