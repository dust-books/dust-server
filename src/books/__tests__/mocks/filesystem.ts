/**
 * Mock filesystem and file system walker for testing
 */

import { type FileSystemWalker } from "../../fs/fs-walker.ts";

export interface MockWalkEntry {
  path: string;
  name: string;
  isFile?: boolean;
  size?: number;
}

export class MockFileSystemWalker implements FileSystemWalker {
  private entries: MockWalkEntry[];

  constructor(entries: MockWalkEntry[]) {
    this.entries = entries.map(entry => ({
      ...entry,
      isFile: entry.isFile ?? true,
      size: entry.size ?? 1024000 // Default 1MB
    }));
  }

  async collect() {
    return this.entries;
  }
}

export const createMockWalker = (entries: MockWalkEntry[]): MockFileSystemWalker => {
  return new MockFileSystemWalker(entries);
};

// Common test file scenarios
export const mockFileEntries = {
  isbnFiles: [
    {
      path: '/storage/books/Jeff Szuhay/Learn C Programming/9781789349917.epub',
      name: '9781789349917.epub'
    },
    {
      path: '/storage/books/J.K. Rowling/Harry Potter/9780747532699.pdf',
      name: '9780747532699.pdf'
    },
    {
      path: '/storage/books/F. Scott Fitzgerald/The Great Gatsby/978-0-7432-7356-5.mobi',
      name: '978-0-7432-7356-5.mobi'
    }
  ],
  
  regularFiles: [
    {
      path: '/storage/books/George Orwell/1984/nineteen_eighty_four.epub',
      name: 'nineteen_eighty_four.epub'
    },
    {
      path: '/storage/books/Jane Austen/Pride and Prejudice/pride_prejudice.pdf',
      name: 'pride_prejudice.pdf'
    }
  ],
  
  mixedFiles: [
    {
      path: '/storage/books/Jeff Szuhay/Learn C Programming/9781789349917.epub',
      name: '9781789349917.epub'
    },
    {
      path: '/storage/books/George Orwell/1984/nineteen_eighty_four.epub',
      name: 'nineteen_eighty_four.epub'
    },
    {
      path: '/storage/books/Technical/Python Guide/isbn_9781449355739_python.pdf',
      name: 'isbn_9781449355739_python.pdf'
    }
  ],
  
  invalidFiles: [
    {
      path: '/storage/books/Bad ISBN/Test/9781234567890.epub', // Invalid checksum
      name: '9781234567890.epub'
    },
    {
      path: '/storage/books/Wrong Format/Test/123456789.txt', // Wrong format
      name: '123456789.txt'
    }
  ]
};

// Mock database interface
export interface MockDatabase {
  execute: jest.Mock;
  migrate: jest.Mock;
}

export const createMockDatabase = (): MockDatabase => ({
  execute: jest.fn(),
  migrate: jest.fn()
});

// Mock book metadata responses
export const mockBookMetadata = {
  basic: {
    fileFormat: 'epub',
    fileSize: 1024000,
    title: 'Extracted Title',
    author: 'Extracted Author'
  },
  
  enhanced: {
    fileFormat: 'epub',
    fileSize: 1024000,
    title: 'Learn C Programming',
    author: 'Jeff Szuhay',
    pageCount: 742,
    language: 'en',
    coverImagePath: '/covers/learn_c.jpg'
  }
};