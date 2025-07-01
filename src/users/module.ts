import type { Router } from "@oak/oak";
import type { Database } from "../../database.ts";
import { Module } from "../../module.ts";
import { migrate } from "./data.ts";
import { registerRoutes } from "./routes.ts";
import { registerAdminRoutes } from "./admin-routes.ts";
import type { DustConfig } from "../../config.ts";
import { UserService } from "./user-service.ts";

export class UsersModule extends Module {
  override registerRoutes(config: DustConfig, router: Router): void {
    registerRoutes(router);
    registerAdminRoutes(router);
  }

  override async runMigrations(config: DustConfig, database: Database): Promise<void> {
    await migrate(database);
    
    // Initialize the permission system with default roles and permissions
    const userService = new UserService(database);
    await userService.initializePermissionSystem();
    
    return;
  }
}