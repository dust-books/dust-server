const std = @import("std");
const sqlite = @import("sqlite");

/// Tag represents a tag entity in the system
pub const Tag = struct {
    id: i64,
    /// Name of the tag
    name: []const u8,
    /// Category of the tag
    category: []const u8,
    /// Optional description of the tag
    description: ?[]const u8,
    /// Optional color (string) associated with the tag
    color: ?[]const u8,
    /// Creation timestamp of the tag
    created_at: []const u8,
};

/// TagService provides methods to manage and query tags
pub const TagService = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,

    /// Initialize the TagService
    pub fn init(db: *sqlite.Db, allocator: std.mem.Allocator) TagService {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    /// Retrieve all tags from the database
    pub fn getAllTags(self: *TagService) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, created_at
            \\FROM tags
            \\ORDER BY category, name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        var tags = std.ArrayList(Tag).init(self.allocator);
        errdefer {
            tags.deinit();
        }

        var iter = try stmt.iterator(Tag, .{});
        while (try iter.next(.{})) |tag| {
            try tags.append(tag);
        }

        return tags.toOwnedSlice();
    }

    /// Retrieve tags by category from the database
    pub fn getTagsByCategory(self: *TagService, category: []const u8) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, created_at
            \\FROM tags
            \\WHERE category = ?
            \\ORDER BY name
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, category);

        var tags = std.ArrayList(Tag).init(self.allocator);
        errdefer tags.deinit();

        var iter = try stmt.iterator(Tag, .{});
        while (try iter.next(.{})) |tag| {
            try tags.append(tag);
        }

        return tags.toOwnedSlice();
    }

    /// Retrieve a tag by its ID
    pub fn getTagById(self: *TagService, id: i64) !?Tag {
        const query =
            \\SELECT id, name, category, description, color, created_at
            \\FROM tags
            \\WHERE id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, id);

        var iter = try stmt.iterator(Tag, .{});
        return try iter.next(.{});
    }

    /// Retrieve book IDs associated with a given tag name
    pub fn getBooksWithTag(self: *TagService, tag_name: []const u8) ![]i64 {
        const query =
            \\SELECT DISTINCT b.id
            \\FROM books b
            \\INNER JOIN book_tags bt ON b.id = bt.book_id
            \\INNER JOIN tags t ON bt.tag_id = t.id
            \\WHERE t.name = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, tag_name);

        var book_ids = std.ArrayList(i64).init(self.allocator);
        errdefer book_ids.deinit();

        var iter = try stmt.iterator(struct { id: i64 }, .{});
        while (try iter.next(.{})) |row| {
            try book_ids.append(row.id);
        }

        return book_ids.toOwnedSlice();
    }

    /// Get the count of books associated with a given tag ID
    pub fn getBookCountForTag(self: *TagService, tag_id: i64) !i64 {
        const query =
            \\SELECT COUNT(DISTINCT book_id) as count
            \\FROM book_tags
            \\WHERE tag_id = ?
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, tag_id);

        var iter = try stmt.iterator(struct { count: i64 }, .{});
        if (try iter.next(.{})) |row| {
            return row.count;
        }

        return 0;
    }

    /// Create a new tag in the database
    pub fn createTag(self: *TagService, name: []const u8, category: []const u8, description: ?[]const u8, color: ?[]const u8) !i64 {
        const query =
            \\INSERT INTO tags (name, category, description, color)
            \\VALUES (?, ?, ?, ?)
        ;

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, name);
        try stmt.bind(2, category);
        if (description) |desc| {
            try stmt.bind(3, desc);
        } else {
            try stmt.bind(3, null);
        }
        if (color) |col| {
            try stmt.bind(4, col);
        } else {
            try stmt.bind(4, null);
        }

        try stmt.exec();
        return self.db.getLastInsertRowID();
    }

    /// Delete a tag by its ID
    pub fn deleteTag(self: *TagService, id: i64) !void {
        const query = "DELETE FROM tags WHERE id = ?";

        var stmt = try self.db.prepare(query);
        defer stmt.deinit();

        try stmt.bind(1, id);
        try stmt.exec();
    }
};
