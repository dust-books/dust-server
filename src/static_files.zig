const std = @import("std");
const httpz = @import("httpz");

pub const StaticFileServer = struct {
    allocator: std.mem.Allocator,
    io: std.Io,
    root_dir: []const u8,

    pub fn init(io: std.Io, allocator: std.mem.Allocator, root_dir: []const u8) StaticFileServer {
        return .{
            .allocator = allocator,
            .io = io,
            .root_dir = root_dir,
        };
    }

    pub fn serve(self: *const StaticFileServer, req: *httpz.Request, res: *httpz.Response) !void {
        var path = req.url.path;

        std.log.debug("Static file request: {s}", .{path});

        if (path.len == 1 and path[0] == '/') {
            path = "/index.html";
        } else if (std.mem.indexOf(u8, path, ".") == null) {
            path = "/index.html";
        }

        const relative_path = if (path.len > 0 and path[0] == '/') path[1..] else path;

        const file_path = try std.fs.path.join(self.allocator, &[_][]const u8{ self.root_dir, relative_path });
        defer self.allocator.free(file_path);

        std.log.debug("Trying to serve file: {s}", .{file_path});

        // Prevent directory traversal using realpath
        const file_path_z = self.allocator.dupeZ(u8, file_path) catch {
            res.status = 500;
            res.body = "Internal server error";
            return;
        };
        defer self.allocator.free(file_path_z);

        var canonical_buf: [std.fs.max_path_bytes]u8 = undefined;
        const canonical_ptr = std.c.realpath(file_path_z.ptr, &canonical_buf) orelse {
            return self.serveIndexHtml(res);
        };
        const canonical = std.mem.span(canonical_ptr);

        const root_dir_z = self.allocator.dupeZ(u8, self.root_dir) catch {
            res.status = 500;
            res.body = "Internal server error";
            return;
        };
        defer self.allocator.free(root_dir_z);

        var root_buf: [std.fs.max_path_bytes]u8 = undefined;
        const root_ptr = std.c.realpath(root_dir_z.ptr, &root_buf) orelse {
            res.status = 500;
            res.body = "Internal server error";
            return;
        };
        const canonical_root = std.mem.span(root_ptr);

        if (!std.mem.startsWith(u8, canonical, canonical_root)) {
            res.status = 403;
            res.body = "Forbidden";
            return;
        }

        const file = std.Io.Dir.openFileAbsolute(self.io, canonical, .{}) catch |err| {
            if (err == error.FileNotFound or err == error.NotDir) {
                return self.serveIndexHtml(res);
            }
            res.status = 500;
            res.body = "Internal server error";
            return;
        };
        defer file.close(self.io);

        const stat = try file.stat(self.io);
        const content = try res.arena.alloc(u8, stat.size);
        _ = try file.readPositionalAll(self.io, content, 0);

        res.status = 200;
        res.header("content-type", getMimeType(path));
        res.body = content;
    }

    fn serveIndexHtml(self: *const StaticFileServer, res: *httpz.Response) !void {
        const file_path = try std.fs.path.join(self.allocator, &[_][]const u8{ self.root_dir, "index.html" });
        defer self.allocator.free(file_path);

        const file = std.Io.Dir.cwd().openFile(self.io, file_path, .{}) catch {
            res.status = 404;
            res.body = "Not found";
            return;
        };
        defer file.close(self.io);

        const stat = try file.stat(self.io);
        const content = try res.arena.alloc(u8, stat.size);
        _ = try file.readPositionalAll(self.io, content, 0);

        res.status = 200;
        res.header("content-type", "text/html; charset=utf-8");
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
