import type { Router } from "@oak/oak";
import { InvalidCredentialsError, UserService } from "./user-service.ts";
import { dustService } from "../../main.ts";
import { validateSignup } from "./validators/signup-validator.ts";
import { validateSignIn } from "./validators/signin-validator.ts";
import { UserWithId } from "./user.ts";

interface Request {
  user: UserWithId;
}

export const registerRoutes = (router: Router) => {
  router.use("/", async (ctx, next) => {
    const userService = new UserService(dustService.database);

    const bearer = ctx.request.headers.get("authorization");
    const token = bearer?.split(" ")?.[1];
    if (token != null) {
      const payload = await userService.validateJWT(token);
      ctx.state.user = payload.user;
    }

    next();
  });

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
        const userToken = await userService.handleSignUp(body);
        ctx.response.headers.set("Authorization", `Bearer: ${userToken}`);
        ctx.response.status = 200;
      } else {
        ctx.response.status = 400;
      }
    } catch (e) {
      console.log(e);
      ctx.response.status = 500;
    }
  });
};
