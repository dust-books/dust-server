import { Application, Router } from "@oak/oak";
import type { Module } from "./module.ts";
import { DustDatabase, type Database } from "./database.ts";
import { UsersModule } from "./src/users/module.ts";
import { BooksModule } from "./src/books/module.ts";
import { GenresModule } from "./src/genres/module.ts";

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


  async registerModule(module: Module): Promise<void> {
    module.registerRoutes(this.router);
    await module.runMigrations(this.database);
    return;
  }

  async start(): Promise<void> {
    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());
    console.log("Dust is bookin' it on port 4001");
    await this.app.listen({port: 4001});
  }
}

const dustService = new DustService();
await Promise.all([UsersModule, BooksModule, GenresModule].map((m) => {
  return dustService.registerModule(new m());
}));
dustService.start();

export { dustService };

// export default { fetch: dustService['app'].fetch }
