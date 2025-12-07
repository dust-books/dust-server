const std = @import("std");
const sqlite = @import("sqlite");

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

const MetadataExtractor = @import("metadata_extractor.zig").MetadataExtractor;

pub const Scanner = struct {
    allocator: std.mem.Allocator,
    db: *sqlite.Db,
    scan_dirs: std.ArrayList([]const u8),
    metadata_extractor: MetadataExtractor,
    
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
        };
    }
    
    pub fn deinit(self: *Scanner) void {
        for (self.scan_dirs.items) |dir| {
            self.allocator.free(dir);
        }
        self.scan_dirs.deinit(self.allocator);
    }
    
    pub fn scanLibrary(self: *Scanner, path: []const u8) !ScanResult {
        std.log.info("📚 Starting library scan at: {s}", .{path});
        
        var result = ScanResult{
            .scan_path = path,
        };
        
        // Check if path exists
        var dir = std.fs.openDirAbsolute(path, .{ .iterate = true }) catch |err| {
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
        
        std.log.info("✅ Library scan complete: {any}", .{result});
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
            .{ path },
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
        // Extract metadata using the enhanced extractor (includes OpenLibrary enrichment)
        var metadata = try self.metadata_extractor.extractMetadata(path);
        defer metadata.deinit(self.allocator);
        
        const title = metadata.title orelse blk: {
            const basename = std.fs.path.basename(path);
            break :blk try self.extractTitle(basename);
        };
        
        const file_format = metadata.file_format orelse "unknown";
        
        // Handle author
        var author_id: i64 = undefined;
        if (metadata.author) |author_name| {
            author_id = try self.getOrCreateAuthor(author_name);
        } else {
            author_id = try self.getOrCreateUnknownAuthor();
        }
        
        // Insert book with enriched metadata
        const insert_query =
            \\INSERT INTO books (name, file_path, file_size, file_format, author, 
            \\                   publisher, publication_date, description, language, page_count,
            \\                   created_at, updated_at)
            \\VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ;
        
        try self.db.exec(insert_query, .{}, .{
            .name = if (metadata.title != null) metadata.title.? else title,
            .file_path = path,
            .file_size = @as(i64, @intCast(metadata.file_size)),
            .file_format = file_format,
            .author = author_id,
            .publisher = metadata.publisher,
            .publication_date = metadata.publication_date,
            .description = metadata.description,
            .language = metadata.language,
            .page_count = if (metadata.page_count) |pc| @as(i64, @intCast(pc)) else null,
        });
        
        std.log.info("➕ Added book: {s}", .{if (metadata.title != null) metadata.title.? else title});
        
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
        
        const update_query =
            \\UPDATE books 
            \\SET file_size = ?, updated_at = datetime('now')
            \\WHERE file_path = ?
        ;
        
        try self.db.exec(update_query, .{}, .{
            .file_size = @as(i64, @intCast(stat.size)),
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
};
