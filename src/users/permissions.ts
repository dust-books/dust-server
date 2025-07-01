export interface Role {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Permission {
  id: number;
  name: string;
  resource_type: string;
  description?: string;
  created_at?: string;
}

export interface UserRole {
  user_id: number;
  role_id: number;
  granted_at: string;
}

export interface RolePermission {
  role_id: number;
  permission_id: number;
}

export interface UserPermission {
  user_id: number;
  permission_id: number;
  resource_id?: number;
  granted_at: string;
}

// Permission constants for type safety
export const PERMISSIONS = {
  // Books
  BOOKS_READ: 'books.read',
  BOOKS_WRITE: 'books.write',
  BOOKS_DELETE: 'books.delete',
  BOOKS_MANAGE: 'books.manage',
  
  // Genres (for your content filtering vision)
  GENRES_READ: 'genres.read',
  GENRES_WRITE: 'genres.write',
  GENRES_MANAGE: 'genres.manage',
  
  // Users
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE: 'users.manage',
  
  // System/Admin
  ADMIN_FULL: 'admin.full',
  ADMIN_USERS: 'admin.users',
  ADMIN_ROLES: 'admin.roles',
  SYSTEM_ADMIN: 'system.admin',
  SYSTEM_CONFIG: 'system.config',
  
  // Content-specific (for your NSFW/genre filtering)
  CONTENT_NSFW: 'content.nsfw',
  CONTENT_RESTRICTED: 'content.restricted'
} as const;

export const RESOURCE_TYPES = {
  BOOK: 'book',
  GENRE: 'genre',
  USER: 'user',
  SYSTEM: 'system',
  CONTENT: 'content'
} as const;

export const ROLES = {
  ADMIN: 'admin',
  LIBRARIAN: 'librarian', 
  USER: 'user',
  GUEST: 'guest'
} as const;

export type PermissionName = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES];
export type RoleName = typeof ROLES[keyof typeof ROLES];