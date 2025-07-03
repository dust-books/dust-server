/**
 * Integration tests for the complete ISBN metadata workflow
 */

import { assertEquals, assertExists, assertStrictEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { BookService } from "../book-service.ts";
import { BookCrawler } from "../book-crawler.ts";
import { createMockWalker, mockFileEntries, createMockDatabase } from "./mocks/filesystem.ts";
import { mockGoogleBooksResponse } from "./mocks/google-books.ts";

// Mock the dustService global
const mockDustService = {
  database: createMockDatabase()
};

// Mock external dependencies
const originalDustService = (globalThis as any).dustService;

Deno.test("Integration - Complete ISBN Workflow", async (t) => {
  
  await t.step("should process ISBN file from discovery to database", async () => {
    // Setup mocks
    (globalThis as any).dustService = mockDustService;
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = ((url: string) => {
      if (url.includes('isbn:9781789349917')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockGoogleBooksResponse)
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({})
      } as Response);
    }) as any;
    
    // Mock database responses
    mockDustService.database.execute
      // addAuthorIfNotExists - check existing
      .mockResolvedValueOnce({ rows: [] })
      // addAuthorIfNotExists - insert new
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Jeff Szuhay' }] })
      // addBookIfNotExists - check existing
      .mockResolvedValueOnce({ rows: [] })
      // addBookIfNotExists - insert new
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Learn C Programming' }] })
      // Tag operations (multiple calls)
      .mockResolvedValue({ rows: [] });
    
    try {
      // Create a book service instance
      const bookService = new BookService();
      
      // Mock the directory scanning to return our test file
      const originalPopulateBooksDB = bookService.populateBooksDB.bind(bookService);
      bookService.populateBooksDB = async (dirs: string[], apiKey?: string, enableExternal?: boolean): Promise<void> => {
        // Create a mock crawler with our test data
        const mockWalker = createMockWalker([
          {
            path: '/storage/books/Jeff Szuhay/Learn C Programming/9781789349917.epub',
            name: '9781789349917.epub',
            isFile: true,
            isDirectory: false,
            isSymlink: false
          }
        ]);
        
        const crawler = new BookCrawler(mockWalker, apiKey, enableExternal);
        
        // Mock the metadata extractor to return basic metadata
        (crawler as any).metadataExtractor = {
          extractMetadata: async () => ({
            fileFormat: 'epub',
            fileSize: 1024000,
            title: 'Learn C Programming',
            author: 'Jeff Szuhay'
          }),
          detectGenres: () => ['Programming', 'Technology'],
          detectContentRating: () => ['All Ages']
        };
        
        // Get the enhanced books
        const enhancedBooks = await crawler.crawlForBooksWithMetadata();
        
        // Process them (simplified version of the actual logic)
        for (const enhancedBook of enhancedBooks) {
          // Verify the book was processed correctly
          assertEquals(enhancedBook.isbn, '9781789349917');
          assertEquals(enhancedBook.name, 'Learn C Programming');
          assertEquals(enhancedBook.author, 'Jeff Szuhay');
          assertExists(enhancedBook.externalMetadata);
          assertEquals(enhancedBook.externalMetadata?.publisher, 'Packt Publishing');
          assertEquals(enhancedBook.suggestedTags.includes('ISBN Metadata'), true);
          assertEquals(enhancedBook.suggestedTags.includes('Programming'), true);
        }
        
        // Don't return anything - function should be void
      };
      
      // Run the population process
      const result = await bookService.populateBooksDB(['/storage/books'], 'test-api-key', true);
      
      // Verify database interactions
      const calls = mockDustService.database.execute.mock.calls;
      assertEquals(calls.length >= 4, true); // Should have multiple database calls
      
      // Verify author was added
      const authorCheck = calls.find((call: any[]) => 
        call[0].sql?.includes('SELECT * FROM authors WHERE name = $name')
      );
      assertExists(authorCheck);
      
      // Verify book was added with metadata
      const bookInsert = calls.find((call: any[]) => 
        call[0].sql?.includes('INSERT INTO books') && call[0].sql?.includes('isbn')
      );
      assertExists(bookInsert);
      assertEquals(bookInsert[0].args.isbn, '9781789349917');
      assertEquals(bookInsert[0].args.publisher, 'Packt Publishing');
      
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).dustService = originalDustService;
    }
  });

  await t.step("should handle mixed ISBN and regular files", async () => {
    // Clear previous mock state
    mockDustService.database.mockClear();
    
    // Setup mocks
    (globalThis as any).dustService = mockDustService;
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = ((url: string) => {
      if (url.includes('isbn:9781789349917')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockGoogleBooksResponse)
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] }) // Empty response for other ISBNs
      } as Response);
    }) as any;
    
    // Reset mock database
    const mockDb = createMockDatabase();
    (globalThis as any).dustService.database = mockDb;
    
    // Mock all database calls to succeed
    mockDb.execute.mockResolvedValue({ rows: [] });
    
    try {
      const mockWalker = createMockWalker([
        // ISBN file with metadata
        {
          path: '/storage/books/Jeff Szuhay/Learn C Programming/9781789349917.epub',
          name: '9781789349917.epub',
          isFile: true,
          isDirectory: false,
          isSymlink: false
        },
        // Regular file without ISBN
        {
          path: '/storage/books/George Orwell/1984/nineteen_eighty_four.epub',
          name: 'nineteen_eighty_four.epub',
          isFile: true,
          isDirectory: false,
          isSymlink: false
        }
      ]);
      
      const crawler = new BookCrawler(mockWalker, 'test-api-key', true);
      
      // Mock the metadata extractor
      (crawler as any).metadataExtractor = {
        extractMetadata: async (filePath: string) => {
          if (filePath.includes('9781789349917')) {
            return {
              fileFormat: 'epub',
              fileSize: 1024000,
              title: 'Learn C Programming',
              author: 'Jeff Szuhay'
            };
          }
          return {
            fileFormat: 'epub',
            fileSize: 800000,
            title: '1984',
            author: 'George Orwell'
          };
        },
        detectGenres: (metadata: any, filePath: string) => {
          if (filePath.includes('programming')) return ['Programming'];
          return ['Fiction', 'Dystopian'];
        },
        detectContentRating: () => ['All Ages']
      };
      
      const results = await crawler.crawlForBooksWithMetadata();
      
      assertEquals(results.length, 2);
      
      // ISBN file should have external metadata
      const isbnBook = results.find(r => r.isbn === '9781789349917');
      assertExists(isbnBook);
      assertEquals(isbnBook.externalMetadata?.title, 'Learn C Programming');
      assertEquals(isbnBook.suggestedTags.includes('ISBN Metadata'), true);
      
      // Regular file should not have external metadata
      const regularBook = results.find(r => r.filepath.includes('nineteen_eighty_four'));
      assertExists(regularBook);
      assertEquals(regularBook.isbn, undefined);
      assertEquals(regularBook.externalMetadata, undefined);
      assertEquals(regularBook.suggestedTags.includes('No ISBN'), true);
      
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).dustService = originalDustService;
    }
  });

  await t.step("should handle external API failures gracefully", async () => {
    // Clear previous mock state
    mockDustService.database.mockClear();
    
    // Setup mocks
    (globalThis as any).dustService = mockDustService;
    const originalFetch = globalThis.fetch;
    
    // Mock fetch to always fail
    globalThis.fetch = (() => {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'API Error' })
      } as Response);
    }) as any;
    
    try {
      const mockWalker = createMockWalker([
        {
          path: '/storage/books/Jeff Szuhay/Learn C Programming/9781789349917.epub',
          name: '9781789349917.epub',
          isFile: true,
          isDirectory: false,
          isSymlink: false
        }
      ]);
      
      const crawler = new BookCrawler(mockWalker, 'test-api-key', true);
      
      // Mock the metadata extractor
      (crawler as any).metadataExtractor = {
        extractMetadata: async () => ({
          fileFormat: 'epub',
          fileSize: 1024000
        }),
        detectGenres: () => ['Programming'],
        detectContentRating: () => ['All Ages']
      };
      
      const results = await crawler.crawlForBooksWithMetadata();
      
      assertEquals(results.length, 1);
      
      const result = results[0];
      assertEquals(result.isbn, '9781789349917'); // ISBN should still be detected
      assertEquals(result.externalMetadata, undefined); // No external metadata due to API failure
      assertEquals(result.suggestedTags.includes('ISBN Metadata'), true); // Should still indicate ISBN was found
      
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).dustService = originalDustService;
    }
  });
});

Deno.test("Integration - Performance", async (t) => {
  
  await t.step("should handle large number of files efficiently", async () => {
    const originalFetch = globalThis.fetch;
    
    // Mock fast API responses
    globalThis.fetch = (() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] })
      } as Response);
    }) as any;
    
    try {
      // Create 100 mock files (mix of ISBN and regular)
      const manyFiles = Array.from({ length: 100 }, (_, i) => {
        const isISBN = i % 3 === 0; // Every 3rd file has an ISBN
        if (isISBN) {
          const isbn = `978${String(i).padStart(10, '0')}`;
          return {
            path: `/storage/books/Author${i}/Book${i}/${isbn}.epub`,
            name: `${isbn}.epub`,
            isFile: true,
            isDirectory: false,
            isSymlink: false
          };
        } else {
          return {
            path: `/storage/books/Author${i}/Book${i}/book${i}.epub`,
            name: `book${i}.epub`,
            isFile: true,
            isDirectory: false,
            isSymlink: false
          };
        }
      });
      
      const mockWalker = createMockWalker(manyFiles);
      const crawler = new BookCrawler(mockWalker, 'test-api-key', true);
      
      // Mock fast metadata extraction
      (crawler as any).metadataExtractor = {
        extractMetadata: async () => ({
          fileFormat: 'epub',
          fileSize: 1000000
        }),
        detectGenres: () => ['Fiction'],
        detectContentRating: () => ['All Ages']
      };
      
      const startTime = Date.now();
      const results = await crawler.crawlForBooksWithMetadata();
      const endTime = Date.now();
      
      assertEquals(results.length, 100);
      
      // Should complete in reasonable time (less than 10 seconds for 100 files)
      const executionTime = endTime - startTime;
      assertEquals(executionTime < 10000, true, `Execution took ${executionTime}ms, should be under 10s`);
      
      // Verify ISBN files were properly processed
      const isbnFiles = results.filter(r => r.isbn);
      assertEquals(isbnFiles.length > 30, true); // Should have ~33 ISBN files
      
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});