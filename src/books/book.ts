export interface Book {
    name: string,
    author: number,
    filepath: string,
    file_format?: string,
    file_size?: number,
    page_count?: number,
    cover_image_path?: string,
    isbn?: string,
    publication_date?: string,
    publisher?: string,
    description?: string,
    status?: string,
    archived_at?: string,
    archive_reason?: string,
}

export type BookWithId = Book & {
    id: number;
}