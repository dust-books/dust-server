import { Application, Router } from "@oak/oak";
import type { Module } from "./module.ts";
import { DustDatabase } from "./database.ts";
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
  private app = new Application();
  private database = new DustDatabase();

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

// export default { fetch: dustService['app'].fetch }
