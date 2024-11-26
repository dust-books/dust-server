import { dustService } from "../../main.ts";
import { BookCrawler } from "./book-crawler.ts";
import type { Book } from "./book.ts";
import { addAuthorIfNotExists, addBookIfNotExists } from "./data.ts";
import { FSWalker } from "./fs/fs-walker.ts";

export class BookService {
    async populateBooksDB(dirs: Array<string>) {
        const fsWalker = new FSWalker(dirs, {supportedFiletypes: ['pdf']});
        const crawler = new BookCrawler(fsWalker);
        const books = await crawler.crawlForBooks();
        const groupedByAuthor = books.reduce((acc, cur) => {
            if (!acc.get(cur.author)) {
                acc.set(cur.author, [])
            }
            acc.get(cur.author)?.push(cur);
            return acc;
        }, new Map<string, Array<Omit<Book, "author">>>());

        for (const [author, books] of Object.entries(groupedByAuthor)) {
            const _author = await addAuthorIfNotExists(dustService.database, author);
            for (const book of books) {
                await addBookIfNotExists(dustService.database, {name: book.name, filepath: book.file_path});
            }
        }

    }
}