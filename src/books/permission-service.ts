import type { Database } from "../../database.ts";
import { PermissionService } from "../users/permission-service.ts";
import { TagService } from "./tag-service.ts";
import * as bookData from "./data.ts";

/**
 * Service to handle book-specific permission checks that integrate with the tag system
 * This enables your vision for granular content control (NSFW, genre-specific access, etc.)
 */
export class BookPermissionService {
    private permissionService: PermissionService;
    private tagService: TagService;

    constructor(private database: Database) {
        this.permissionService = new PermissionService(database);
        this.tagService = new TagService(database);
    }

    /**
     * Check if a user can access a specific book based on its tags and required permissions
     * This is the core function that enables your content filtering vision
     */
    async canUserAccessBook(userId: number, bookId: number): Promise<{canAccess: boolean, reason?: string}> {
        try {
            // Get all tags for the book
            const bookTags = await this.tagService.getBookTags(bookId);
            
            // Check each tag that requires a permission
            for (const tag of bookTags) {
                if (tag.requires_permission) {
                    const hasPermission = await this.permissionService.userHasPermission(
                        userId, 
                        tag.requires_permission as any
                    );
                    
                    if (!hasPermission) {
                        return {
                            canAccess: false,
                            reason: `Access denied: Missing permission for ${tag.name} content`
                        };
                    }
                }
            }
            
            return { canAccess: true };
        } catch (error) {
            console.error(`Error checking book access for user ${userId}, book ${bookId}:`, error);
            return {
                canAccess: false,
                reason: "Error checking permissions"
            };
        }
    }

    /**
     * Filter a list of books to only return those the user can access
     * This enables your vision for content filtering in book lists
     */
    async filterAccessibleBooks(userId: number, books: bookData.BookWithId[]): Promise<bookData.BookWithId[]> {
        const accessibleBooks: bookData.BookWithId[] = [];
        
        for (const book of books) {
            const { canAccess } = await this.canUserAccessBook(userId, book.id);
            if (canAccess) {
                accessibleBooks.push(book);
            }
        }
        
        return accessibleBooks;
    }

    /**
     * Get books filtered by user's content preferences and permissions
     * Supports filtering by tags like "Cooking" vs "Magic" for your use case
     */
    async getBooksForUser(userId: number, filters?: {
        includeCategories?: string[],
        excludeCategories?: string[],
        includeTags?: string[],
        excludeTags?: string[]
    }): Promise<(Omit<bookData.BookWithId, "author"> & { author: { id: number; name: string } | undefined })[]> {
        // Get all books and authors
        let books = await bookData.getAllBooks(this.database);
        const authors = await bookData.getAllAuthors(this.database);
        
        // Create author lookup map
        const authorsById = new Map<number, { id: number; name: string }>();
        for (const author of authors) {
            authorsById.set(author.id, author);
        }
        
        // Filter by user's access permissions first
        books = await this.filterAccessibleBooks(userId, books);
        
        // Apply additional filters if provided
        if (filters) {
            books = await this.applyContentFilters(books, filters);
        }
        
        // Hydrate author information
        return books.map((book) => ({
            ...book,
            author: authorsById.get(book.author)
        }));
    }

    /**
     * Apply content filters based on tags/categories
     */
    private async applyContentFilters(
        books: bookData.BookWithId[], 
        filters: {
            includeCategories?: string[],
            excludeCategories?: string[],
            includeTags?: string[],
            excludeTags?: string[]
        }
    ): Promise<bookData.BookWithId[]> {
        const filteredBooks: bookData.BookWithId[] = [];
        
        for (const book of books) {
            const bookTags = await this.tagService.getBookTags(book.id);
            const tagNames = bookTags.map(tag => tag.name);
            const categories = bookTags.map(tag => tag.category);
            
            let includeBook = true;
            
            // Check include filters (book must have at least one)
            if (filters.includeCategories && filters.includeCategories.length > 0) {
                const hasIncludedCategory = filters.includeCategories.some(cat => categories.includes(cat));
                if (!hasIncludedCategory) includeBook = false;
            }
            
            if (filters.includeTags && filters.includeTags.length > 0) {
                const hasIncludedTag = filters.includeTags.some(tag => tagNames.includes(tag));
                if (!hasIncludedTag) includeBook = false;
            }
            
            // Check exclude filters (book must not have any)
            if (filters.excludeCategories && filters.excludeCategories.length > 0) {
                const hasExcludedCategory = filters.excludeCategories.some(cat => categories.includes(cat));
                if (hasExcludedCategory) includeBook = false;
            }
            
            if (filters.excludeTags && filters.excludeTags.length > 0) {
                const hasExcludedTag = filters.excludeTags.some(tag => tagNames.includes(tag));
                if (hasExcludedTag) includeBook = false;
            }
            
            if (includeBook) {
                filteredBooks.push(book);
            }
        }
        
        return filteredBooks;
    }

    /**
     * Get user's content preferences/restrictions for creating personalized views
     * This could be extended to store per-user preferences in the database
     */
    async getUserContentPreferences(userId: number): Promise<{
        canAccessNSFW: boolean,
        canAccessRestricted: boolean,
        accessibleGenres: string[]
    }> {
        const canAccessNSFW = await this.permissionService.userHasPermission(
            userId, 
            'content.nsfw' as any
        );
        
        const canAccessRestricted = await this.permissionService.userHasPermission(
            userId, 
            'content.restricted' as any
        );
        
        // For now, return all genres. This could be enhanced with user-specific genre permissions
        const allTags = await this.tagService.getTagsByCategory('genre');
        const accessibleGenres = allTags.map(tag => tag.name);
        
        return {
            canAccessNSFW,
            canAccessRestricted,
            accessibleGenres
        };
    }
}