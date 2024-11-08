import type { Router } from "@oak/oak";

export const registerRoutes = (router: Router) => {
    router.get("/users", (ctx) => {});
    router.post("/users", (ctx) => {})
}