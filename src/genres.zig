const std = @import("std");
const httpz = @import("httpz");
const sqlite = @import("sqlite");

pub const Genre = struct {
    id: u64,
    name: []const u8,
    description: ?[]const u8,
    color: ?[]const u8,
    book_count: usize,
};

// Stub implementation - will be completed when tag service is integrated
pub fn registerRoutes(server: anytype) !void {
    var routes = server.router();
    
    routes.get("/genres/", getGenresHandler, .{});
    routes.get("/genres/:id", getGenreHandler, .{});
}

fn getGenresHandler(req: *httpz.Request, res: *httpz.Response) !void {
    _ = req;
    // TODO: Implement with tag service integration
    const empty: [0]Genre = .{};
    try res.json(.{ .genres = empty[0..0], .message = "Genre listing pending tag service integration" }, .{});
}

fn getGenreHandler(req: *httpz.Request, res: *httpz.Response) !void {
    const id_str = req.param("id") orelse {
        res.status = 400;
        try res.json(.{ .@"error" = "Genre ID is required" }, .{});
        return;
    };
    
    _ = std.fmt.parseInt(u64, id_str, 10) catch {
        res.status = 400;
        try res.json(.{ .@"error" = "Invalid genre ID" }, .{});
        return;
    };
    
    // TODO: Implement with tag service integration
    res.status = 404;
    try res.json(.{ .@"error" = "Genre not found", .message = "Genre details pending tag service integration" }, .{});
}

pub fn migrate(database: *sqlite.Db) !void {
    // Genres are handled via tags with category='genre'
    // No separate migration needed as tags table is created in books module
    _ = database;
}
