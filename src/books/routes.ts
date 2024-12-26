import { RouterContext, Status, type Router } from "@oak/oak";
import { bookService } from "./book-service.ts";
import { dustService } from "../../main.ts";

export const registerRoutes = (router: Router) => {
  router.get("/books/", async (ctx: RouterContext<"/books/">) => {
    const books = await bookService.getBooks(dustService.database);
    ctx.response.body = {
      books: books,
    };
  });
  router.get("/books/:id", async (ctx: RouterContext<"/books/:id">) => {
    try {
      const book = await bookService.getBookById(
        dustService.database,
        ctx.params.id
      );
      ctx.response.body = {
        book: book,
      };
      return;
    } catch (e) {
      console.error(e);
    }
  });
  router.get("/books/:id/stream", async (ctx) => {
    const book = await bookService.getBookById(
      dustService.database,
      ctx.params.id
    );
    const file = await Deno.open(book.filepath, { read: true });
    ctx.response.body = file.readable;
    file.close();
  });
  router.get("/books/:id/progress", (ctx) => {
    ctx.response.body = {
      book: {
        id: ctx.params.id,
      },
      progress: {
        page: 0,
      },
    };
  });
  router.put("/books/:id/progress", (ctx) => {
    ctx.response.status = 200;
  });
};
