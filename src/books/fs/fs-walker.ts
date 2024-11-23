import { walk, type WalkEntry } from "jsr:@std/fs/walk";

export class FSWalker {
    private dirs: Array<string> = [];
    private supportedFiletypes: Array<string> = [];

    constructor(dirs: Array<string>, config: { supportedFiletypes: Array<string> }) {
        this.dirs = dirs;
        this.supportedFiletypes = config.supportedFiletypes ?? this.supportedFiletypes;
    }

    // Walks the provided dirs and finds files that end in the supported filetype extensions
    async collect(): Promise<Array<WalkEntry>> {
        const foundItems = [];
        for (const dir in this.dirs) {
            for await (const dirEntry of walk(dir, { exts: this.supportedFiletypes })) {
                foundItems.push(dirEntry);
            }
        }

        return foundItems;
    }
}