/**
 * Tests for BookCrawler with ISBN integration
 */

import { assertEquals, assertExists, assertStrictEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { BookCrawler, type EnhancedCrawlResult } from "../book-crawler.ts";
import {
  createMockWalker,
  mockFileEntries,
  mockBookMetadata
} from "./mocks/filesystem.ts";
import {
  mockGoogleBooksResponse,
  mockGoogleBooksEmptyResponse
} from "./mocks/google-books.ts";
import { mockOpenLibraryResponse } from "./mocks/openlibrary.ts";

// Mock the MetadataExtractor
class MockMetadataExtractor {
  async extractMetadata(filePath: string, enableExternalLookup: boolean = false) {
    if (filePath.includes("9781789349917")) {
      return {
        ...mockBookMetadata.enhanced,
        title: "Learn C Programming",
        author: "Jeff Szuhay"
      };
    }
    if (filePath.includes("George Orwell") || filePath.includes("nineteen_eighty_four")) {
      return {
        ...mockBookMetadata.basic,
        title: undefined,  // No title so path parsing will be used
        author: undefined   // No author so path parsing will be used
      };
    }
    return mockBookMetadata.basic;
  }

  detectGenres(metadata: any, filePath: string): string[] {
    if (filePath.includes("programming") || filePath.includes("9781789349917")) {
      return ["Programming", "Technology"];
    }
    return ["Fiction"];
  }

  detectContentRating(metadata: any, filePath: string): string[] {
    return ["All Ages"];
  }
}

// Mock fetch for external API calls
const createMockFetch = (responses: Record<string, any>) => {
  return (url: string): Promise<Response> => {
    const mockResponse = responses[url] || mockGoogleBooksEmptyResponse;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse)
    } as Response);
  };
};

Deno.test("BookCrawler - crawlForBooksWithMetadata", async (t) => {
  
  await t.step("should process ISBN files with external metadata", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': mockGoogleBooksResponse
    }) as any;
    
    try {
      const mockWalker = createMockWalker(mockFileEntries.isbnFiles.slice(0, 1)); // Just the C programming book
      const crawler = new BookCrawler(mockWalker, "test-api-key", true);
      
      // Mock the metadata extractor
      (crawler as any).metadataExtractor = new MockMetadataExtractor();
      
      // Mock the external metadata service
      (crawler as any).externalMetadataService = {
        lookupByISBN: async (isbn: string) => {
          if (isbn === "9781789349917") {
            return {
              isbn: "9781789349917",
              title: "Learn C Programming",
              authors: ["Jeff Szuhay"],
              publisher: "Packt Publishing",
              publishedDate: "2020-06-26",
              description: "Get started with writing simple programs in C while learning the skills that will help you work with practically any programming language",
              pageCount: 742,
              categories: ["Computers"],
              language: "en"
            };
          }
          return null;
        },
        detectGenresFromCategories: (categories: string[]) => {
          return categories.includes("Computers") ? ["Programming", "Technology"] : ["Fiction"];
        },
        detectContentRating: (metadata: any) => {
          return ["All Ages"];
        },
        generateAuthorTags: (authorDetails: any) => {
          return [];
        }
      };
      
      const results = await crawler.crawlForBooksWithMetadata();
      
      assertEquals(results.length, 1);
      
      const result = results[0];
      assertEquals(result.isbn, "9781789349917");
      assertEquals(result.name, "Learn C Programming"); // Should come from external metadata
      assertEquals(result.author, "Jeff Szuhay"); // Should come from external metadata
      assertExists(result.externalMetadata);
      assertEquals(result.externalMetadata?.title, "Learn C Programming");
      assertEquals(result.externalMetadata?.authors?.[0], "Jeff Szuhay");
      assertEquals(result.suggestedTags.includes("ISBN Metadata"), true);
      assertEquals(result.suggestedTags.includes("EPUB"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should process regular files without ISBN", async () => {
    const mockWalker = createMockWalker(mockFileEntries.regularFiles.slice(0, 1));
    const crawler = new BookCrawler(mockWalker, undefined, false);
    
    // Mock the metadata extractor
    (crawler as any).metadataExtractor = new MockMetadataExtractor();
    
    // Mock the external metadata service
    (crawler as any).externalMetadataService = {
      lookupByISBN: async (isbn: string) => null,
      detectGenresFromCategories: (categories: string[]) => ["Fiction"],
      detectContentRating: (metadata: any) => ["All Ages"],
      generateAuthorTags: (authorDetails: any) => []
    };
    
    const results = await crawler.crawlForBooksWithMetadata();
    
    assertEquals(results.length, 1);
    
    const result = results[0];
    assertEquals(result.isbn, undefined);
    assertEquals(result.name, "1984"); // Should come from path parsing
    assertEquals(result.author, "George Orwell"); // Should come from path parsing
    assertEquals(result.externalMetadata, undefined);
    assertEquals(result.suggestedTags.includes("No ISBN"), true);
    assertEquals(result.suggestedTags.includes("EPUB"), true);
  });

  await t.step("should handle mixed ISBN and regular files", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': mockGoogleBooksResponse,
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781449355739': mockGoogleBooksEmptyResponse
    }) as any;
    
    try {
      const mockWalker = createMockWalker(mockFileEntries.mixedFiles);
      const crawler = new BookCrawler(mockWalker, "test-api-key", true);
      
      // Mock the metadata extractor
      (crawler as any).metadataExtractor = new MockMetadataExtractor();
      
      // Mock the external metadata service
      (crawler as any).externalMetadataService = {
        lookupByISBN: async (isbn: string) => {
          if (isbn === "9781789349917") {
            return {
              isbn: "9781789349917",
              title: "Learn C Programming",
              authors: ["Jeff Szuhay"],
              publisher: "Packt Publishing",
              publishedDate: "2020-06-26",
              description: "Get started with writing simple programs in C while learning the skills that will help you work with practically any programming language",
              pageCount: 742,
              categories: ["Computers"],
              language: "en"
            };
          }
          return null;
        },
        detectGenresFromCategories: (categories: string[]) => {
          return categories.includes("Computers") ? ["Programming", "Technology"] : ["Fiction"];
        },
        detectContentRating: (metadata: any) => {
          return ["All Ages"];
        },
        generateAuthorTags: (authorDetails: any) => {
          return [];
        }
      };
      
      const results = await crawler.crawlForBooksWithMetadata();
      
      assertEquals(results.length, 3);
      
      // First file - ISBN with external metadata
      const isbnResult = results.find(r => r.isbn === "9781789349917");
      assertExists(isbnResult);
      assertEquals(isbnResult.externalMetadata?.title, "Learn C Programming");
      assertEquals(isbnResult.suggestedTags.includes("ISBN Metadata"), true);
      
      // Second file - regular file
      const regularResult = results.find(r => r.filepath.includes("nineteen_eighty_four"));
      assertExists(regularResult);
      assertEquals(regularResult.isbn, undefined);
      assertEquals(regularResult.suggestedTags.includes("No ISBN"), true);
      
      // Third file - ISBN but no external metadata found
      const isbnNoMetadataResult = results.find(r => r.isbn === "9781449355739");
      assertExists(isbnNoMetadataResult);
      assertEquals(isbnNoMetadataResult.externalMetadata, undefined);
      assertEquals(isbnNoMetadataResult.suggestedTags.includes("ISBN Metadata"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should handle invalid ISBN files gracefully", async () => {
    const mockWalker = createMockWalker(mockFileEntries.invalidFiles);
    const crawler = new BookCrawler(mockWalker, undefined, false);
    
    // Mock the metadata extractor
    (crawler as any).metadataExtractor = new MockMetadataExtractor();
    
    // Mock the external metadata service
    (crawler as any).externalMetadataService = {
      lookupByISBN: async (isbn: string) => null,
      detectGenresFromCategories: (categories: string[]) => ["Fiction"],
      detectContentRating: (metadata: any) => ["All Ages"],
      generateAuthorTags: (authorDetails: any) => []
    };
    
    const results = await crawler.crawlForBooksWithMetadata();
    
    assertEquals(results.length, 1); // Only the .epub file should be processed (txt is not supported)
    
    const result = results[0];
    assertEquals(result.isbn, undefined); // Invalid ISBN should be rejected
    assertEquals(result.suggestedTags.includes("No ISBN"), true);
  });

  await t.step("should fallback gracefully on processing errors", async () => {
    const mockWalker = createMockWalker([
      {
        path: '/storage/books/Author/Book/9781789349917.epub',
        name: '9781789349917.epub',
        isFile: true,
        isDirectory: false,
        isSymlink: false
      }
    ]);
    const crawler = new BookCrawler(mockWalker, undefined, false);
    
    // Mock the metadata extractor to throw an error
    (crawler as any).metadataExtractor = {
      extractMetadata: () => {
        throw new Error("Metadata extraction failed");
      }
    };
    
    const results = await crawler.crawlForBooksWithMetadata();
    
    assertEquals(results.length, 1);
    
    const result = results[0];
    assertEquals(result.isbn, "9781789349917"); // ISBN should still be extracted
    assertEquals(result.name, "Book"); // Should fallback to path parsing
    assertEquals(result.author, "Author");
    assertEquals(result.suggestedTags.includes("ISBN Metadata"), true);
    assertEquals(result.suggestedTags.includes("Unknown"), true);
  });

  await t.step("should enhance genres with external metadata", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': {
        items: [{
          volumeInfo: {
            ...mockGoogleBooksResponse.items[0].volumeInfo,
            categories: ["Computers", "Programming Languages", "C Programming"]
          }
        }]
      }
    }) as any;
    
    try {
      const mockWalker = createMockWalker([mockFileEntries.isbnFiles[0]]);
      const crawler = new BookCrawler(mockWalker, "test-api-key", true);
      
      // Mock the metadata extractor
      (crawler as any).metadataExtractor = new MockMetadataExtractor();
      
      // Mock the external metadata service
      (crawler as any).externalMetadataService = {
        lookupByISBN: async (isbn: string) => {
          if (isbn === "9781789349917") {
            return {
              isbn: "9781789349917",
              title: "Learn C Programming",
              authors: ["Jeff Szuhay"],
              publisher: "Packt Publishing",
              publishedDate: "2020-06-26",
              description: "Get started with writing simple programs in C while learning the skills that will help you work with practically any programming language",
              pageCount: 742,
              categories: ["Computers"],
              language: "en"
            };
          }
          return null;
        },
        detectGenresFromCategories: (categories: string[]) => {
          return categories.includes("Computers") ? ["Programming", "Technology"] : ["Fiction"];
        },
        detectContentRating: (metadata: any) => {
          return ["All Ages"];
        },
        generateAuthorTags: (authorDetails: any) => {
          return [];
        }
      };
      
      const results = await crawler.crawlForBooksWithMetadata();
      
      assertEquals(results.length, 1);
      
      const result = results[0];
      // Should have genres from both internal detection and external metadata
      assertEquals(result.suggestedTags.includes("Programming"), true);
      assertEquals(result.suggestedTags.includes("Technology"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should detect series information", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9780747532699': {
        items: [{
          volumeInfo: {
            title: "Harry Potter and the Philosopher's Stone (Harry Potter #1)",
            authors: ["J.K. Rowling"],
            publisher: "Bloomsbury",
            categories: ["Fiction", "Fantasy"],
            industryIdentifiers: [
              { type: 'ISBN_13', identifier: '9780747532699' }
            ]
          }
        }]
      }
    }) as any;
    
    try {
      const mockWalker = createMockWalker([mockFileEntries.isbnFiles[1]]); // Harry Potter file
      const crawler = new BookCrawler(mockWalker, "test-api-key", true);
      
      // Mock the metadata extractor
      (crawler as any).metadataExtractor = new MockMetadataExtractor();
      
      // Mock the external metadata service with Harry Potter metadata
      (crawler as any).externalMetadataService = {
        lookupByISBN: async (isbn: string) => {
          if (isbn === "9780747532699") {
            return {
              isbn: "9780747532699",
              title: "Harry Potter and the Philosopher's Stone",
              authors: ["J.K. Rowling"],
              publisher: "Bloomsbury",
              publishedDate: "1997-06-26",
              description: "The first book in the Harry Potter series",
              pageCount: 223,
              categories: ["Fiction", "Fantasy"],
              language: "en",
              series: "Harry Potter",
              seriesNumber: 1
            };
          }
          return null;
        },
        detectGenresFromCategories: (categories: string[]) => {
          return categories.includes("Fantasy") ? ["Fantasy", "Fiction"] : ["Fiction"];
        },
        detectContentRating: (metadata: any) => {
          return ["All Ages"];
        },
        generateAuthorTags: (authorDetails: any) => {
          return [];
        }
      };
      
      const results = await crawler.crawlForBooksWithMetadata();
      
      assertEquals(results.length, 1);
      
      const result = results[0];
      assertEquals(result.externalMetadata?.series, "Harry Potter");
      assertEquals(result.externalMetadata?.seriesNumber, 1);
      assertEquals(result.suggestedTags.includes("Series"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should handle external lookup disabled", async () => {
    const mockWalker = createMockWalker([mockFileEntries.isbnFiles[0]]);
    const crawler = new BookCrawler(mockWalker, undefined, false); // External lookup disabled
    
    // Mock the metadata extractor
    (crawler as any).metadataExtractor = new MockMetadataExtractor();
    
    // Mock the external metadata service (even though disabled, it needs to exist)
    (crawler as any).externalMetadataService = {
      lookupByISBN: async (isbn: string) => null,
      detectGenresFromCategories: (categories: string[]) => ["Fiction"],
      detectContentRating: (metadata: any) => ["All Ages"],
      generateAuthorTags: (authorDetails: any) => []
    };
    
    const results = await crawler.crawlForBooksWithMetadata();
    
    assertEquals(results.length, 1);
    
    const result = results[0];
    assertEquals(result.isbn, "9781789349917"); // ISBN should still be detected
    assertEquals(result.externalMetadata, undefined); // No external metadata
    assertEquals(result.suggestedTags.includes("ISBN Metadata"), true);
  });
});

Deno.test("BookCrawler - legacy crawlForBooks", async (t) => {
  
  await t.step("should work with legacy crawling method", async () => {
    const mockWalker = createMockWalker(mockFileEntries.regularFiles);
    const crawler = new BookCrawler(mockWalker, undefined, false);
    
    const results = await crawler.crawlForBooks();
    
    assertEquals(results.length, 2);
    assertEquals(results[0].name, "1984");
    assertEquals(results[0].author, "George Orwell");
    assertEquals(results[0].filepath, "/storage/books/George Orwell/1984/nineteen_eighty_four.epub");
  });
});