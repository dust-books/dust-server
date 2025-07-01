import { ExternalMetadataService, type ExternalBookMetadata } from "./external-metadata-service.ts";

/**
 * MetadataExtractor - Extracts metadata from various ebook formats
 * Supports EPUB, PDF, and basic file information extraction
 * Enhanced with external API lookups for rich metadata
 */

export interface BookMetadata {
    title?: string;
    author?: string;
    isbn?: string;
    publisher?: string;
    publicationDate?: string;
    description?: string;
    language?: string;
    pageCount?: number;
    fileSize?: number;
    fileFormat?: string;
    coverImagePath?: string;
    coverImageUrl?: string; // From external APIs
    genre?: string[];
    series?: string;
    seriesNumber?: number;
    rating?: number;
    ratingsCount?: number;
    categories?: string[];
    maturityRating?: string;
}

export class MetadataExtractor {
    private externalMetadataService: ExternalMetadataService;
    
    constructor(googleBooksApiKey?: string) {
        this.externalMetadataService = new ExternalMetadataService(googleBooksApiKey);
    }
    
    /**
     * Extract metadata from a file based on its format, enhanced with external API data
     */
    async extractMetadata(filePath: string, enableExternalLookup: boolean = true): Promise<BookMetadata> {
        const metadata: BookMetadata = {};
        
        // Get basic file information
        metadata.fileFormat = this.getFileFormat(filePath);
        metadata.fileSize = await this.getFileSize(filePath);
        
        try {
            switch (metadata.fileFormat?.toLowerCase()) {
                case 'epub':
                    Object.assign(metadata, await this.extractEpubMetadata(filePath));
                    break;
                case 'pdf':
                    Object.assign(metadata, await this.extractPdfMetadata(filePath));
                    break;
                case 'mobi':
                case 'azw3':
                    Object.assign(metadata, await this.extractMobiMetadata(filePath));
                    break;
                default:
                    // For unsupported formats, extract what we can from filename/path
                    Object.assign(metadata, this.extractFromFilename(filePath));
                    break;
            }
        } catch (error) {
            console.warn(`Failed to extract metadata from ${filePath}:`, error);
            // Fallback to filename extraction
            Object.assign(metadata, this.extractFromFilename(filePath));
        }
        
        // Enhance with external API data if enabled
        if (enableExternalLookup) {
            await this.enhanceWithExternalMetadata(metadata, filePath);
        }
        
        return metadata;
    }
    
    /**
     * Enhance metadata with external API data
     */
    private async enhanceWithExternalMetadata(metadata: BookMetadata, filePath: string): Promise<void> {
        try {
            let externalData: ExternalBookMetadata | null = null;
            
            // Try ISBN lookup first if we have an ISBN
            if (metadata.isbn) {
                console.log(`🔍 Looking up ISBN ${metadata.isbn} for enhanced metadata...`);
                externalData = await this.externalMetadataService.lookupByISBN(metadata.isbn);
            }
            
            // If no ISBN result, try title/author search
            if (!externalData && metadata.title && metadata.author) {
                console.log(`🔍 Searching "${metadata.title}" by ${metadata.author} for enhanced metadata...`);
                const searchResults = await this.externalMetadataService.searchByTitle(metadata.title, metadata.author);
                if (searchResults.length > 0) {
                    externalData = searchResults[0]; // Take the best match
                }
            }
            
            // If still no result, try title-only search
            if (!externalData && metadata.title) {
                console.log(`🔍 Searching "${metadata.title}" (title only) for enhanced metadata...`);
                const searchResults = await this.externalMetadataService.searchByTitle(metadata.title);
                if (searchResults.length > 0) {
                    externalData = searchResults[0]; // Take the best match
                }
            }
            
            if (externalData) {
                console.log(`✓ Found enhanced metadata for "${metadata.title || filePath}"`);
                
                // Merge external data with existing metadata (prefer external data for rich fields)
                metadata.title = metadata.title || externalData.title;
                metadata.author = metadata.author || externalData.authors?.[0];
                metadata.isbn = metadata.isbn || externalData.isbn;
                metadata.publisher = externalData.publisher || metadata.publisher;
                metadata.publicationDate = externalData.publishedDate || metadata.publicationDate;
                metadata.description = externalData.description || metadata.description;
                metadata.pageCount = externalData.pageCount || metadata.pageCount;
                metadata.language = metadata.language || externalData.language;
                metadata.coverImageUrl = externalData.coverImageUrl;
                metadata.rating = externalData.rating;
                metadata.ratingsCount = externalData.ratingsCount;
                metadata.categories = externalData.categories;
                metadata.maturityRating = externalData.maturityRating;
                
                // Enhanced genre detection using external categories
                if (externalData.categories && externalData.categories.length > 0) {
                    const detectedGenres = this.externalMetadataService.detectGenresFromCategories(externalData.categories);
                    metadata.genre = [...new Set([...(metadata.genre || []), ...detectedGenres])];
                }
                
                // Enhanced series detection
                if (externalData.series) {
                    metadata.series = externalData.series;
                    metadata.seriesNumber = externalData.seriesNumber;
                }
                
                console.log(`📚 Enhanced metadata: ${metadata.genre?.length || 0} genres, ${metadata.description ? 'description' : 'no description'}, ${metadata.coverImageUrl ? 'cover image' : 'no cover'}`);
            } else {
                console.log(`ℹ️  No external metadata found for "${metadata.title || filePath}"`);
            }
            
        } catch (error) {
            console.warn(`Failed to enhance metadata with external APIs for ${filePath}:`, error);
            // Continue without external enhancement
        }
    }

    /**
     * Extract metadata from EPUB files
     */
    private async extractEpubMetadata(filePath: string): Promise<Partial<BookMetadata>> {
        // For now, we'll implement a basic version
        // In a full implementation, you'd want to use a library like epub-parser
        // or extract the OPF file from the EPUB zip structure
        
        try {
            // This is a placeholder - real implementation would:
            // 1. Read EPUB as ZIP file
            // 2. Parse META-INF/container.xml to find OPF file
            // 3. Parse OPF file for Dublin Core metadata
            // 4. Extract cover image if present
            
            const metadata: Partial<BookMetadata> = {};
            
            // For demonstration, let's extract what we can from the filename
            const filenameMetadata = this.extractFromFilename(filePath);
            Object.assign(metadata, filenameMetadata);
            
            // Add EPUB-specific defaults
            metadata.language = metadata.language || 'en';
            
            return metadata;
        } catch (error) {
            console.error('Error extracting EPUB metadata:', error);
            return this.extractFromFilename(filePath);
        }
    }

    /**
     * Extract metadata from PDF files
     */
    private async extractPdfMetadata(filePath: string): Promise<Partial<BookMetadata>> {
        try {
            // This is a placeholder - real implementation would use a PDF library
            // to read PDF metadata like Title, Author, Subject, Creator, etc.
            
            const metadata: Partial<BookMetadata> = {};
            
            // For demonstration, extract from filename
            const filenameMetadata = this.extractFromFilename(filePath);
            Object.assign(metadata, filenameMetadata);
            
            return metadata;
        } catch (error) {
            console.error('Error extracting PDF metadata:', error);
            return this.extractFromFilename(filePath);
        }
    }

    /**
     * Extract metadata from MOBI/AZW3 files
     */
    private async extractMobiMetadata(filePath: string): Promise<Partial<BookMetadata>> {
        try {
            // This is a placeholder - real implementation would parse MOBI headers
            
            const metadata: Partial<BookMetadata> = {};
            
            // For demonstration, extract from filename
            const filenameMetadata = this.extractFromFilename(filePath);
            Object.assign(metadata, filenameMetadata);
            
            return metadata;
        } catch (error) {
            console.error('Error extracting MOBI metadata:', error);
            return this.extractFromFilename(filePath);
        }
    }

    /**
     * Extract metadata from filename and directory structure
     * Handles both: /books/Author/Book Title/file.ext and /books/Author/file.ext
     */
    private extractFromFilename(filePath: string): Partial<BookMetadata> {
        const metadata: Partial<BookMetadata> = {};
        
        // Extract from path structure
        const pathParts = filePath.split('/');
        const filename = pathParts[pathParts.length - 1];
        const filenameWithoutExt = filename.split('.').slice(0, -1).join('.');
        
        // Find the "books" directory in the path to understand structure
        const booksIndex = pathParts.findIndex(part => part.toLowerCase() === 'books');
        
        if (booksIndex !== -1 && booksIndex < pathParts.length - 2) {
            const authorName = pathParts[booksIndex + 1];
            const nextPart = pathParts[booksIndex + 2];
            
            // Case 1: /books/Author/BookTitle/file.ext (3-level structure)
            if (nextPart !== filename && booksIndex < pathParts.length - 3) {
                metadata.author = this.cleanString(authorName);
                metadata.title = this.cleanString(nextPart);
            }
            // Case 2: /books/Author/file.ext (2-level structure)
            else {
                metadata.author = this.cleanString(authorName);
                metadata.title = this.cleanString(filenameWithoutExt);
            }
        } else {
            // Fallback: just use filename
            metadata.title = this.cleanString(filenameWithoutExt);
        }
        
        // Try to extract ISBN from filename or directory names
        metadata.isbn = this.extractISBN(filePath);
        
        // Try to detect series information
        const seriesInfo = this.extractSeriesInfo(metadata.title || '');
        if (seriesInfo) {
            metadata.series = seriesInfo.series;
            metadata.seriesNumber = seriesInfo.number;
        }
        
        return metadata;
    }

    /**
     * Get file format from extension
     */
    private getFileFormat(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        return ext || 'unknown';
    }

    /**
     * Get file size in bytes
     */
    private async getFileSize(filePath: string): Promise<number> {
        try {
            const stat = await Deno.stat(filePath);
            return stat.size;
        } catch (error) {
            console.warn(`Could not get file size for ${filePath}:`, error);
            return 0;
        }
    }

    /**
     * Clean up strings extracted from filenames/paths
     */
    private cleanString(str: string): string {
        return str
            .replace(/[_-]/g, ' ')  // Replace underscores and hyphens with spaces
            .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
            .trim();
    }

    /**
     * Extract ISBN from filename or directory names
     */
    private extractISBN(filePath: string): string | undefined {
        // Look for ISBN-10 or ISBN-13 patterns
        const isbnRegex = /(?:ISBN[-\s]*(?:10|13)?[-\s]*[:\s]*)?((?:97[89][-\s]*)?(?:\d[-\s]*){9}[\dX])/gi;
        const match = filePath.match(isbnRegex);
        
        if (match) {
            // Clean up the ISBN (remove spaces, hyphens)
            return match[0].replace(/[^\dX]/gi, '');
        }
        
        return undefined;
    }

    /**
     * Extract series information from title
     * Looks for patterns like "Book Title (Series Name #3)" or "Series Name 3: Book Title"
     */
    private extractSeriesInfo(title: string): { series: string; number: number } | null {
        // Pattern 1: "Book Title (Series Name #3)"
        const pattern1 = /^(.+?)\s*\((.+?)\s*#(\d+)\)$/i;
        const match1 = title.match(pattern1);
        if (match1) {
            return {
                series: match1[2].trim(),
                number: parseInt(match1[3], 10)
            };
        }
        
        // Pattern 2: "Series Name 3: Book Title"
        const pattern2 = /^(.+?)\s+(\d+):\s*(.+)$/i;
        const match2 = title.match(pattern2);
        if (match2) {
            return {
                series: match2[1].trim(),
                number: parseInt(match2[2], 10)
            };
        }
        
        // Pattern 3: "Series Name Book 3"
        const pattern3 = /^(.+?)\s+(?:book|vol|volume)\s+(\d+)$/i;
        const match3 = title.match(pattern3);
        if (match3) {
            return {
                series: match3[1].trim(),
                number: parseInt(match3[2], 10)
            };
        }
        
        return null;
    }

    /**
     * Detect potential genres from metadata, enhanced with external API data
     */
    detectGenres(metadata: BookMetadata, filePath: string): string[] {
        const genres: string[] = [];
        
        // First, use external API genres if available
        if (metadata.genre && metadata.genre.length > 0) {
            genres.push(...metadata.genre);
        }
        
        // Then, use external categories if available
        if (metadata.categories && metadata.categories.length > 0) {
            const detectedGenres = this.externalMetadataService.detectGenresFromCategories(metadata.categories);
            genres.push(...detectedGenres);
        }
        
        // Fallback to keyword-based detection
        const text = `${metadata.title || ''} ${metadata.description || ''} ${filePath}`.toLowerCase();
        
        const genreKeywords = {
            'Cooking': ['cooking', 'recipe', 'kitchen', 'chef', 'culinary', 'food'],
            'Magic': ['magic', 'illusion', 'trick', 'magician', 'prestidigitation'],
            'Romance': ['romance', 'love', 'romantic'],
            'Mystery': ['mystery', 'detective', 'crime', 'murder'],
            'Fantasy': ['fantasy', 'dragon', 'wizard', 'magic', 'quest'],
            'Sci-Fi': ['science fiction', 'sci-fi', 'space', 'alien', 'future'],
            'Horror': ['horror', 'scary', 'ghost', 'vampire', 'zombie'],
            'Biography': ['biography', 'memoir', 'life of', 'autobiography'],
            'History': ['history', 'historical', 'war', 'ancient'],
            'Self-Help': ['self-help', 'improvement', 'success', 'productivity'],
            'Technology': ['technology', 'programming', 'computer', 'software'],
            'Science': ['science', 'physics', 'chemistry', 'biology', 'research']
        };
        
        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                genres.push(genre);
            }
        }
        
        // Remove duplicates and return
        return [...new Set(genres)];
    }

    /**
     * Detect content rating based on metadata, enhanced with external API data
     */
    detectContentRating(metadata: BookMetadata, filePath: string): string[] {
        // Use external API content rating if available
        if (metadata.maturityRating) {
            const externalRatings = this.externalMetadataService.detectContentRating(metadata);
            if (externalRatings.length > 0) {
                return externalRatings;
            }
        }
        
        // Fallback to keyword-based detection
        const ratings: string[] = [];
        const text = `${metadata.title || ''} ${metadata.description || ''} ${filePath}`.toLowerCase();
        
        const nsfwKeywords = ['adult', 'explicit', 'erotic', 'xxx', 'nsfw'];
        const matureKeywords = ['mature', 'violence', 'blood', 'gore'];
        const teenKeywords = ['young adult', 'teen', 'teenager'];
        const childrenKeywords = ['children', 'kids', 'juvenile'];
        
        if (nsfwKeywords.some(keyword => text.includes(keyword))) {
            ratings.push('NSFW');
        } else if (matureKeywords.some(keyword => text.includes(keyword))) {
            ratings.push('Mature');
        } else if (teenKeywords.some(keyword => text.includes(keyword))) {
            ratings.push('Teen');
        } else if (childrenKeywords.some(keyword => text.includes(keyword))) {
            ratings.push('All Ages');
        } else {
            ratings.push('All Ages');
        }
        
        return ratings;
    }
}