export interface Author {
    name: string,
}

export type AuthorWithId = Author & {
    id: number;
}