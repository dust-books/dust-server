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
    pub fn load(allocator: std.mem.Allocator) !Config {
        const dirs_str = std.process.getEnvVarOwned(allocator, "DUST_DIRS") catch try allocator.dupe(u8, "");
        defer allocator.free(dirs_str);
        const library_directories = try parseCommaSeparated(allocator, dirs_str);
        const google_books_api_key = std.process.getEnvVarOwned(allocator, "GOOGLE_BOOKS_API_KEY") catch null;
        const user_agent_suffix = std.process.getEnvVarOwned(allocator, "USER_AGENT_SUFFIX") catch null;
        defer {
            if (user_agent_suffix) |suffix| {
                allocator.free(suffix);
            }
        }

        const user_agent = try std.fmt.allocPrint(allocator, "Dust Server/{s} {s}", .{
            build.version,
            user_agent_suffix orelse "",
        });
        const port_str = std.process.getEnvVarOwned(allocator, "PORT") catch
            try allocator.dupe(u8, "4001");
        defer allocator.free(port_str);
        const port = try std.fmt.parseInt(u16, port_str, 10);

        const jwt_secret = std.process.getEnvVarOwned(allocator, "JWT_SECRET") catch
            return error.MissingJWTSecret;

        // blk: produce block result via break (avoids trailing expr without semicolon, which Zig 0.15 rejects here)
        const database_url = blk: {
            const url = std.process.getEnvVarOwned(allocator, "DATABASE_URL") catch |err| {
                // catch EnvironmentVariableNotFound and handle it;
                if (err == std.process.GetEnvVarOwnedError.EnvironmentVariableNotFound) {
                    // fix: db file instance-specific naming to avoid 2+ servers sharing the same db.
                    break :blk try std.fmt.allocPrint(allocator, "file:dust-{d}.db", .{port});
                } else { // return other errors (OutOfMemory, InvalidWtf8): std.process.GetEnvVarOwnedError
                    return err;
                }
            };
            break :blk url;
        };

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

        allocator.free(self.database_url);
        allocator.free(self.jwt_secret);
        allocator.free(self.user_agent);
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
