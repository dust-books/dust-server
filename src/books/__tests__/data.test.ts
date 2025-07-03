/**
 * Tests for database operations with ISBN support
 */

import { assertEquals, assertExists, assertStrictEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  addBookIfNotExists,
  updateBookMetadata,
  getBookByISBN,
  migrate
} from "../data.ts";
import type { Book, BookWithId } from "../book.ts";
import { createMockDatabase } from "./mocks/filesystem.ts";

// Mock database responses
const createMockBookRow = (overrides: Partial<any> = {}) => ({
  id: 1,
  name: 'Learn C Programming',
  file_path: '/path/to/9781789349917.epub',
  author: 1,
  file_format: 'epub',
  file_size: 1024000,
  page_count: 742,
  cover_image_path: null,
  isbn: '9781789349917',
  publication_date: '2020-06-26',
  publisher: 'Packt Publishing',
  description: 'A comprehensive guide to C programming',
  status: 'active',
  archived_at: null,
  archive_reason: null,
  ...overrides
});

Deno.test("Data Layer - addBookIfNotExists", async (t) => {
  
  await t.step("should add book with ISBN metadata", async () => {
    const mockDb = createMockDatabase();
    
    // Mock getBookByName to return no existing books
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] }) // getBookByName
      .mockResolvedValueOnce({ rows: [createMockBookRow()] }); // INSERT
    
    const book: Book = {
      name: 'Learn C Programming',
      filepath: '/path/to/9781789349917.epub',
      author: 1,
      file_format: 'epub',
      file_size: 1024000,
      page_count: 742,
      isbn: '9781789349917',
      publication_date: '2020-06-26',
      publisher: 'Packt Publishing',
      description: 'A comprehensive guide to C programming'
    };
    
    const result = await addBookIfNotExists(mockDb as any, book);
    
    assertExists(result);
    assertEquals(result.rows.length, 1);
    
    // Verify the INSERT was called with all metadata
    const insertCall = mockDb.execute.mock.calls[1];
    assertEquals(insertCall[0].sql.includes('isbn'), true);
    assertEquals(insertCall[0].sql.includes('publication_date'), true);
    assertEquals(insertCall[0].sql.includes('publisher'), true);
    assertEquals(insertCall[0].sql.includes('description'), true);
    assertEquals(insertCall[0].args.isbn, '9781789349917');
    assertEquals(insertCall[0].args.publisher, 'Packt Publishing');
  });

  await t.step("should skip adding if book already exists", async () => {
    const mockDb = createMockDatabase();
    
    // Mock getBookByName to return existing book
    mockDb.execute.mockResolvedValueOnce({ 
      rows: [createMockBookRow()] 
    });
    
    const book: Book = {
      name: 'Learn C Programming',
      filepath: '/path/to/9781789349917.epub',
      author: 1
    };
    
    const result = await addBookIfNotExists(mockDb as any, book);
    
    assertEquals(result, undefined);
    assertEquals(mockDb.execute.mock.calls.length, 1); // Only getBookByName called
  });

  await t.step("should handle book without ISBN", async () => {
    const mockDb = createMockDatabase();
    
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] }) // getBookByName
      .mockResolvedValueOnce({ rows: [createMockBookRow({ isbn: null })] }); // INSERT
    
    const book: Book = {
      name: 'Regular Book',
      filepath: '/path/to/regular.epub',
      author: 1,
      file_format: 'epub'
    };
    
    const result = await addBookIfNotExists(mockDb as any, book);
    
    assertExists(result);
    
    const insertCall = mockDb.execute.mock.calls[1];
    assertEquals(insertCall[0].args.isbn, null);
    assertEquals(insertCall[0].args.publication_date, null);
    assertEquals(insertCall[0].args.publisher, null);
    assertEquals(insertCall[0].args.description, null);
  });

  await t.step("should extract file format from filepath if not provided", async () => {
    const mockDb = createMockDatabase();
    
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [createMockBookRow()] });
    
    const book: Book = {
      name: 'Test Book',
      filepath: '/path/to/book.mobi',
      author: 1
    };
    
    await addBookIfNotExists(mockDb as any, book);
    
    const insertCall = mockDb.execute.mock.calls[1];
    assertEquals(insertCall[0].args.file_format, 'mobi');
  });
});

Deno.test("Data Layer - updateBookMetadata", async (t) => {
  
  await t.step("should update ISBN and related metadata", async () => {
    const mockDb = createMockDatabase();
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    
    const metadata: Partial<Book> = {
      isbn: '9781789349917',
      publication_date: '2020-06-26',
      publisher: 'Packt Publishing',
      description: 'Updated description',
      page_count: 742
    };
    
    const result = await updateBookMetadata(mockDb as any, 1, metadata);
    
    assertExists(result);
    
    const updateCall = mockDb.execute.mock.calls[0];
    assertEquals(updateCall[0].sql.includes('isbn = $isbn'), true);
    assertEquals(updateCall[0].sql.includes('publication_date = $publication_date'), true);
    assertEquals(updateCall[0].sql.includes('publisher = $publisher'), true);
    assertEquals(updateCall[0].sql.includes('description = $description'), true);
    assertEquals(updateCall[0].sql.includes('page_count = $page_count'), true);
    assertEquals(updateCall[0].sql.includes('updated_at = CURRENT_TIMESTAMP'), true);
    
    assertEquals(updateCall[0].args.id, 1);
    assertEquals(updateCall[0].args.isbn, '9781789349917');
    assertEquals(updateCall[0].args.publisher, 'Packt Publishing');
  });

  await t.step("should update only provided fields", async () => {
    const mockDb = createMockDatabase();
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    
    const metadata: Partial<Book> = {
      isbn: '9781789349917'
    };
    
    const result = await updateBookMetadata(mockDb as any, 1, metadata);
    
    assertExists(result);
    
    const updateCall = mockDb.execute.mock.calls[0];
    assertEquals(updateCall[0].sql.includes('isbn = $isbn'), true);
    assertEquals(updateCall[0].sql.includes('publication_date'), false);
    assertEquals(updateCall[0].sql.includes('publisher'), false);
  });

  await t.step("should return null if no fields to update", async () => {
    const mockDb = createMockDatabase();
    
    const result = await updateBookMetadata(mockDb as any, 1, {});
    
    assertEquals(result, null);
    assertEquals(mockDb.execute.mock.calls.length, 0);
  });

  await t.step("should handle undefined values", async () => {
    const mockDb = createMockDatabase();
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    
    const metadata: Partial<Book> = {
      isbn: undefined,
      publication_date: '2020-06-26',
      description: undefined
    };
    
    await updateBookMetadata(mockDb as any, 1, metadata);
    
    const updateCall = mockDb.execute.mock.calls[0];
    assertEquals(updateCall[0].sql.includes('isbn'), false);
    assertEquals(updateCall[0].sql.includes('publication_date = $publication_date'), true);
    assertEquals(updateCall[0].sql.includes('description'), false);
  });
});

Deno.test("Data Layer - getBookByISBN", async (t) => {
  
  await t.step("should find book by ISBN", async () => {
    const mockDb = createMockDatabase();
    const mockRow = createMockBookRow();
    
    mockDb.execute.mockResolvedValueOnce({ 
      rows: [mockRow] 
    });
    
    const result = await getBookByISBN(mockDb as any, '9781789349917');
    
    assertExists(result);
    assertEquals(result.id, 1);
    assertEquals(result.isbn, '9781789349917');
    assertEquals(result.name, 'Learn C Programming');
    assertEquals(result.publisher, 'Packt Publishing');
    
    const queryCall = mockDb.execute.mock.calls[0];
    assertEquals(queryCall[0].sql, 'SELECT * FROM books WHERE isbn = $isbn LIMIT 1');
    assertEquals(queryCall[0].args.isbn, '9781789349917');
  });

  await t.step("should return null if book not found", async () => {
    const mockDb = createMockDatabase();
    
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    
    const result = await getBookByISBN(mockDb as any, '0000000000');
    
    assertEquals(result, null);
  });

  await t.step("should handle book with null metadata", async () => {
    const mockDb = createMockDatabase();
    const mockRow = createMockBookRow({
      isbn: '9781789349917',
      publication_date: null,
      publisher: null,
      description: null
    });
    
    mockDb.execute.mockResolvedValueOnce({ rows: [mockRow] });
    
    const result = await getBookByISBN(mockDb as any, '9781789349917');
    
    assertExists(result);
    assertEquals(result.isbn, '9781789349917');
    assertEquals(result.publication_date, null);
    assertEquals(result.publisher, null);
    assertEquals(result.description, null);
  });
});

Deno.test("Data Layer - migrate", async (t) => {
  
  await t.step("should run all migrations", async () => {
    const mockDb = createMockDatabase();
    mockDb.migrate.mockResolvedValueOnce(undefined);
    
    await migrate(mockDb as any);
    
    assertEquals(mockDb.migrate.mock.calls.length, 1);
    
    const migrations = mockDb.migrate.mock.calls[0][0];
    assertEquals(Array.isArray(migrations), true);
    assertEquals(migrations.length > 0, true);
    
    // Check that the books table includes ISBN and metadata fields
    const booksTableMigration = migrations.find((m: string) => 
      m.includes('CREATE TABLE IF NOT EXISTS books')
    );
    assertExists(booksTableMigration);
    assertEquals(booksTableMigration.includes('isbn TEXT'), true);
    assertEquals(booksTableMigration.includes('publication_date TEXT'), true);
    assertEquals(booksTableMigration.includes('publisher TEXT'), true);
    assertEquals(booksTableMigration.includes('description TEXT'), true);
    assertEquals(booksTableMigration.includes('status TEXT DEFAULT \'active\''), true);
  });

  await t.step("should include all necessary tables", async () => {
    const mockDb = createMockDatabase();
    mockDb.migrate.mockResolvedValueOnce(undefined);
    
    await migrate(mockDb as any);
    
    const migrations = mockDb.migrate.mock.calls[0][0];
    
    // Check for required tables
    const hasBooks = migrations.some((m: string) => m.includes('CREATE TABLE IF NOT EXISTS books'));
    const hasAuthors = migrations.some((m: string) => m.includes('CREATE TABLE IF NOT EXISTS authors'));
    const hasTags = migrations.some((m: string) => m.includes('CREATE TABLE IF NOT EXISTS tags'));
    const hasBookTags = migrations.some((m: string) => m.includes('CREATE TABLE IF NOT EXISTS book_tags'));
    const hasReadingProgress = migrations.some((m: string) => m.includes('CREATE TABLE IF NOT EXISTS reading_progress'));
    
    assertEquals(hasBooks, true);
    assertEquals(hasAuthors, true);
    assertEquals(hasTags, true);
    assertEquals(hasBookTags, true);
    assertEquals(hasReadingProgress, true);
  });
});