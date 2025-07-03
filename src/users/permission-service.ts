import type { Database } from "../../database.ts";
import * as userData from "./data.ts";
import { PERMISSIONS, ROLES, RESOURCE_TYPES, type PermissionName, type RoleName } from "./permissions.ts";

export class PermissionService {
    constructor(private database: Database) {}

    async initializeDefaultRolesAndPermissions(): Promise<void> {
        await this.createDefaultRoles();
        await this.createDefaultPermissions();
        await this.assignDefaultRolePermissions();
    }

    private async createDefaultRoles(): Promise<void> {
        const defaultRoles = [
            { name: ROLES.ADMIN, description: "Full system administrator access" },
            { name: ROLES.LIBRARIAN, description: "Can manage books and users but not system settings" },
            { name: ROLES.USER, description: "Can read books and manage own progress" },
            { name: ROLES.GUEST, description: "Limited read-only access" }
        ];

        for (const role of defaultRoles) {
            try {
                await userData.createRole(this.database, role.name, role.description);
            } catch (error) {
                // Role might already exist, continue
                // Role already exists, skipping (this is normal)
            }
        }
    }

    private async createDefaultPermissions(): Promise<void> {
        const defaultPermissions = [
            // Books permissions
            { name: PERMISSIONS.BOOKS_READ, resource_type: RESOURCE_TYPES.BOOK, description: "Read books" },
            { name: PERMISSIONS.BOOKS_WRITE, resource_type: RESOURCE_TYPES.BOOK, description: "Add/edit books" },
            { name: PERMISSIONS.BOOKS_DELETE, resource_type: RESOURCE_TYPES.BOOK, description: "Delete books" },
            { name: PERMISSIONS.BOOKS_MANAGE, resource_type: RESOURCE_TYPES.BOOK, description: "Full book management" },
            
            // Genres permissions
            { name: PERMISSIONS.GENRES_READ, resource_type: RESOURCE_TYPES.GENRE, description: "Read genres" },
            { name: PERMISSIONS.GENRES_WRITE, resource_type: RESOURCE_TYPES.GENRE, description: "Add/edit genres" },
            { name: PERMISSIONS.GENRES_MANAGE, resource_type: RESOURCE_TYPES.GENRE, description: "Full genre management" },
            
            // Users permissions
            { name: PERMISSIONS.USERS_READ, resource_type: RESOURCE_TYPES.USER, description: "View user information" },
            { name: PERMISSIONS.USERS_WRITE, resource_type: RESOURCE_TYPES.USER, description: "Add/edit users" },
            { name: PERMISSIONS.USERS_DELETE, resource_type: RESOURCE_TYPES.USER, description: "Delete users" },
            { name: PERMISSIONS.USERS_MANAGE, resource_type: RESOURCE_TYPES.USER, description: "Full user management" },
            
            // Admin permissions
            { name: PERMISSIONS.ADMIN_FULL, resource_type: RESOURCE_TYPES.SYSTEM, description: "Full administrative access" },
            { name: PERMISSIONS.ADMIN_USERS, resource_type: RESOURCE_TYPES.USER, description: "User administration" },
            { name: PERMISSIONS.ADMIN_ROLES, resource_type: RESOURCE_TYPES.SYSTEM, description: "Role administration" },
            
            // System permissions
            { name: PERMISSIONS.SYSTEM_ADMIN, resource_type: RESOURCE_TYPES.SYSTEM, description: "System administration" },
            { name: PERMISSIONS.SYSTEM_CONFIG, resource_type: RESOURCE_TYPES.SYSTEM, description: "System configuration" },
            
            // Content filtering permissions (for your vision)
            { name: PERMISSIONS.CONTENT_NSFW, resource_type: RESOURCE_TYPES.CONTENT, description: "Access NSFW content" },
            { name: PERMISSIONS.CONTENT_RESTRICTED, resource_type: RESOURCE_TYPES.CONTENT, description: "Access restricted content" }
        ];

        for (const permission of defaultPermissions) {
            try {
                await userData.createPermission(this.database, permission.name, permission.resource_type, permission.description);
            } catch (error) {
                // Permission might already exist, continue
                // Permission already exists, skipping (this is normal)
            }
        }
    }

    private async assignDefaultRolePermissions(): Promise<void> {
        try {
            const adminRole = await userData.getRoleByName(this.database, ROLES.ADMIN);
            const librarianRole = await userData.getRoleByName(this.database, ROLES.LIBRARIAN);
            const userRole = await userData.getRoleByName(this.database, ROLES.USER);
            const guestRole = await userData.getRoleByName(this.database, ROLES.GUEST);

            // Get all permissions to assign
            const allPermissions = Object.values(PERMISSIONS);
            
            // Admin gets everything
            for (const permName of allPermissions) {
                const perm = await this.getPermissionByName(permName);
                try {
                    await userData.assignRolePermission(this.database, adminRole.id, perm.id);
                } catch (error) {
                    // Assignment might already exist
                }
            }

            // Librarian gets most things except system admin
            const librarianPermissions = [
                PERMISSIONS.BOOKS_READ, PERMISSIONS.BOOKS_WRITE, PERMISSIONS.BOOKS_DELETE, PERMISSIONS.BOOKS_MANAGE,
                PERMISSIONS.GENRES_READ, PERMISSIONS.GENRES_WRITE, PERMISSIONS.GENRES_MANAGE,
                PERMISSIONS.USERS_READ, PERMISSIONS.USERS_WRITE,
                PERMISSIONS.CONTENT_NSFW, PERMISSIONS.CONTENT_RESTRICTED
            ];
            
            for (const permName of librarianPermissions) {
                const perm = await this.getPermissionByName(permName);
                try {
                    await userData.assignRolePermission(this.database, librarianRole.id, perm.id);
                } catch (error) {
                    // Assignment might already exist
                }
            }

            // User gets basic read access
            const userPermissions = [
                PERMISSIONS.BOOKS_READ,
                PERMISSIONS.GENRES_READ
            ];
            
            for (const permName of userPermissions) {
                const perm = await this.getPermissionByName(permName);
                try {
                    await userData.assignRolePermission(this.database, userRole.id, perm.id);
                } catch (error) {
                    // Assignment might already exist
                }
            }

            // Guest gets very limited access
            const guestPermissions = [
                PERMISSIONS.BOOKS_READ
            ];
            
            for (const permName of guestPermissions) {
                const perm = await this.getPermissionByName(permName);
                try {
                    await userData.assignRolePermission(this.database, guestRole.id, perm.id);
                } catch (error) {
                    // Assignment might already exist
                }
            }

        } catch (error) {
            console.error("Error assigning default role permissions:", error);
        }
    }

    private async getPermissionByName(name: PermissionName) {
        const result = await this.database.execute({
            sql: `SELECT * FROM permissions WHERE name = $name`,
            args: { name }
        });
        
        if (result.rows.length === 0) {
            throw new Error(`Permission '${name}' not found`);
        }
        
        const row = result.rows[0];
        return {
            id: row.id as number,
            name: row.name as string,
            resource_type: row.resource_type as string,
            description: row.description as string
        };
    }

    async assignUserRole(user_id: number, role_name: RoleName): Promise<void> {
        const role = await userData.getRoleByName(this.database, role_name);
        await userData.assignUserRole(this.database, user_id, role.id);
    }

    async removeUserRole(user_id: number, role_name: RoleName): Promise<void> {
        const role = await userData.getRoleByName(this.database, role_name);
        await userData.removeUserRole(this.database, user_id, role.id);
    }

    async userHasPermission(user_id: number, permission: PermissionName, resource_id?: number): Promise<boolean> {
        return await userData.userHasPermission(this.database, user_id, permission, resource_id);
    }

    async getUserRoles(user_id: number) {
        return await userData.getUserRoles(this.database, user_id);
    }

    async getUserPermissions(user_id: number) {
        return await userData.getUserPermissions(this.database, user_id);
    }
}