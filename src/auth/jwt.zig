const std = @import("std");
const base64 = std.base64;
const crypto = std.crypto;

/// JWT Claims structure
pub const Claims = struct {
    user_id: i64,
    email: []const u8,
    username: ?[]const u8,
    exp: i64, // Expiration timestamp (Unix time)
    iat: i64, // Issued at timestamp (Unix time)

    pub fn init(user_id: i64, email: []const u8, username: ?[]const u8) Claims {
        const now = std.time.timestamp();
        return .{
            .user_id = user_id,
            .email = email,
            .username = username,
            .iat = now,
            .exp = now + (24 * 60 * 60), // 24 hours from now
        };
    }
};

test "JWT create/validate round-trip with username set" {
    const allocator = std.testing.allocator;
    const secret = "test-secret";
    var jwt = JWT.init(allocator, secret);

    const claims_in = Claims.init(42, "user@example.com", "alice");
    const token = try jwt.create(claims_in);
    defer allocator.free(token);

    var claims_out = try jwt.validate(token);
    defer jwt.freeClaims(&claims_out);

    try std.testing.expectEqual(claims_in.user_id, claims_out.user_id);
    try std.testing.expectEqualStrings(claims_in.email, claims_out.email);
    try std.testing.expect(claims_out.username != null);
    try std.testing.expectEqualStrings(claims_in.username.?, claims_out.username.?);
}

test "JWT validate rejects expired token" {
    const allocator = std.testing.allocator;
    const secret = "test-secret";
    var jwt = JWT.init(allocator, secret);

    var claims = Claims.init(1, "u@e", null);
    // Force expiration in the past
    claims.exp = std.time.timestamp() - 10;

    const token = try jwt.create(claims);
    defer allocator.free(token);

    const result = jwt.validate(token);
    try std.testing.expectError(error.TokenExpired, result);
}

test "JWT create/validate round-trip with username null" {
    const allocator = std.testing.allocator;
    const secret = "another-secret";
    var jwt = JWT.init(allocator, secret);

    const claims_in = Claims.init(7, "nobody@example.com", null);
    const token = try jwt.create(claims_in);
    defer allocator.free(token);

    var claims_out = try jwt.validate(token);
    defer jwt.freeClaims(&claims_out);

    try std.testing.expect(claims_out.username == null);
    try std.testing.expectEqual(claims_in.user_id, claims_out.user_id);
    try std.testing.expectEqualStrings(claims_in.email, claims_out.email);
}

/// JWT token generator and validator
pub const JWT = struct {
    secret: []const u8,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator, secret: []const u8) JWT {
        return .{
            .secret = secret,
            .allocator = allocator,
        };
    }

    /// Create a JWT token from claims
    pub fn create(self: JWT, claims: Claims) ![]const u8 {
        // JWT structure: header.payload.signature

        // Header (always the same for HS256)
        const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"; // {"alg":"HS256","typ":"JWT"}

        // Encode payload as JSON then base64url using an Allocating writer (Zig 0.15)
        var out: std.Io.Writer.Allocating = .init(self.allocator);
        try std.json.Stringify.value(claims, .{}, &out.writer);
        var payload_arr = out.toArrayList();
        defer payload_arr.deinit(self.allocator);

        // Now base64url-encode the JSON bytes
        const payload_b64 = try self.base64urlEncode(payload_arr.items);
        defer self.allocator.free(payload_b64);

        // Create signature over "header.payload"
        var message: std.ArrayList(u8) = .empty;
        defer message.deinit(self.allocator);
        try message.appendSlice(self.allocator, header);
        try message.appendSlice(self.allocator, ".");
        try message.appendSlice(self.allocator, payload_b64);

        const signature = try self.sign(message.items);
        defer self.allocator.free(signature);

        // Combine into final token
        var token: std.ArrayList(u8) = .empty;
        errdefer token.deinit(self.allocator);

        try token.appendSlice(self.allocator, header);
        try token.appendSlice(self.allocator, ".");
        try token.appendSlice(self.allocator, payload_b64);
        try token.appendSlice(self.allocator, ".");
        try token.appendSlice(self.allocator, signature);

        return token.toOwnedSlice(self.allocator);
    }

    /// Validate and decode a JWT token
    pub fn validate(self: JWT, token: []const u8) !Claims {
        // Split token into parts
        var parts = std.mem.splitScalar(u8, token, '.');

        const header = parts.next() orelse return error.InvalidToken;
        const payload_b64 = parts.next() orelse return error.InvalidToken;
        const signature_b64 = parts.next() orelse return error.InvalidToken;

        if (parts.next() != null) return error.InvalidToken; // Too many parts

        // Verify signature
        var message: std.ArrayList(u8) = .empty;
        defer message.deinit(self.allocator);
        try message.appendSlice(self.allocator, header);
        try message.appendSlice(self.allocator, ".");
        try message.appendSlice(self.allocator, payload_b64);

        const expected_signature = try self.sign(message.items);
        defer self.allocator.free(expected_signature);

        if (!std.mem.eql(u8, signature_b64, expected_signature)) {
            return error.InvalidSignature;
        }

        // Decode payload
        const payload_json = try self.base64urlDecode(payload_b64);
        defer self.allocator.free(payload_json);

        // Parse claims
        const parsed = try std.json.parseFromSlice(Claims, self.allocator, payload_json, .{});
        defer parsed.deinit();

        const claims = parsed.value;

        // Check expiration
        const now = std.time.timestamp();
        if (claims.exp < now) {
            return error.TokenExpired;
        }

        // Return claims (need to duplicate strings since parsed will be freed)
        return Claims{
            .user_id = claims.user_id,
            .email = try self.allocator.dupe(u8, claims.email),
            .username = if (claims.username) |un| try self.allocator.dupe(u8, un) else null,
            .exp = claims.exp,
            .iat = claims.iat,
        };
    }

    /// Free claims memory
    pub fn freeClaims(self: JWT, claims: *Claims) void {
        self.allocator.free(claims.email);
        if (claims.username) |un| {
            self.allocator.free(un);
        }
    }

    // Private helper functions

    fn sign(self: JWT, message: []const u8) ![]const u8 {
        var hmac_buf: [32]u8 = undefined;
        crypto.auth.hmac.sha2.HmacSha256.create(&hmac_buf, message, self.secret);
        return self.base64urlEncode(&hmac_buf);
    }

    fn base64urlEncode(self: JWT, data: []const u8) ![]const u8 {
        const encoder = base64.url_safe_no_pad.Encoder;
        const encoded_len = encoder.calcSize(data.len);
        const encoded = try self.allocator.alloc(u8, encoded_len);
        _ = encoder.encode(encoded, data);
        return encoded;
    }

    fn base64urlDecode(self: JWT, data: []const u8) ![]const u8 {
        const decoder = base64.url_safe_no_pad.Decoder;
        const decoded_len = try decoder.calcSizeForSlice(data);
        const decoded = try self.allocator.alloc(u8, decoded_len);
        try decoder.decode(decoded, data);
        return decoded;
    }
};
