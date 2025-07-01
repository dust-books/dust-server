import type { Context, Next, RouterContext } from "@oak/oak";
import { createHttpError } from "@oak/oak";
import type { Database } from "../../database.ts";
import { PermissionService } from "./permission-service.ts";
import { type PermissionName } from "./permissions.ts";

export interface AuthenticatedState {
  user?: {
    id: number;
    email: string;
    displayName: string;
  };
}

/**
 * Middleware to check if user has required permission
 * @param database Database instance
 * @param permission Required permission name
 * @param resource_id Optional specific resource ID
 */
export function requirePermission(
  database: Database, 
  permission: PermissionName, 
  resource_id?: number
) {
  return async (ctx: Context<AuthenticatedState>, next: Next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      throw createHttpError(401, "Authentication required");
    }

    const permissionService = new PermissionService(database);
    const hasPermission = await permissionService.userHasPermission(
      ctx.state.user.id, 
      permission, 
      resource_id
    );

    if (!hasPermission) {
      throw createHttpError(403, `Permission denied: ${permission} required`);
    }

    await next();
  };
}

/**
 * Middleware to check if user has any of the required permissions
 * @param database Database instance
 * @param permissions Array of permission names (user needs ANY one of them)
 * @param resource_id Optional specific resource ID
 */
export function requireAnyPermission(
  database: Database, 
  permissions: PermissionName[], 
  resource_id?: number
) {
  return async (ctx: Context<AuthenticatedState>, next: Next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      throw createHttpError(401, "Authentication required");
    }

    const permissionService = new PermissionService(database);
    
    for (const permission of permissions) {
      const hasPermission = await permissionService.userHasPermission(
        ctx.state.user.id, 
        permission, 
        resource_id
      );
      
      if (hasPermission) {
        await next();
        return;
      }
    }

    throw createHttpError(403, `Permission denied: One of [${permissions.join(', ')}] required`);
  };
}

/**
 * Middleware to check if user has all of the required permissions
 * @param database Database instance
 * @param permissions Array of permission names (user needs ALL of them)
 * @param resource_id Optional specific resource ID
 */
export function requireAllPermissions(
  database: Database, 
  permissions: PermissionName[], 
  resource_id?: number
) {
  return async (ctx: Context<AuthenticatedState>, next: Next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      throw createHttpError(401, "Authentication required");
    }

    const permissionService = new PermissionService(database);
    
    for (const permission of permissions) {
      const hasPermission = await permissionService.userHasPermission(
        ctx.state.user.id, 
        permission, 
        resource_id
      );
      
      if (!hasPermission) {
        throw createHttpError(403, `Permission denied: ${permission} required`);
      }
    }

    await next();
  };
}

/**
 * Middleware to inject user permissions into context for use in routes
 * @param database Database instance
 */
export function injectUserPermissions(database: Database) {
  return async (ctx: Context<AuthenticatedState & { permissions?: PermissionName[] }>, next: Next) => {
    if (ctx.state.user) {
      const permissionService = new PermissionService(database);
      // In a real implementation, you'd want to cache this or get user's permissions more efficiently
      // For now, we'll just inject the service so routes can check as needed
      (ctx.state as any).permissionService = permissionService;
    }
    
    await next();
  };
}

/**
 * Dynamic permission checker that gets resource_id from route params
 * @param database Database instance
 * @param permission Required permission name
 * @param resourceParam Route parameter name containing resource ID (e.g., 'id' for '/books/:id')
 */
export function requirePermissionForResource(
  database: Database, 
  permission: PermissionName,
  resourceParam: string = 'id'
) {
  return async (ctx: RouterContext<string, Record<string, string>, AuthenticatedState>, next: Next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      throw createHttpError(401, "Authentication required");
    }

    // Get resource ID from route params
    const resourceIdStr = ctx.params?.[resourceParam];
    const resource_id = resourceIdStr ? parseInt(resourceIdStr, 10) : undefined;

    const permissionService = new PermissionService(database);
    const hasPermission = await permissionService.userHasPermission(
      ctx.state.user.id, 
      permission, 
      resource_id
    );

    if (!hasPermission) {
      throw createHttpError(403, `Permission denied: ${permission} required for resource ${resource_id}`);
    }

    await next();
  };
}