import type { Database } from "../../database.ts";
import type { Book } from "./book.ts";

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

export const getBookByName = (database: Database, name: string) => {
    return database.execute({
        sql: "SELECT * FROM books WHERE name = $name",
        args: {name: name}
    })
}

// TODO: Need to ensure author exists when we put the book in the DB.
export const addBookIfNotExists = async (database: Database, book: Omit<Book, "author">) => {
    const existing = await getBookByName(database, book.name);
    if (existing.rows) {
        return;
    }
    return database.execute({
        sql: "INSERT INTO books (name, filepath) VALUES($name, $filepath)", 
        args: {name: book.name, filePath: book.filepath}
    });
}

export const getAuthorByName = (database: Database, name: string) => {
    return database.execute({
        sql: "SELECT * FROM authors WHERE name = $name",
        args: {name: name}
    })
}

// TODO: Need to ensure author exists when we put the book in the DB.
export const addAuthorIfNotExists = async (database: Database, authorName: string) => {
    const existing = await getAuthorByName(database, authorName);
    if (existing.rows) {
        return;
    }
    return database.execute({
        sql: "INSERT INTO authors (name) VALUES($name)", 
        args: {name: authorName}
    });
}