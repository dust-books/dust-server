/**
 * Book Archive Service
 * Handles archiving of books that are no longer accessible on the filesystem
 */

import type { Database } from "../../database.ts";
import * as bookData from "./data.ts";
import type { BookWithId } from "./book.ts";

export interface ArchiveResult {
    archivedCount: number;
    unarchivedCount: number;
    archivedBooks: BookWithId[];
    errors: Array<{ bookId: number; error: string }>;
}

export class ArchiveService {
    constructor(private database: Database) {}

    /**
     * Validate all active books and archive those whose files no longer exist
     */
    async validateAndArchiveMissingBooks(): Promise<ArchiveResult> {
        const result: ArchiveResult = {
            archivedCount: 0,
            unarchivedCount: 0,
            archivedBooks: [],
            errors: []
        };

        try {
            // Get all active books
            const activeBooks = await bookData.getActiveBooks(this.database);
            console.log(`📚 Archive Service: Validating ${activeBooks.length} active books`);

            for (const book of activeBooks) {
                try {
                    // Check if file exists
                    const fileExists = await this.checkFileExists(book.filepath);
                    
                    if (!fileExists) {
                        console.log(`📚 Archive Service: File not found, archiving book: ${book.name} (${book.filepath})`);
                        
                        // Archive the book with appropriate reason
                        await this.archiveBook(book.id, "File not found during validation scan");
                        
                        result.archivedCount++;
                        result.archivedBooks.push({
                            ...book,
                            status: 'archived',
                            archived_at: new Date().toISOString(),
                            archive_reason: "File not found during validation scan"
                        });
                    }
                } catch (error) {
                    console.error(`📚 Archive Service: Error validating book ${book.id}:`, error);
                    result.errors.push({
                        bookId: book.id,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            // Also check for previously archived books that might have been restored
            await this.checkForRestoredBooks(result);

            console.log(`📚 Archive Service: Validation complete. Archived: ${result.archivedCount}, Unarchived: ${result.unarchivedCount}, Errors: ${result.errors.length}`);
            
        } catch (error) {
            console.error('📚 Archive Service: Error during validation:', error);
            throw error;
        }

        return result;
    }

    /**
     * Check for previously archived books that might have been restored to the filesystem
     */
    private async checkForRestoredBooks(result: ArchiveResult): Promise<void> {
        try {
            const archivedBooks = await bookData.getArchivedBooks(this.database);
            
            for (const book of archivedBooks) {
                // Only check books archived due to missing files
                if (book.archive_reason?.includes("File not found") || book.archive_reason?.includes("missing")) {
                    try {
                        const fileExists = await this.checkFileExists(book.filepath);
                        
                        if (fileExists) {
                            console.log(`📚 Archive Service: File restored, unarchiving book: ${book.name} (${book.filepath})`);
                            await this.unarchiveBook(book.id);
                            result.unarchivedCount++;
                        }
                    } catch (error) {
                        console.error(`📚 Archive Service: Error checking restored book ${book.id}:`, error);
                        result.errors.push({
                            bookId: book.id,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }
            }
        } catch (error) {
            console.error('📚 Archive Service: Error checking for restored books:', error);
        }
    }

    /**
     * Check if a file exists on the filesystem
     */
    private async checkFileExists(filepath: string): Promise<boolean> {
        try {
            const stat = await Deno.stat(filepath);
            return stat.isFile;
        } catch (error) {
            // If Deno.stat throws, the file doesn't exist or is inaccessible
            return false;
        }
    }

    /**
     * Archive a specific book
     */
    async archiveBook(bookId: number, reason: string): Promise<void> {
        await bookData.archiveBook(this.database, bookId, reason);
    }

    /**
     * Unarchive a specific book
     */
    async unarchiveBook(bookId: number): Promise<void> {
        await bookData.unarchiveBook(this.database, bookId);
    }

    /**
     * Get all archived books
     */
    async getArchivedBooks(): Promise<BookWithId[]> {
        return bookData.getArchivedBooks(this.database);
    }

    /**
     * Get all active books
     */
    async getActiveBooks(): Promise<BookWithId[]> {
        return bookData.getActiveBooks(this.database);
    }

    /**
     * Manually archive a book with a custom reason
     */
    async manualArchive(bookId: number, reason: string): Promise<void> {
        console.log(`📚 Archive Service: Manually archiving book ${bookId}: ${reason}`);
        await bookData.archiveBook(this.database, bookId, reason);
    }

    /**
     * Get archive statistics
     */
    async getArchiveStats(): Promise<{
        totalBooks: number;
        activeBooks: number;
        archivedBooks: number;
        archivedDueToMissingFiles: number;
    }> {
        const allBooks = await bookData.getAllBooks(this.database);
        const activeBooks = await bookData.getActiveBooks(this.database);
        const archivedBooks = await bookData.getArchivedBooks(this.database);
        
        const archivedDueToMissingFiles = archivedBooks.filter(book => 
            book.archive_reason?.includes("File not found") || 
            book.archive_reason?.includes("missing")
        ).length;

        return {
            totalBooks: allBooks.length,
            activeBooks: activeBooks.length,
            archivedBooks: archivedBooks.length,
            archivedDueToMissingFiles
        };
    }
}