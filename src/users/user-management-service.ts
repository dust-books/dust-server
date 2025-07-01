import type { Database } from "../../database.ts";
import * as userData from "./data.ts";
import { PermissionService } from "./permission-service.ts";
import { PERMISSIONS, type PermissionName } from "./permissions.ts";

export interface CreateUserRequest {
    username: string;
    email: string;
    password: string;
    display_name?: string;
    roles?: string[]; // Role names to assign
}

export interface UpdateUserRequest {
    username?: string;
    email?: string;
    display_name?: string;
    is_active?: boolean;
    roles?: string[]; // Complete list of role names (replaces existing)
}

export interface UserWithRoles {
    id: number;
    username: string;
    email: string;
    display_name: string;
    is_active: boolean;
    created_at: string;
    roles: string[];
    permissions: string[];
}

export interface RoleWithPermissions {
    id: number;
    name: string;
    description: string;
    created_at: string;
    permissions: string[];
}

export class UserManagementService {
    private permissionService: PermissionService;

    constructor(private database: Database) {
        this.permissionService = new PermissionService(database);
    }

    /**
     * Get all users with their roles and permissions
     */
    async getAllUsers(): Promise<UserWithRoles[]> {
        const usersResult = await userData.getAllUsers(this.database);
        const users = usersResult.rows.map(row => ({
            id: row.id as number,
            username: row.username as string || row.display_name as string,
            email: row.email as string,
            display_name: row.display_name as string,
            is_active: Boolean(row.is_active),
            created_at: row.created_at as string
        }));
        const result: UserWithRoles[] = [];

        for (const user of users) {
            const roles = await userData.getUserRoles(this.database, user.id);
            const permissions = await this.getUserPermissions(user.id);
            
            result.push({
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name || user.username,
                is_active: user.is_active ?? true,
                created_at: user.created_at || '',
                roles: roles.map(r => r.name),
                permissions: permissions
            });
        }

        return result;
    }

    /**
     * Get a specific user with roles and permissions
     */
    async getUserById(userId: number): Promise<UserWithRoles | null> {
        const user = await userData.getUserById(this.database, userId);
        if (!user) return null;

        const roles = await userData.getUserRoles(this.database, userId);
        const permissions = await this.getUserPermissions(userId);

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name || user.username,
            is_active: user.is_active ?? true,
            created_at: user.created_at || '',
            roles: roles.map(r => r.name),
            permissions: permissions
        };
    }

    /**
     * Create a new user with optional role assignments
     */
    async createUser(request: CreateUserRequest): Promise<UserWithRoles> {
        // Hash password (placeholder - in real implementation, use bcrypt)
        const hashedPassword = await this.hashPassword(request.password);

        // Create user
        const result = await userData.createUser(this.database, {
            username: request.username,
            email: request.email,
            password_hash: hashedPassword,
            display_name: request.display_name || request.username
        });

        const userId = result.rows[0].id as number;

        // Assign roles if specified
        if (request.roles && request.roles.length > 0) {
            await this.assignRolesToUser(userId, request.roles);
        } else {
            // Assign default 'user' role
            await this.assignRolesToUser(userId, ['user']);
        }

        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error("Failed to create user");
        }

        return user;
    }

    /**
     * Update an existing user
     */
    async updateUser(userId: number, request: UpdateUserRequest): Promise<UserWithRoles> {
        const existingUser = await userData.getUserById(this.database, userId);
        if (!existingUser) {
            throw new Error("User not found");
        }

        // Update user basic info
        if (request.username || request.email || request.display_name || request.is_active !== undefined) {
            await userData.updateUser(this.database, userId, {
                username: request.username,
                email: request.email,
                display_name: request.display_name,
                is_active: request.is_active
            });
        }

        // Update roles if specified (replace all existing roles)
        if (request.roles !== undefined) {
            // Remove all existing roles
            const currentRoles = await userData.getUserRoles(this.database, userId);
            for (const role of currentRoles) {
                await userData.removeUserRole(this.database, userId, role.id);
            }

            // Assign new roles
            if (request.roles.length > 0) {
                await this.assignRolesToUser(userId, request.roles);
            }
        }

        const updatedUser = await this.getUserById(userId);
        if (!updatedUser) {
            throw new Error("Failed to update user");
        }

        return updatedUser;
    }

    /**
     * Delete a user (soft delete by setting is_active = false)
     */
    async deleteUser(userId: number): Promise<void> {
        await userData.updateUser(this.database, userId, {
            is_active: false
        });
    }

    /**
     * Get all roles with their permissions
     */
    async getAllRoles(): Promise<RoleWithPermissions[]> {
        const roles = await userData.getAllRoles(this.database);
        const result: RoleWithPermissions[] = [];

        for (const role of roles) {
            const permissions = await userData.getRolePermissions(this.database, role.id);
            
            result.push({
                id: role.id,
                name: role.name,
                description: role.description || '',
                created_at: role.created_at || '',
                permissions: permissions.map(p => p.name)
            });
        }

        return result;
    }

    /**
     * Create a new role with permissions
     */
    async createRole(name: string, description?: string, permissions?: PermissionName[]): Promise<RoleWithPermissions> {
        const result = await userData.createRole(this.database, name, description);
        const roleId = result.rows[0].id as number;

        // Assign permissions if specified
        if (permissions && permissions.length > 0) {
            await this.assignPermissionsToRole(roleId, permissions);
        }

        const role = await this.getRoleById(roleId);
        if (!role) {
            throw new Error("Failed to create role");
        }

        return role;
    }

    /**
     * Update a role and its permissions
     */
    async updateRole(roleId: number, name?: string, description?: string, permissions?: PermissionName[]): Promise<RoleWithPermissions> {
        // Update role info
        if (name || description !== undefined) {
            await userData.updateRole(this.database, roleId, { name, description });
        }

        // Update permissions if specified (replace all existing permissions)
        if (permissions !== undefined) {
            // Remove all existing permissions
            const currentPermissions = await userData.getRolePermissions(this.database, roleId);
            for (const permission of currentPermissions) {
                await userData.removeRolePermission(this.database, roleId, permission.id);
            }

            // Assign new permissions
            if (permissions.length > 0) {
                await this.assignPermissionsToRole(roleId, permissions);
            }
        }

        const updatedRole = await this.getRoleById(roleId);
        if (!updatedRole) {
            throw new Error("Failed to update role");
        }

        return updatedRole;
    }

    /**
     * Delete a role
     */
    async deleteRole(roleId: number): Promise<void> {
        // First check if any users have this role
        const usersWithRole = await userData.getUsersWithRole(this.database, roleId);
        if (usersWithRole.length > 0) {
            throw new Error(`Cannot delete role: ${usersWithRole.length} users are assigned to this role`);
        }

        await userData.deleteRole(this.database, roleId);
    }

    /**
     * Get all available permissions
     */
    async getAllPermissions(): Promise<userData.Permission[]> {
        return await userData.getAllPermissions(this.database);
    }

    // Helper methods

    private async getRoleById(roleId: number): Promise<RoleWithPermissions | null> {
        const role = await userData.getRole(this.database, roleId);
        if (!role) return null;

        const permissions = await userData.getRolePermissions(this.database, roleId);

        return {
            id: role.id,
            name: role.name,
            description: role.description || '',
            created_at: role.created_at || '',
            permissions: permissions.map(p => p.name)
        };
    }

    private async assignRolesToUser(userId: number, roleNames: string[]): Promise<void> {
        for (const roleName of roleNames) {
            const role = await userData.getRoleByName(this.database, roleName);
            if (role) {
                await userData.assignUserRole(this.database, userId, role.id);
            } else {
                console.warn(`Role "${roleName}" not found, skipping assignment`);
            }
        }
    }

    private async assignPermissionsToRole(roleId: number, permissionNames: PermissionName[]): Promise<void> {
        for (const permissionName of permissionNames) {
            const permission = await userData.getPermissionByName(this.database, permissionName);
            if (permission) {
                await userData.assignRolePermission(this.database, roleId, permission.id);
            } else {
                console.warn(`Permission "${permissionName}" not found, skipping assignment`);
            }
        }
    }

    private async getUserPermissions(userId: number): Promise<string[]> {
        const roles = await userData.getUserRoles(this.database, userId);
        const allPermissions = new Set<string>();

        for (const role of roles) {
            const permissions = await userData.getRolePermissions(this.database, role.id);
            permissions.forEach(p => allPermissions.add(p.name));
        }

        return Array.from(allPermissions);
    }

    private async hashPassword(password: string): Promise<string> {
        // Placeholder implementation - in production, use bcrypt or similar
        // For now, just return the password as-is (NOT SECURE)
        console.warn("WARNING: Password hashing not implemented - using plaintext passwords");
        return password;
    }

    /**
     * Check if a user is an admin (has ADMIN_FULL permission)
     */
    async isUserAdmin(userId: number): Promise<boolean> {
        return await this.permissionService.userHasPermission(userId, PERMISSIONS.ADMIN_FULL);
    }

    /**
     * Get user statistics for admin dashboard
     */
    async getUserStats(): Promise<{
        totalUsers: number;
        activeUsers: number;
        adminUsers: number;
        recentUsers: UserWithRoles[];
    }> {
        const allUsers = await this.getAllUsers();
        const activeUsers = allUsers.filter(u => u.is_active);
        const adminUsers = [];

        // Check which users have admin permissions
        for (const user of activeUsers) {
            if (user.permissions.includes(PERMISSIONS.ADMIN_FULL) || 
                user.permissions.includes(PERMISSIONS.USERS_MANAGE)) {
                adminUsers.push(user);
            }
        }

        // Get recent users (last 10, sorted by creation date)
        const recentUsers = allUsers
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10);

        return {
            totalUsers: allUsers.length,
            activeUsers: activeUsers.length,
            adminUsers: adminUsers.length,
            recentUsers: recentUsers
        };
    }
}