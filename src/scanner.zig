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

pub const Scanner = struct {
    allocator: std.mem.Allocator,
    db: *sqlite.Db,
    scan_dirs: std.ArrayList([]const u8),
    
    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) !Scanner {
        // Get directories from environment variable
        const dirs_env = std.posix.getenv("DUST_DIRS") orelse "";
        var dirs = std.ArrayList([]const u8).init(allocator);
        
        if (dirs_env.len > 0) {
            var it = std.mem.split(u8, dirs_env, ":");
            while (it.next()) |dir| {
                const dir_copy = try allocator.dupe(u8, dir);
                try dirs.append(dir_copy);
            }
        }
        
        return .{
            .allocator = allocator,
            .db = db,
            .scan_dirs = dirs,
        };
    }
    
    pub fn deinit(self: *Scanner) void {
        for (self.scan_dirs.items) |dir| {
            self.allocator.free(dir);
        }
        self.scan_dirs.deinit();
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
        // Extract basic info from filename
        const basename = std.fs.path.basename(path);
        const title = try self.extractTitle(basename);
        defer self.allocator.free(title);
        
        // Extract file format from extension
        const ext = std.fs.path.extension(basename);
        const file_format = if (ext.len > 1) ext[1..] else "unknown";
        
        // Get file size
        const file = try std.fs.openFileAbsolute(path, .{});
        defer file.close();
        const stat = try file.stat();
        
        // We need an author - create "Unknown" if doesn't exist
        const author_id = try self.getOrCreateUnknownAuthor();
        
        const insert_query =
            \\INSERT INTO books (name, file_path, file_size, file_format, author, created_at, updated_at)
            \\VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ;
        
        try self.db.exec(insert_query, .{}, .{
            .name = title,
            .file_path = path,
            .file_size = @as(i64, @intCast(stat.size)),
            .file_format = file_format,
            .author = author_id,
        });
        
        std.log.info("➕ Added book: {s}", .{title});
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
    
    fn getOrCreateUnknownAuthor(self: *Scanner) !i64 {
        const check_query = 
            \\SELECT id FROM authors WHERE name = 'Unknown'
        ;
        
        var stmt = try self.db.prepare(check_query);
        defer stmt.deinit();
        
        const row = try stmt.one(
            struct { id: i64 },
            .{},
            .{},
        );
        
        if (row) |r| {
            return r.id;
        }
        
        // Create Unknown author
        const insert_query =
            \\INSERT INTO authors (name, created_at) VALUES ('Unknown', datetime('now'))
        ;
        
        try self.db.exec(insert_query, .{}, .{});
        
        // Get the ID
        return self.db.getLastInsertRowID();
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
