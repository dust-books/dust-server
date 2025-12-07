import type { Router } from "@oak/oak";
import type { Database } from "./database.ts";
import type { TimerManager } from "./clock.ts";
import type { DustConfig } from "./config.ts";

/**
 * Modules are the backbone of Dust. Features are made available via Modules
 * and this abstract class is the standard interface for those modules to be
 * made available to the Dust engine.
 */
export abstract class Module {
    /**
     * Runs migrations against the passed in database. This is intended to be used to setup
     * your module for execution within the Dust engine.
     * 
     * @param database Database to run migrations against
     */
    abstract runMigrations(config: DustConfig, database: Database): Promise<void>;
    /**
     * Hook to register routes in the router. This is intended to be used to setup your routes
     * within the Dust router.
     * @param router Router in which to register routes
     */
    abstract registerRoutes(config: DustConfig, router: Router): void;

    /**
     * Hook to register a new timer to be managed by the Dust engine. Timers are intended to be
     * used to run tasks at a set interval (for example, scanning the filesystem to populate the book database).
     */
    registerTimers(config: DustConfig, timerManager: TimerManager): void {}
}