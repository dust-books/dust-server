const std = @import("std");
const build = @import("build.zig.zon");

/// Application configuration loaded from environment variables
pub const Config = struct {
    library_directories: []const []const u8,
    google_books_api_key: ?[]const u8,
    user_agent: []const u8,
    port: u16,
    database_url: []const u8,
    jwt_secret: []const u8,

    /// Provide an empty shell config for manual configuration
    pub fn init() Config {
        return .{
            .library_directories = &[_][]const u8{},
            .google_books_api_key = null,
            .user_agent = "",
            .port = 3000,
            .database_url = "",
            .jwt_secret = "",
        };
    }

    /// Load configuration from environment variables
    pub fn load(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !Config {
        const dirs_str = environ.get("DUST_DIRS") orelse "";
        const library_directories = try parseCommaSeparated(allocator, dirs_str);
        const google_books_api_key = if (environ.get("GOOGLE_BOOKS_API_KEY")) |key| try allocator.dupe(u8, key) else null;
        const user_agent_suffix = environ.get("USER_AGENT_SUFFIX");

        const user_agent = try std.fmt.allocPrint(allocator, "Dust Server/{s} {s}", .{
            build.version,
            user_agent_suffix orelse "",
        });
        const port_str = environ.get("PORT") orelse "4001";
        const port = try std.fmt.parseInt(u16, port_str, 10);

        const jwt_secret = try allocator.dupe(u8, environ.get("JWT_SECRET") orelse return error.MissingJWTSecret);

        const database_url = if (environ.get("DATABASE_URL")) |key| allocator.duple(key) else try std.fmt.allocPrint(allocator, "file:dust-{d}.db", .{port});

        return Config{
            .library_directories = library_directories,
            .google_books_api_key = google_books_api_key,
            .user_agent = user_agent,
            .port = port,
            .database_url = database_url,
            .jwt_secret = jwt_secret,
        };
    }

    /// Deinitialize and free allocated resources
    pub fn deinit(self: *Config, allocator: std.mem.Allocator) void {
        for (self.library_directories) |dir| {
            allocator.free(dir);
        }
        allocator.free(self.library_directories);

        if (self.google_books_api_key) |key| {
            allocator.free(key);
        }

        allocator.free(self.user_agent);
        allocator.free(self.database_url);
        allocator.free(self.jwt_secret);
    }

    /// Helper function to parse comma-separated strings into an array
    fn parseCommaSeparated(allocator: std.mem.Allocator, input: []const u8) ![]const []const u8 {
        if (input.len == 0) return &[_][]const u8{};

        var list: std.ArrayList([]const u8) = .empty;
        errdefer {
            for (list.items) |item| allocator.free(item);
            list.deinit(allocator);
        }

        var iter = std.mem.splitScalar(u8, input, ',');
        while (iter.next()) |part| {
            const trimmed = std.mem.trim(u8, part, " \t\r\n");
            if (trimmed.len > 0) {
                try list.append(allocator, try allocator.dupe(u8, trimmed));
            }
        }

        return list.toOwnedSlice(allocator);
    }
};
