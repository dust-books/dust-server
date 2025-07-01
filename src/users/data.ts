import type { Database } from "../../database.ts";
import type { User, UserWithId } from "./user.ts";
import type { Role, Permission, UserRole, RolePermission, UserPermission } from "./permissions.ts";

export type { Permission, Role };

class NoValidTokenError extends Error {}
class ExpiredTokenError extends Error {}

export const migrate = (database: Database) => {
    return database.migrate([
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
            session_token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            user_id INTEGER
        )`,
        `CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            resource_type TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS user_roles (
            user_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, role_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (role_id) REFERENCES roles(id)
        )`,
        `CREATE TABLE IF NOT EXISTS role_permissions (
            role_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            PRIMARY KEY (role_id, permission_id),
            FOREIGN KEY (role_id) REFERENCES roles(id),
            FOREIGN KEY (permission_id) REFERENCES permissions(id)
        )`,
        `CREATE TABLE IF NOT EXISTS user_permissions (
            user_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            resource_id INTEGER,
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, permission_id, resource_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (permission_id) REFERENCES permissions(id)
        )`
    ])
}

export const getAllUsers = (database: Database) => {
    return database.execute(`
        SELECT display_name, email FROM users;
    `);
}

export const getUser = async (database: Database, id: string): Promise<UserWithId> => {
    const results = await database.execute({
        sql: "SELECT * FROM users where id = $id",
        args: { id }
    });

    return {
        email: results.rows[0]["email"],
        password: results.rows[0]["password"],
        displayName: results.rows[0]["display_name"],
        id: results.rows[0]["id"]
    } as UserWithId;
}

export const getUserByEmail = async (database: Database, email: string): Promise<UserWithId> => {
    const results = await database.execute({
        sql: "SELECT * FROM users where email = $email",
        args: { email }
    });

    return {
        email: results.rows[0]["email"],
        password: results.rows[0]["password"],
        displayName: results.rows[0]["display_name"],
        id: results.rows[0]["id"]
    } as UserWithId;
}

export const addUser = (database: Database, user: User) => {
    return database.execute({
        sql: `
        INSERT INTO users (username, display_name, email, password) VALUES ($username, $display, $email, $password) 
    `, args: {
            username: user.username,
            display: user.displayName,
            email: user.email,
            // This _SHOULD_ be encrypted by this point
            password: user.password
        }
    });
}

export const createSession = (database: Database, user: UserWithId, token: string) => {
    const expires = new Date();
    // expires after 24 hours
    expires.setDate(expires.getDate() + 1);
    return database.execute({
        sql: `
        INSERT INTO sessions (session_token, expires_at, user_id) VALUES ($token, $expires_at, $user) 
    `, args: {
            token,
            expires_at: expires.toISOString(),
            user: user.id
        }
    });
}

export const getUserIdFromSession = async (database: Database, token: string): Promise<number> => {
    const result = await database.execute({
        sql: `
        SELECT * FROM sessions WHERE session_token = $token
    `, args: {
            token,
        }
    });

    if (result.rows.length <= 0) {
        throw new NoValidTokenError();
    }

    const expiresAt = new Date(result.rows[0]['expires_at'] as string);
    if (expiresAt.getMilliseconds() <= new Date().getMilliseconds()) {
        throw new ExpiredTokenError();
    }

    return result.rows[0]['user_id'] as number;
}

// Role management functions
export const createRole = (database: Database, name: string, description?: string) => {
    return database.execute({
        sql: `INSERT INTO roles (name, description) VALUES ($name, $description)`,
        args: { name, description: description || null }
    });
}

export const getRole = async (database: Database, id: number): Promise<Role> => {
    const result = await database.execute({
        sql: `SELECT * FROM roles WHERE id = $id`,
        args: { id }
    });
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        name: row.name as string,
        description: row.description as string
    };
}

export const getRoleByName = async (database: Database, name: string): Promise<Role> => {
    const result = await database.execute({
        sql: `SELECT * FROM roles WHERE name = $name`,
        args: { name }
    });
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        name: row.name as string,
        description: row.description as string
    };
}

// Permission management functions
export const createPermission = (database: Database, name: string, resource_type: string, description?: string) => {
    return database.execute({
        sql: `INSERT INTO permissions (name, resource_type, description) VALUES ($name, $resource_type, $description)`,
        args: { name, resource_type, description: description || null }
    });
}

export const getPermission = async (database: Database, id: number): Promise<Permission> => {
    const result = await database.execute({
        sql: `SELECT * FROM permissions WHERE id = $id`,
        args: { id }
    });
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        name: row.name as string,
        resource_type: row.resource_type as string,
        description: row.description as string
    };
}

// User role assignment
export const assignUserRole = (database: Database, user_id: number, role_id: number) => {
    return database.execute({
        sql: `INSERT INTO user_roles (user_id, role_id) VALUES ($user_id, $role_id)`,
        args: { user_id, role_id }
    });
}

export const removeUserRole = (database: Database, user_id: number, role_id: number) => {
    return database.execute({
        sql: `DELETE FROM user_roles WHERE user_id = $user_id AND role_id = $role_id`,
        args: { user_id, role_id }
    });
}

export const getUserRoles = async (database: Database, user_id: number): Promise<Role[]> => {
    const result = await database.execute({
        sql: `
            SELECT r.* FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $user_id
        `,
        args: { user_id }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        description: row.description as string
    }));
}

export const getUserPermissions = async (database: Database, user_id: number): Promise<Permission[]> => {
    const result = await database.execute({
        sql: `
            SELECT DISTINCT p.* FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = $user_id
            UNION
            SELECT p.* FROM permissions p
            JOIN user_permissions up ON p.id = up.permission_id
            WHERE up.user_id = $user_id
        `,
        args: { user_id }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        resource_type: row.resource_type as string,
        description: row.description as string
    }));
}

// Role permission assignment
export const assignRolePermission = (database: Database, role_id: number, permission_id: number) => {
    return database.execute({
        sql: `INSERT INTO role_permissions (role_id, permission_id) VALUES ($role_id, $permission_id)`,
        args: { role_id, permission_id }
    });
}

// Check if user has permission
export const userHasPermission = async (database: Database, user_id: number, permission_name: string, resource_id?: number): Promise<boolean> => {
    // Check direct user permissions
    let directPermResult;
    if (resource_id !== undefined) {
        directPermResult = await database.execute({
            sql: `
                SELECT 1 FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = $user_id 
                AND p.name = $permission_name
                AND (up.resource_id = $resource_id OR up.resource_id IS NULL)
            `,
            args: { user_id, permission_name, resource_id }
        });
    } else {
        directPermResult = await database.execute({
            sql: `
                SELECT 1 FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = $user_id 
                AND p.name = $permission_name
                AND up.resource_id IS NULL
            `,
            args: { user_id, permission_name }
        });
    }

    if (directPermResult.rows.length > 0) {
        return true;
    }

    // Check role-based permissions
    const rolePermResult = await database.execute({
        sql: `
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = $user_id 
            AND p.name = $permission_name
        `,
        args: { user_id, permission_name }
    });

    return rolePermResult.rows.length > 0;
}

// Additional user management functions

export const getUserById = async (database: Database, id: number): Promise<UserWithId | null> => {
    const result = await database.execute({
        sql: `SELECT * FROM users WHERE id = $id`,
        args: { id }
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        username: row.username as string || row.display_name as string,
        displayName: row.display_name as string,
        display_name: row.display_name as string,
        email: row.email as string,
        password: row.password as string,
        is_active: Boolean(row.is_active),
        created_at: row.created_at as string
    };
}

export const createUser = (database: Database, user: {
    username: string;
    email: string;
    password_hash: string;
    display_name?: string;
    is_active?: boolean;
}) => {
    return database.execute({
        sql: `INSERT INTO users (username, email, password, display_name, is_active, created_at) 
              VALUES ($username, $email, $password, $display_name, $is_active, CURRENT_TIMESTAMP) RETURNING *`,
        args: {
            username: user.username,
            email: user.email,
            password: user.password_hash,
            display_name: user.display_name || user.username,
            is_active: user.is_active ?? true
        }
    });
}

export const updateUser = (database: Database, id: number, updates: {
    username?: string;
    email?: string;
    display_name?: string;
    is_active?: boolean;
}) => {
    const setParts = [];
    const args: Record<string, any> = { id };
    
    if (updates.username !== undefined) {
        setParts.push("username = $username");
        args.username = updates.username;
    }
    if (updates.email !== undefined) {
        setParts.push("email = $email");
        args.email = updates.email;
    }
    if (updates.display_name !== undefined) {
        setParts.push("display_name = $display_name");
        args.display_name = updates.display_name;
    }
    if (updates.is_active !== undefined) {
        setParts.push("is_active = $is_active");
        args.is_active = updates.is_active;
    }
    
    if (setParts.length === 0) {
        throw new Error("No updates provided");
    }
    
    return database.execute({
        sql: `UPDATE users SET ${setParts.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $id`,
        args
    });
}

export const getAllRoles = async (database: Database): Promise<Role[]> => {
    const result = await database.execute({
        sql: `SELECT * FROM roles ORDER BY name`,
        args: {}
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        description: row.description as string,
        created_at: row.created_at as string
    }));
}

export const updateRole = (database: Database, id: number, updates: {
    name?: string;
    description?: string;
}) => {
    const setParts = [];
    const args: Record<string, any> = { id };
    
    if (updates.name !== undefined) {
        setParts.push("name = $name");
        args.name = updates.name;
    }
    if (updates.description !== undefined) {
        setParts.push("description = $description");
        args.description = updates.description;
    }
    
    if (setParts.length === 0) {
        throw new Error("No updates provided");
    }
    
    return database.execute({
        sql: `UPDATE roles SET ${setParts.join(", ")} WHERE id = $id`,
        args
    });
}

export const deleteRole = (database: Database, id: number) => {
    return database.execute({
        sql: `DELETE FROM roles WHERE id = $id`,
        args: { id }
    });
}

export const getRolePermissions = async (database: Database, role_id: number): Promise<Permission[]> => {
    const result = await database.execute({
        sql: `
            SELECT p.* FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = $role_id
            ORDER BY p.name
        `,
        args: { role_id }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        resource_type: row.resource_type as string,
        description: row.description as string,
        created_at: row.created_at as string
    }));
}

export const removeRolePermission = (database: Database, role_id: number, permission_id: number) => {
    return database.execute({
        sql: `DELETE FROM role_permissions WHERE role_id = $role_id AND permission_id = $permission_id`,
        args: { role_id, permission_id }
    });
}

export const getAllPermissions = async (database: Database): Promise<Permission[]> => {
    const result = await database.execute({
        sql: `SELECT * FROM permissions ORDER BY resource_type, name`,
        args: {}
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        resource_type: row.resource_type as string,
        description: row.description as string,
        created_at: row.created_at as string
    }));
}

export const getPermissionByName = async (database: Database, name: string): Promise<Permission | null> => {
    const result = await database.execute({
        sql: `SELECT * FROM permissions WHERE name = $name`,
        args: { name }
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        name: row.name as string,
        resource_type: row.resource_type as string,
        description: row.description as string,
        created_at: row.created_at as string
    };
}

export const getUsersWithRole = async (database: Database, role_id: number): Promise<UserWithId[]> => {
    const result = await database.execute({
        sql: `
            SELECT u.* FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            WHERE ur.role_id = $role_id
            ORDER BY u.username
        `,
        args: { role_id }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        username: row.username as string || row.display_name as string,
        displayName: row.display_name as string,
        display_name: row.display_name as string,
        email: row.email as string,
        password: row.password as string,
        is_active: Boolean(row.is_active),
        created_at: row.created_at as string
    }));
}