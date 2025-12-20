const std = @import("std");

pub const ValidationError = error{
    MissingField,
    InvalidType,
    InvalidFormat,
};

/// Check if a JSON object has a specific field
pub fn hasField(object: std.json.Value, field: []const u8) bool {
    return switch (object) {
        .object => |obj| obj.contains(field),
        else => false,
    };
}

/// Get string field from JSON object, or null if not present or wrong type
pub fn getString(object: std.json.Value, field: []const u8) ?[]const u8 {
    if (!hasField(object, field)) return null;
    const obj = object.object;
    const value = obj.get(field) orelse return null;
    return switch (value) {
        .string => |s| s,
        else => null,
    };
}

/// Get integer field from JSON object, or null if not present or wrong type
pub fn getInt(object: std.json.Value, field: []const u8) ?i64 {
    if (!hasField(object, field)) return null;
    const obj = object.object;
    const value = obj.get(field) orelse return null;
    return switch (value) {
        .integer => |i| i,
        else => null,
    };
}

/// Get boolean field from JSON object, or null if not present or wrong type
pub fn getBool(object: std.json.Value, field: []const u8) ?bool {
    if (!hasField(object, field)) return null;
    const obj = object.object;
    const value = obj.get(field) orelse return null;
    return switch (value) {
        .bool => |b| b,
        else => null,
    };
}

/// Validate sign-in payload
pub fn validateSignIn(payload: std.json.Value) bool {
    if (payload != .object) return false;

    if (!hasField(payload, "email")) return false;
    if (!hasField(payload, "password")) return false;

    return true;
}

/// Validate sign-up payload
pub fn validateSignUp(payload: std.json.Value) bool {
    if (payload != .object) return false;

    // Check for display_name or displayName (both formats supported)
    const has_display = hasField(payload, "display_name") or hasField(payload, "displayName");
    if (!has_display) return false;

    if (!hasField(payload, "email")) return false;
    if (!hasField(payload, "password")) return false;

    return true;
}

/// Simple email format validation
pub fn validateEmail(email: []const u8) bool {
    if (email.len == 0) return false;

    var has_at = false;
    var has_dot_after_at = false;
    var at_pos: usize = 0;

    for (email, 0..) |c, i| {
        if (c == '@') {
            if (has_at) return false; // Multiple @
            has_at = true;
            at_pos = i;
            if (i == 0 or i == email.len - 1) return false; // @ at start or end
        } else if (has_at and c == '.') {
            if (i > at_pos + 1) { // Dot must be after @ with at least one char between
                has_dot_after_at = true;
            }
        }
    }

    return has_at and has_dot_after_at;
}

test "validateEmail" {
    try std.testing.expect(validateEmail("test@example.com"));
    try std.testing.expect(validateEmail("user@domain.co.uk"));
    try std.testing.expect(!validateEmail("invalid"));
    try std.testing.expect(!validateEmail("@example.com"));
    try std.testing.expect(!validateEmail("test@"));
    try std.testing.expect(!validateEmail("test@@example.com"));
}

test "validateSignIn" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const valid_json = try std.json.parseFromSlice(std.json.Value, allocator,
        \\{"email":"test@example.com","password":"secret"}
    , .{});
    defer valid_json.deinit();

    try std.testing.expect(validateSignIn(valid_json.value));

    const invalid_json = try std.json.parseFromSlice(std.json.Value, allocator,
        \\{"email":"test@example.com"}
    , .{});
    defer invalid_json.deinit();

    try std.testing.expect(!validateSignIn(invalid_json.value));
}

test "validateSignUp" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const valid_json = try std.json.parseFromSlice(std.json.Value, allocator,
        \\{"email":"test@example.com","password":"secret","display_name":"Test User"}
    , .{});
    defer valid_json.deinit();

    try std.testing.expect(validateSignUp(valid_json.value));

    const valid_json2 = try std.json.parseFromSlice(std.json.Value, allocator,
        \\{"email":"test@example.com","password":"secret","displayName":"Test User"}
    , .{});
    defer valid_json2.deinit();

    try std.testing.expect(validateSignUp(valid_json2.value));

    const invalid_json = try std.json.parseFromSlice(std.json.Value, allocator,
        \\{"email":"test@example.com","password":"secret"}
    , .{});
    defer invalid_json.deinit();

    try std.testing.expect(!validateSignUp(invalid_json.value));
}
