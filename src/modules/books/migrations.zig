const std = @import("std");
const Database = @import("../../database.zig").Database;

pub fn migrate(db: *Database) !void {
    // Books table
    if (!try db.hasMigration("create_books_table")) {
        try db.execMultiple(
            \\CREATE TABLE IF NOT EXISTS books (
            \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\    name TEXT NOT NULL,
            \\    author INTEGER NOT NULL,
            \\    file_path TEXT NOT NULL UNIQUE,
            \\    isbn TEXT,
            \\    publication_date TEXT,
            \\    publisher TEXT,
            \\    description TEXT,
            \\    page_count INTEGER,
            \\    file_size INTEGER,
            \\    file_format TEXT,
            \\    cover_image_path TEXT,
            \\    status TEXT DEFAULT 'active',
            \\    archived_at DATETIME,
            \\    archive_reason TEXT,
            \\    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            \\    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            \\    FOREIGN KEY (author) REFERENCES authors(id)
            \\)
        );
        try db.recordMigration("create_books_table");
    }

    // Authors table
    if (!try db.hasMigration("create_authors_table")) {
        try db.execMultiple(
            \\CREATE TABLE IF NOT EXISTS authors (
            \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\    name TEXT NOT NULL,
            \\    biography TEXT,
            \\    birth_date TEXT,
            \\    death_date TEXT,
            \\    nationality TEXT,
            \\    image_url TEXT,
            \\    wikipedia_url TEXT,
            \\    goodreads_url TEXT,
            \\    website TEXT,
            \\    aliases TEXT,
            \\    genres TEXT,
            \\    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            \\    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            \\)
        );
        try db.recordMigration("create_authors_table");
    }

    // Tags table
    if (!try db.hasMigration("create_tags_table")) {
        try db.execMultiple(
            \\CREATE TABLE IF NOT EXISTS tags (
            \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\    name TEXT NOT NULL UNIQUE,
            \\    category TEXT NOT NULL,
            \\    description TEXT,
            \\    color TEXT,
            \\    requires_permission TEXT,
            \\    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            \\)
        );
        try db.recordMigration("create_tags_table");
    }

    // Book-tags junction table
    if (!try db.hasMigration("create_book_tags_table")) {
        try db.execMultiple(
            \\CREATE TABLE IF NOT EXISTS book_tags (
            \\    book_id INTEGER NOT NULL,
            \\    tag_id INTEGER NOT NULL,
            \\    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            \\    applied_by INTEGER,
            \\    auto_applied BOOLEAN DEFAULT FALSE,
            \\    PRIMARY KEY (book_id, tag_id),
            \\    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
            \\    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            \\    FOREIGN KEY (applied_by) REFERENCES users(id)
            \\)
        );
        try db.recordMigration("create_book_tags_table");
    }

    // Reading progress table
    if (!try db.hasMigration("create_reading_progress_table")) {
        try db.execMultiple(
            \\CREATE TABLE IF NOT EXISTS reading_progress (
            \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\    user_id INTEGER NOT NULL,
            \\    book_id INTEGER NOT NULL,
            \\    current_page INTEGER DEFAULT 0,
            \\    total_pages INTEGER,
            \\    percentage_complete REAL DEFAULT 0.0,
            \\    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            \\    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            \\    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            \\    UNIQUE(user_id, book_id),
            \\    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            \\    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            \\)
        );
        try db.recordMigration("create_reading_progress_table");
    }
}
