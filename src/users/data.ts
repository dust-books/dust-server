import type { Database } from "../../database.ts";
import type { User, UserWithId } from "./user.ts";

class NoValidTokenError extends Error {}
class ExpiredTokenError extends Error {}

export const migrate = (database: Database) => {
    return database.migrate([
        `CREATE TABLE IF NOT EXISTS users (
            display_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
            session_token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            user_id INTEGER
        )`,
    ])
}

export const getAllUsers = (database: Database) => {
    return database.execute(`
        SELECT display_name, email FROM users;
    `);
}

export const getUser = (database: Database, id: string) => {
    return database.execute({
        sql: "SELECT * FROM users where rowId = $id",
        args: { id }
    })
}

export const getUserByEmail = async (database: Database, email: string) => {
    const results = await database.execute({
        sql: "SELECT * FROM users where email = $email",
        args: { email }
    });

    return {
        email: results.rows[0]["email"],
        password: results.rows[0]["password"],
        displayName: results.rows[0]["display_name"],
    } as User;
}

export const addUser = (database: Database, user: User) => {
    return database.execute({
        sql: `
        INSERT INTO users (display_name, email, password) VALUES ($display, $email, $password) 
    `, args: {
            display: user.displayName,
            email: user.email,
            // This _SHOULD_ be encrypted by this point
            password: user.password
        }
    });
}

export const createSession = (database: Database, user: UserWithId, token: string) => {
    const expires = new Date();
    // expires after 24 hours
    expires.setDate(expires.getDate() + 1);
    return database.execute({
        sql: `
        INSERT INTO sessions (session_token, expires_at, user_id) VALUES ($token, $expires_at, $user) 
    `, args: {
            token,
            expires_at: expires.toISOString(),
            user: user.id
        }
    });
}

export const getUserIdFromSession = async (database: Database, token: string): Promise<number> => {
    const result = await database.execute({
        sql: `
        SELECT * FROM sessions WHERE session_token = $token
    `, args: {
            token,
        }
    });

    if (result.rows.length <= 0) {
        throw new NoValidTokenError();
    }

    const expiresAt = new Date(result.rows[0]['expires_at'] as string);
    if (expiresAt.getMilliseconds() <= new Date().getMilliseconds()) {
        throw new ExpiredTokenError();
    }

    return result.rows[0]['user_id'] as number;
}