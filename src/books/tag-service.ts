import type { Database } from "../../database.ts";
import * as bookData from "./data.ts";
import { PERMISSIONS } from "../users/permissions.ts";

export class TagService {
    constructor(private database: Database) {}

    async initializeDefaultTags(): Promise<void> {
        const defaultTags = [
            // Content Rating Tags
            { name: "NSFW", category: "content-rating", description: "Not Safe For Work content", color: "#FF4444", requires_permission: PERMISSIONS.CONTENT_NSFW },
            { name: "Adult", category: "content-rating", description: "Adult content", color: "#FF6666", requires_permission: PERMISSIONS.CONTENT_NSFW },
            { name: "Mature", category: "content-rating", description: "Mature content", color: "#FF9999" },
            { name: "Teen", category: "content-rating", description: "Teen content", color: "#FFAA44" },
            { name: "All Ages", category: "content-rating", description: "Suitable for all ages", color: "#44AA44" },
            
            // Genre Tags (supporting your vision for granular access)
            { name: "Cooking", category: "genre", description: "Cooking and culinary books", color: "#FFA500" },
            { name: "Magic", category: "genre", description: "Magic and illusion books", color: "#9932CC", requires_permission: PERMISSIONS.CONTENT_RESTRICTED },
            { name: "Fiction", category: "genre", description: "Fiction books", color: "#4169E1" },
            { name: "Non-Fiction", category: "genre", description: "Non-fiction books", color: "#228B22" },
            { name: "Biography", category: "genre", description: "Biographical books", color: "#DAA520" },
            { name: "History", category: "genre", description: "Historical books", color: "#8B4513" },
            { name: "Science", category: "genre", description: "Science books", color: "#00CED1" },
            { name: "Technology", category: "genre", description: "Technology books", color: "#FF6347" },
            { name: "Self-Help", category: "genre", description: "Self-help books", color: "#32CD32" },
            { name: "Romance", category: "genre", description: "Romance books", color: "#FF1493" },
            { name: "Mystery", category: "genre", description: "Mystery books", color: "#8B008B" },
            { name: "Thriller", category: "genre", description: "Thriller books", color: "#DC143C" },
            { name: "Horror", category: "genre", description: "Horror books", color: "#800000" },
            { name: "Fantasy", category: "genre", description: "Fantasy books", color: "#9370DB" },
            { name: "Sci-Fi", category: "genre", description: "Science fiction books", color: "#4682B4" },
            
            // Format Tags
            { name: "PDF", category: "format", description: "PDF format", color: "#FF6B6B" },
            { name: "EPUB", category: "format", description: "EPUB format", color: "#4ECDC4" },
            { name: "MOBI", category: "format", description: "MOBI format", color: "#45B7D1" },
            { name: "AZW3", category: "format", description: "AZW3 format", color: "#96CEB4" },
            { name: "CBR", category: "format", description: "Comic Book RAR", color: "#FFEAA7" },
            { name: "CBZ", category: "format", description: "Comic Book ZIP", color: "#DDA0DD" },
            
            // Collection Tags
            { name: "Series", category: "collection", description: "Part of a series", color: "#87CEEB" },
            { name: "Standalone", category: "collection", description: "Standalone book", color: "#98FB98" },
            { name: "Reference", category: "collection", description: "Reference material", color: "#F0E68C" },
            { name: "Textbook", category: "collection", description: "Educational textbook", color: "#FFB6C1" },
            
            // Status Tags
            { name: "New Addition", category: "status", description: "Recently added to library", color: "#00FF7F" },
            { name: "Featured", category: "status", description: "Featured content", color: "#FFD700" },
            { name: "Popular", category: "status", description: "Popular content", color: "#FF4500" },
            { name: "Recommended", category: "status", description: "Recommended reading", color: "#1E90FF" },
            
            // Language Tags
            { name: "English", category: "language", description: "English language", color: "#B0E0E6" },
            { name: "Spanish", category: "language", description: "Spanish language", color: "#FFE4B5" },
            { name: "French", category: "language", description: "French language", color: "#E6E6FA" },
            { name: "German", category: "language", description: "German language", color: "#F5DEB3" },
            { name: "Japanese", category: "language", description: "Japanese language", color: "#FFC0CB" },
        ];

        for (const tag of defaultTags) {
            try {
                const existing = await bookData.getTagByName(this.database, tag.name);
                if (!existing) {
                    await bookData.createTag(
                        this.database, 
                        tag.name, 
                        tag.category, 
                        tag.description, 
                        tag.color, 
                        tag.requires_permission
                    );
                    console.log(`Created tag: ${tag.name}`);
                }
            } catch (error) {
                console.error(`Error creating tag ${tag.name}:`, error);
            }
        }
    }

    async addTagToBook(bookId: number, tagName: string, appliedBy?: number): Promise<void> {
        const tag = await bookData.getTagByName(this.database, tagName);
        if (!tag) {
            throw new Error(`Tag "${tagName}" not found`);
        }
        
        await bookData.addTagToBook(this.database, bookId, tag.id, appliedBy, false);
    }

    async autoTagBook(bookId: number, tags: string[]): Promise<void> {
        for (const tagName of tags) {
            const tag = await bookData.getTagByName(this.database, tagName);
            if (tag) {
                try {
                    await bookData.addTagToBook(this.database, bookId, tag.id, undefined, true);
                } catch (error) {
                    // Tag might already exist on book, continue
                    console.log(`Tag ${tagName} already exists on book ${bookId}`);
                }
            }
        }
    }

    async removeTagFromBook(bookId: number, tagName: string): Promise<void> {
        const tag = await bookData.getTagByName(this.database, tagName);
        if (!tag) {
            throw new Error(`Tag "${tagName}" not found`);
        }
        
        await bookData.removeTagFromBook(this.database, bookId, tag.id);
    }

    async getBookTags(bookId: number): Promise<bookData.Tag[]> {
        return await bookData.getBookTags(this.database, bookId);
    }

    async getAllTags(): Promise<bookData.Tag[]> {
        return await bookData.getAllTags(this.database);
    }

    async getTagsByCategory(category: string): Promise<bookData.Tag[]> {
        return await bookData.getTagsByCategory(this.database, category);
    }

    async getBooksWithTag(tagName: string): Promise<any[]> {
        const tag = await bookData.getTagByName(this.database, tagName);
        if (!tag) {
            return [];
        }
        
        return await bookData.getBooksWithTag(this.database, tag.id);
    }

    // Utility function to determine file format from file path
    getFormatFromFilePath(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'pdf': return 'PDF';
            case 'epub': return 'EPUB';
            case 'mobi': return 'MOBI';
            case 'azw3': return 'AZW3';
            case 'cbr': return 'CBR';
            case 'cbz': return 'CBZ';
            default: return 'Unknown';
        }
    }

    // Auto-tag a book based on its metadata and file path
    async autoTagBookByMetadata(bookId: number, filePath: string, metadata?: any): Promise<void> {
        const autoTags: string[] = [];
        
        // Add format tag
        const format = this.getFormatFromFilePath(filePath);
        if (format !== 'Unknown') {
            autoTags.push(format);
        }
        
        // Add default status
        autoTags.push('New Addition');
        
        // Add language if detected (default to English for now)
        autoTags.push('English');
        
        // Auto-determine if standalone (could be enhanced with series detection)
        autoTags.push('Standalone');
        
        // Apply the auto tags
        await this.autoTagBook(bookId, autoTags);
    }
}