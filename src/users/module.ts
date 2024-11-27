import type { Router } from "@oak/oak";
import type { Database } from "../../database.ts";
import { Module } from "../../module.ts";
import { migrate } from "./data.ts";
import { registerRoutes } from "./routes.ts";
import type { DustConfig } from "../../config.ts";

export class UsersModule extends Module {
  override registerRoutes(config: DustConfig, router: Router): void {
    registerRoutes(router);
  }

  override async runMigrations(config: DustConfig, database: Database): Promise<void> {
    await migrate(database);
    return;
  }
}