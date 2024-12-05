import type { Database } from "../../database.ts";
import { addUser, getUserByEmail, createSession } from "./data.ts";
import type { User } from "./user.ts";
import { hash, verify } from "@ts-rex/bcrypt";
import * as jose from "https://deno.land/x/jose@v5.9.6/index.ts";

export class InvalidTokenError extends Error {}
export class InvalidCredentialsError extends Error {}
type SignedJWTToken = string;

export class UserService {
  private db: Database;
  private jwtSecretKey: Uint8Array;

  constructor(db: Database) {
    this.db = db;
    const encoder = new TextEncoder();
    this.jwtSecretKey = encoder.encode(Deno.env.get("JWT_SECRET"));
  }

  async handleSignUp(user: User): Promise<SignedJWTToken> {
    const encryptedUser = {
      ...user,
      password: hash(user.password),
    };

    await addUser(this.db, encryptedUser);
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
        ["sign"]
      );
  }

  private async createJWTForUser(user: Omit<User, "password">): Promise<SignedJWTToken> {
    const key = await this.getJWTSecret();
    const token = await new jose.SignJWT({
      user: {
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

  async validateJWT(token: SignedJWTToken): Promise<{user: {email: string, displayName: string}}> {
    const key = await this.getJWTSecret();
    try {
        // verify token
        const { payload, protectedHeader } = await jose.jwtVerify<{user: {email: string, displayName: string}}>(token, key, {
          issuer:   "dust-server", // issuer
          audience: "dust-client", // audience
        });
        
        return payload;
      } catch (e) {
        console.log("Token is invalid", e);
        throw new InvalidTokenError();
      }
  }
}
