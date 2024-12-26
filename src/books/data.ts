import type { Database } from "../../database.ts";
import type { AuthorWithId } from "./author.ts";
import type { Book, BookWithId } from "./book.ts";

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

export const getAllBooks = async (database: Database): Promise<BookWithId[]> => {
    const resp = await database.execute(`
        SELECT rowid, * FROM books;
    `);

    return resp.rows.map((r) => {
        return {
            id: r['rowid'] as number,
            name: r['name'] as string,
            filepath: r['file_path'] as string,
            author: r['author'] as number,
        };
    })
}

export const getBook = async (database: Database, id: string): Promise<BookWithId> => {
    const resp = await database.execute({
        sql: "SELECT rowid, * FROM books where rowId = $id;",
        args: { id }
    });

    return {
        id: resp.rows[0]['rowid'] as number,
        name: resp.rows[0]['name'] as string,
        author: resp.rows[0]['author'] as number,
        filepath: resp.rows[0]['file_path'] as string,
    }
}

export const getBookByName = (database: Database, name: string) => {
    return database.execute({
        sql: "SELECT rowid, * FROM books WHERE name = $name",
        args: {name: name}
    })
}

// TODO: Need to ensure author exists when we put the book in the DB.
export const addBookIfNotExists = async (database: Database, book: Book) => {
    const existing = await getBookByName(database, book.name);
    if (existing.rows.length != 0) {
        return;
    }
    return database.execute({
        sql: "INSERT INTO books (name, author, file_path) VALUES ($name, $author, $filePath) RETURNING rowId, *", 
        args: {name: book.name, filePath: book.filepath, author: book.author}
    });
}

export const getAuthorById = async (database: Database, id: number): Promise<AuthorWithId> => {
    const resp = await database.execute({
        sql: "SELECT rowid, * FROM authors where rowId = $id",
        args: {id}
    });
    return {
        id: resp.rows[0]['rowid'] as number,
        name: resp.rows[0]['name'] as string,
    }
}

export const getAuthorByName = (database: Database, name: string) => {
    return database.execute({
        sql: "SELECT rowid, * FROM authors WHERE name = $name",
        args: {name: name}
    })
}

export const getAllAuthors = async (database: Database): Promise<AuthorWithId[]> => {
    const resp = await database.execute({
        sql: "SELECT rowid, * FROM authors",
        args: {name: name}
    });

    return resp.rows.map((r) => {
        return {
            id: r['rowid'] as number,
            name: r['name'] as string,
        }
    })
}

// TODO: Need to ensure author exists when we put the book in the DB.
export const addAuthorIfNotExists = async (database: Database, authorName: string): Promise<AuthorWithId> => {
    const existing = await getAuthorByName(database, authorName);
    if (existing.rows.length != 0) {
        return {
            id: existing.rows[0]['rowid'] as number,
            name: existing.rows[0]['name'] as string,
        };
    }

    const resp = await database.execute({
        sql: "INSERT INTO authors (name) VALUES ($name) RETURNING rowId, *", 
        args: {name: authorName}
    });

    return {
        id: resp.rows[0]['rowid'] as number,
        name: resp.rows[0]['name'] as string,
    }
}