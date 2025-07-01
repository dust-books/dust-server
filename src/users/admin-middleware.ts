import type { Context, Next, RouterContext } from "@oak/oak";
import { createHttpError } from "@oak/oak";
import type { Database } from "../../database.ts";
import { PermissionService } from "./permission-service.ts";
import { PERMISSIONS } from "./permissions.ts";
import type { AuthenticatedState } from "./permission-middleware.ts";

/**
 * Middleware that requires admin privileges (ADMIN_FULL permission)
 */
export function requireAdmin(database: Database) {
  return async (ctx: RouterContext<string, Record<string, string>, AuthenticatedState>, next: Next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      throw createHttpError(401, "Authentication required");
    }

    const permissionService = new PermissionService(database);
    const isAdmin = await permissionService.userHasPermission(
      ctx.state.user.id, 
      PERMISSIONS.ADMIN_FULL
    );

    if (!isAdmin) {
      throw createHttpError(403, "Admin privileges required");
    }

    await next();
  };
}

/**
 * Middleware that requires user management privileges (USERS_MANAGE permission)
 */
export function requireUserManager(database: Database) {
  return async (ctx: RouterContext<string, Record<string, string>, AuthenticatedState>, next: Next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      throw createHttpError(401, "Authentication required");
    }

    const permissionService = new PermissionService(database);
    
    // Check for either ADMIN_FULL or USERS_MANAGE permission
    const hasAdminFull = await permissionService.userHasPermission(
      ctx.state.user.id, 
      PERMISSIONS.ADMIN_FULL
    );
    
    const hasUserManage = await permissionService.userHasPermission(
      ctx.state.user.id, 
      PERMISSIONS.USERS_MANAGE
    );

    if (!hasAdminFull && !hasUserManage) {
      throw createHttpError(403, "User management privileges required");
    }

    await next();
  };
}

/**
 * Middleware that allows users to access their own data or requires admin privileges for other users
 */
export function requireSelfOrAdmin(database: Database, userIdParam: string = 'id') {
  return async (ctx: RouterContext<string, Record<string, string>, AuthenticatedState>, next: Next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      throw createHttpError(401, "Authentication required");
    }

    const targetUserId = parseInt(ctx.params[userIdParam] || '', 10);
    
    // Allow if accessing own data
    if (ctx.state.user.id === targetUserId) {
      await next();
      return;
    }

    // Otherwise, require admin privileges
    const permissionService = new PermissionService(database);
    const isAdmin = await permissionService.userHasPermission(
      ctx.state.user.id, 
      PERMISSIONS.ADMIN_FULL
    );

    if (!isAdmin) {
      throw createHttpError(403, "Access denied: can only access your own data or requires admin privileges");
    }

    await next();
  };
}