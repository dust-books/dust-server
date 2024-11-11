import type { Router } from "@oak/oak";

export const registerRoutes = (router: Router) => {
    router.get("/genres/", (ctx) => {
        ctx.response.body = {
            genres: [],
        }
    });
    router.get("/genres/:id", (ctx) => {
        ctx.response.body = {
            genre: {
                id: ctx.params.id,
                books: [],
            }
        }
    });
}