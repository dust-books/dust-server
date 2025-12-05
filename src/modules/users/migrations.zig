const std = @import("std");
const Database = @import("../../database.zig").Database;

pub fn migrate(db: *Database) !void {
    // Migration 1: Create users table
    if (!try db.hasMigration("001_create_users")) {
        try db.execMultiple(
            \\CREATE TABLE users (
            \\  id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\  email TEXT NOT NULL UNIQUE,
            \\  username TEXT,
            \\  password_hash TEXT NOT NULL,
            \\  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \\  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            \\);
            \\
            \\CREATE INDEX idx_users_email ON users(email);
        );
        try db.recordMigration("001_create_users");
    }

    // Migration 2: Create roles table
    if (!try db.hasMigration("002_create_roles")) {
        try db.execMultiple(
            \\CREATE TABLE roles (
            \\  id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\  name TEXT NOT NULL UNIQUE,
            \\  description TEXT,
            \\  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            \\)
        );
        try db.execMultiple("INSERT INTO roles (name, description) VALUES ('admin', 'Administrator with full access')");
        try db.execMultiple("INSERT INTO roles (name, description) VALUES ('user', 'Regular user with basic access')");
        try db.execMultiple("INSERT INTO roles (name, description) VALUES ('guest', 'Guest with limited access')");
        try db.recordMigration("002_create_roles");
    }

    // Migration 3: Create permissions table
    if (!try db.hasMigration("003_create_permissions")) {
        try db.execMultiple(
            \\CREATE TABLE permissions (
            \\  id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\  name TEXT NOT NULL UNIQUE,
            \\  description TEXT,
            \\  resource TEXT NOT NULL,
            \\  action TEXT NOT NULL,
            \\  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            \\);
            \\
            \\CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
        );

        // Seed default permissions
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('books.read', 'book', 'read', 'Read books')");
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('books.write', 'book', 'write', 'Create and edit books')");
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('books.delete', 'book', 'delete', 'Delete books')");
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('users.read', 'user', 'read', 'View users')");
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('users.write', 'user', 'write', 'Create and edit users')");
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('users.manage', 'user', 'manage', 'Manage user roles and permissions')");
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('admin.full', 'system', 'admin', 'Full administrative access')");
        try db.execMultiple("INSERT INTO permissions (name, resource, action, description) VALUES ('system.admin', 'system', 'admin', 'System administration')");

        try db.recordMigration("003_create_permissions");
    }

    // Migration 4: Create role_permissions junction table
    if (!try db.hasMigration("004_create_role_permissions")) {
        try db.execMultiple(
            \\CREATE TABLE role_permissions (
            \\  role_id INTEGER NOT NULL,
            \\  permission_id INTEGER NOT NULL,
            \\  PRIMARY KEY (role_id, permission_id),
            \\  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
            \\  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            \\);
        );

        // Assign all permissions to admin role (role_id = 1)
        try db.execMultiple("INSERT INTO role_permissions (role_id, permission_id) SELECT 1, id FROM permissions");

        // Assign read permissions to user role (role_id = 2)
        try db.execMultiple("INSERT INTO role_permissions (role_id, permission_id) SELECT 2, id FROM permissions WHERE name LIKE '%.read'");

        try db.recordMigration("004_create_role_permissions");
    }

    // Migration 5: Create user_roles junction table
    if (!try db.hasMigration("005_create_user_roles")) {
        try db.execMultiple(
            \\CREATE TABLE user_roles (
            \\  user_id INTEGER NOT NULL,
            \\  role_id INTEGER NOT NULL,
            \\  PRIMARY KEY (user_id, role_id),
            \\  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            \\  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            \\);
        );
        try db.recordMigration("005_create_user_roles");
    }

    // Migration 6: Create sessions table (for JWT tracking)
    if (!try db.hasMigration("006_create_sessions")) {
        try db.execMultiple(
            \\CREATE TABLE sessions (
            \\  id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\  user_id INTEGER NOT NULL,
            \\  token TEXT NOT NULL UNIQUE,
            \\  expires_at TIMESTAMP NOT NULL,
            \\  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \\  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            \\);
            \\
            \\CREATE INDEX idx_sessions_token ON sessions(token);
            \\CREATE INDEX idx_sessions_user_id ON sessions(user_id);
        );
        try db.recordMigration("006_create_sessions");
    }

    // Migration 7: Add is_admin field to users table
    if (!try db.hasMigration("007_add_is_admin_to_users")) {
        try db.execMultiple("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0 NOT NULL");
        try db.recordMigration("007_add_is_admin_to_users");
    }

    std.log.info("Users module migrations complete\n", .{});
}
