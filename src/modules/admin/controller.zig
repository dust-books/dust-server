const std = @import("std");
const httpz = @import("httpz");
const scanner = @import("../../scanner.zig");
const Database = @import("../../database.zig").Database;

pub const AdminController = struct {
    db: *Database,
    allocator: std.mem.Allocator,
    
    pub fn init(db: *Database, allocator: std.mem.Allocator) AdminController {
        return .{
            .db = db,
            .allocator = allocator,
        };
    }
    
    pub fn scanLibrary(self: *AdminController, req: *httpz.Request, res: *httpz.Response) !void {
        const body_opt = try req.json(struct {
            path: ?[]const u8 = null,
        });
        
        const scan_path = if (body_opt) |body| body.path orelse "/library" else "/library";
        
        std.log.info("🔍 Library scan initiated at: {s}", .{scan_path});
        
        var lib_scanner = scanner.Scanner.init(res.arena, &self.db.db) catch |err| {
            std.log.err("Failed to initialize scanner: {}", .{err});
            res.status = 500;
            try res.json(.{ 
                .message = "Failed to initialize scanner",
                .@"error" = @errorName(err),
            }, .{});
            return;
        };
        defer lib_scanner.deinit();
        
        const result = lib_scanner.scanLibrary(scan_path) catch |err| {
            std.log.err("Scan failed: {}", .{err});
            res.status = 500;
            try res.json(.{ 
                .message = "Library scan failed",
                .@"error" = @errorName(err),
            }, .{});
            return;
        };
        
        try res.json(.{
            .success = true,
            .message = "Library scan completed",
            .results = .{
                .books_found = result.books_found,
                .books_added = result.books_added,
                .books_updated = result.books_updated,
                .errors = result.errors,
                .scan_path = result.scan_path,
            },
        }, .{});
    }
};
