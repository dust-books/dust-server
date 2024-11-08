import {sqliteTable, int, text} from 'drizzle-orm/sqlite-core';

export const usersTable = sqliteTable("users", {
    id: int().primaryKey({ autoIncrement: true }),
    displayName: text().notNull(),
    password: int().notNull(),
    email: text().notNull().unique(),
  });

export const sessionsTable = sqliteTable("sessions", {
    id: int().primaryKey({autoIncrement: true}),
    sessionToken: text().notNull(),
    expiresAt: text().notNull(),
})