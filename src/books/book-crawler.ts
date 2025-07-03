import type { Book } from "./book.ts";
import { type FileSystemWalker } from "./fs/fs-walker.ts";
import { MetadataExtractor, type BookMetadata } from "./metadata-extractor.ts";
import { extractISBNFromFilename, validateISBN } from "./isbn-utils.ts";
import { ExternalMetadataService, type ExternalBookMetadata } from "./external-metadata-service.ts";

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
    
    // External metadata (if available)
    externalMetadata?: ExternalBookMetadata;
    
    // ISBN information
    isbn?: string;
    
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
    private externalMetadataService: ExternalMetadataService;
    private enableExternalLookup: boolean;

    constructor(fileSystemWalker: FileSystemWalker, googleBooksApiKey?: string, enableExternalLookup: boolean = true) {
        this.fileSystemWalker = fileSystemWalker;
        this.metadataExtractor = new MetadataExtractor(googleBooksApiKey);
        this.externalMetadataService = new ExternalMetadataService(googleBooksApiKey);
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
                
                // Step 1: Extract ISBN from filename
                const filename = item.path.split('/').pop() || '';
                const extractedISBN = extractISBNFromFilename(filename);
                let validISBN: string | undefined;
                
                if (extractedISBN) {
                    const isbnInfo = validateISBN(extractedISBN);
                    if (isbnInfo && isbnInfo.isValid) {
                        validISBN = isbnInfo.isbn;
                        console.log(`📚 Found valid ${isbnInfo.type}: ${validISBN}`);
                    } else {
                        console.log(`📚 Invalid ISBN found in filename: ${extractedISBN}`);
                    }
                }
                
                // Step 2: Extract metadata from the file
                const metadata = await this.metadataExtractor.extractMetadata(item.path, false); // Don't use external lookup here
                
                // Step 3: If we have a valid ISBN and external lookup is enabled, fetch external metadata
                let externalMetadata: ExternalBookMetadata | undefined;
                if (validISBN && this.enableExternalLookup) {
                    console.log(`📚 Fetching external metadata for ISBN: ${validISBN}`);
                    const result = await this.externalMetadataService.lookupByISBN(validISBN);
                    externalMetadata = result || undefined;
                    
                    if (externalMetadata) {
                        console.log(`✓ External metadata found: "${externalMetadata.title}" by ${externalMetadata.authors?.join(', ')}`);
                    } else {
                        console.log(`❌ No external metadata found for ISBN: ${validISBN}`);
                    }
                }
                
                // Step 4: Determine author and title (prefer external metadata, then extracted metadata, then path parsing)
                let author: string = externalMetadata?.authors?.[0] || metadata.author || 'Unknown Author';
                let title: string = externalMetadata?.title || metadata.title || item.name;
                
                // If no external metadata and no extracted metadata, try path parsing as fallback
                if (!externalMetadata && (!metadata.author || !metadata.title)) {
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
                
                // Step 5: Auto-detect genres and content ratings (enhanced with external metadata)
                let detectedGenres = this.metadataExtractor.detectGenres(metadata, item.path);
                let contentRatings = this.metadataExtractor.detectContentRating(metadata, item.path);
                
                // Enhance with external metadata if available
                if (externalMetadata) {
                    const externalGenres = this.externalMetadataService.detectGenresFromCategories(externalMetadata.categories || []);
                    const externalRatings = this.externalMetadataService.detectContentRating(externalMetadata);
                    
                    detectedGenres = [...new Set([...detectedGenres, ...externalGenres])];
                    contentRatings = [...new Set([...contentRatings, ...externalRatings])];
                }
                
                // Step 6: Generate author-based tags
                let authorTags: string[] = [];
                if (externalMetadata?.authorDetails) {
                    authorTags = this.externalMetadataService.generateAuthorTags(externalMetadata.authorDetails);
                }

                // Step 7: Build suggested tags
                const suggestedTags: string[] = [
                    // File format tag
                    metadata.fileFormat?.toUpperCase() || 'Unknown',
                    
                    // Language tag (prefer external metadata)
                    externalMetadata?.language || metadata.language || 'English',
                    
                    // Content rating tags
                    ...contentRatings,
                    
                    // Genre tags
                    ...detectedGenres.map(genre => genre.charAt(0).toUpperCase() + genre.slice(1)),
                    
                    // Author-based tags
                    ...authorTags,
                    
                    // Series vs standalone (prefer external metadata)
                    (externalMetadata?.series || metadata.series) ? 'Series' : 'Standalone',
                    
                    // Status tag
                    'New Addition',
                    
                    // ISBN indicator if we have one
                    validISBN ? 'ISBN Metadata' : 'No ISBN'
                ];
                
                // Remove duplicates and empty tags
                const uniqueTags = [...new Set(suggestedTags.filter(tag => tag && tag.trim()))];
                
                enhancedBooks.push({
                    name: title,
                    filepath: item.path,
                    author: author,
                    metadata: metadata,
                    externalMetadata: externalMetadata,
                    isbn: validISBN,
                    suggestedTags: uniqueTags
                });
                
                console.log(`✓ Processed: ${title} by ${author} (ISBN: ${validISBN || 'none'}, ${uniqueTags.length} tags suggested)`);
                
            } catch (error) {
                console.error(`Error processing ${item.path}:`, error);
                
                // Fallback to basic extraction
                const filename = item.path.split('/').pop() || '';
                const extractedISBN = extractISBNFromFilename(filename);
                let fallbackISBN: string | undefined;
                
                if (extractedISBN) {
                    const isbnInfo = validateISBN(extractedISBN);
                    if (isbnInfo && isbnInfo.isValid) {
                        fallbackISBN = isbnInfo.isbn;
                    }
                }
                
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
                        isbn: fallbackISBN,
                        suggestedTags: ['New Addition', 'Unknown', fallbackISBN ? 'ISBN Metadata' : 'No ISBN']
                    });
                }
            }
        }
        
        console.log(`✓ Finished processing ${enhancedBooks.length} books`);
        return enhancedBooks;
    }
}