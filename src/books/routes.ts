import type { Router } from "@oak/oak";

export const registerRoutes = (router: Router) => {
    router.get("/books/", (ctx) => {
        ctx.response.body = {
            books: [],
        };
    });
    router.get("/books/:id", (ctx) => {
        ctx.response.body = {
            book: {
                id: ctx.params.id
            }
        }
    });
    router.get("/books/:id/progress", (ctx) => {
        ctx.response.body = {
            book: {
                id: ctx.params.id,
            },
            progress: {
                page: 0,
            }
        };
    });
    router.put("/books/:id/progress", (ctx) => {
        ctx.response.status = 200;
    });
}