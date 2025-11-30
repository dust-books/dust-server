const std = @import("std");
const fs_walker = @import("fs_walker.zig");

pub const CrawlResult = struct {
    name: []const u8,
    filepath: []const u8,
    author: []const u8,
    
    pub fn deinit(self: *CrawlResult, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        allocator.free(self.filepath);
        allocator.free(self.author);
    }
};

pub const BookCrawler = struct {
    fs_walker: *fs_walker.FSWalker,
    allocator: std.mem.Allocator,
    book_regex_pattern: []const u8 = "books/",
    
    pub fn init(allocator: std.mem.Allocator, walker: *fs_walker.FSWalker) BookCrawler {
        return .{
            .allocator = allocator,
            .fs_walker = walker,
        };
    }
    
    pub fn crawlForBooks(self: *BookCrawler) !std.ArrayList(CrawlResult) {
        var all_items = try self.fs_walker.collect();
        defer {
            for (all_items.items) |*item| {
                item.deinit(self.allocator);
            }
            all_items.deinit();
        }
        
        var books = std.ArrayList(CrawlResult).init(self.allocator);
        errdefer {
            for (books.items) |*book| {
                book.deinit(self.allocator);
            }
            books.deinit();
        }
        
        for (all_items.items) |item| {
            if (self.parseBookPath(item.path)) |result| {
                try books.append(result);
            } else |_| {
                // Failed to parse, skip this item
                continue;
            }
        }
        
        return books;
    }
    
    fn parseBookPath(self: *BookCrawler, path: []const u8) !CrawlResult {
        // Pattern: .../books/{author}/{title}
        const books_idx = std.mem.indexOf(u8, path, "/books/") orelse return error.InvalidPath;
        
        const after_books = path[books_idx + 7..]; // Skip "/books/"
        
        // Find next slash to separate author from title
        const next_slash = std.mem.indexOf(u8, after_books, "/") orelse return error.InvalidPath;
        
        const author_part = after_books[0..next_slash];
        const remaining = after_books[next_slash + 1..];
        
        // Find the last slash to get the filename
        const last_slash = std.mem.lastIndexOf(u8, remaining, "/");
        const title_with_ext = if (last_slash) |idx| remaining[idx + 1..] else remaining;
        
        // Remove file extension from title
        const last_dot = std.mem.lastIndexOf(u8, title_with_ext, ".");
        const title = if (last_dot) |idx| title_with_ext[0..idx] else title_with_ext;
        
        return CrawlResult{
            .name = try self.allocator.dupe(u8, title),
            .filepath = try self.allocator.dupe(u8, path),
            .author = try self.allocator.dupe(u8, author_part),
        };
    }
};

test "BookCrawler parseBookPath" {
    const testing = std.testing;
    const allocator = testing.allocator;
    
    var dummy_walker = fs_walker.FSWalker.init(allocator, &.{}, &.{});
    var crawler = BookCrawler.init(allocator, &dummy_walker);
    
    const test_path = "/home/user/books/John Doe/Great Book.epub";
    var result = try crawler.parseBookPath(test_path);
    defer result.deinit(allocator);
    
    try testing.expectEqualStrings("Great Book", result.name);
    try testing.expectEqualStrings("John Doe", result.author);
    try testing.expectEqualStrings(test_path, result.filepath);
}

test "BookCrawler parseBookPath nested" {
    const testing = std.testing;
    const allocator = testing.allocator;
    
    var dummy_walker = fs_walker.FSWalker.init(allocator, &.{}, &.{});
    var crawler = BookCrawler.init(allocator, &dummy_walker);
    
    const test_path = "/home/user/books/Jane Smith/Series/Book One.pdf";
    var result = try crawler.parseBookPath(test_path);
    defer result.deinit(allocator);
    
    try testing.expectEqualStrings("Book One", result.name);
    try testing.expectEqualStrings("Jane Smith", result.author);
}
