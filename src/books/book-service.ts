import { Database } from "../../database.ts";
import { dustService } from "../../main.ts";
import { Author, AuthorWithId } from "./author.ts";
import { BookCrawler } from "./book-crawler.ts";
import type { Book, BookWithId } from "./book.ts";
import {
  addAuthorIfNotExists,
  addAuthorWithMetadata,
  addBookIfNotExists,
  getAllAuthors,
  getAllBooks,
  getAuthorById,
  getAuthorByName,
  getBook,
} from "./data.ts";
import type { ExternalAuthorMetadata } from "./external-metadata-service.ts";
import { FSWalker } from "./fs/fs-walker.ts";
import { TagService } from "./tag-service.ts";
import { ArchiveService } from "./archive-service.ts";

export class BookService {
  async populateBooksDB(dirs: Array<string>, googleBooksApiKey?: string, enableExternalLookup: boolean = true) {
    // Support more file types now that we have metadata extraction
    const fsWalker = new FSWalker(dirs, { 
      supportedFiletypes: ["pdf", "epub", "mobi", "azw3", "cbr", "cbz"] 
    });
    const crawler = new BookCrawler(fsWalker, googleBooksApiKey, enableExternalLookup);
    
    console.log("🔍 Starting enhanced book discovery with metadata extraction...");
    
    // Use the enhanced crawler with metadata extraction
    const enhancedBooks = await crawler.crawlForBooksWithMetadata();
    
    if (enhancedBooks.length === 0) {
      console.log("📚 No books found in specified directories");
      return;
    }
    
    console.log(`📚 Processing ${enhancedBooks.length} books with metadata...`);
    
    // Group books by author for efficient processing
    const groupedByAuthor = enhancedBooks.reduce((acc, cur) => {
      if (!acc.get(cur.author)) {
        acc.set(cur.author, []);
      }
      acc.get(cur.author)?.push(cur);
      return acc;
    }, new Map<string, Array<typeof enhancedBooks[0]>>());

    const tagService = new TagService(dustService.database);
    let processedCount = 0;

    for (const [authorName, books] of groupedByAuthor.entries()) {
      console.log(`👤 Processing author: ${authorName} (${books.length} books)`);
      
      // Get enhanced author metadata from the first book that has it
      const authorMetadata = books.find(book => 
        book.externalMetadata?.authorDetails?.find(author => 
          author.name.toLowerCase().includes(authorName.toLowerCase()) ||
          authorName.toLowerCase().includes(author.name.toLowerCase())
        )
      )?.externalMetadata?.authorDetails?.find(author => 
        author.name.toLowerCase().includes(authorName.toLowerCase()) ||
        authorName.toLowerCase().includes(author.name.toLowerCase())
      );

      // Add author with enhanced metadata if available
      let author: AuthorWithId;
      if (authorMetadata) {
        console.log(`👤 ✓ Enhanced metadata available for ${authorName}`);
        author = await addAuthorWithMetadata(dustService.database, {
          name: authorName,
          biography: authorMetadata.biography,
          birth_date: authorMetadata.birthDate,
          death_date: authorMetadata.deathDate,
          nationality: authorMetadata.nationality,
          image_url: authorMetadata.imageUrl,
          wikipedia_url: authorMetadata.wikipediaUrl,
          goodreads_url: authorMetadata.goodreadsUrl,
          website: authorMetadata.website,
          aliases: authorMetadata.aliases ? JSON.stringify(authorMetadata.aliases) : undefined,
          genres: authorMetadata.genres ? JSON.stringify(authorMetadata.genres) : undefined
        });
      } else {
        // Fallback to basic author creation
        author = await addAuthorIfNotExists(dustService.database, authorName);
      }
      
      for (const enhancedBook of books) {
        try {
          // Add book to database with enhanced metadata
          const bookToAdd: Book = {
            name: enhancedBook.name,
            filepath: enhancedBook.filepath,
            author: author.id,
            file_format: enhancedBook.metadata.fileFormat,
            file_size: enhancedBook.metadata.fileSize,
            page_count: enhancedBook.externalMetadata?.pageCount || enhancedBook.metadata.pageCount,
            isbn: enhancedBook.isbn,
            publication_date: enhancedBook.externalMetadata?.publishedDate,
            publisher: enhancedBook.externalMetadata?.publisher,
            description: enhancedBook.externalMetadata?.description,
            cover_image_path: enhancedBook.metadata.coverImagePath || (enhancedBook.externalMetadata?.coverImageUrl ? undefined : undefined), // TODO: Download and store cover images
          };
          
          const bookResult = await addBookIfNotExists(dustService.database, bookToAdd);
          
          // If book was actually added (not already existing), apply auto-tags
          if (bookResult && bookResult.rows.length > 0) {
            const bookId = bookResult.rows[0].id as number;
            
            const metadataInfo = enhancedBook.isbn ? `ISBN: ${enhancedBook.isbn}` : 'No ISBN';
            const externalInfo = enhancedBook.externalMetadata ? ' (External metadata)' : '';
            const authorInfo = authorMetadata ? ` (Author: ${authorMetadata.name}${authorMetadata.nationality ? `, ${authorMetadata.nationality}` : ''})` : '';
            console.log(`📖 Added new book: ${enhancedBook.name} (ID: ${bookId}, ${metadataInfo}${externalInfo}${authorInfo})`);
            
            // Apply suggested tags automatically
            for (const tagName of enhancedBook.suggestedTags) {
              try {
                await tagService.autoTagBook(bookId, [tagName]);
              } catch (error) {
                // Tag might not exist or already applied, continue
                console.log(`⚠️  Could not apply tag "${tagName}" to book ${bookId}: ${error instanceof Error ? error.message : error}`);
              }
            }
            
            console.log(`🏷️  Applied ${enhancedBook.suggestedTags.length} auto-tags to "${enhancedBook.name}"`);
          } else {
            console.log(`📖 Book already exists: ${enhancedBook.name}`);
          }
          
          processedCount++;
          
        } catch (error) {
          console.error(`❌ Error processing book "${enhancedBook.name}":`, error);
        }
      }
    }
    
    console.log(`✅ Finished processing ${processedCount} books with enhanced metadata!`);
    
    // Update existing books that don't have file_format populated
    await this.updateExistingBookFormats();

    // Validate existing books and archive those with missing files
    console.log("🔍 Validating existing books and archiving missing files...");
    const archiveService = new ArchiveService(dustService.database);
    const archiveResult = await archiveService.validateAndArchiveMissingBooks();
    
    if (archiveResult.archivedCount > 0) {
      console.log(`📦 Archived ${archiveResult.archivedCount} books with missing files`);
    }
    
    if (archiveResult.unarchivedCount > 0) {
      console.log(`📤 Unarchived ${archiveResult.unarchivedCount} books whose files were restored`);
    }
    
    if (archiveResult.errors.length > 0) {
      console.log(`⚠️  ${archiveResult.errors.length} errors occurred during validation`);
    }
  }
  
  async updateExistingBookFormats() {
    console.log("🔄 Updating file formats for existing books...");
    
    try {
      // Get all books without file_format
      const books = await getAllBooks(dustService.database);
      const booksToUpdate = books.filter(book => !book.file_format && book.filepath);
      
      if (booksToUpdate.length === 0) {
        console.log("📚 All books already have file formats");
        return;
      }
      
      console.log(`📚 Updating file formats for ${booksToUpdate.length} books`);
      
      for (const book of booksToUpdate) {
        try {
          const file_format = book.filepath.split('.').pop()?.toLowerCase();
          if (file_format) {
            await (await import("./data.ts")).updateBookFileFormat(dustService.database, book.id, file_format);
            console.log(`✅ Updated ${book.name}: ${file_format}`);
          }
        } catch (error) {
          console.error(`❌ Failed to update file format for ${book.name}:`, error);
        }
      }
      
      console.log("🔄 File format update complete");
    } catch (error) {
      console.error("❌ Error updating book file formats:", error);
    }
  }

  // Legacy method for backwards compatibility
  async populateBooksDBBasic(dirs: Array<string>) {
    const fsWalker = new FSWalker(dirs, { supportedFiletypes: ["pdf"] });
    const crawler = new BookCrawler(fsWalker, undefined, false); // Disable external lookup for basic mode
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

  async getAllAuthors(database: Database): Promise<AuthorWithId[]> {
    return await getAllAuthors(database);
  }

  async getAuthorById(database: Database, id: number): Promise<AuthorWithId | null> {
    try {
      return await getAuthorById(database, id);
    } catch (error) {
      return null;
    }
  }

  async getBooksByAuthor(
    database: Database, 
    authorId: number
  ): Promise<(Omit<BookWithId, "author"> & { author: Author })[]> {
    const books = await getAllBooks(database);
    const author = await getAuthorById(database, authorId);
    
    const authorBooks = books.filter(book => book.author === authorId);
    
    return authorBooks.map((book) => ({
      ...book,
      author: author,
    }));
  }
}

export const bookService: BookService = new BookService();
