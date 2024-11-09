import type { DustDatabase } from "../../database.ts";

export const migrate = (database: DustDatabase) => {
    database.migrate([
        `CREATE TABLE IF NOT EXISTS dust.genres (
            name TEXT NOT NULL,
        )`,
    ])
}