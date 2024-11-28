import type { Book } from "./book.ts";
import { type FileSystemWalker } from "./fs/fs-walker.ts";

/**
 * CrawlResult the result of a crawl of the FS and parsing of filepath into book info.
 * This is similar to a book object at this point, but the author ID has been replaced with
 * a string for the author name.
 */
type CrawlResult = Omit<Book, "author"> & { author: string }

/**
 * BookCrawler takes in a fileSystemWalker and collects that walker,
 * ultimately converting the output into objects that meet the "Book" interface.
 * 
 * The crawler is responsible for taking the WalkEntry from the fileSystemWalker and
 * parsing out the meta-information about the title from the filepath structure.
 */
export class BookCrawler {
    private bookRegex = /(?:.*?)\/books\/([^/]+)\/([^/]+)/;
    private fileSystemWalker: FileSystemWalker;

    constructor(fileSystemWalker: FileSystemWalker) {
        this.fileSystemWalker = fileSystemWalker;
    }

    /**
     * crawlForbooks crawls the fileSystemWalker and parses the output into book objects.
     * 
     * @returns array of book objects parsed from the fileSystemWalker results
     */
    async crawlForBooks() {
        const allItems = await this.fileSystemWalker.collect();
        // TODO: We need to capture author data at some point.
        const books: Array<CrawlResult> = [];
        for (const item of allItems) {
            const matches = item.path.match(this.bookRegex);
            if (matches) {
                const [_fullMatch, author, title] = matches;
                books.push({
                    name: title,
                    filepath: item.path,
                    author: author,
                });
            }
        }

        return books;
    }
}