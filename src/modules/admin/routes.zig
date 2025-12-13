const std = @import("std");
const httpz = @import("httpz");
const scanner = @import("../../scanner.zig");
const Database = @import("../../database.zig").Database;

pub fn scanLibrary(
    db: *Database,
    allocator: std.mem.Allocator,
    library_directories: []const []const u8,
    req: *httpz.Request,
    res: *httpz.Response,
) !void {
    _ = req;
    
    std.log.info("🔍 Library scan initiated for configured directories", .{});
    
    if (library_directories.len == 0) {
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
    
    for (library_directories) |dir_path| {
        std.log.info("📂 Scanning directory: {s}", .{dir_path});
        
        var lib_scanner = scanner.Scanner.init(allocator, &db.db) catch |err| {
            std.log.err("Failed to initialize scanner: {}", .{err});
            total_errors += 1;
            continue;
        };
        defer lib_scanner.deinit();
        
        const result = lib_scanner.scanLibrary(dir_path) catch |err| {
            std.log.err("Scan failed for {s}: {}", .{dir_path, err});
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
            .directories_scanned = library_directories.len,
        },
    }, .{});
}
