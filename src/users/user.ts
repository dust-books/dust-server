export interface User {
    username: string,
    displayName: string,
    email: string,
    password: string,
}

export type UserWithId = User & { 
    id: number;
    display_name: string;
    username: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
    created?: string;
    lastLogin?: string;
}

export type UserWithRoles = Omit<UserWithId, "password"> & {
    roles: string[];
    permissions: string[];
}