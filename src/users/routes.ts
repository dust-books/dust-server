import type { Router } from "@oak/oak";
import { InvalidCredentialsError, UserService } from "./user-service.ts";
import { dustService } from "../../main.ts";
import { validateSignup } from "./validators/signup-validator.ts";
import { validateSignIn } from "./validators/signin-validator.ts";
import { requirePermission, injectUserPermissions, type AuthenticatedState } from "./permission-middleware.ts";
import { PERMISSIONS } from "./permissions.ts";

export const registerRoutes = (router: Router) => {
  console.log("🔧 Registering user routes...");
  
  // POST /auth/login - User login
  router.post("/auth/login", async (ctx) => {
    console.log("🔑 Login attempt received");
    const userService = new UserService(dustService.database);
    try {
      const body = await ctx.request.body.json();
      if (validateSignIn(body)) {
        const userToken = await userService.handleSignIn(body);
        const user = await userService.getUserFromToken(userToken);
        ctx.response.body = { 
          token: userToken,
          user: user
        };
        ctx.response.status = 200;
      } else {
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid login data" };
      }
    } catch (e) {
      if (e instanceof InvalidCredentialsError) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Invalid credentials" };
      } else {
        console.error("Login error:", e);
        ctx.response.status = 500;
        ctx.response.body = { error: "Login failed" };
      }
    }
  });

  // POST /auth/register - User registration
  router.post("/auth/register", async (ctx) => {
    console.log("📝 Register attempt received");
    const userService = new UserService(dustService.database);
    try {
      const body = await ctx.request.body.json();
      console.log("📝 Registration data:", body);
      
      if (validateSignup(body)) {
        // Transform client data to match server expectations
        const userData = {
          username: body.username || body.email.split('@')[0] || 'user' + Date.now(), // ensure username is always set
          displayName: body.display_name || body.displayName || body.username || 'User',
          email: body.email,
          password: body.password
        };
        
        console.log("📝 Transformed userData:", userData);
        
        const userToken = await userService.handleSignUp(userData);
        const user = await userService.getUserFromToken(userToken);
        ctx.response.body = user;
        ctx.response.status = 201;
      } else {
        console.log("📝 Validation failed for:", body);
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid registration data" };
      }
    } catch (e) {
      console.error("Registration error:", e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Registration failed" };
    }
  });

  // POST /auth/logout - User logout
  router.post("/auth/logout", async (ctx) => {
    ctx.response.body = { message: "Logged out successfully" };
    ctx.response.status = 200;
  });

  // Authentication middleware for profile routes only
  router.use("/profile", async (ctx, next) => {
    const userService = new UserService(dustService.database);
    const bearer = ctx.request.headers.get("authorization");
    const token = bearer?.split(" ")?.[1];
    
    if (token) {
      try {
        const payload = await userService.validateJWT(token);
        ctx.state.user = payload.user;
      } catch (_e) {
        // Token is invalid, continue without user
      }
    }
    
    await next();
  });

  // GET /profile - Get current user profile
  router.get("/profile", async (ctx) => {
    const currentUser = (ctx.state as AuthenticatedState).user;
    if (!currentUser) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" };
      return;
    }

    try {
      const userService = new UserService(dustService.database);
      const token = ctx.request.headers.get("authorization")?.split(" ")?.[1] || "";
      const userProfile = await userService.getUserFromToken(token);
      ctx.response.body = userProfile;
      ctx.response.status = 200;
    } catch (e) {
      console.error("Profile error:", e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get user profile" };
    }
  });
};