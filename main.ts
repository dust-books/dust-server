import { Application, isHttpError, Router } from "@oak/oak";
import type { Module } from "./module.ts";
import { DustDatabase } from "./database.ts";
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
  private _stop = () => this.stop();

  constructor() {
    const { signal } = this.abortController;
    this.config.collect();
    Deno.addSignalListener('SIGINT', this._abort);
    signal.addEventListener("abort", this._stop);
    
    // TODO: Let's pull this out. Maybe to a "core" module?
    this.app.use(async (context, next) => {
      try {
        await next();
      } catch (err) {
        if (isHttpError(err)) {
          context.response.status = err.status;
          const { message, status, stack } = err;
          if (context.request.accepts("json")) {
            context.response.body = { message, status, stack };
            context.response.type = "json";
          } else {
            context.response.body = `${status} ${message}\n\n${stack ?? ""}`;
            context.response.type = "text/plain";
          }
        } else {
          console.log(err);
          throw err;
        }
      }
    });
    // TODO: We keepin' this?
    this.router.get("/", (ctx) => {
      ctx.response.status = 200;
      ctx.response.type = "text/html";
      ctx.response.body = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Dust Server</title></head><body><iframe src="https://giphy.com/embed/2wKbtCMHTVoOY" width="480" height="480" style="" frameBorder="0" class="giphy-embed" allowFullScreen></iframe></body></html>`
    });
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
    this.abortController.signal.removeEventListener("abort", this._stop);
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
