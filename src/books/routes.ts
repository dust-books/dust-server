import type { Router } from "@oak/oak";

export const registerRoutes = (router: Router) => {
    router.get("/book/", (ctx) => {});
    router.get("/book/:id", (ctx) => {});
    router.get("/book/:id/progress", (ctx) => {});
    router.put("/book/:id/progress", (ctx) => {});
}