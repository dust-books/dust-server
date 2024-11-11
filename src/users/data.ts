import type { Database } from "../../database.ts";
import type { User } from "./user.ts";

export const migrate = (database: Database) => {
    return database.migrate([
        `CREATE TABLE IF NOT EXISTS users (
            display_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
            session_token TEXT NOT NULL,
            expires_at TEXT NOT NULL
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