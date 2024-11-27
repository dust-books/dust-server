import { Application, Router } from "@oak/oak";
import type { Module } from "./module.ts";
import { DustDatabase, type Database } from "./database.ts";
import { UsersModule } from "./src/users/module.ts";
import { BooksModule } from "./src/books/module.ts";
import { GenresModule } from "./src/genres/module.ts";
import { DustConfig } from "./config.ts";
import { DustTimerManager } from "./clock.ts";

interface Service {
  registerModule(module: Module): Promise<void>;
  start(): Promise<void>;
}
class DustService implements Service {
  // TODO: Move to constructor args for mocking
  private router = new Router();
  // TODO: Apparently we should be able to pass state around via the application
  // which is available to router routes. So we _could_ set the db as part of the application
  // state, in which we would not need to make the database public.
  database = new DustDatabase();
  private app = new Application();
  private config = new DustConfig();
  private timerManager = new DustTimerManager();
  private abortController = new AbortController();
  private _abort = () => this.abortController.abort();

  constructor() {
    const { signal } = this.abortController;
    this.config.collect();
    Deno.addSignalListener('SIGINT', this._abort);
    signal.addEventListener("abort", this.stop);
  }

  async registerModule(module: Module): Promise<void> {
    module.registerRoutes(this.config, this.router);
    await module.runMigrations(this.config, this.database);
    module.registerTimers(this.config, this.timerManager);
    return;
  }

  async start(): Promise<void> {
    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());
    console.log("Dust is bookin' it on port 4001");
    await this.app.listen({ port: 4001, signal: this.abortController.signal });
  }

  stop(): void {
    console.log("Gracefully shutting down Dust");
    this.timerManager.clearAll();
    Deno.removeSignalListener('SIGINT', this._abort);
    this.abortController.signal.removeEventListener("abort", this.stop);
    console.log("Dust shut down successfully");
  }
}

const dustService = new DustService();
await Promise.all(
  [UsersModule, BooksModule, GenresModule].map((m) => {
    return dustService.registerModule(new m());
  })
);
dustService.start();

export { dustService };

// export default { fetch: dustService['app'].fetch }
