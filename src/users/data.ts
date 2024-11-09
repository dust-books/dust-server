import type { DustDatabase } from "../../database.ts";

export const migrate = (database: DustDatabase) => {
    database.migrate([
        `CREATE TABLE IF NOT EXISTS dust.users (
            display_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
        )`,
        `CREATE TABLE IF NOT EXISTS dust.sessions (
            session_token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
        )`,
    ])
}