import type { DustDatabase } from "../../database.ts";

export const migrate = (database: DustDatabase) => {
    database.migrate([
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