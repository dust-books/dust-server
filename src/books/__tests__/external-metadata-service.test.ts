/**
 * Tests for External Metadata Service
 */

import { assertEquals, assertExists, assertStrictEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  GoogleBooksAPI,
  OpenLibraryAPI,
  ExternalMetadataService,
  type ExternalBookMetadata
} from "../external-metadata-service.ts";
import {
  mockGoogleBooksResponse,
  mockGoogleBooksEmptyResponse,
  mockGoogleBooksSeriesResponse,
  mockGoogleBooksMatureResponse,
  mockGoogleBooksSearchResponse
} from "./mocks/google-books.ts";
import {
  mockOpenLibraryResponse,
  mockOpenLibraryEmptyResponse,
  mockOpenLibrarySearchResponse
} from "./mocks/openlibrary.ts";

// Mock fetch function
const createMockFetch = (responses: Record<string, any>) => {
  return (url: string): Promise<Response> => {
    const mockResponse = responses[url] || { status: 404, ok: false };
    
    if (mockResponse.status && !mockResponse.ok) {
      return Promise.resolve({
        ok: false,
        status: mockResponse.status,
        json: () => Promise.resolve(mockResponse)
      } as Response);
    }
    
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse)
    } as Response);
  };
};

Deno.test("GoogleBooksAPI - lookupByISBN", async (t) => {
  
  await t.step("should fetch book metadata by ISBN", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': mockGoogleBooksResponse
    }) as any;
    
    try {
      const api = new GoogleBooksAPI();
      const result = await api.lookupByISBN("9781789349917");
      
      assertExists(result);
      assertEquals(result.isbn, "9781789349917");
      assertEquals(result.title, "Learn C Programming");
      assertEquals(result.authors?.[0], "Jeff Szuhay");
      assertEquals(result.publisher, "Packt Publishing");
      assertEquals(result.publishedDate, "2020-06-26");
      assertEquals(result.pageCount, 742);
      assertEquals(result.language, "en");
      assertEquals(result.rating, 4.2);
      assertEquals(result.maturityRating, "NOT_MATURE");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should handle ISBN with hyphens", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': mockGoogleBooksResponse
    }) as any;
    
    try {
      const api = new GoogleBooksAPI();
      const result = await api.lookupByISBN("978-1-789-34991-7");
      
      assertExists(result);
      assertEquals(result.isbn, "9781789349917");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should return null for no results", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:0000000000': mockGoogleBooksEmptyResponse
    }) as any;
    
    try {
      const api = new GoogleBooksAPI();
      const result = await api.lookupByISBN("0000000000");
      
      assertEquals(result, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should extract series information", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9780747532699': mockGoogleBooksSeriesResponse
    }) as any;
    
    try {
      const api = new GoogleBooksAPI();
      const result = await api.lookupByISBN("9780747532699");
      
      assertExists(result);
      assertEquals(result.series, "Harry Potter");
      assertEquals(result.seriesNumber, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should handle API errors gracefully", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': { status: 403, ok: false }
    }) as any;
    
    try {
      const api = new GoogleBooksAPI();
      const result = await api.lookupByISBN("9781789349917");
      
      assertEquals(result, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("GoogleBooksAPI - lookupByTitle", async (t) => {
  
  await t.step("should search books by title", async () => {
    const originalFetch = globalThis.fetch;
    const expectedUrl = 'https://www.googleapis.com/books/v1/volumes?q=intitle%3A%22The%20Great%20Gatsby%22&maxResults=5';
    globalThis.fetch = createMockFetch({
      [expectedUrl]: mockGoogleBooksSearchResponse
    }) as any;
    
    try {
      const api = new GoogleBooksAPI();
      const results = await api.lookupByTitle("The Great Gatsby");
      
      assertEquals(results.length, 2);
      assertEquals(results[0].title, "The Great Gatsby");
      assertEquals(results[0].authors?.[0], "F. Scott Fitzgerald");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should search books by title and author", async () => {
    const originalFetch = globalThis.fetch;
    const expectedUrl = 'https://www.googleapis.com/books/v1/volumes?q=intitle%3A%22The%20Great%20Gatsby%22%2Binauthor%3A%22F.%20Scott%20Fitzgerald%22&maxResults=5';
    globalThis.fetch = createMockFetch({
      [expectedUrl]: mockGoogleBooksSearchResponse
    }) as any;
    
    try {
      const api = new GoogleBooksAPI();
      const results = await api.lookupByTitle("The Great Gatsby", "F. Scott Fitzgerald");
      
      assertEquals(results.length, 2);
      assertEquals(results[0].authors?.[0], "F. Scott Fitzgerald");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("OpenLibraryAPI - lookupByISBN", async (t) => {
  
  await t.step("should fetch book metadata by ISBN", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://openlibrary.org/api/books?bibkeys=ISBN:9781789349917&format=json&jscmd=data': mockOpenLibraryResponse
    }) as any;
    
    try {
      const api = new OpenLibraryAPI();
      const result = await api.lookupByISBN("9781789349917");
      
      assertExists(result);
      assertEquals(result.isbn, "9781789349917");
      assertEquals(result.title, "Learn C Programming");
      assertEquals(result.authors?.[0], "Jeff Szuhay");
      assertEquals(result.publisher, "Packt Publishing");
      assertEquals(result.pageCount, 742);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should return null for no results", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://openlibrary.org/api/books?bibkeys=ISBN:0000000000&format=json&jscmd=data': mockOpenLibraryEmptyResponse
    }) as any;
    
    try {
      const api = new OpenLibraryAPI();
      const result = await api.lookupByISBN("0000000000");
      
      assertEquals(result, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("OpenLibraryAPI - lookupByTitle", async (t) => {
  
  await t.step("should search books by title", async () => {
    const originalFetch = globalThis.fetch;
    const expectedUrl = 'https://openlibrary.org/search.json?q=title%3A%22The%20Catcher%20in%20the%20Rye%22&limit=5';
    globalThis.fetch = createMockFetch({
      [expectedUrl]: mockOpenLibrarySearchResponse
    }) as any;
    
    try {
      const api = new OpenLibraryAPI();
      const results = await api.lookupByTitle("The Catcher in the Rye");
      
      assertEquals(results.length, 2);
      assertEquals(results[0].title, "The Catcher in the Rye");
      assertEquals(results[0].authors?.[0], "J.D. Salinger");
      assertExists(results[0].coverImageUrl);
      assertEquals(results[0].coverImageUrl, "https://covers.openlibrary.org/b/id/8567531-L.jpg");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("ExternalMetadataService - lookupByISBN", async (t) => {
  
  await t.step("should try Google Books first, then OpenLibrary", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': mockGoogleBooksResponse,
      'https://openlibrary.org/api/books?bibkeys=ISBN:9781789349917&format=json&jscmd=data': mockOpenLibraryResponse
    }) as any;
    
    try {
      const service = new ExternalMetadataService();
      const result = await service.lookupByISBN("9781789349917");
      
      assertExists(result);
      assertEquals(result.title, "Learn C Programming");
      // Should come from Google Books (first source)
      assertEquals(result.rating, 4.2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should fallback to OpenLibrary if Google Books fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:9781789349917': { status: 403, ok: false },
      'https://openlibrary.org/api/books?bibkeys=ISBN:9781789349917&format=json&jscmd=data': mockOpenLibraryResponse
    }) as any;
    
    try {
      const service = new ExternalMetadataService();
      const result = await service.lookupByISBN("9781789349917");
      
      assertExists(result);
      assertEquals(result.title, "Learn C Programming");
      // Should come from OpenLibrary (fallback)
      assertEquals(result.rating, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should return null if all sources fail", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createMockFetch({
      'https://www.googleapis.com/books/v1/volumes?q=isbn:0000000000': mockGoogleBooksEmptyResponse,
      'https://openlibrary.org/api/books?bibkeys=ISBN:0000000000&format=json&jscmd=data': mockOpenLibraryEmptyResponse
    }) as any;
    
    try {
      const service = new ExternalMetadataService();
      const result = await service.lookupByISBN("0000000000");
      
      assertEquals(result, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should reject invalid ISBN", async () => {
    const service = new ExternalMetadataService();
    const result = await service.lookupByISBN("123");
    
    assertEquals(result, null);
  });
});

Deno.test("ExternalMetadataService - detectGenresFromCategories", async (t) => {
  
  await t.step("should detect genres from categories", () => {
    const service = new ExternalMetadataService();
    const genres = service.detectGenresFromCategories([
      "Fiction",
      "Science Fiction",
      "Fantasy",
      "Young Adult"
    ]);
    
    assertEquals(genres.includes("Fiction"), true);
    assertEquals(genres.includes("Sci-Fi"), true);
    assertEquals(genres.includes("Fantasy"), true);
    assertEquals(genres.includes("Young Adult"), true);
  });

  await t.step("should handle case insensitive matching", () => {
    const service = new ExternalMetadataService();
    const genres = service.detectGenresFromCategories([
      "FICTION",
      "science fiction",
      "Self-Help"
    ]);
    
    assertEquals(genres.includes("Fiction"), true);
    assertEquals(genres.includes("Sci-Fi"), true);
    assertEquals(genres.includes("Self-Help"), true);
  });

  await t.step("should return empty array for unknown categories", () => {
    const service = new ExternalMetadataService();
    const genres = service.detectGenresFromCategories([
      "Unknown Category",
      "Random Stuff"
    ]);
    
    assertEquals(genres.length, 0);
  });

  await t.step("should handle partial matches", () => {
    const service = new ExternalMetadataService();
    const genres = service.detectGenresFromCategories([
      "Cooking & Food",
      "Computer Science",
      "Historical Fiction"
    ]);
    
    assertEquals(genres.includes("Cooking"), true);
    assertEquals(genres.includes("Science"), true);
    assertEquals(genres.includes("Fiction"), true);
    assertEquals(genres.includes("History"), true);
  });
});

Deno.test("ExternalMetadataService - detectContentRating", async (t) => {
  
  await t.step("should detect mature content from Google Books", () => {
    const service = new ExternalMetadataService();
    const metadata: ExternalBookMetadata = {
      maturityRating: "MATURE",
      title: "Adult Book",
      categories: []
    };
    
    const ratings = service.detectContentRating(metadata);
    assertEquals(ratings.includes("Mature"), true);
  });

  await t.step("should detect all ages content", () => {
    const service = new ExternalMetadataService();
    const metadata: ExternalBookMetadata = {
      maturityRating: "NOT_MATURE",
      title: "Children's Book",
      categories: ["Children"]
    };
    
    const ratings = service.detectContentRating(metadata);
    assertEquals(ratings.includes("All Ages"), true);
  });

  await t.step("should detect NSFW content from description", () => {
    const service = new ExternalMetadataService();
    const metadata: ExternalBookMetadata = {
      title: "Adult Romance",
      description: "An explicit erotic novel for adult readers",
      categories: ["Romance", "Adult"]
    };
    
    const ratings = service.detectContentRating(metadata);
    assertEquals(ratings.includes("NSFW"), true);
  });

  await t.step("should detect teen content", () => {
    const service = new ExternalMetadataService();
    const metadata: ExternalBookMetadata = {
      title: "Teen Drama",
      description: "A young adult novel about teenage life",
      categories: ["Young Adult", "Teen"]
    };
    
    const ratings = service.detectContentRating(metadata);
    assertEquals(ratings.includes("Teen"), true);
  });

  await t.step("should default to all ages if no indicators", () => {
    const service = new ExternalMetadataService();
    const metadata: ExternalBookMetadata = {
      title: "Generic Book",
      description: "A book about programming",
      categories: ["Programming"]
    };
    
    const ratings = service.detectContentRating(metadata);
    assertEquals(ratings.includes("All Ages"), true);
  });
});