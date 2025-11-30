const std = @import("std");
const sqlite = @import("sqlite");

pub const Tag = struct {
    id: i64,
    name: []const u8,
    category: []const u8,
    description: ?[]const u8,
    color: ?[]const u8,
    requires_permission: ?i64,
    created_at: i64,
};

pub const BookTag = struct {
    book_id: i64,
    tag_id: i64,
    applied_by: ?i64,
    auto_applied: bool,
    applied_at: i64,
};

pub const TagService = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) TagService {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn initializeDefaultTags(self: *TagService) !void {
        const default_tags = [_]struct {
            name: []const u8,
            category: []const u8,
            description: []const u8,
            color: []const u8,
            requires_permission: ?i64 = null,
        }{
            // Content Rating Tags
            .{ .name = "NSFW", .category = "content-rating", .description = "Not Safe For Work content", .color = "#FF4444", .requires_permission = 2 }, // CONTENT_NSFW
            .{ .name = "Adult", .category = "content-rating", .description = "Adult content", .color = "#FF6666", .requires_permission = 2 },
            .{ .name = "Mature", .category = "content-rating", .description = "Mature content", .color = "#FF9999" },
            .{ .name = "Teen", .category = "content-rating", .description = "Teen content", .color = "#FFAA44" },
            .{ .name = "All Ages", .category = "content-rating", .description = "Suitable for all ages", .color = "#44AA44" },

            // Genre Tags
            .{ .name = "Cooking", .category = "genre", .description = "Cooking and culinary books", .color = "#FFA500" },
            .{ .name = "Magic", .category = "genre", .description = "Magic and illusion books", .color = "#9932CC", .requires_permission = 4 }, // CONTENT_RESTRICTED
            .{ .name = "Fiction", .category = "genre", .description = "Fiction books", .color = "#4169E1" },
            .{ .name = "Non-Fiction", .category = "genre", .description = "Non-fiction books", .color = "#228B22" },
            .{ .name = "Biography", .category = "genre", .description = "Biographical books", .color = "#DAA520" },
            .{ .name = "History", .category = "genre", .description = "Historical books", .color = "#8B4513" },
            .{ .name = "Science", .category = "genre", .description = "Science books", .color = "#00CED1" },
            .{ .name = "Technology", .category = "genre", .description = "Technology books", .color = "#FF6347" },
            .{ .name = "Self-Help", .category = "genre", .description = "Self-help books", .color = "#32CD32" },
            .{ .name = "Romance", .category = "genre", .description = "Romance books", .color = "#FF1493" },
            .{ .name = "Mystery", .category = "genre", .description = "Mystery books", .color = "#8B008B" },
            .{ .name = "Thriller", .category = "genre", .description = "Thriller books", .color = "#DC143C" },
            .{ .name = "Horror", .category = "genre", .description = "Horror books", .color = "#800000" },
            .{ .name = "Fantasy", .category = "genre", .description = "Fantasy books", .color = "#9370DB" },
            .{ .name = "Sci-Fi", .category = "genre", .description = "Science fiction books", .color = "#4682B4" },

            // Format Tags
            .{ .name = "PDF", .category = "format", .description = "PDF format", .color = "#FF6B6B" },
            .{ .name = "EPUB", .category = "format", .description = "EPUB format", .color = "#4ECDC4" },
            .{ .name = "MOBI", .category = "format", .description = "MOBI format", .color = "#45B7D1" },
            .{ .name = "AZW3", .category = "format", .description = "AZW3 format", .color = "#96CEB4" },
            .{ .name = "CBR", .category = "format", .description = "Comic Book RAR", .color = "#FFEAA7" },
            .{ .name = "CBZ", .category = "format", .description = "Comic Book ZIP", .color = "#DDA0DD" },

            // Collection Tags
            .{ .name = "Series", .category = "collection", .description = "Part of a series", .color = "#87CEEB" },
            .{ .name = "Standalone", .category = "collection", .description = "Standalone book", .color = "#98FB98" },
            .{ .name = "Reference", .category = "collection", .description = "Reference material", .color = "#F0E68C" },
            .{ .name = "Textbook", .category = "collection", .description = "Educational textbook", .color = "#FFB6C1" },

            // Status Tags
            .{ .name = "New Addition", .category = "status", .description = "Recently added to library", .color = "#00FF7F" },
            .{ .name = "Featured", .category = "status", .description = "Featured content", .color = "#FFD700" },
            .{ .name = "Popular", .category = "status", .description = "Popular content", .color = "#FF4500" },
            .{ .name = "Recommended", .category = "status", .description = "Recommended reading", .color = "#1E90FF" },

            // Language Tags
            .{ .name = "English", .category = "language", .description = "English language", .color = "#B0E0E6" },
            .{ .name = "Spanish", .category = "language", .description = "Spanish language", .color = "#FFE4B5" },
            .{ .name = "French", .category = "language", .description = "French language", .color = "#E6E6FA" },
            .{ .name = "German", .category = "language", .description = "German language", .color = "#F5DEB3" },
            .{ .name = "Japanese", .category = "language", .description = "Japanese language", .color = "#FFC0CB" },
        };

        for (default_tags) |tag| {
            const existing = self.getTagByName(tag.name) catch null;
            if (existing == null) {
                try self.createTag(tag.name, tag.category, tag.description, tag.color, tag.requires_permission);
                std.log.info("Created tag: {s}", .{tag.name});
            }
        }
    }

    pub fn createTag(
        self: *TagService,
        name: []const u8,
        category: []const u8,
        description: []const u8,
        color: []const u8,
        requires_permission: ?i64,
    ) !void {
        const query =
            \\INSERT INTO tags (name, category, description, color, requires_permission, created_at)
            \\VALUES (?, ?, ?, ?, ?, ?)
        ;

        const now = std.time.timestamp();
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            .name = name,
            .category = category,
            .description = description,
            .color = color,
            .requires_permission = requires_permission,
            .created_at = now,
        });
    }

    pub fn getTagByName(self: *TagService, name: []const u8) !?Tag {
        const query = "SELECT id, name, category, description, color, requires_permission, created_at FROM tags WHERE name = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        const row = try stmt.oneAlloc(
            Tag,
            self.allocator,
            .{},
            .{ .name = name },
        );

        return row;
    }

    pub fn getAllTags(self: *TagService) ![]Tag {
        const query = "SELECT id, name, category, description, color, requires_permission, created_at FROM tags ORDER BY category, name";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var tags = std.ArrayList(Tag).init(self.allocator);
        errdefer tags.deinit();

        const iter = try stmt.iterator(Tag, .{});
        while (try iter.next(.{})) |tag| {
            try tags.append(tag);
        }

        return tags.toOwnedSlice();
    }

    pub fn getTagsByCategory(self: *TagService, category: []const u8) ![]Tag {
        const query = "SELECT id, name, category, description, color, requires_permission, created_at FROM tags WHERE category = ? ORDER BY name";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var tags = std.ArrayList(Tag).init(self.allocator);
        errdefer tags.deinit();

        const iter = try stmt.iterator(Tag, .{ .category = category });
        while (try iter.next(.{})) |tag| {
            try tags.append(tag);
        }

        return tags.toOwnedSlice();
    }

    pub fn addTagToBook(
        self: *TagService,
        book_id: i64,
        tag_id: i64,
        applied_by: ?i64,
        auto_applied: bool,
    ) !void {
        const query =
            \\INSERT INTO book_tags (book_id, tag_id, applied_by, auto_applied, applied_at)
            \\VALUES (?, ?, ?, ?, ?)
        ;

        const now = std.time.timestamp();
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{
            .book_id = book_id,
            .tag_id = tag_id,
            .applied_by = applied_by,
            .auto_applied = @intFromBool(auto_applied),
            .applied_at = now,
        });
    }

    pub fn removeTagFromBook(self: *TagService, book_id: i64, tag_id: i64) !void {
        const query = "DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.exec(.{}, .{ .book_id = book_id, .tag_id = tag_id });
    }

    pub fn getBookTags(self: *TagService, book_id: i64) ![]Tag {
        const query =
            \\SELECT t.id, t.name, t.category, t.description, t.color, t.requires_permission, t.created_at
            \\FROM tags t
            \\JOIN book_tags bt ON t.id = bt.tag_id
            \\WHERE bt.book_id = ?
            \\ORDER BY t.category, t.name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var tags = std.ArrayList(Tag).init(self.allocator);
        errdefer tags.deinit();

        const iter = try stmt.iterator(Tag, .{ .book_id = book_id });
        while (try iter.next(.{})) |tag| {
            try tags.append(tag);
        }

        return tags.toOwnedSlice();
    }

    pub fn autoTagBookByMetadata(self: *TagService, book_id: i64, filepath: []const u8) !void {
        var auto_tags = std.ArrayList([]const u8).init(self.allocator);
        defer auto_tags.deinit();

        // Add format tag based on file extension
        const ext_start = std.mem.lastIndexOf(u8, filepath, ".") orelse filepath.len;
        if (ext_start < filepath.len) {
            const ext = filepath[ext_start + 1 ..];
            const format_tag = if (std.mem.eql(u8, ext, "pdf"))
                "PDF"
            else if (std.mem.eql(u8, ext, "epub"))
                "EPUB"
            else if (std.mem.eql(u8, ext, "mobi"))
                "MOBI"
            else if (std.mem.eql(u8, ext, "azw3"))
                "AZW3"
            else if (std.mem.eql(u8, ext, "cbr"))
                "CBR"
            else if (std.mem.eql(u8, ext, "cbz"))
                "CBZ"
            else
                null;

            if (format_tag) |tag| {
                try auto_tags.append(tag);
            }
        }

        // Add default tags
        try auto_tags.append("New Addition");
        try auto_tags.append("English");
        try auto_tags.append("Standalone");

        // Apply all auto tags
        for (auto_tags.items) |tag_name| {
            if (try self.getTagByName(tag_name)) |tag| {
                self.addTagToBook(book_id, tag.id, null, true) catch |err| {
                    std.log.debug("Tag {s} already exists on book {d}: {}", .{ tag_name, book_id, err });
                };
            }
        }
    }
};
