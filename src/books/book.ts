export interface Book {
    name: string,
    author: number,
    filepath: string,
}

export type BookWithId = Book & {
    id: number;
}