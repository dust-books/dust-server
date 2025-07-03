import type { Database } from "../../database.ts";
import { addUser, getUserByEmail, getUserById, createSession, getUserIdFromSession } from "./data.ts";
import type { User, UserWithId, UserWithRoles } from "./user.ts";
import { hash, verify } from "@ts-rex/bcrypt";
import * as jose from "https://deno.land/x/jose@v5.9.6/index.ts";
import { PermissionService } from "./permission-service.ts";
import { ROLES, type RoleName } from "./permissions.ts";

export class InvalidTokenError extends Error {}
export class InvalidCredentialsError extends Error {}
type SignedJWTToken = string;

export class UserService {
  private db: Database;
  private jwtSecretKey: Uint8Array;
  private permissionService: PermissionService;

  constructor(db: Database) {
    this.db = db;
    const encoder = new TextEncoder();
    this.jwtSecretKey = encoder.encode(Deno.env.get("JWT_SECRET"));
    this.permissionService = new PermissionService(db);
  }

  async handleSignUp(user: User): Promise<SignedJWTToken> {
    const encryptedUser = {
      ...user,
      password: hash(user.password),
    };

    await addUser(this.db, encryptedUser);
    
    // Get the newly created user to assign default role
    const newUser = await getUserByEmail(this.db, user.email);
    await this.permissionService.assignUserRole(newUser.id, ROLES.USER);
    
    const token = await this.handleSignIn(user);
    return token;
  }

  async handleSignIn(user: Pick<User, "email" | "password">): Promise<SignedJWTToken> {
    const storedUser = await getUserByEmail(this.db, user.email);
    const isValid = verify(user.password, storedUser.password);

    if (isValid) {
        const token = await this.createJWTForUser(storedUser);
        await createSession(this.db, storedUser, token);
        return token;
    } else {
        throw new InvalidCredentialsError();
    }
  }

  private async getJWTSecret() {
    return await crypto.subtle.importKey(
        "raw",
        this.jwtSecretKey,
        { name: "HMAC", hash: "SHA-256" },
        true,
        ["sign", "verify"]
      );
  }

  private async createJWTForUser(user: Omit<UserWithId, "password">): Promise<SignedJWTToken> {
    const key = await this.getJWTSecret();
    const token = await new jose.SignJWT({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    })
      .setIssuedAt()
      .setIssuer("urn:dust:server")
      .setAudience("urn:dust:client")
      .setExpirationTime("1 day")
      .setProtectedHeader({alg: 'HS256'})
      .sign(key);

    return token;
  }

  async validateJWT(token: SignedJWTToken): Promise<{user: {id: number, email: string, displayName: string}}> {
    const key = await this.getJWTSecret();
    try {
        // verify token
        const { payload, protectedHeader } = await jose.jwtVerify<{user: {id: number, email: string, displayName: string}}>(token, key, {
          issuer:   "urn:dust:server", // issuer
          audience: "urn:dust:client", // audience
        });
        
        return payload;
      } catch (e) {
        console.log("Token is invalid", e);
        throw new InvalidTokenError();
      }
  }

  async getUserForValidatedSession(token: SignedJWTToken): Promise<number> {
    const userId = await getUserIdFromSession(this.db, token);

    return userId;
  }

  async getUserFromToken(token: SignedJWTToken): Promise<UserWithRoles> {
    const payload = await this.validateJWT(token);
    const userId = payload.user.id;
    
    // Get full user data including roles and permissions
    const user = await getUserById(this.db, userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const roles = await this.permissionService.getUserRoles(userId);
    const permissions = await this.permissionService.getUserPermissions(userId);
    
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      display_name: user.display_name,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles: roles.map(r => r.name),
      permissions: permissions.map(p => p.name),
      created: user.created,
      lastLogin: user.lastLogin
    };
  }

  // Permission management methods
  async assignUserRole(userId: number, roleName: RoleName): Promise<void> {
    return await this.permissionService.assignUserRole(userId, roleName);
  }

  async removeUserRole(userId: number, roleName: RoleName): Promise<void> {
    return await this.permissionService.removeUserRole(userId, roleName);
  }

  async getUserRoles(userId: number) {
    return await this.permissionService.getUserRoles(userId);
  }

  async initializePermissionSystem(): Promise<void> {
    await this.permissionService.initializeDefaultRolesAndPermissions();
  }
}
