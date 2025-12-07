export interface SupportedConfig {
    // libraryDirectories -- a list of file paths to index files from
    libraryDirectories: Array<string>;
    
    // googleBooksApiKey -- API key for Google Books API (optional)
    googleBooksApiKey?: string;
    
    // port -- server port (default: 4001)
    port: number;

    [key: string]: any,

}

export class DustConfig {
    private internalConfig: SupportedConfig = {
        libraryDirectories: [],
        port: 4001,
    };
    
    collect() {
        this.internalConfig = {...this.internalConfig, 
            libraryDirectories: Deno.env.get("dirs")?.split(",") ?? [],
            googleBooksApiKey: Deno.env.get("GOOGLE_BOOKS_API_KEY"),
            port: parseInt(Deno.env.get("PORT") ?? "4001", 10),
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
    
    getPort() {
        return this.internalConfig.port;
    }
}