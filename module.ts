import type { Router } from "@oak/oak";
import type { Database } from "./database.ts";

export abstract class Module {
    abstract runMigrations(database: Database): Promise<void>;
    abstract registerRoutes(router: Router): void;
}