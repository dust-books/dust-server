import {sqliteTable, int, text} from 'drizzle-orm/sqlite-core';

export const booksTable = sqliteTable("books", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    author: int().notNull(),
    filePath: text().notNull().unique(),
});

export const authorsTable = sqliteTable("authors", {
    id: int().primaryKey({autoIncrement: true}),
    name: text().notNull(),
});
