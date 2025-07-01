import type { Book } from "./book.ts";
import { type FileSystemWalker } from "./fs/fs-walker.ts";
import { MetadataExtractor, type BookMetadata } from "./metadata-extractor.ts";

/**
 * EnhancedCrawlResult - Enhanced result with full metadata extraction
 */
export interface EnhancedCrawlResult {
    // Basic book info
    name: string;
    filepath: string;
    author: string;
    
    // Enhanced metadata
    metadata: BookMetadata;
    
    // Auto-detected tags
    suggestedTags: string[];
}

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
    private metadataExtractor: MetadataExtractor;
    private enableExternalLookup: boolean;

    constructor(fileSystemWalker: FileSystemWalker, googleBooksApiKey?: string, enableExternalLookup: boolean = true) {
        this.fileSystemWalker = fileSystemWalker;
        this.metadataExtractor = new MetadataExtractor(googleBooksApiKey);
        this.enableExternalLookup = enableExternalLookup;
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

    /**
     * Enhanced crawling with full metadata extraction and auto-tagging
     * 
     * @returns array of enhanced book objects with metadata and suggested tags
     */
    async crawlForBooksWithMetadata(): Promise<Array<EnhancedCrawlResult>> {
        const allItems = await this.fileSystemWalker.collect();
        const enhancedBooks: Array<EnhancedCrawlResult> = [];
        
        console.log(`Found ${allItems.length} files to process`);
        
        for (const item of allItems) {
            try {
                console.log(`Processing: ${item.path}`);
                
                // Extract metadata from the file (with optional external lookup)
                const metadata = await this.metadataExtractor.extractMetadata(item.path, this.enableExternalLookup);
                
                // Determine author and title (prefer extracted metadata over path parsing)
                let author: string = metadata.author || 'Unknown Author';
                let title: string = metadata.title || item.name;
                
                // If metadata extraction didn't provide author/title, try path parsing as fallback
                if (!metadata.author || !metadata.title) {
                    const pathMatches = item.path.match(this.bookRegex);
                    if (pathMatches) {
                        const [_fullMatch, pathAuthor, pathTitle] = pathMatches;
                        author = metadata.author || pathAuthor;
                        // Only use pathTitle if it's not the filename (indicating 3-level structure)
                        if (!metadata.title) {
                            title = pathTitle !== item.name ? pathTitle : item.name.split('.').slice(0, -1).join('.');
                        }
                    }
                }
                
                // Auto-detect genres and content ratings
                const detectedGenres = this.metadataExtractor.detectGenres(metadata, item.path);
                const contentRatings = this.metadataExtractor.detectContentRating(metadata, item.path);
                
                // Build suggested tags
                const suggestedTags: string[] = [
                    // File format tag
                    metadata.fileFormat?.toUpperCase() || 'Unknown',
                    
                    // Language tag (default to English)
                    metadata.language || 'English',
                    
                    // Content rating tags
                    ...contentRatings,
                    
                    // Genre tags
                    ...detectedGenres.map(genre => genre.charAt(0).toUpperCase() + genre.slice(1)),
                    
                    // Series vs standalone
                    metadata.series ? 'Series' : 'Standalone',
                    
                    // Status tag
                    'New Addition'
                ];
                
                // Remove duplicates and empty tags
                const uniqueTags = [...new Set(suggestedTags.filter(tag => tag && tag.trim()))];
                
                enhancedBooks.push({
                    name: title,
                    filepath: item.path,
                    author: author,
                    metadata: metadata,
                    suggestedTags: uniqueTags
                });
                
                console.log(`✓ Processed: ${title} by ${author} (${uniqueTags.length} tags suggested)`);
                
            } catch (error) {
                console.error(`Error processing ${item.path}:`, error);
                
                // Fallback to basic extraction
                const pathMatches = item.path.match(this.bookRegex);
                if (pathMatches) {
                    const [_fullMatch, author, title] = pathMatches;
                    enhancedBooks.push({
                        name: title,
                        filepath: item.path,
                        author: author,
                        metadata: {
                            fileFormat: item.path.split('.').pop()?.toLowerCase() || 'unknown',
                            fileSize: 0
                        },
                        suggestedTags: ['New Addition', 'Unknown']
                    });
                }
            }
        }
        
        console.log(`✓ Finished processing ${enhancedBooks.length} books`);
        return enhancedBooks;
    }
}