/**
 * Mock filesystem and file system walker for testing
 */

import { type FileSystemWalker } from "../../fs/fs-walker.ts";

export interface MockWalkEntry {
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size?: number;
}

export class MockFileSystemWalker implements FileSystemWalker {
  private entries: MockWalkEntry[];

  constructor(entries: MockWalkEntry[]) {
    this.entries = entries.map(entry => ({
      ...entry,
      isFile: entry.isFile,
      isDirectory: entry.isDirectory,
      isSymlink: entry.isSymlink,
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
      name: '9781789349917.epub',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    },
    {
      path: '/storage/books/J.K. Rowling/Harry Potter/9780747532699.pdf',
      name: '9780747532699.pdf',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    },
    {
      path: '/storage/books/F. Scott Fitzgerald/The Great Gatsby/978-0-7432-7356-5.mobi',
      name: '978-0-7432-7356-5.mobi',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    }
  ],
  
  regularFiles: [
    {
      path: '/storage/books/George Orwell/1984/nineteen_eighty_four.epub',
      name: 'nineteen_eighty_four.epub',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    },
    {
      path: '/storage/books/Jane Austen/Pride and Prejudice/pride_prejudice.pdf',
      name: 'pride_prejudice.pdf',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    }
  ],
  
  mixedFiles: [
    {
      path: '/storage/books/Jeff Szuhay/Learn C Programming/9781789349917.epub',
      name: '9781789349917.epub',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    },
    {
      path: '/storage/books/George Orwell/1984/nineteen_eighty_four.epub',
      name: 'nineteen_eighty_four.epub',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    },
    {
      path: '/storage/books/Technical/Python Guide/isbn_9781449355739_python.pdf',
      name: 'isbn_9781449355739_python.pdf',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    }
  ],
  
  invalidFiles: [
    {
      path: '/storage/books/Bad ISBN/Test/9781234567890.epub', // Invalid checksum
      name: '9781234567890.epub',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    },
    {
      path: '/storage/books/Wrong Format/Test/123456789.txt', // Wrong format
      name: '123456789.txt',
      isFile: true,
      isDirectory: false,
      isSymlink: false
    }
  ]
};

// Mock database interface
export interface MockDatabase {
  execute: (sql: string, params?: any[]) => Promise<any>;
  migrate: () => Promise<void>;
}

// Jest-compatible mock function implementation for Deno
class MockFunction {
  calls: any[][] = [];
  returnValues: any[] = [];
  callIndex = 0;
  
  constructor() {}
  
  async fn(...args: any[]) {
    this.calls.push(args);
    const value = this.returnValues[this.callIndex] || { rows: [] };
    this.callIndex++;
    return value;
  }
  
  mockReturnValue(value: any) {
    this.returnValues = [value];
    this.callIndex = 0; // Reset call index when setting new return values
    return this;
  }
  
  mockResolvedValueOnce(value: any) {
    this.returnValues.push(value);
    return this;
  }
  
  mockResolvedValue(value: any) {
    this.returnValues = [value];
    this.callIndex = 0; // Reset call index when setting new return values
    return this;
  }
  
  mockClear() {
    this.calls = [];
    this.returnValues = [];
    this.callIndex = 0;
    return this;
  }
  
  toHaveBeenCalledWith(...args: any[]) {
    return this.calls.some(call => 
      call.length === args.length && 
      call.every((arg, i) => arg === args[i])
    );
  }
  
  get mock() {
    return {
      calls: this.calls
    };
  }
}

export const createMockDatabase = (): any => {
  const executeMock = new MockFunction();
  const migrateMock = new MockFunction();
  
  const executeWrapper = (...args: any[]) => executeMock.fn(...args);
  executeWrapper.mockResolvedValueOnce = (value: any) => executeMock.mockResolvedValueOnce(value);
  executeWrapper.mockResolvedValue = (value: any) => executeMock.mockResolvedValue(value);
  executeWrapper.mockReturnValue = (value: any) => executeMock.mockReturnValue(value);
  executeWrapper.mockClear = () => executeMock.mockClear();
  executeWrapper.mock = executeMock.mock;
  
  const migrateWrapper = () => migrateMock.fn();
  migrateWrapper.mockClear = () => migrateMock.mockClear();
  
  return {
    execute: executeWrapper,
    migrate: migrateWrapper,
    mockClear: () => {
      executeMock.mockClear();
      migrateMock.mockClear();
    }
  };
};

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