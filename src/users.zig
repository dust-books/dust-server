// Re-export from the actual users module
const users_module = @import("modules/users/migrations.zig");

pub const migrate = users_module.migrate;
