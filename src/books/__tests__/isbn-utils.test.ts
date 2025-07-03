/**
 * Tests for ISBN utility functions
 */

import { assertEquals, assertExists, assertStrictEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  extractISBNFromFilename,
  validateISBN,
  cleanISBN,
  formatISBN,
  isbn10ToIsbn13,
  extractAllISBNs
} from "../isbn-utils.ts";

Deno.test("ISBN Utils - extractISBNFromFilename", async (t) => {
  
  await t.step("should extract valid ISBN-13 from simple filename", () => {
    const result = extractISBNFromFilename("9781789349917.epub");
    assertEquals(result, "9781789349917");
  });

  await t.step("should extract ISBN-13 with hyphens", () => {
    const result = extractISBNFromFilename("978-1-789-34991-7.pdf");
    assertEquals(result, "9781789349917");
  });

  await t.step("should extract ISBN-10 from filename", () => {
    const result = extractISBNFromFilename("0123456789.mobi");
    assertEquals(result, "0123456789");
  });

  await t.step("should extract ISBN with X checksum", () => {
    const result = extractISBNFromFilename("012345678X.epub");
    assertEquals(result, "012345678X");
  });

  await t.step("should extract ISBN from prefixed filename", () => {
    const result = extractISBNFromFilename("isbn_9781789349917_title.pdf");
    assertEquals(result, "9781789349917");
  });

  await t.step("should return null for non-ISBN filename", () => {
    const result = extractISBNFromFilename("regular_book_title.epub");
    assertEquals(result, null);
  });

  await t.step("should return null for partial ISBN", () => {
    const result = extractISBNFromFilename("123456.epub");
    assertEquals(result, null);
  });

  await t.step("should handle filename without extension", () => {
    const result = extractISBNFromFilename("9781789349917");
    assertEquals(result, "9781789349917");
  });

  await t.step("should handle ISBN with mixed separators", () => {
    const result = extractISBNFromFilename("978-1-789_34991-7.epub");
    assertEquals(result, "9781789349917");
  });
});

Deno.test("ISBN Utils - validateISBN", async (t) => {
  
  await t.step("should validate correct ISBN-13", () => {
    const result = validateISBN("9781789349917");
    assertExists(result);
    assertEquals(result.isValid, true);
    assertEquals(result.type, "ISBN-13");
    assertEquals(result.isbn, "9781789349917");
  });

  await t.step("should validate correct ISBN-10", () => {
    const result = validateISBN("0471958697");
    assertExists(result);
    assertEquals(result.isValid, true);
    assertEquals(result.type, "ISBN-10");
  });

  await t.step("should validate ISBN-10 with X checksum", () => {
    const result = validateISBN("043942089X");
    assertExists(result);
    assertEquals(result.isValid, true);
    assertEquals(result.type, "ISBN-10");
  });

  await t.step("should reject ISBN with wrong checksum", () => {
    const result = validateISBN("9781789349918"); // Wrong last digit
    assertExists(result);
    assertEquals(result.isValid, false);
    assertEquals(result.type, "ISBN-13");
  });

  await t.step("should reject ISBN-10 with wrong checksum", () => {
    const result = validateISBN("0471958698"); // Wrong last digit
    assertExists(result);
    assertEquals(result.isValid, false);
    assertEquals(result.type, "ISBN-10");
  });

  await t.step("should return null for invalid length", () => {
    const result = validateISBN("123456789");
    assertEquals(result, null);
  });

  await t.step("should return null for empty string", () => {
    const result = validateISBN("");
    assertEquals(result, null);
  });

  await t.step("should handle ISBN with hyphens", () => {
    const result = validateISBN("978-1-789-34991-7");
    assertExists(result);
    assertEquals(result.isValid, true);
    assertEquals(result.isbn, "9781789349917");
  });
});

Deno.test("ISBN Utils - cleanISBN", async (t) => {
  
  await t.step("should remove hyphens", () => {
    const result = cleanISBN("978-1-789-34991-7");
    assertEquals(result, "9781789349917");
  });

  await t.step("should remove spaces", () => {
    const result = cleanISBN("978 1 789 34991 7");
    assertEquals(result, "9781789349917");
  });

  await t.step("should preserve X checksum", () => {
    const result = cleanISBN("043942089X");
    assertEquals(result, "043942089X");
  });

  await t.step("should convert lowercase x to uppercase", () => {
    const result = cleanISBN("043942089x");
    assertEquals(result, "043942089X");
  });

  await t.step("should remove all non-digit non-X characters", () => {
    const result = cleanISBN("ISBN-13: 978-1-789-34991-7 (paperback)");
    assertEquals(result, "9781789349917");
  });
});

Deno.test("ISBN Utils - formatISBN", async (t) => {
  
  await t.step("should format ISBN-13 with hyphens", () => {
    const result = formatISBN("9781789349917");
    assertEquals(result, "978-1-789-34991-7");
  });

  await t.step("should format ISBN-10 with hyphens", () => {
    const result = formatISBN("0471958697");
    assertEquals(result, "0-471-95869-7");
  });

  await t.step("should return original for invalid length", () => {
    const result = formatISBN("123456789");
    assertEquals(result, "123456789");
  });

  await t.step("should handle X checksum", () => {
    const result = formatISBN("043942089X");
    assertEquals(result, "0-439-42089-X");
  });
});

Deno.test("ISBN Utils - isbn10ToIsbn13", async (t) => {
  
  await t.step("should convert valid ISBN-10 to ISBN-13", () => {
    const result = isbn10ToIsbn13("0471958697");
    assertEquals(result, "9780471958697");
  });

  await t.step("should convert ISBN-10 with X to ISBN-13", () => {
    const result = isbn10ToIsbn13("043942089X");
    assertEquals(result, "9780439420891");
  });

  await t.step("should return null for invalid length", () => {
    const result = isbn10ToIsbn13("123456789");
    assertEquals(result, null);
  });

  await t.step("should return null for ISBN-13 input", () => {
    const result = isbn10ToIsbn13("9781789349917");
    assertEquals(result, null);
  });

  await t.step("should handle ISBN-10 with hyphens", () => {
    const result = isbn10ToIsbn13("0-471-95869-7");
    assertEquals(result, "9780471958697");
  });
});

Deno.test("ISBN Utils - extractAllISBNs", async (t) => {
  
  await t.step("should extract multiple ISBNs from text", () => {
    const text = "This book has ISBN 9781789349917 and also ISBN-10: 0471958697";
    const result = extractAllISBNs(text);
    assertEquals(result.length, 2);
    assertEquals(result.includes("9781789349917"), true);
    assertEquals(result.includes("0471958697"), true);
  });

  await t.step("should extract ISBNs with various formats", () => {
    const text = "ISBN: 978-1-789-34991-7, ISBN-13: 9780471958697, ISBN-10 043942089X";
    const result = extractAllISBNs(text);
    assertEquals(result.length, 3);
  });

  await t.step("should ignore invalid ISBNs", () => {
    const text = "Invalid ISBN: 9781789349918, Valid ISBN: 9781789349917";
    const result = extractAllISBNs(text);
    assertEquals(result.length, 1);
    assertEquals(result[0], "9781789349917");
  });

  await t.step("should return empty array for no ISBNs", () => {
    const text = "This is just regular text with no ISBNs";
    const result = extractAllISBNs(text);
    assertEquals(result.length, 0);
  });

  await t.step("should deduplicate identical ISBNs", () => {
    const text = "ISBN: 9781789349917, Also ISBN: 9781789349917";
    const result = extractAllISBNs(text);
    assertEquals(result.length, 1);
    assertEquals(result[0], "9781789349917");
  });
});