const std = @import("std");
const zqlite = @import("zqlite");
const MetadataExtractor = @import("metadata_extractor.zig").MetadataExtractor;
const CoverManager = @import("cover_manager.zig").CoverManager;
const Config = @import("./config.zig").Config;
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
    db: *zqlite.Conn,
    metadata_extractor: MetadataExtractor,
    cover_manager: CoverManager,

    pub fn init(io: std.Io, allocator: std.mem.Allocator, db: *zqlite.Conn, config: Config) !Scanner {
        const metadata_extractor = try MetadataExtractor.init(
            io,
            allocator,
            true,
            config,
        );

        return .{
            .allocator = allocator,
            .db = db,
            .metadata_extractor = metadata_extractor,
            .cover_manager = CoverManager.init(allocator),
        };
    }

    pub fn scanLibrary(self: *Scanner, io: std.Io, path: []const u8) !ScanResult {
        std.log.info("Starting library scan at: {s}", .{path});

        var result = ScanResult{
            .scan_path = path,
        };

        var dir = if (std.fs.path.isAbsolute(path))
            std.Io.Dir.openDirAbsolute(io, path, .{ .iterate = true }) catch |err| {
                std.log.err("Failed to open directory {s}: {}", .{ path, err });
                result.errors += 1;
                return result;
            }
        else
            std.Io.Dir.cwd().openDir(io, path, .{ .iterate = true }) catch |err| {
                std.log.err("Failed to open directory {s}: {}", .{ path, err });
                result.errors += 1;
                return result;
            };
        defer dir.close(io);

        var walker = try dir.walk(self.allocator);
        defer walker.deinit();

        while (try walker.next(io)) |entry| {
            if (entry.kind != .file) continue;

            if (self.isEbookFile(entry.basename)) {
                result.books_found += 1;

                const full_path = try std.fs.path.join(self.allocator, &[_][]const u8{ path, entry.path });
                defer self.allocator.free(full_path);

                self.processBookFile(io, full_path, &result) catch |err| {
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

    fn processBookFile(self: *Scanner, io: std.Io, path: []const u8, result: *ScanResult) !void {
        const row = try self.db.row("SELECT id FROM books WHERE file_path = ?", .{path});
        if (row) |r| {
            r.deinit();
            try self.updateBookMetadata(io, path);
            result.books_updated += 1;
        } else {
            try self.addNewBook(io, path);
            result.books_added += 1;
        }
    }

    fn addNewBook(self: *Scanner, io: std.Io, path: []const u8) !void {
        std.log.debug("Adding new book: {s}", .{path});

        var metadata = try self.metadata_extractor.extractMetadata(io, path);

        if (metadata.isbn == null) {
            metadata.isbn = try self.deriveIsbnFromPath(path);
        }
        defer metadata.deinit(self.allocator);

        const title = metadata.title orelse blk: {
            const basename = std.fs.path.basename(path);
            break :blk try self.extractTitle(basename);
        };

        const file_format = metadata.file_format orelse "unknown";

        var author_id: i64 = undefined;
        if (metadata.author) |author_name| {
            author_id = try self.getOrCreateAuthor(author_name);
        } else {
            author_id = try self.getOrCreateUnknownAuthor();
        }

        const cover_path = self.cover_manager.ensureCover(io, path, metadata.cover_image_url) catch |err| blk: {
            std.log.warn("Failed to resolve cover for {s}: {} ({s})", .{ path, err, @errorName(err) });
            break :blk null;
        };
        defer if (cover_path) |cp| self.allocator.free(cp);

        self.db.exec(
            \\INSERT INTO books (name, file_path, file_size, file_format, author, isbn,
            \\                   publisher, publication_date, description, page_count,
            \\                   cover_image_path, created_at, updated_at)
            \\VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        , .{
            if (metadata.title != null) metadata.title.? else title,
            path,
            @as(i64, @intCast(metadata.file_size)),
            file_format,
            author_id,
            metadata.isbn,
            metadata.publisher,
            metadata.publication_date,
            metadata.description,
            if (metadata.page_count) |pc| @as(i64, @intCast(pc)) else @as(?i64, null),
            cover_path,
        }) catch |err| {
            std.log.err("Failed to insert book into database: {}", .{err});
            return err;
        };

        std.log.info("Added book: {s}", .{if (metadata.title != null) metadata.title.? else title});

        if (metadata.title == null) {
            self.allocator.free(title);
        }
    }

    fn updateBookMetadata(self: *Scanner, io: std.Io, path: []const u8) !void {
        const file = try std.Io.Dir.openFileAbsolute(io, path, .{});
        defer file.close(io);
        const stat = try file.stat(io);

        const cover_path = self.cover_manager.findLocalCover(io, path) catch |err| blk: {
            std.log.warn("Failed to refresh cover for {s}: {}", .{ path, err });
            break :blk null;
        };
        defer if (cover_path) |cp| self.allocator.free(cp);

        try self.db.exec(
            \\UPDATE books SET file_size = ?, cover_image_path = ?, updated_at = datetime('now')
            \\WHERE file_path = ?
        , .{
            @as(i64, @intCast(stat.size)),
            cover_path,
            path,
        });
    }

    fn getOrCreateAuthor(self: *Scanner, name: []const u8) !i64 {
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

    fn getOrCreateUnknownAuthor(self: *Scanner) !i64 {
        return self.getOrCreateAuthor("Unknown");
    }

    fn extractTitle(self: *Scanner, filename: []const u8) ![]const u8 {
        var title = filename;
        if (std.mem.lastIndexOfScalar(u8, filename, '.')) |dot_index| {
            title = filename[0..dot_index];
        }

        var result = try self.allocator.alloc(u8, title.len);
        for (title, 0..) |c, i| {
            result[i] = if (c == '_' or c == '-') ' ' else c;
        }

        return result;
    }

    fn deriveIsbnFromPath(self: *Scanner, path: []const u8) !?[]const u8 {
        const basename = std.fs.path.basename(path);

        const candidate = try deriveIsbnFromText(self.allocator, basename);
        if (candidate) |isbn| return isbn;

        const name_without_ext = if (std.mem.lastIndexOfScalar(u8, basename, '.')) |dot_index|
            basename[0..dot_index]
        else
            basename;

        return deriveIsbnFromText(self.allocator, name_without_ext);
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
