const std = @import("std");

pub const CoverManager = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) CoverManager {
        return .{ .allocator = allocator };
    }

    /// Ensure a cover exists for the provided book. Returns the resolved path if one exists.
    /// If no local cover is found and a download URL is provided, the cover will be downloaded
    /// into the same directory as the book file.
    pub fn ensureCover(self: *CoverManager, book_path: []const u8, download_url: ?[]const u8) !?[]const u8 {
        if (try self.findLocalCover(book_path)) |existing| {
            return existing;
        }

        // TODO: once the cover manager work is sorted out, let's swapped this over to debug
        std.log.warn("Unable to find local cover for {s}", .{book_path});

        if (download_url) |url| {
            return self.downloadCover(book_path, url);
        }

        return null;
    }

    /// Look for an existing cover image alongside the provided book.
    pub fn findLocalCover(self: *CoverManager, book_path: []const u8) !?[]const u8 {
        const dir_path = std.fs.path.dirname(book_path) orelse {
            std.log.warn("findLocalCover: Could not determine directory for book path: {s}", .{book_path});
            return null;
        };

        const static_candidates = [_][]const u8{
            "cover.jpg",
            "cover.jpeg",
            "cover.png",
            "cover.webp",
            "folder.jpg",
            "folder.jpeg",
            "folder.png",
            "folder.webp",
        };

        for (static_candidates) |candidate| {
            if (try self.candidatePathIfExists(dir_path, candidate)) |path| {
                return path;
            }
        }

        const filename = std.fs.path.basename(book_path);
        const stem = self.getFilenameWithoutExt(filename);
        const dynamic_extensions = [_][]const u8{ ".jpg", ".jpeg", ".png", ".webp" };

        for (dynamic_extensions) |ext| {
            const candidate_name = std.fmt.allocPrint(self.allocator, "{s}_cover{s}", .{ stem, ext }) catch |err| {
                std.log.warn("findLocalCover: Error formatting candidate name for '{s}' + '{s}': {} ({s})", .{ stem, ext, err, @errorName(err) });
                continue;
            };
            defer self.allocator.free(candidate_name);
            const maybe_path = self.candidatePathIfExists(dir_path, candidate_name) catch |err| {
                std.log.warn("findLocalCover: Error checking dynamic candidate '{s}' in '{s}': {} ({s})", .{ candidate_name, dir_path, err, @errorName(err) });
                continue;
            };
            if (maybe_path) |path| {
                return path;
            }
        }

        std.log.debug("findLocalCover: No cover found for book path: {s}", .{book_path});
        return null;
    }

    fn candidatePathIfExists(self: *CoverManager, dir_path: []const u8, candidate: []const u8) !?[]const u8 {
        const joined = try std.fs.path.join(self.allocator, &.{ dir_path, candidate });
        if (try self.pathExists(joined)) {
            return joined;
        }
        self.allocator.free(joined);
        return null;
    }

    fn pathExists(_: *CoverManager, absolute_or_relative_path: []const u8) !bool {
        std.log.info("Checking if path exists: {s}", .{absolute_or_relative_path});
        if (std.fs.path.isAbsolute(absolute_or_relative_path)) {
            std.fs.accessAbsolute(absolute_or_relative_path, .{}) catch |err| {
                return switch (err) {
                    error.FileNotFound => false,
                    else => err,
                };
            };
            return true;
        }

        std.fs.cwd().access(absolute_or_relative_path, .{}) catch |err| {
            return switch (err) {
                error.FileNotFound => false,
                else => err,
            };
        };
        return true;
    }

    fn downloadCover(self: *CoverManager, book_path: []const u8, url: []const u8) !?[]const u8 {
        const dir_path = std.fs.path.dirname(book_path) orelse return null;

        const uri = std.Uri.parse(url) catch {
            std.log.warn("Invalid cover URL: {s}", .{url});
            return null;
        };

        var client = std.http.Client{ .allocator = self.allocator };
        defer client.deinit();

        var req = try client.request(.GET, uri, .{});
        defer req.deinit();

        var buffer: [4096]u8 = undefined;

        try req.sendBodiless();
        var response = try req.receiveHead(&buffer);

        if (response.head.status != .ok) {
            std.log.warn("Failed to download cover ({s}): {}", .{ url, response.head.status });
            return null;
        }

        var reader_buffer: [4096]u8 = undefined;
        const reader = response.reader(&reader_buffer);

        const max_size = 5 * 1024 * 1024; // 5MB safety net
        const body = try reader.allocRemaining(self.allocator, std.Io.Limit.limited(max_size));
        defer self.allocator.free(body);

        const extension = inferExtension(url);
        const filename = try std.fmt.allocPrint(self.allocator, "cover{s}", .{extension});
        defer self.allocator.free(filename);

        var dir = try openDir(dir_path);
        defer dir.close();

        var file = try dir.createFile(filename, .{ .truncate = true });
        errdefer {
            file.close();
            dir.deleteFile(filename) catch {};
        }

        try file.writeAll(body);
        file.close();

        const cover_path = try std.fs.path.join(self.allocator, &.{ dir_path, filename });
        return cover_path;
    }

    fn openDir(path: []const u8) !std.fs.Dir {
        if (std.fs.path.isAbsolute(path)) {
            return std.fs.openDirAbsolute(path, .{});
        }
        return std.fs.cwd().openDir(path, .{});
    }

    fn getFilenameWithoutExt(self: *CoverManager, filename: []const u8) []const u8 {
        _ = self;
        if (std.mem.lastIndexOfScalar(u8, filename, '.')) |dot_index| {
            return filename[0..dot_index];
        }
        return filename;
    }
};

fn inferExtension(url: []const u8) []const u8 {
    const trimmed = trimQuery(url);
    if (endsWithIgnoreCase(trimmed, ".png")) return ".png";
    if (endsWithIgnoreCase(trimmed, ".jpeg")) return ".jpeg";
    if (endsWithIgnoreCase(trimmed, ".webp")) return ".webp";
    if (endsWithIgnoreCase(trimmed, ".jpg")) return ".jpg";
    return ".jpg";
}

fn trimQuery(url: []const u8) []const u8 {
    if (std.mem.indexOfScalar(u8, url, '?')) |idx| {
        return url[0..idx];
    }
    return url;
}

fn endsWithIgnoreCase(haystack: []const u8, needle: []const u8) bool {
    if (needle.len > haystack.len) return false;
    const start = haystack.len - needle.len;
    return std.ascii.eqlIgnoreCase(haystack[start..], needle);
}

const testing = std.testing;

test "inferExtension handles known types and defaults" {
    try testing.expectEqualStrings(".png", inferExtension("https://example.com/cover.PNG"));
    try testing.expectEqualStrings(".jpeg", inferExtension("https://cdn/foo.jpeg?sz=1"));
    try testing.expectEqualStrings(".jpg", inferExtension("https://cdn/foo"));
}

test "trimQuery strips query parameters" {
    try testing.expectEqualStrings("https://example.com/file.png", trimQuery("https://example.com/file.png?cache=bust"));
    try testing.expectEqualStrings("https://example.com/file.png", trimQuery("https://example.com/file.png"));
}

test "endsWithIgnoreCase matches case-insensitive suffix" {
    try testing.expect(endsWithIgnoreCase("/path/COVER.JPG", ".jpg"));
    try testing.expect(!endsWithIgnoreCase("cover.png", ".jpeg"));
}

test "getFilenameWithoutExt strips extension" {
    var manager = CoverManager.init(testing.allocator);
    const stem = manager.getFilenameWithoutExt("1984_cover.jpg");
    try testing.expectEqualStrings("1984_cover", stem);
    const no_ext = manager.getFilenameWithoutExt("README");
    try testing.expectEqualStrings("README", no_ext);
}
