import type { Router } from "@oak/oak";
import type { Database } from "../../database.ts";
import { Module } from "../../module.ts";
import { migrate } from "./data.ts";
import { registerRoutes } from "./routes.ts";

class BooksModule extends Module {
  override registerRoutes(router: Router): void {
    registerRoutes(router);
  }

  override async runMigrations(database: Database): Promise<void> {
    await migrate(database);
    return;
  }
}