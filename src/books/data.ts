import type { Database } from "../../database.ts";

export const migrate = (database: Database) => {
    return database.migrate([
        `CREATE TABLE IF NOT EXISTS books (
            name TEXT NOT NULL,
            author INTEGER,
            file_path TEXT NOT NULL UNIQUE
        )`,
        `CREATE TABLE IF NOT EXISTS authors (
            name TEXT NOT NULL
        )`,
    ]);
}

export const getAllBooks = (database: Database) => {
    return database.execute(`
        SELECT * FROM books;
    `);
}

export const getBook = (database: Database, id: string) => {
    return database.execute({
        sql: "SELECT * FROM books where rowId = $id;",
        args: { id }
    })
}