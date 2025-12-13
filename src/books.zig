// Re-export from modules/books for backwards compatibility
const books_migrations = @import("modules/books/migrations.zig");
const books_background = @import("modules/books/background_tasks.zig");

pub const migrate = books_migrations.migrate;
pub const createBackgroundTimerManager = books_background.createBackgroundTimerManager;
pub const BooksTimerManager = books_background.BooksTimerManager;
