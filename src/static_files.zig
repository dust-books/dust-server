const std = @import("std");
const httpz = @import("httpz");

pub const StaticFileServer = struct {
    allocator: std.mem.Allocator,
    root_dir: []const u8,

    pub fn init(allocator: std.mem.Allocator, root_dir: []const u8) StaticFileServer {
        return .{
            .allocator = allocator,
            .root_dir = root_dir,
        };
    }

    pub fn serve(self: *const StaticFileServer, req: *httpz.Request, res: *httpz.Response) !void {
        var path = req.url.path;
        
        std.log.debug("Static file request: {s}", .{path});
        
        // Default to index.html for root or paths without extension (SPA routing)
        if (path.len == 1 and path[0] == '/') {
            path = "/index.html";
        } else if (std.mem.indexOf(u8, path, ".") == null) {
            // No file extension - serve index.html for SPA routing
            path = "/index.html";
        }

        // Strip leading slash for file path construction
        const relative_path = if (path.len > 0 and path[0] == '/') path[1..] else path;

        // Build full file path
        const file_path = try std.fs.path.join(self.allocator, &[_][]const u8{ self.root_dir, relative_path });
        defer self.allocator.free(file_path);
        
        std.log.debug("Trying to serve file: {s}", .{file_path});

        // Prevent directory traversal
        const canonical = std.fs.cwd().realpathAlloc(self.allocator, file_path) catch |err| {
            if (err == error.FileNotFound) {
                // File not found - serve index.html for SPA routing
                return self.serveFile(req, res, "index.html");
            }
            res.status = 500;
            res.body = "Internal server error";
            return;
        };
        defer self.allocator.free(canonical);

        const canonical_root = try std.fs.cwd().realpathAlloc(self.allocator, self.root_dir);
        defer self.allocator.free(canonical_root);

        if (!std.mem.startsWith(u8, canonical, canonical_root)) {
            res.status = 403;
            res.body = "Forbidden";
            return;
        }

        // Read and serve the file
        const file = std.fs.openFileAbsolute(canonical, .{}) catch |err| {
            if (err == error.FileNotFound) {
                // File not found - serve index.html for SPA routing
                return self.serveFile(req, res, "index.html");
            }
            res.status = 500;
            res.body = "Internal server error";
            return;
        };
        defer file.close();

        const stat = try file.stat();
        const content = try file.readToEndAlloc(res.arena, stat.size);

        res.status = 200;
        res.header("content-type", getMimeType(path));
        res.body = content;
    }

    fn serveFile(self: *const StaticFileServer, _: *httpz.Request, res: *httpz.Response, filename: []const u8) !void {
        const file_path = try std.fs.path.join(self.allocator, &[_][]const u8{ self.root_dir, filename });
        defer self.allocator.free(file_path);

        const file = std.fs.cwd().openFile(file_path, .{}) catch {
            res.status = 404;
            res.body = "Not found";
            return;
        };
        defer file.close();

        const stat = try file.stat();
        const content = try file.readToEndAlloc(res.arena, stat.size);

        res.status = 200;
        res.header("content-type", getMimeType(filename));
        res.body = content;
    }
};

fn getMimeType(path: []const u8) []const u8 {
    if (std.mem.endsWith(u8, path, ".html")) return "text/html; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".css")) return "text/css; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".js")) return "application/javascript; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".mjs")) return "application/javascript; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".json")) return "application/json; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".png")) return "image/png";
    if (std.mem.endsWith(u8, path, ".jpg") or std.mem.endsWith(u8, path, ".jpeg")) return "image/jpeg";
    if (std.mem.endsWith(u8, path, ".gif")) return "image/gif";
    if (std.mem.endsWith(u8, path, ".svg")) return "image/svg+xml";
    if (std.mem.endsWith(u8, path, ".ico")) return "image/x-icon";
    if (std.mem.endsWith(u8, path, ".woff")) return "font/woff";
    if (std.mem.endsWith(u8, path, ".woff2")) return "font/woff2";
    if (std.mem.endsWith(u8, path, ".ttf")) return "font/ttf";
    if (std.mem.endsWith(u8, path, ".xml")) return "application/xml";
    return "application/octet-stream";
}
