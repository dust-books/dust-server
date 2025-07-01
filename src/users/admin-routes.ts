import { RouterContext, Status, type Router } from "@oak/oak";
import { dustService } from "../../main.ts";
import { requireAdmin, requireUserManager, requireSelfOrAdmin } from "./admin-middleware.ts";
import { requirePermission, type AuthenticatedState } from "./permission-middleware.ts";
import { PERMISSIONS } from "./permissions.ts";
import { UserManagementService } from "./user-management-service.ts";

export const registerAdminRoutes = (router: Router) => {
  const userManager = new UserManagementService(dustService.database);

  // User Management Routes

  // GET /admin/users - List all users (admin or user manager only)
  router.get("/admin/users", requireUserManager(dustService.database), async (ctx) => {
    try {
      const users = await userManager.getAllUsers();
      ctx.response.body = { users };
    } catch (error) {
      console.error('Error fetching users:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch users" };
    }
  });

  // GET /admin/users/:id - Get specific user (self or admin)
  router.get("/admin/users/:id", requireSelfOrAdmin(dustService.database), async (ctx) => {
    try {
      const userId = parseInt(ctx.params.id!, 10);
      const user = await userManager.getUserById(userId);
      
      if (!user) {
        ctx.response.status = 404;
        ctx.response.body = { error: "User not found" };
        return;
      }
      
      ctx.response.body = { user };
    } catch (error) {
      console.error('Error fetching user:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch user" };
    }
  });

  // POST /admin/users - Create new user (admin only)
  router.post("/admin/users", requireAdmin(dustService.database), async (ctx) => {
    try {
      const body = await ctx.request.body.json();
      
      // Validate required fields
      if (!body.username || !body.email || !body.password) {
        ctx.response.status = 400;
        ctx.response.body = { error: "username, email, and password are required" };
        return;
      }

      const user = await userManager.createUser({
        username: body.username,
        email: body.email,
        password: body.password,
        display_name: body.display_name,
        roles: body.roles
      });

      ctx.response.status = 201;
      ctx.response.body = { user };
    } catch (error) {
      console.error('Error creating user:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: error instanceof Error ? error.message : "Failed to create user" };
    }
  });

  // PUT /admin/users/:id - Update user (self for basic info, admin for roles/status)
  router.put("/admin/users/:id", requireSelfOrAdmin(dustService.database), async (ctx) => {
    try {
      const userId = parseInt(ctx.params.id!, 10);
      const body = await ctx.request.body.json();
      const currentUser = (ctx.state as AuthenticatedState).user!;
      
      // Check if user is updating their own account vs. admin updating another user
      const isSelfUpdate = currentUser.id === userId;
      
      if (isSelfUpdate) {
        // Self-update: only allow basic info changes
        const allowedFields = ['username', 'email', 'display_name'];
        const updates: any = {};
        
        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            updates[field] = body[field];
          }
        }
        
        if (body.roles || body.is_active !== undefined) {
          ctx.response.status = 403;
          ctx.response.body = { error: "Cannot modify roles or account status for your own account" };
          return;
        }
        
        const user = await userManager.updateUser(userId, updates);
        ctx.response.body = { user };
      } else {
        // Admin update: allow all fields
        const user = await userManager.updateUser(userId, body);
        ctx.response.body = { user };
      }
    } catch (error) {
      console.error('Error updating user:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: error instanceof Error ? error.message : "Failed to update user" };
    }
  });

  // DELETE /admin/users/:id - Deactivate user (admin only)
  router.delete("/admin/users/:id", requireAdmin(dustService.database), async (ctx) => {
    try {
      const userId = parseInt(ctx.params.id!, 10);
      const currentUser = (ctx.state as AuthenticatedState).user!;
      
      // Prevent self-deletion
      if (currentUser.id === userId) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Cannot delete your own account" };
        return;
      }
      
      await userManager.deleteUser(userId);
      ctx.response.body = { message: "User deactivated successfully" };
    } catch (error) {
      console.error('Error deleting user:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to delete user" };
    }
  });

  // Role Management Routes

  // GET /admin/roles - List all roles (admin only)
  router.get("/admin/roles", requireAdmin(dustService.database), async (ctx) => {
    try {
      const roles = await userManager.getAllRoles();
      ctx.response.body = { roles };
    } catch (error) {
      console.error('Error fetching roles:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch roles" };
    }
  });

  // POST /admin/roles - Create new role (admin only)
  router.post("/admin/roles", requireAdmin(dustService.database), async (ctx) => {
    try {
      const body = await ctx.request.body.json();
      
      if (!body.name) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Role name is required" };
        return;
      }

      const role = await userManager.createRole(
        body.name,
        body.description,
        body.permissions
      );

      ctx.response.status = 201;
      ctx.response.body = { role };
    } catch (error) {
      console.error('Error creating role:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: error instanceof Error ? error.message : "Failed to create role" };
    }
  });

  // PUT /admin/roles/:id - Update role (admin only)
  router.put("/admin/roles/:id", requireAdmin(dustService.database), async (ctx) => {
    try {
      const roleId = parseInt(ctx.params.id!, 10);
      const body = await ctx.request.body.json();

      const role = await userManager.updateRole(
        roleId,
        body.name,
        body.description,
        body.permissions
      );

      ctx.response.body = { role };
    } catch (error) {
      console.error('Error updating role:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: error instanceof Error ? error.message : "Failed to update role" };
    }
  });

  // DELETE /admin/roles/:id - Delete role (admin only)
  router.delete("/admin/roles/:id", requireAdmin(dustService.database), async (ctx) => {
    try {
      const roleId = parseInt(ctx.params.id!, 10);
      
      await userManager.deleteRole(roleId);
      ctx.response.body = { message: "Role deleted successfully" };
    } catch (error) {
      console.error('Error deleting role:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: error instanceof Error ? error.message : "Failed to delete role" };
    }
  });

  // Permission Management Routes

  // GET /admin/permissions - List all permissions (admin only)
  router.get("/admin/permissions", requireAdmin(dustService.database), async (ctx) => {
    try {
      const permissions = await userManager.getAllPermissions();
      ctx.response.body = { permissions };
    } catch (error) {
      console.error('Error fetching permissions:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch permissions" };
    }
  });

  // Dashboard and Stats Routes

  // GET /admin/dashboard - Get admin dashboard data (admin only)
  router.get("/admin/dashboard", requireAdmin(dustService.database), async (ctx) => {
    try {
      const userStats = await userManager.getUserStats();
      
      // You could add more dashboard data here:
      // - Book statistics
      // - System health info
      // - Recent activity logs
      
      ctx.response.body = {
        userStats,
        systemInfo: {
          version: "1.0.0", // Could be from package.json or env
          uptime: "N/A", // Deno doesn't have process.uptime() 
          denoVersion: Deno.version.deno
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch dashboard data" };
    }
  });

  // User Profile Routes (for current user)

  // GET /profile - Get current user's profile (authenticated users)
  router.get("/profile", requirePermission(dustService.database, PERMISSIONS.BOOKS_READ), async (ctx) => {
    try {
      const currentUser = (ctx.state as AuthenticatedState).user!;
      const user = await userManager.getUserById(currentUser.id);
      
      if (!user) {
        ctx.response.status = 404;
        ctx.response.body = { error: "User profile not found" };
        return;
      }
      
      // Remove sensitive information for profile endpoint
      const { ...profile } = user;
      
      ctx.response.body = { profile };
    } catch (error) {
      console.error('Error fetching profile:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch profile" };
    }
  });

  // PUT /profile - Update current user's profile (authenticated users)
  router.put("/profile", requirePermission(dustService.database, PERMISSIONS.BOOKS_READ), async (ctx) => {
    try {
      const currentUser = (ctx.state as AuthenticatedState).user!;
      const body = await ctx.request.body.json();
      
      // Only allow certain fields to be updated via profile endpoint
      const allowedFields = ['username', 'email', 'display_name'];
      const updates: any = {};
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }
      
      const user = await userManager.updateUser(currentUser.id, updates);
      ctx.response.body = { profile: user };
    } catch (error) {
      console.error('Error updating profile:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: error instanceof Error ? error.message : "Failed to update profile" };
    }
  });
};