/**
 * Test runner script for all ISBN metadata tests
 * Run with: deno test src/books/__tests__/run-tests.ts
 */

// Import all test files to run them
import "./isbn-utils.test.ts";
import "./external-metadata-service.test.ts";
import "./book-crawler.test.ts";
import "./data.test.ts";
import "./integration.test.ts";

console.log(`
📚 Running ISBN Metadata Tests
==============================

Test Coverage:
✅ ISBN Utilities - validation, extraction, formatting
✅ External Metadata Service - Google Books & OpenLibrary APIs
✅ Book Crawler - ISBN detection and metadata integration
✅ Database Operations - storing and retrieving ISBN metadata
✅ Integration Tests - complete workflow from file to database

To run specific test files:
- deno test src/books/__tests__/isbn-utils.test.ts
- deno test src/books/__tests__/external-metadata-service.test.ts
- deno test src/books/__tests__/book-crawler.test.ts
- deno test src/books/__tests__/data.test.ts
- deno test src/books/__tests__/integration.test.ts

To run with coverage:
- deno test --coverage=coverage src/books/__tests__/

To run with detailed output:
- deno test --reporter=verbose src/books/__tests__/
`);