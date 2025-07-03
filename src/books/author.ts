export interface Author {
    name: string;
    biography?: string;
    birth_date?: string;
    death_date?: string;
    nationality?: string;
    image_url?: string;
    wikipedia_url?: string;
    goodreads_url?: string;
    website?: string;
    aliases?: string; // JSON string of aliases array
    genres?: string; // JSON string of genres array
    created_at?: string;
    updated_at?: string;
}

export type AuthorWithId = Author & {
    id: number;
}