export interface User {
    displayName: string,
    email: string,
    password: string,
}

export type UserWithId = User & { id: number }