import { Database } from "../../database.ts";
import { dustService } from "../../main.ts";
import { Author, AuthorWithId } from "./author.ts";
import { BookCrawler } from "./book-crawler.ts";
import type { Book, BookWithId } from "./book.ts";
import {
  addAuthorIfNotExists,
  addBookIfNotExists,
  getAllAuthors,
  getAllBooks,
  getAuthorById,
  getAuthorByName,
  getBook,
} from "./data.ts";
import { FSWalker } from "./fs/fs-walker.ts";

export class BookService {
  async populateBooksDB(dirs: Array<string>) {
    const fsWalker = new FSWalker(dirs, { supportedFiletypes: ["pdf"] });
    const crawler = new BookCrawler(fsWalker);
    const books = await crawler.crawlForBooks();
    const groupedByAuthor = books.reduce((acc, cur) => {
      if (!acc.get(cur.author)) {
        acc.set(cur.author, []);
      }
      acc.get(cur.author)?.push(cur);
      return acc;
    }, new Map<string, Array<Omit<Book, "author">>>());

    for (const [author, books] of groupedByAuthor.entries()) {
      const _author = await addAuthorIfNotExists(dustService.database, author);
      for (const book of books) {
        await addBookIfNotExists(dustService.database, {
          name: book.name,
          filepath: book.filepath,
          author: _author.id,
        });
      }
    }
  }

  async getBookById(
    database: Database,
    id: string
  ): Promise<Omit<BookWithId, "author"> & { author: Author }> {
    const book = await getBook(database, id);
    const author = await getAuthorById(database, book.author);

    return {
      ...book,
      author: author,
    };
  }

  async getBooks(
    database: Database
  ): Promise<(Omit<BookWithId, "author"> & { author: Author | undefined })[]> {
    const books = await getAllBooks(database);
    const authors = await getAllAuthors(database);
    const authorsById = new Map<number, AuthorWithId>();
    for (const author of authors) {
      authorsById.set(author.id, author);
    }

    return books.map((book) => {
      return {
        ...book,
        author: authorsById.get(book.author),
      };
    });
  }
}

export const bookService: BookService = new BookService();
