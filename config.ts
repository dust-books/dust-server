export interface SupportedConfig {
    // libraryDirectories -- a list of file paths to index files from
    libraryDirectories: Array<string>;
    
    // googleBooksApiKey -- API key for Google Books API (optional)
    googleBooksApiKey?: string;

    [key: string]: any,

}

export class DustConfig {
    private internalConfig: SupportedConfig = {
        libraryDirectories: [],
    };
    
    collect() {
        this.internalConfig = {...this.internalConfig, 
            libraryDirectories: Deno.env.get("dirs")?.split(",") ?? [],
            googleBooksApiKey: Deno.env.get("GOOGLE_BOOKS_API_KEY"),
        }
    }

    get(key: string) {
        return this.internalConfig[key];
    }

    getLibraryDirectories() {
        return this.internalConfig.libraryDirectories;
    }
    
    getGoogleBooksApiKey() {
        return this.internalConfig.googleBooksApiKey;
    }
}