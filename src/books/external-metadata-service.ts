/**
 * External Metadata Service - Fetches rich book metadata from external APIs
 * Supports Google Books API and OpenLibrary as fallback
 */

export interface ExternalBookMetadata {
    isbn?: string;
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    coverImageUrl?: string;
    smallCoverImageUrl?: string;
    rating?: number;
    ratingsCount?: number;
    subtitle?: string;
    series?: string;
    seriesNumber?: number;
    maturityRating?: string; // For content filtering
}

export interface MetadataSource {
    name: string;
    lookupByISBN(isbn: string): Promise<ExternalBookMetadata | null>;
    lookupByTitle(title: string, author?: string): Promise<ExternalBookMetadata[]>;
}

export class GoogleBooksAPI implements MetadataSource {
    name = "Google Books";
    private apiKey?: string;
    private baseUrl = "https://www.googleapis.com/books/v1/volumes";
    
    constructor(apiKey?: string) {
        this.apiKey = apiKey;
    }

    async lookupByISBN(isbn: string): Promise<ExternalBookMetadata | null> {
        try {
            const cleanISBN = isbn.replace(/[^\dX]/g, '');
            const url = `${this.baseUrl}?q=isbn:${cleanISBN}${this.apiKey ? `&key=${this.apiKey}` : ''}`;
            
            console.log(`📚 Looking up ISBN ${cleanISBN} via Google Books...`);
            
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Google Books API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                console.log(`📚 No results found for ISBN ${cleanISBN}`);
                return null;
            }

            const book = data.items[0];
            const volumeInfo = book.volumeInfo || {};
            const imageLinks = volumeInfo.imageLinks || {};
            
            const metadata: ExternalBookMetadata = {
                isbn: cleanISBN,
                title: volumeInfo.title,
                subtitle: volumeInfo.subtitle,
                authors: volumeInfo.authors || [],
                publisher: volumeInfo.publisher,
                publishedDate: volumeInfo.publishedDate,
                description: volumeInfo.description,
                pageCount: volumeInfo.pageCount,
                categories: volumeInfo.categories || [],
                language: volumeInfo.language,
                coverImageUrl: imageLinks.thumbnail || imageLinks.smallThumbnail,
                smallCoverImageUrl: imageLinks.smallThumbnail,
                rating: volumeInfo.averageRating,
                ratingsCount: volumeInfo.ratingsCount,
                maturityRating: volumeInfo.maturityRating
            };

            // Try to extract series information from title or subtitle
            const seriesInfo = this.extractSeriesInfo(metadata.title || '', metadata.subtitle || '');
            if (seriesInfo) {
                metadata.series = seriesInfo.series;
                metadata.seriesNumber = seriesInfo.number;
            }

            console.log(`📚 ✓ Found: "${metadata.title}" by ${metadata.authors?.join(', ')}`);
            return metadata;
            
        } catch (error) {
            console.error(`Error fetching from Google Books API:`, error);
            return null;
        }
    }

    async lookupByTitle(title: string, author?: string): Promise<ExternalBookMetadata[]> {
        try {
            let query = `intitle:"${title}"`;
            if (author) {
                query += `+inauthor:"${author}"`;
            }
            
            const url = `${this.baseUrl}?q=${encodeURIComponent(query)}${this.apiKey ? `&key=${this.apiKey}` : ''}&maxResults=5`;
            
            console.log(`📚 Searching "${title}" by ${author || 'unknown author'} via Google Books...`);
            
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Google Books API error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                console.log(`📚 No results found for title "${title}"`);
                return [];
            }

            const results: ExternalBookMetadata[] = [];
            
            for (const book of data.items.slice(0, 3)) { // Limit to top 3 results
                const volumeInfo = book.volumeInfo || {};
                const imageLinks = volumeInfo.imageLinks || {};
                
                const metadata: ExternalBookMetadata = {
                    title: volumeInfo.title,
                    subtitle: volumeInfo.subtitle,
                    authors: volumeInfo.authors || [],
                    publisher: volumeInfo.publisher,
                    publishedDate: volumeInfo.publishedDate,
                    description: volumeInfo.description,
                    pageCount: volumeInfo.pageCount,
                    categories: volumeInfo.categories || [],
                    language: volumeInfo.language,
                    coverImageUrl: imageLinks.thumbnail || imageLinks.smallThumbnail,
                    smallCoverImageUrl: imageLinks.smallThumbnail,
                    rating: volumeInfo.averageRating,
                    ratingsCount: volumeInfo.ratingsCount,
                    maturityRating: volumeInfo.maturityRating
                };

                // Extract ISBN if available
                if (volumeInfo.industryIdentifiers) {
                    for (const identifier of volumeInfo.industryIdentifiers) {
                        if (identifier.type === 'ISBN_13' || identifier.type === 'ISBN_10') {
                            metadata.isbn = identifier.identifier;
                            break;
                        }
                    }
                }

                results.push(metadata);
            }

            console.log(`📚 ✓ Found ${results.length} results for "${title}"`);
            return results;
            
        } catch (error) {
            console.error(`Error searching Google Books API:`, error);
            return [];
        }
    }

    private extractSeriesInfo(title: string, subtitle: string): { series: string; number: number } | null {
        const text = `${title} ${subtitle}`.toLowerCase();
        
        // Pattern 1: "Book Title (Series Name #3)"
        const pattern1 = /\((.+?)\s*(?:#|book|vol\.?|volume)\s*(\d+)\)/i;
        const match1 = text.match(pattern1);
        if (match1) {
            return {
                series: match1[1].trim(),
                number: parseInt(match1[2], 10)
            };
        }
        
        // Pattern 2: "Series Name: Book 3"
        const pattern2 = /(.+?):\s*(?:book|vol\.?|volume)\s*(\d+)/i;
        const match2 = text.match(pattern2);
        if (match2) {
            return {
                series: match2[1].trim(),
                number: parseInt(match2[2], 10)
            };
        }
        
        return null;
    }
}

export class OpenLibraryAPI implements MetadataSource {
    name = "OpenLibrary";
    private baseUrl = "https://openlibrary.org";

    async lookupByISBN(isbn: string): Promise<ExternalBookMetadata | null> {
        try {
            const cleanISBN = isbn.replace(/[^\dX]/g, '');
            const url = `${this.baseUrl}/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`;
            
            console.log(`📚 Looking up ISBN ${cleanISBN} via OpenLibrary...`);
            
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`OpenLibrary API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            const bookKey = `ISBN:${cleanISBN}`;
            
            if (!data[bookKey]) {
                console.log(`📚 No results found for ISBN ${cleanISBN}`);
                return null;
            }

            const book = data[bookKey];
            
            const metadata: ExternalBookMetadata = {
                isbn: cleanISBN,
                title: book.title,
                subtitle: book.subtitle,
                authors: book.authors?.map((a: any) => a.name) || [],
                publisher: book.publishers?.[0]?.name,
                publishedDate: book.publish_date,
                description: book.description?.value || book.description,
                pageCount: book.number_of_pages,
                categories: book.subjects?.map((s: any) => s.name) || [],
                coverImageUrl: book.cover?.large || book.cover?.medium,
                smallCoverImageUrl: book.cover?.small
            };

            console.log(`📚 ✓ Found: "${metadata.title}" by ${metadata.authors?.join(', ')}`);
            return metadata;
            
        } catch (error) {
            console.error(`Error fetching from OpenLibrary API:`, error);
            return null;
        }
    }

    async lookupByTitle(title: string, author?: string): Promise<ExternalBookMetadata[]> {
        try {
            let query = `title:"${title}"`;
            if (author) {
                query += ` author:"${author}"`;
            }
            
            const url = `${this.baseUrl}/search.json?q=${encodeURIComponent(query)}&limit=5`;
            
            console.log(`📚 Searching "${title}" by ${author || 'unknown author'} via OpenLibrary...`);
            
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`OpenLibrary API error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            
            if (!data.docs || data.docs.length === 0) {
                console.log(`📚 No results found for title "${title}"`);
                return [];
            }

            const results: ExternalBookMetadata[] = [];
            
            for (const book of data.docs.slice(0, 3)) {
                const metadata: ExternalBookMetadata = {
                    title: book.title,
                    authors: book.author_name || [],
                    publisher: book.publisher?.[0],
                    publishedDate: book.first_publish_year?.toString(),
                    pageCount: book.number_of_pages_median,
                    categories: book.subject || [],
                    isbn: book.isbn?.[0],
                    language: book.language?.[0]
                };

                // Construct cover image URL if cover ID exists
                if (book.cover_i) {
                    metadata.coverImageUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`;
                    metadata.smallCoverImageUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-S.jpg`;
                }

                results.push(metadata);
            }

            console.log(`📚 ✓ Found ${results.length} results for "${title}"`);
            return results;
            
        } catch (error) {
            console.error(`Error searching OpenLibrary API:`, error);
            return [];
        }
    }
}

export class ExternalMetadataService {
    private sources: MetadataSource[];
    
    constructor(googleBooksApiKey?: string) {
        this.sources = [
            new GoogleBooksAPI(googleBooksApiKey),
            new OpenLibraryAPI()
        ];
    }

    /**
     * Lookup book metadata by ISBN, trying multiple sources
     */
    async lookupByISBN(isbn: string): Promise<ExternalBookMetadata | null> {
        const cleanISBN = isbn.replace(/[^\dX]/g, '');
        
        if (!cleanISBN || cleanISBN.length < 10) {
            console.warn(`Invalid ISBN: ${isbn}`);
            return null;
        }

        for (const source of this.sources) {
            try {
                const result = await source.lookupByISBN(cleanISBN);
                if (result) {
                    console.log(`✓ Successfully found metadata for ISBN ${cleanISBN} via ${source.name}`);
                    return result;
                }
            } catch (error) {
                console.warn(`Failed to lookup ISBN ${cleanISBN} via ${source.name}:`, error);
                continue; // Try next source
            }
        }

        console.log(`❌ No metadata found for ISBN ${cleanISBN} from any source`);
        return null;
    }

    /**
     * Search for book metadata by title and author, trying multiple sources
     */
    async searchByTitle(title: string, author?: string): Promise<ExternalBookMetadata[]> {
        const allResults: ExternalBookMetadata[] = [];

        for (const source of this.sources) {
            try {
                const results = await source.lookupByTitle(title, author);
                allResults.push(...results);
                
                if (allResults.length >= 5) break; // Limit total results
            } catch (error) {
                console.warn(`Failed to search via ${source.name}:`, error);
                continue; // Try next source
            }
        }

        // Remove duplicates based on ISBN or title+author combination
        const uniqueResults = this.deduplicateResults(allResults);
        
        console.log(`✓ Found ${uniqueResults.length} unique results for "${title}"`);
        return uniqueResults.slice(0, 5); // Limit to top 5
    }

    private deduplicateResults(results: ExternalBookMetadata[]): ExternalBookMetadata[] {
        const seen = new Set<string>();
        const unique: ExternalBookMetadata[] = [];

        for (const result of results) {
            // Create a unique key based on ISBN or title+author
            const key = result.isbn || 
                       `${result.title?.toLowerCase()}|${result.authors?.[0]?.toLowerCase()}`;
            
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(result);
            }
        }

        return unique;
    }

    /**
     * Enhanced genre detection using external metadata categories
     */
    detectGenresFromCategories(categories: string[]): string[] {
        const genreMap: { [key: string]: string } = {
            'fiction': 'Fiction',
            'non-fiction': 'Non-Fiction',
            'biography': 'Biography',
            'autobiography': 'Biography',
            'history': 'History',
            'science': 'Science',
            'technology': 'Technology',
            'cooking': 'Cooking',
            'recipes': 'Cooking',
            'romance': 'Romance',
            'mystery': 'Mystery',
            'thriller': 'Thriller',
            'horror': 'Horror',
            'fantasy': 'Fantasy',
            'science fiction': 'Sci-Fi',
            'self-help': 'Self-Help',
            'business': 'Business',
            'philosophy': 'Philosophy',
            'religion': 'Religion',
            'travel': 'Travel',
            'art': 'Art',
            'music': 'Music',
            'poetry': 'Poetry',
            'drama': 'Drama',
            'children': 'Children',
            'young adult': 'Young Adult',
            'education': 'Education',
            'reference': 'Reference'
        };

        const detectedGenres = new Set<string>();

        for (const category of categories) {
            const lowerCategory = category.toLowerCase();
            
            for (const [keyword, genre] of Object.entries(genreMap)) {
                if (lowerCategory.includes(keyword)) {
                    detectedGenres.add(genre);
                }
            }
        }

        return Array.from(detectedGenres);
    }

    /**
     * Detect content rating from external metadata
     */
    detectContentRating(metadata: ExternalBookMetadata): string[] {
        const ratings: string[] = [];
        
        // Check maturity rating from Google Books
        if (metadata.maturityRating === 'MATURE') {
            ratings.push('Mature');
        } else if (metadata.maturityRating === 'NOT_MATURE') {
            ratings.push('All Ages');
        }
        
        // Check categories for content indicators
        const categories = metadata.categories || [];
        const allText = `${metadata.title} ${metadata.description} ${categories.join(' ')}`.toLowerCase();
        
        if (allText.includes('adult') || allText.includes('erotic') || allText.includes('explicit')) {
            ratings.push('NSFW');
        } else if (allText.includes('young adult') || allText.includes('teen')) {
            ratings.push('Teen');
        } else if (allText.includes('children')) {
            ratings.push('All Ages');
        }
        
        // Default if no specific rating found
        if (ratings.length === 0) {
            ratings.push('All Ages');
        }
        
        return ratings;
    }
}