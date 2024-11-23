import type { Router } from "@oak/oak";
import { InvalidCredentialsError, UserService } from "./user-service.ts";
import { dustService } from "../../main.ts";
import { validateSignup } from "./validators/signup-validator.ts";
import { validateSignIn } from "./validators/signin-validator.ts";

export const registerRoutes = (router: Router) => {
    router.post("/auth", async (ctx) => {
        const userService = new UserService(dustService.database);
        try {
            const body = await ctx.request.body.json();
            if (validateSignIn(body)) {
                const userToken = await userService.handleSignIn(body);
                    ctx.response.headers.set("Authorization", `Bearer: ${userToken}`);
                    ctx.response.status = 200;
            } else {
                ctx.response.status = 400;
            }
        } catch (e) {
            if (e instanceof InvalidCredentialsError) {
                ctx.response.status = 401;
            }
            ctx.response.status = 500;
        }
    });
    router.get("/users", (ctx) => {});
    router.post("/users", async (ctx) => {
        const userService = new UserService(dustService.database);
        try {
            const body = await ctx.request.body.json();
            if (validateSignup(body)) {
                await userService.handleSignUp(body);
                ctx.response.status = 200;
            } else {
                ctx.response.status = 400;
            }
        } catch (_e) {
            ctx.response.status = 500;
        }
    });
}