export interface SupportedConfig {
    // libraryDirectories -- a list of file paths to index files from
    libraryDirectories: Array<string>;

}

export class DustConfig {
    private internalConfig: SupportedConfig = {
        libraryDirectories: [],
    };
    
    collect() {
        this.internalConfig = {...this.internalConfig, 
            libraryDirectories: Deno.env.get("dirs")?.split(",") ?? [],
        }
    }
}