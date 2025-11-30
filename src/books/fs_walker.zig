const std = @import("std");

pub const WalkEntry = struct {
    path: []const u8,
    name: []const u8,
    is_file: bool,
    is_dir: bool,
    
    pub fn deinit(self: *WalkEntry, allocator: std.mem.Allocator) void {
        allocator.free(self.path);
        allocator.free(self.name);
    }
};

pub const FSWalker = struct {
    dirs: []const []const u8,
    supported_filetypes: []const []const u8,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, dirs: []const []const u8, supported_filetypes: []const []const u8) FSWalker {
        return .{
            .allocator = allocator,
            .dirs = dirs,
            .supported_filetypes = supported_filetypes,
        };
    }
    
    pub fn collect(self: *FSWalker) !std.ArrayList(WalkEntry) {
        var found_items = std.ArrayList(WalkEntry).init(self.allocator);
        errdefer {
            for (found_items.items) |*item| {
                item.deinit(self.allocator);
            }
            found_items.deinit();
        }
        
        for (self.dirs) |dir| {
            try self.walkDir(dir, &found_items);
        }
        
        return found_items;
    }
    
    fn walkDir(self: *FSWalker, dir_path: []const u8, results: *std.ArrayList(WalkEntry)) !void {
        var dir = std.fs.cwd().openDir(dir_path, .{ .iterate = true }) catch |err| {
            std.log.warn("Failed to open directory {s}: {}", .{ dir_path, err });
            return;
        };
        defer dir.close();
        
        var walker = try dir.walk(self.allocator);
        defer walker.deinit();
        
        while (try walker.next()) |entry| {
            if (entry.kind == .file) {
                if (self.hasValidExtension(entry.path)) {
                    const full_path = try std.fs.path.join(self.allocator, &.{ dir_path, entry.path });
                    errdefer self.allocator.free(full_path);
                    
                    const name = try self.allocator.dupe(u8, entry.basename);
                    errdefer self.allocator.free(name);
                    
                    try results.append(.{
                        .path = full_path,
                        .name = name,
                        .is_file = true,
                        .is_dir = false,
                    });
                }
            }
        }
    }
    
    fn hasValidExtension(self: *FSWalker, path: []const u8) bool {
        if (self.supported_filetypes.len == 0) return true;
        
        for (self.supported_filetypes) |ext| {
            if (std.mem.endsWith(u8, path, ext)) {
                return true;
            }
        }
        
        return false;
    }
};

test "FSWalker basic functionality" {
    const testing = std.testing;
    const allocator = testing.allocator;
    
    // Create a temp directory for testing
    var tmp_dir = testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    
    // Create some test files
    var test_file = try tmp_dir.dir.createFile("test.epub", .{});
    test_file.close();
    
    var test_file2 = try tmp_dir.dir.createFile("test.pdf", .{});
    test_file2.close();
    
    var test_file3 = try tmp_dir.dir.createFile("test.txt", .{});
    test_file3.close();
    
    // Get the path
    const tmp_path = try tmp_dir.dir.realpathAlloc(allocator, ".");
    defer allocator.free(tmp_path);
    
    const dirs = [_][]const u8{tmp_path};
    const exts = [_][]const u8{ ".epub", ".pdf" };
    
    var walker = FSWalker.init(allocator, &dirs, &exts);
    var entries = try walker.collect();
    defer {
        for (entries.items) |*entry| {
            entry.deinit(allocator);
        }
        entries.deinit();
    }
    
    // Should find 2 files (.epub and .pdf, not .txt)
    try testing.expectEqual(@as(usize, 2), entries.items.len);
}
