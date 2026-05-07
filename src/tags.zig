const std = @import("std");
const zqlite = @import("zqlite");

pub const Tag = struct {
    id: i64,
    name: []const u8,
    category: []const u8,
    description: ?[]const u8,
    color: ?[]const u8,
    created_at: []const u8,
};

pub const TagService = struct {
    db: *zqlite.Conn,
    allocator: std.mem.Allocator,

    pub fn init(db: *zqlite.Conn, allocator: std.mem.Allocator) TagService {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }

    pub fn getAllTags(self: *TagService) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, created_at
            \\FROM tags
            \\ORDER BY category, name
        ;

        var tags = std.ArrayList(Tag).empty;
        errdefer tags.deinit(self.allocator);

        var rows = try self.db.rows(query, .{});
        defer rows.deinit();
        while (rows.next()) |row| {
            try tags.append(self.allocator, .{
                .id = row.int(0),
                .name = row.text(1),
                .category = row.text(2),
                .description = row.nullableText(3),
                .color = row.nullableText(4),
                .created_at = row.text(5),
            });
        }
        if (rows.err) |err| return err;

        return tags.toOwnedSlice(self.allocator);
    }

    pub fn getTagsByCategory(self: *TagService, category: []const u8) ![]Tag {
        const query =
            \\SELECT id, name, category, description, color, created_at
            \\FROM tags WHERE category = ? ORDER BY name
        ;

        var tags = std.ArrayList(Tag).empty;
        errdefer tags.deinit(self.allocator);

        var rows = try self.db.rows(query, .{category});
        defer rows.deinit();
        while (rows.next()) |row| {
            try tags.append(self.allocator, .{
                .id = row.int(0),
                .name = row.text(1),
                .category = row.text(2),
                .description = row.nullableText(3),
                .color = row.nullableText(4),
                .created_at = row.text(5),
            });
        }
        if (rows.err) |err| return err;

        return tags.toOwnedSlice(self.allocator);
    }

    pub fn getTagById(self: *TagService, id: i64) !?Tag {
        const query =
            \\SELECT id, name, category, description, color, created_at
            \\FROM tags WHERE id = ?
        ;

        const row = try self.db.row(query, .{id}) orelse return null;
        defer row.deinit();
        return Tag{
            .id = row.int(0),
            .name = row.text(1),
            .category = row.text(2),
            .description = row.nullableText(3),
            .color = row.nullableText(4),
            .created_at = row.text(5),
        };
    }

    pub fn getBooksWithTag(self: *TagService, tag_name: []const u8) ![]i64 {
        const query =
            \\SELECT DISTINCT b.id
            \\FROM books b
            \\INNER JOIN book_tags bt ON b.id = bt.book_id
            \\INNER JOIN tags t ON bt.tag_id = t.id
            \\WHERE t.name = ?
        ;

        var book_ids = std.ArrayList(i64).empty;
        errdefer book_ids.deinit(self.allocator);

        var rows = try self.db.rows(query, .{tag_name});
        defer rows.deinit();
        while (rows.next()) |row| {
            try book_ids.append(self.allocator, row.int(0));
        }
        if (rows.err) |err| return err;

        return book_ids.toOwnedSlice(self.allocator);
    }

    pub fn getBookCountForTag(self: *TagService, tag_id: i64) !i64 {
        const query =
            \\SELECT COUNT(DISTINCT book_id) FROM book_tags WHERE tag_id = ?
        ;

        const row = try self.db.row(query, .{tag_id}) orelse return 0;
        defer row.deinit();
        return row.int(0);
    }

    pub fn createTag(self: *TagService, name: []const u8, category: []const u8, description: ?[]const u8, color: ?[]const u8) !i64 {
        try self.db.exec(
            \\INSERT INTO tags (name, category, description, color) VALUES (?, ?, ?, ?)
        , .{ name, category, description, color });
        return self.db.lastInsertedRowId();
    }

    pub fn deleteTag(self: *TagService, id: i64) !void {
        try self.db.exec("DELETE FROM tags WHERE id = ?", .{id});
    }
};
