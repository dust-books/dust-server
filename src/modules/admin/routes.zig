const std = @import("std");
const httpz = @import("httpz");
const scanner = @import("../../scanner.zig");
const Database = @import("../../database.zig").Database;
const BookRepository = @import("../books/model.zig").BookRepository;
const Config = @import("../../config.zig").Config;

pub fn scanLibrary(
    db: *Database,
    allocator: std.mem.Allocator,
    config: Config,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;

    std.log.info("🔍 Library scan initiated for configured directories", .{});

    if (config.library_directories.len == 0) {
        std.log.warn("No library directories configured", .{});
        res.status = 400;
        try res.json(.{
            .message = "No library directories configured. Set DUST_DIRS environment variable.",
        }, .{});
        return;
    }

    var total_books_found: usize = 0;
    var total_books_added: usize = 0;
    var total_books_updated: usize = 0;
    var total_errors: usize = 0;

    for (config.library_directories) |dir_path| {
        std.log.info("📂 Scanning directory: {s}", .{dir_path});

        var lib_scanner = scanner.Scanner.init(allocator, &db.db, config) catch |err| {
            std.log.err("Failed to initialize scanner: {}", .{err});
            total_errors += 1;
            continue;
        };

        const result = lib_scanner.scanLibrary(dir_path) catch |err| {
            std.log.err("Scan failed for {s}: {}", .{ dir_path, err });
            total_errors += 1;
            continue;
        };

        total_books_found += result.books_found;
        total_books_added += result.books_added;
        total_books_updated += result.books_updated;
        total_errors += result.errors;
    }

    try res.json(.{
        .success = true,
        .message = "Library scan completed",
        .results = .{
            .books_found = total_books_found,
            .books_added = total_books_added,
            .books_updated = total_books_updated,
            .errors = total_errors,
            .directories_scanned = config.library_directories.len,
        },
    }, .{});
}

pub fn refreshBookMetadata(
    book_repo: *BookRepository,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Missing book ID" }, .{});
        return;
    };

    const book_id = std.fmt.parseInt(i64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid book ID" }, .{});
        return;
    };

    std.log.info("Refreshing metadata for book ID: {d}", .{book_id});

    book_repo.refreshMetadata(res.arena, book_id) catch |err| {
        std.log.err("Failed to refresh metadata for book {d}: {}", .{ book_id, err });
        if (err == error.BookNotFound) {
            res.status = 404;
            try res.json(.{ .@"error" = "Book not found" }, .{});
        } else {
            res.status = 500;
            try res.json(.{ .@"error" = "Failed to refresh metadata" }, .{});
        }
        return;
    };

    std.log.info("Metadata refreshed for book ID: {d}", .{book_id});

    try res.json(.{
        .success = true,
        .message = "Metadata refreshed successfully",
        .book_id = book_id,
    }, .{});
}
