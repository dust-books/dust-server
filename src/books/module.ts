import type { Router } from "@oak/oak";
import type { Database } from "../../database.ts";
import { Module } from "../../module.ts";
import { migrate } from "./data.ts";
import { registerRoutes } from "./routes.ts";
import type { TimerManager } from "../../clock.ts";
import { bookService } from "./book-service.ts";
import type { DustConfig } from "../../config.ts";
import { TagService } from "./tag-service.ts";

export class BooksModule extends Module {
  override registerRoutes(config: DustConfig, router: Router): void {
    registerRoutes(router);
  }

  override async runMigrations(config: DustConfig, database: Database): Promise<void> {
    await migrate(database);
    
    // Initialize the tag system with default tags
    const tagService = new TagService(database);
    await tagService.initializeDefaultTags();
    
    return;
  }

  override registerTimers(config: DustConfig, timerManager: TimerManager): void {
    const EVERY_HOUR = 1000 * 60 * 60;
    setTimeout(() => {
        bookService.populateBooksDB(
            config.getLibraryDirectories(), 
            config.getGoogleBooksApiKey()
        );
    }, 1000);
    timerManager.registerTimer(() => {
        bookService.populateBooksDB(
            config.getLibraryDirectories(), 
            config.getGoogleBooksApiKey()
        );
    }, EVERY_HOUR);
  }
}