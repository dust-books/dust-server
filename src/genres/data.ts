import type { Database } from "../../database.ts";

export const migrate = (database: Database) => {
    return database.migrate([
        `CREATE TABLE IF NOT EXISTS genres (
            name TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS books_genres (
            genreId INTEGER NOT NULL,
            bookId INTEGER NOT NULL
        )`
    ])
}

export const getAllGenres = (database: Database) => {
    return database.execute(`
        SELECT * FROM genres;
    `);
}

export const getGenre = (database: Database, id: string) => {
    return database.execute({
        sql: "SELECT * FROM genres where rowId = $id;",
        args: { id }
    })
}