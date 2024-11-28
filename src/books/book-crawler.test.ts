import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { BookCrawler } from "./book-crawler.ts";
import type { FileSystemWalker } from "./fs/fs-walker.ts";
import type { WalkEntry } from "jsr:@std/fs/walk";

class MockFSWalker implements FileSystemWalker {
  collectOutput: Array<WalkEntry> = [];
  collect(): Promise<Array<WalkEntry>> {
    return Promise.resolve(this.collectOutput);
  }
}

describe("BookCrawler", () => {
  describe("crawlForBooks", () => {
    it("parses appropriate data from FSWalker", async () => {
      const items = [
        {
          path: "M:/books/Henry James/The Portrait of a Lady/portrait.epub",
          isFile: true,
          isDirectory: false,
          isSymlink: false,
          name: "portrait.epub",
        },
      ];
      const mockFs = new MockFSWalker();
      mockFs.collectOutput = items;

      const crawler = new BookCrawler(mockFs);
      const books = await crawler.crawlForBooks();
      expect(books[0].author).toBe("Henry James");
      expect(books[0].name).toBe("The Portrait of a Lady");
      expect(books[0].filepath).toBe(items[0].path);
    });
  });
});
