const std = @import("std");
const crypto = std.crypto;
const base64 = std.base64;

/// Invitation tokens are derived purely from the JWT secret and are
/// never stored in the database. They encode an email address and a
/// short-lived expiration time, signed with HMAC-SHA256.
///
/// Token format (URL-safe, not JWT):
///   base64url("email|exp") + "." + base64url(hmac_sha256(secret, "email|exp"))
///
/// Both functions are stateless and can be called from any route.

/// generateToken: uses the JWT_SECRET (passed in as `secret`) and an
/// input email to generate a signed token. Returns the token string.
pub fn generateToken(
    allocator: std.mem.Allocator,
    secret: []const u8,
    email: []const u8,
) ![]const u8 {
    const now = std.time.timestamp();
    const exp = now + (24 * 60 * 60); // 24 hours

    // Build payload "email|exp"
    var payload_buf: std.ArrayList(u8) = .empty;
    defer payload_buf.deinit(allocator);
    try payload_buf.appendSlice(allocator, email);
    try payload_buf.append(allocator, '|');
    try std.fmt.format(payload_buf.writer(allocator), "{d}", .{exp});

    const payload = payload_buf.items;

    // Compute HMAC-SHA256
    var mac: [32]u8 = undefined;
    crypto.auth.hmac.sha2.HmacSha256.create(&mac, payload, secret);

    // base64url encode payload and mac
    const encoder = base64.url_safe_no_pad.Encoder;

    const payload_b64_len = encoder.calcSize(payload.len);
    const payload_b64 = try allocator.alloc(u8, payload_b64_len);
    defer allocator.free(payload_b64);
    _ = encoder.encode(payload_b64, payload);

    const mac_b64_len = encoder.calcSize(mac.len);
    const mac_b64 = try allocator.alloc(u8, mac_b64_len);
    defer allocator.free(mac_b64);
    _ = encoder.encode(mac_b64, &mac);

    // token = payload_b64 + "." + mac_b64
    var token_buf: std.ArrayList(u8) = .empty;
    errdefer token_buf.deinit(allocator);
    try token_buf.appendSlice(allocator, payload_b64);
    try token_buf.append(allocator, '.');
    try token_buf.appendSlice(allocator, mac_b64);

    return token_buf.toOwnedSlice(allocator);
}

/// verifyToken: uses the same JWT_SECRET (passed in as `secret`),
/// the expected email, and the provided token. Returns true if:
///   - the token structure is valid,
///   - the HMAC matches,
///   - the token has not expired,
///   - and the embedded email matches the expectd email.
pub fn verifyToken(
    allocator: std.mem.Allocator,
    secret: []const u8,
    email: []const u8,
    token: []const u8,
) bool {
    var parts = std.mem.splitScalar(u8, token, '.');
    const payload_b64 = parts.next() orelse return false;
    const mac_b64 = parts.next() orelse return false;
    if (parts.next() != null) return false;

    const decoder = base64.url_safe_no_pad.Decoder;

    const payload_len = decoder.calcSizeForSlice(payload_b64) catch return false;
    const payload = allocator.alloc(u8, payload_len) catch return false;
    decoder.decode(payload, payload_b64) catch {
        allocator.free(payload);
        return false;
    };
    defer allocator.free(payload);

    const mac_len = decoder.calcSizeForSlice(mac_b64) catch return false;
    const mac = allocator.alloc(u8, mac_len) catch return false;
    decoder.decode(mac, mac_b64) catch {
        allocator.free(mac);
        return false;
    };
    defer allocator.free(mac);

    if (mac.len != 32) return false;

    // Recompute HMAC and compare
    var expected_mac: [32]u8 = undefined;
    crypto.auth.hmac.sha2.HmacSha256.create(&expected_mac, payload, secret);
    if (!std.mem.eql(u8, &expected_mac, mac)) return false;

    // Parse "email|exp"
    var it = std.mem.splitScalar(u8, payload, '|');
    const email_part = it.next() orelse return false;
    const exp_part = it.next() orelse return false;
    if (it.next() != null) return false;

    if (!std.mem.eql(u8, email_part, email)) return false;

    const exp = std.fmt.parseInt(i64, exp_part, 10) catch return false;
    const now = std.time.timestamp();
    if (exp < now) return false;

    return true;
}

// --- Tests (most sensitive backend logic: invitation accept/reject) ---

test "invitation generateToken then verifyToken with same email returns true" {
    const allocator = std.testing.allocator;
    const secret = "test-jwt-secret";
    const email = "user@example.com";

    const token = try generateToken(allocator, secret, email);
    defer allocator.free(token);

    try std.testing.expect(verifyToken(allocator, secret, email, token));
}

test "invitation verifyToken with wrong email returns false" {
    const allocator = std.testing.allocator;
    const secret = "test-jwt-secret";
    const email = "user@example.com";

    const token = try generateToken(allocator, secret, email);
    defer allocator.free(token);

    try std.testing.expect(!verifyToken(allocator, secret, "other@example.com", token));
}

test "invitation verifyToken with tampered token returns false" {
    const allocator = std.testing.allocator;
    const secret = "test-jwt-secret";
    const email = "user@example.com";

    const token = try generateToken(allocator, secret, email);
    defer allocator.free(token);

    // Tamper: flip one character in the token
    var buf: [512]u8 = undefined;
    const len = token.len;
    std.mem.copyForwards(u8, buf[0..len], token);
    if (buf[len - 1] == 'a') buf[len - 1] = 'b' else buf[len - 1] = 'a';
    const tampered = buf[0..len];

    try std.testing.expect(!verifyToken(allocator, secret, email, tampered));
}

test "invitation verifyToken with wrong secret returns false" {
    const allocator = std.testing.allocator;
    const secret = "correct-secret";
    const email = "user@example.com";

    const token = try generateToken(allocator, secret, email);
    defer allocator.free(token);

    try std.testing.expect(!verifyToken(allocator, "wrong-secret", email, token));
}
