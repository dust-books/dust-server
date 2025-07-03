/**
 * External Metadata Service - Fetches rich book metadata from external APIs
 * Supports Google Books API and OpenLibrary as fallback
 */

export interface ExternalAuthorMetadata {
  name: string;
  biography?: string;
  birthDate?: string;
  deathDate?: string;
  nationality?: string;
  genres?: string[];
  awards?: string[];
  website?: string;
  imageUrl?: string;
  aliases?: string[];
  wikipediaUrl?: string;
  goodreadsUrl?: string;
}

export interface ExternalBookMetadata {
  isbn?: string;
  title?: string;
  authors?: string[];
  authorDetails?: ExternalAuthorMetadata[];
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
  lookupByTitle(
    title: string,
    author?: string
  ): Promise<ExternalBookMetadata[]>;
  lookupAuthor?(authorName: string): Promise<ExternalAuthorMetadata | null>;
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
      const cleanISBN = isbn.replace(/[^\dX]/g, "");
      const url = `${this.baseUrl}?q=isbn:${cleanISBN}${
        this.apiKey ? `&key=${this.apiKey}` : ""
      }`;

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
        maturityRating: volumeInfo.maturityRating,
      };

      // Try to extract series information from title or subtitle
      const seriesInfo = this.extractSeriesInfo(
        metadata.title || "",
        metadata.subtitle || ""
      );
      if (seriesInfo) {
        metadata.series = seriesInfo.series;
        metadata.seriesNumber = seriesInfo.number;
      }

      // Enhance with author details if available
      if (metadata.authors && metadata.authors.length > 0) {
        metadata.authorDetails = await this.enrichWithAuthorDetails(metadata.authors);
      }

      console.log(
        `📚 ✓ Found: "${metadata.title}" by ${metadata.authors?.join(", ")}`
      );
      return metadata;
    } catch (error) {
      console.error(`Error fetching from Google Books API:`, error);
      return null;
    }
  }

  async lookupByTitle(
    title: string,
    author?: string
  ): Promise<ExternalBookMetadata[]> {
    try {
      let query = `intitle:"${title}"`;
      if (author) {
        query += `+inauthor:"${author}"`;
      }

      const url = `${this.baseUrl}?q=${encodeURIComponent(query)}${
        this.apiKey ? `&key=${this.apiKey}` : ""
      }&maxResults=5`;

      console.log(
        `📚 Searching "${title}" by ${
          author || "unknown author"
        } via Google Books...`
      );

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

      for (const book of data.items.slice(0, 3)) {
        // Limit to top 3 results
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
          maturityRating: volumeInfo.maturityRating,
        };

        // Extract ISBN if available
        if (volumeInfo.industryIdentifiers) {
          for (const identifier of volumeInfo.industryIdentifiers) {
            if (
              identifier.type === "ISBN_13" ||
              identifier.type === "ISBN_10"
            ) {
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

  private extractSeriesInfo(
    title: string,
    subtitle: string
  ): { series: string; number: number } | null {
    const text = `${title} ${subtitle}`;

    // Pattern 1: "Book Title (Series Name #3)"
    const pattern1 = /\((.+?)\s*(?:#|book|vol\.?|volume)\s*(\d+)\)/i;
    const match1 = text.match(pattern1);
    if (match1) {
      return {
        series: this.toTitleCase(match1[1].trim()),
        number: parseInt(match1[2], 10),
      };
    }

    // Pattern 2: "Series Name: Book 3"
    const pattern2 = /(.+?):\s*(?:book|vol\.?|volume)\s*(\d+)/i;
    const match2 = text.match(pattern2);
    if (match2) {
      return {
        series: this.toTitleCase(match2[1].trim()),
        number: parseInt(match2[2], 10),
      };
    }

    return null;
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  async lookupAuthor(authorName: string): Promise<ExternalAuthorMetadata | null> {
    try {
      // Search for books by this author to get author information
      const query = `inauthor:"${authorName}"`;
      const url = `${this.baseUrl}?q=${encodeURIComponent(query)}${
        this.apiKey ? `&key=${this.apiKey}` : ""
      }&maxResults=1`;

      console.log(`👤 Looking up author "${authorName}" via Google Books...`);

      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Google Books API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        console.log(`👤 No books found for author "${authorName}"`);
        return null;
      }

      // Extract author information from the first book
      const book = data.items[0];
      const volumeInfo = book.volumeInfo || {};

      // Find the matching author name (handle case variations)
      const matchingAuthor = volumeInfo.authors?.find((author: string) =>
        author.toLowerCase().includes(authorName.toLowerCase()) ||
        authorName.toLowerCase().includes(author.toLowerCase())
      );

      if (!matchingAuthor) {
        return null;
      }

      const authorMetadata: ExternalAuthorMetadata = {
        name: matchingAuthor,
        genres: this.extractAuthorGenres(volumeInfo.categories || []),
      };

      // Try to get more detailed author info from the description
      if (volumeInfo.description) {
        const bioInfo = this.extractBiographicalInfo(volumeInfo.description, matchingAuthor);
        if (bioInfo) {
          authorMetadata.biography = bioInfo.biography;
          authorMetadata.birthDate = bioInfo.birthDate;
          authorMetadata.nationality = bioInfo.nationality;
        }
      }

      console.log(`👤 ✓ Found author: "${authorMetadata.name}"`);
      return authorMetadata;
    } catch (error) {
      console.error(`Error looking up author "${authorName}":`, error);
      return null;
    }
  }

  private async enrichWithAuthorDetails(authorNames: string[]): Promise<ExternalAuthorMetadata[]> {
    const authorDetails: ExternalAuthorMetadata[] = [];

    for (const authorName of authorNames.slice(0, 3)) { // Limit to first 3 authors
      try {
        const authorMetadata = await this.lookupAuthor(authorName);
        if (authorMetadata) {
          authorDetails.push(authorMetadata);
        } else {
          // Add basic author info if detailed lookup fails
          authorDetails.push({
            name: authorName,
            genres: []
          });
        }
      } catch (error) {
        console.warn(`Failed to enrich author "${authorName}":`, error);
        // Add basic author info on error
        authorDetails.push({
          name: authorName,
          genres: []
        });
      }
    }

    return authorDetails;
  }

  private extractAuthorGenres(categories: string[]): string[] {
    const authorGenres = new Set<string>();
    
    for (const category of categories) {
      const lowerCategory = category.toLowerCase();
      
      // Map book categories to author specialties
      if (lowerCategory.includes('fiction')) authorGenres.add('Fiction Writer');
      if (lowerCategory.includes('mystery')) authorGenres.add('Mystery Author');
      if (lowerCategory.includes('romance')) authorGenres.add('Romance Author');
      if (lowerCategory.includes('science fiction')) authorGenres.add('Sci-Fi Author');
      if (lowerCategory.includes('fantasy')) authorGenres.add('Fantasy Author');
      if (lowerCategory.includes('biography')) authorGenres.add('Biographer');
      if (lowerCategory.includes('history')) authorGenres.add('Historian');
      if (lowerCategory.includes('science')) authorGenres.add('Science Writer');
      if (lowerCategory.includes('technology')) authorGenres.add('Technical Writer');
      if (lowerCategory.includes('self-help')) authorGenres.add('Self-Help Author');
      if (lowerCategory.includes('business')) authorGenres.add('Business Writer');
      if (lowerCategory.includes('cooking')) authorGenres.add('Cookbook Author');
      if (lowerCategory.includes('children')) authorGenres.add('Children\'s Author');
      if (lowerCategory.includes('young adult')) authorGenres.add('YA Author');
    }

    return Array.from(authorGenres);
  }

  private extractBiographicalInfo(description: string, authorName: string): {
    biography?: string;
    birthDate?: string;
    nationality?: string;
  } | null {
    const bio: any = {};
    
    // Look for birth year patterns
    const birthYearMatch = description.match(/born\s+(?:in\s+)?(\d{4})/i);
    if (birthYearMatch) {
      bio.birthDate = birthYearMatch[1];
    }

    // Look for nationality patterns
    const nationalityPatterns = [
      /American\s+(?:author|writer)/i,
      /British\s+(?:author|writer)/i,
      /Canadian\s+(?:author|writer)/i,
      /Australian\s+(?:author|writer)/i,
      /French\s+(?:author|writer)/i,
      /German\s+(?:author|writer)/i,
      /(\w+)\s+(?:author|writer|novelist)/i
    ];

    for (const pattern of nationalityPatterns) {
      const match = description.match(pattern);
      if (match) {
        bio.nationality = match[1] || match[0].split(' ')[0];
        break;
      }
    }

    // Extract a brief biography (first sentence that mentions the author)
    const sentences = description.split(/[.!?]+/);
    const bioSentence = sentences.find(sentence => 
      sentence.toLowerCase().includes(authorName.toLowerCase().split(' ')[0])
    );
    
    if (bioSentence && bioSentence.length > 20) {
      bio.biography = bioSentence.trim() + '.';
    }

    return Object.keys(bio).length > 0 ? bio : null;
  }
}

export class OpenLibraryAPI implements MetadataSource {
  name = "OpenLibrary";
  private baseUrl = "https://openlibrary.org";

  async lookupByISBN(isbn: string): Promise<ExternalBookMetadata | null> {
    try {
      const cleanISBN = isbn.replace(/[^\dX]/g, "");
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
        description:
          book.description?.value || book.description || book.subtitle,
        pageCount: book.number_of_pages,
        categories: book.subjects?.map((s: any) => s.name) || [],
        coverImageUrl: book.cover?.large || book.cover?.medium,
        smallCoverImageUrl: book.cover?.small,
      };

      console.log(
        `📚 ✓ Found: "${metadata.title}" by ${metadata.authors?.join(", ")}`
      );
      return metadata;
    } catch (error) {
      console.error(`Error fetching from OpenLibrary API:`, error);
      return null;
    }
  }

  async lookupByTitle(
    title: string,
    author?: string
  ): Promise<ExternalBookMetadata[]> {
    try {
      let query = `title:"${title}"`;
      if (author) {
        query += ` author:"${author}"`;
      }

      const url = `${this.baseUrl}/search.json?q=${encodeURIComponent(
        query
      )}&limit=5`;

      console.log(
        `📚 Searching "${title}" by ${
          author || "unknown author"
        } via OpenLibrary...`
      );

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
          language: book.language?.[0],
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

  async lookupAuthor(authorName: string): Promise<ExternalAuthorMetadata | null> {
    try {
      // First, try to search for the author directly
      const searchUrl = `${this.baseUrl}/search/authors.json?q=${encodeURIComponent(authorName)}&limit=1`;
      
      console.log(`👤 Looking up author "${authorName}" via OpenLibrary...`);
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        console.warn(`OpenLibrary API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.docs || data.docs.length === 0) {
        console.log(`👤 No author found for "${authorName}"`);
        return null;
      }

      const author = data.docs[0];
      
      const authorMetadata: ExternalAuthorMetadata = {
        name: author.name || authorName,
        birthDate: author.birth_date,
        deathDate: author.death_date,
        biography: author.bio,
        aliases: author.alternate_names || [],
      };

      // If we have the author key, fetch more detailed information
      if (author.key) {
        try {
          const detailUrl = `${this.baseUrl}${author.key}.json`;
          const detailResponse = await fetch(detailUrl);
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            
            if (detailData.bio) {
              if (typeof detailData.bio === 'string') {
                authorMetadata.biography = detailData.bio;
              } else if (detailData.bio.value) {
                authorMetadata.biography = detailData.bio.value;
              }
            }
            
            if (detailData.birth_date) {
              authorMetadata.birthDate = detailData.birth_date;
            }
            
            if (detailData.death_date) {
              authorMetadata.deathDate = detailData.death_date;
            }
            
            if (detailData.wikipedia) {
              authorMetadata.wikipediaUrl = detailData.wikipedia;
            }
            
            if (detailData.photos && detailData.photos.length > 0) {
              authorMetadata.imageUrl = `https://covers.openlibrary.org/a/id/${detailData.photos[0]}-L.jpg`;
            }
          }
        } catch (detailError) {
          console.warn(`Failed to fetch detailed author info:`, detailError);
        }
      }

      console.log(`👤 ✓ Found author: "${authorMetadata.name}"`);
      return authorMetadata;
      
    } catch (error) {
      console.error(`Error looking up author "${authorName}":`, error);
      return null;
    }
  }
}

export class ExternalMetadataService {
  private sources: MetadataSource[];

  constructor(googleBooksApiKey?: string) {
    this.sources = [
      new GoogleBooksAPI(googleBooksApiKey),
      new OpenLibraryAPI(),
    ];
  }

  /**
   * Lookup book metadata by ISBN, trying multiple sources
   */
  async lookupByISBN(isbn: string): Promise<ExternalBookMetadata | null> {
    const cleanISBN = isbn.replace(/[^\dX]/g, "");

    if (!cleanISBN || cleanISBN.length < 10) {
      console.warn(`Invalid ISBN: ${isbn}`);
      return null;
    }

    for (const source of this.sources) {
      try {
        const result = await source.lookupByISBN(cleanISBN);
        if (result) {
          console.log(
            `✓ Successfully found metadata for ISBN ${cleanISBN} via ${source.name}`
          );
          return result;
        }
      } catch (error) {
        console.warn(
          `Failed to lookup ISBN ${cleanISBN} via ${source.name}:`,
          error
        );
        continue; // Try next source
      }
    }

    console.log(`❌ No metadata found for ISBN ${cleanISBN} from any source`);
    return null;
  }

  /**
   * Search for book metadata by title and author, trying multiple sources
   */
  async searchByTitle(
    title: string,
    author?: string
  ): Promise<ExternalBookMetadata[]> {
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

    console.log(
      `✓ Found ${uniqueResults.length} unique results for "${title}"`
    );
    return uniqueResults.slice(0, 5); // Limit to top 5
  }

  private deduplicateResults(
    results: ExternalBookMetadata[]
  ): ExternalBookMetadata[] {
    const seen = new Set<string>();
    const unique: ExternalBookMetadata[] = [];

    for (const result of results) {
      // Create a unique key based on ISBN or title+author
      const key =
        result.isbn ||
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
      fiction: "Fiction",
      "non-fiction": "Non-Fiction",
      biography: "Biography",
      autobiography: "Biography",
      history: "History",
      historical: "History", // Added for partial matches like "Historical Fiction"
      science: "Science",
      technology: "Technology",
      cooking: "Cooking",
      recipes: "Cooking",
      romance: "Romance",
      mystery: "Mystery",
      thriller: "Thriller",
      horror: "Horror",
      fantasy: "Fantasy",
      "science fiction": "Sci-Fi",
      "self-help": "Self-Help",
      business: "Business",
      philosophy: "Philosophy",
      religion: "Religion",
      travel: "Travel",
      art: "Art",
      music: "Music",
      poetry: "Poetry",
      drama: "Drama",
      children: "Children",
      "young adult": "Young Adult",
      education: "Education",
      reference: "Reference",
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
    if (metadata.maturityRating === "MATURE") {
      ratings.push("Mature");
    } else if (metadata.maturityRating === "NOT_MATURE") {
      ratings.push("All Ages");
    }

    // Check categories for content indicators
    const categories = metadata.categories || [];
    const allText = `${metadata.title} ${
      metadata.description
    } ${categories.join(" ")}`.toLowerCase();

    // Check for teen content first (more specific)
    if (allText.includes("young adult") || allText.includes("teen")) {
      ratings.push("Teen");
    } else if (
      allText.includes("adult") ||
      allText.includes("erotic") ||
      allText.includes("explicit")
    ) {
      ratings.push("NSFW");
    } else if (allText.includes("children")) {
      ratings.push("All Ages");
    }

    // Default if no specific rating found
    if (ratings.length === 0) {
      ratings.push("All Ages");
    }

    return ratings;
  }

  /**
   * Lookup author metadata from multiple sources
   */
  async lookupAuthor(authorName: string): Promise<ExternalAuthorMetadata | null> {
    for (const source of this.sources) {
      if (!source.lookupAuthor) continue;
      
      try {
        const result = await source.lookupAuthor(authorName);
        if (result) {
          console.log(
            `✓ Successfully found author metadata for "${authorName}" via ${source.name}`
          );
          return result;
        }
      } catch (error) {
        console.warn(
          `Failed to lookup author "${authorName}" via ${source.name}:`,
          error
        );
        continue; // Try next source
      }
    }

    console.log(`❌ No author metadata found for "${authorName}" from any source`);
    return null;
  }

  /**
   * Lookup multiple authors efficiently
   */
  async lookupAuthors(authorNames: string[]): Promise<ExternalAuthorMetadata[]> {
    const authorDetails: ExternalAuthorMetadata[] = [];
    
    for (const authorName of authorNames.slice(0, 5)) { // Limit to first 5 authors
      try {
        const authorMetadata = await this.lookupAuthor(authorName);
        if (authorMetadata) {
          authorDetails.push(authorMetadata);
        } else {
          // Add basic author info if detailed lookup fails
          authorDetails.push({
            name: authorName,
            genres: []
          });
        }
      } catch (error) {
        console.warn(`Failed to lookup author "${authorName}":`, error);
        // Add basic author info on error
        authorDetails.push({
          name: authorName,
          genres: []
        });
      }
    }

    return authorDetails;
  }

  /**
   * Extract author tags from author metadata
   */
  generateAuthorTags(authorDetails: ExternalAuthorMetadata[]): string[] {
    const tags = new Set<string>();
    
    for (const author of authorDetails) {
      // Add genre-based tags
      for (const genre of author.genres || []) {
        tags.add(genre);
      }
      
      // Add nationality-based tags
      if (author.nationality) {
        tags.add(`${author.nationality} Author`);
      }
      
      // Add era-based tags
      if (author.birthDate) {
        const year = parseInt(author.birthDate.split('-')[0] || author.birthDate);
        if (!isNaN(year)) {
          if (year < 1900) tags.add('Classic Author');
          else if (year < 1950) tags.add('Early 20th Century');
          else if (year < 1980) tags.add('Mid-Century Author');
          else tags.add('Contemporary Author');
        }
      }
      
      // Add biographical indicators
      if (author.biography) {
        const bio = author.biography.toLowerCase();
        if (bio.includes('pulitzer') || bio.includes('nobel')) {
          tags.add('Award Winner');
        }
        if (bio.includes('bestselling') || bio.includes('best-selling')) {
          tags.add('Bestselling Author');
        }
        if (bio.includes('professor') || bio.includes('academic')) {
          tags.add('Academic Author');
        }
      }
      
      // Add prolific author tag if they have many aliases (indicating long career)
      if (author.aliases && author.aliases.length > 2) {
        tags.add('Prolific Author');
      }
    }
    
    return Array.from(tags);
  }
}
