const std = @import("std");

/// Application configuration loaded from environment variables
pub const Config = struct {
    library_directories: []const []const u8,
    google_books_api_key: ?[]const u8,
    port: u16,
    database_url: []const u8,
    jwt_secret: []const u8,
    allocator: std.mem.Allocator,

    /// Load configuration from environment variables
    pub fn load(allocator: std.mem.Allocator) !Config {
        const dirs_str = std.process.getEnvVarOwned(allocator, "DUST_DIRS") catch try allocator.dupe(u8, "");
        defer allocator.free(dirs_str);
        const library_directories = try parseCommaSeparated(allocator, dirs_str);
        const google_books_api_key = std.process.getEnvVarOwned(allocator, "GOOGLE_BOOKS_API_KEY") catch null;

        const port_str = std.process.getEnvVarOwned(allocator, "PORT") catch
            try allocator.dupe(u8, "4001");
        defer allocator.free(port_str);
        const port = try std.fmt.parseInt(u16, port_str, 10);

        const jwt_secret = std.process.getEnvVarOwned(allocator, "JWT_SECRET") catch
            return error.MissingJWTSecret;

        const database_url = std.process.getEnvVarOwned(allocator, "DATABASE_URL") catch try allocator.dupe(u8, "file:dust.db");

        return Config{
            .library_directories = library_directories,
            .google_books_api_key = google_books_api_key,
            .port = port,
            .database_url = database_url,
            .jwt_secret = jwt_secret,
            .allocator = allocator,
        };
    }

    /// Deinitialize and free allocated resources
    pub fn deinit(self: *Config) void {
        for (self.library_directories) |dir| {
            self.allocator.free(dir);
        }
        self.allocator.free(self.library_directories);

        if (self.google_books_api_key) |key| {
            self.allocator.free(key);
        }

        self.allocator.free(self.database_url);
        self.allocator.free(self.jwt_secret);
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
