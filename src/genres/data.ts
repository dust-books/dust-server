import {sqliteTable, int, text} from 'drizzle-orm/sqlite-core';

export const genresTable = sqliteTable("genres", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
});