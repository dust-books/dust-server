import type { Database } from "../../database.ts";

export const migrate = (database: Database) => {
    return database.migrate([
        `CREATE TABLE IF NOT EXISTS dust.books (
            name TEXT NOT NULL,
            author INTEGER,
            file_path TEXT NOT NULL UNIQUE
        )`,
        `CREATE TABLE IF NOT EXISTS dust.authors (
            name TEXT NOT NULL,
        )`,
    ])
}