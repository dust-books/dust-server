const std = @import("std");
const Database = @import("../../database.zig").Database;
const User = @import("model.zig").User;
const UserRepository = @import("model.zig").UserRepository;

pub const AuthService = struct {
    user_repo: UserRepository,
    allocator: std.mem.Allocator,

    pub fn init(db: *Database, allocator: std.mem.Allocator) AuthService {
        return .{
            .user_repo = UserRepository.init(db, allocator),
            .allocator = allocator,
        };
    }

    /// Hash a password using bcrypt
    pub fn hashPassword(self: *AuthService, password: []const u8) ![128]u8 {
        _ = self;
        var hash: [128]u8 = [_]u8{0} ** 128; // Zero-initialize

        // Use bcrypt from std.crypto with crypt encoding for compatibility
        _ = try std.crypto.pwhash.bcrypt.strHash(
            password,
            .{
                .allocator = std.heap.page_allocator,
                .params = .{
                    .rounds_log = 12,
                    .silently_truncate_password = false,
                },
                .encoding = .crypt,
            },
            &hash,
        );

        return hash;
    }

    /// Verify a password against a bcrypt hash
    pub fn verifyPassword(self: *AuthService, password: []const u8, hash: []const u8) !bool {
        _ = self;

        // Find the null terminator in the hash
        var hash_len: usize = 0;
        for (hash) |byte| {
            if (byte == 0) break;
            hash_len += 1;
        }

        const hash_slice = hash[0..hash_len];

        // Use bcrypt verification
        std.crypto.pwhash.bcrypt.strVerify(
            hash_slice,
            password,
            .{
                .allocator = std.heap.page_allocator,
                .silently_truncate_password = false,
            },
        ) catch return false;

        return true;
    }

    /// Register a new user
    pub fn register(self: *AuthService, email: []const u8, password: []const u8, username: ?[]const u8) !i64 {
        // Check if user already exists
        if (try self.user_repo.findByEmail(email)) |existing_user| {
            var user = existing_user;
            defer user.deinit(self.allocator);
            return error.UserAlreadyExists;
        }

        // Hash the password
        var password_hash = try self.hashPassword(password);

        // Find null terminator for the hash string
        var hash_len: usize = 0;
        for (password_hash) |byte| {
            if (byte == 0) break;
            hash_len += 1;
        }

        const hash_slice = password_hash[0..hash_len];

        // Check if this is the first user
        const user_count = try self.user_repo.countUsers();
        const is_first_user = user_count == 0;

        // Create user (first user gets is_admin = true)
        const user_id = try self.user_repo.create(
            email,
            hash_slice,
            username,
            is_first_user,
        );

        // Assign appropriate role
        if (is_first_user) {
            try self.user_repo.assignRole(user_id, "admin");
            std.log.info("First user created as admin: {s}", .{email});
        } else {
            try self.user_repo.assignRole(user_id, "user");
        }

        return user_id;
    }

    /// Login a user and return the user if credentials are valid
    pub fn login(self: *AuthService, email: []const u8, password: []const u8) !?User {
        // Find user by email
        std.log.debug("Login attempt for: {s}", .{email});
        const maybe_user = try self.user_repo.findByEmail(email);
        if (maybe_user == null) {
            std.log.warn("❌ User not found", .{});
            return null;
        }

        var user = maybe_user.?;
        errdefer user.deinit(self.allocator);

        std.log.debug("User found: id={d}", .{user.id});
        std.log.debug("Password provided length: {d}", .{password.len});
        std.log.debug("Hash length: {d}", .{user.password_hash.len});

        // Verify password
        const valid = try self.verifyPassword(password, user.password_hash);
        std.log.debug("Password valid: {}", .{valid});
        if (!valid) {
            user.deinit(self.allocator);
            return null;
        }

        return user;
    }
};
