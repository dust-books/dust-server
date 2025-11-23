# Dust Server - Comprehensive Codebase Analysis

> **Purpose**: This document provides a detailed analysis of the Dust server codebase to inform a rewrite in Zig. It catalogs routes, authentication patterns, database schema, services, and interesting behaviors.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [API Routes](#api-routes)
4. [Authentication & Authorization](#authentication--authorization)
5. [Database Schema](#database-schema)
6. [Core Services](#core-services)
7. [File System Operations](#file-system-operations)
8. [Metadata & External APIs](#metadata--external-apis)
9. [Permission System](#permission-system)
10. [Tag-Based Content Filtering](#tag-based-content-filtering)
11. [Reading Progress Tracking](#reading-progress-tracking)
12. [Archive Management](#archive-management)
13. [Configuration](#configuration)
14. [Interesting Behaviors & Patterns](#interesting-behaviors--patterns)
15. [Module Architecture](#module-architecture)

---

## System Overview

Dust is a media server focused on ebooks and comics, similar to Plex but for digital reading materials. It:

- Crawls filesystem directories to index books and comics
- Extracts metadata from files and external APIs
- Provides REST API for book management and streaming
- Implements role-based access control with fine-grained permissions
- Supports tag-based content filtering (e.g., NSFW, genre restrictions)
- Tracks reading progress per user
- Archives books with missing files automatically

**Core Philosophy**: Keep it simple to ship and run - uses SQLite, no separate database server required.

---

## Technology Stack

- **Runtime**: Deno (TypeScript/JavaScript)
- **Web Framework**: Oak (Deno's middleware framework, similar to Koa/Express)
- **Database**: libsql/client (SQLite-compatible)
- **Authentication**: JWT tokens using jose library
- **Password Hashing**: bcrypt via @ts-rex/bcrypt
- **CORS**: oakCors middleware

**Key Dependencies**:
```json
{
  "@libsql/client": "npm:@libsql/client@^0.14.0",
  "@oak/oak": "jsr:@oak/oak@^17.1.3",
  "@ts-rex/bcrypt": "jsr:@ts-rex/bcrypt@^1.0.3"
}
```

---

## API Routes

### Base Routes

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | Returns HTML with embedded Giphy iframe | No |
| GET | `/health` | Health check endpoint returning server status | No |

**Health Check Response**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "service": "dust-server"
}
```

### Authentication Routes

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/auth/login` | User login with email/password | No |
| POST | `/auth/register` | User registration | No |
| POST | `/auth/logout` | User logout (client-side token clearing) | No |
| GET | `/profile` | Get current user profile | Yes |

**Login Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Login Response**:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "displayName": "User Name",
    "roles": ["user"],
    "permissions": ["books.read", "..."]
  }
}
```

**Registration Request**:
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "displayName": "User Name"
}
```

### Book Routes

All book routes require authentication and `books.read` permission minimum.

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/books/` | List all books (filtered by user permissions) | books.read |
| GET | `/books/:id` | Get specific book details | books.read |
| GET | `/books/:id/stream` | Stream book file content | books.read |
| GET | `/books/authors` | List all authors with book counts | books.read |
| GET | `/books/authors/:id` | Get author details and their books | books.read |
| GET | `/books/by-tag/:tagName` | Get books with specific tag | books.read |

**Books List Query Parameters**:
- `includeGenres`: Comma-separated genre tags to include
- `excludeGenres`: Comma-separated genre tags to exclude
- `includeTags`: Comma-separated tags to include
- `excludeTags`: Comma-separated tags to exclude

**Book Object Structure**:
```json
{
  "book": {
    "id": 1,
    "name": "Book Title",
    "filepath": "/path/to/book.epub",
    "file_format": "epub",
    "file_size": 1234567,
    "page_count": 300,
    "author": 1,
    "isbn": "9781234567890",
    "publication_date": "2023-01-01",
    "publisher": "Publisher Name",
    "description": "Book description",
    "cover_image_path": "/path/to/cover.jpg",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "tags": [
    {
      "id": 1,
      "name": "Fiction",
      "category": "genre",
      "color": "#4169E1"
    }
  ]
}
```

### Tag Management Routes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/tags` | Get all tags | books.manage |
| GET | `/tags/categories/:category` | Get tags by category | books.read |
| POST | `/books/:id/tags` | Add tag to book | books.write |
| DELETE | `/books/:id/tags/:tagName` | Remove tag from book | books.write |

### Reading Progress Routes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/books/:id/progress` | Get reading progress for book | books.read |
| PUT | `/books/:id/progress` | Update reading progress | books.read |
| POST | `/books/:id/progress/start` | Start reading a book | books.read |
| POST | `/books/:id/progress/complete` | Mark book as completed | books.read |
| DELETE | `/books/:id/progress` | Reset reading progress | books.read |
| GET | `/reading/progress` | Get all reading progress | books.read |
| GET | `/reading/recent` | Get recently read books (limit param) | books.read |
| GET | `/reading/currently-reading` | Get books in progress | books.read |
| GET | `/reading/completed` | Get completed books | books.read |
| GET | `/reading/stats` | Get reading statistics and streak | books.read |

**Reading Progress Update Request**:
```json
{
  "current_page": 150,
  "total_pages": 300
}
```

**Reading Progress Response**:
```json
{
  "progress": {
    "current_page": 150,
    "total_pages": 300,
    "percentage_complete": 50.0,
    "last_read_at": "2024-01-15T10:30:00Z"
  }
}
```

### Archive Management Routes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/books/archive` | List archived books | books.read |
| POST | `/books/:id/archive` | Archive a book | books.write |
| DELETE | `/books/:id/archive` | Unarchive a book | books.write |
| GET | `/books/archive/stats` | Get archive statistics | books.read |
| POST | `/books/archive/validate` | Manually trigger archive validation | books.manage |

### Genre Routes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/genres/` | List all genre tags with book counts | books.read |
| GET | `/genres/:id` | Get genre details and books (filtered) | books.read |

### Admin User Management Routes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/admin/users` | List all users | users.manage or admin.full |
| GET | `/admin/users/:id` | Get specific user | Self or admin.full |
| POST | `/admin/users` | Create new user | admin.full |
| PUT | `/admin/users/:id` | Update user | Self (limited) or admin.full |
| DELETE | `/admin/users/:id` | Deactivate user | admin.full |

**Important**: Users can update their own basic info (username, email, display_name) but cannot modify their own roles or account status.

### Admin Role Management Routes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/admin/roles` | List all roles | admin.full |
| POST | `/admin/roles` | Create new role | admin.full |
| PUT | `/admin/roles/:id` | Update role | admin.full |
| DELETE | `/admin/roles/:id` | Delete role | admin.full |
| GET | `/admin/permissions` | List all permissions | admin.full |

### Admin Dashboard Routes

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/admin/dashboard` | Get admin dashboard data | admin.full |

---

## Authentication & Authorization

### JWT Authentication

**JWT Secret**: Loaded from `JWT_SECRET` environment variable (required)

**JWT Structure**:
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "User Name"
  },
  "iss": "urn:dust:server",
  "aud": "urn:dust:client",
  "iat": 1234567890,
  "exp": 1234654290
}
```

**Token Lifespan**: 24 hours (1 day)

**Algorithm**: HS256 (HMAC with SHA-256)

**Token Transmission**: Via `Authorization: Bearer <token>` header

### Session Management

- Sessions are stored in database with expiration timestamp
- Session token is the JWT itself
- Sessions expire after 24 hours
- No active session invalidation on logout (client-side only)

### Authentication Middleware

**Pattern**: Combined authentication + permission check middleware

```typescript
const authenticateAndRequirePermission = (permission: any) => {
  return async (ctx: any, next: any) => {
    // 1. Extract JWT from Authorization header
    // 2. Validate JWT signature and expiration
    // 3. Load user from JWT payload
    // 4. Check if user has required permission
    // 5. Set ctx.state.user if valid
    // 6. Return 401 if not authenticated
    // 7. Return 403 if not authorized
    await next();
  };
};
```

### Password Security

- Passwords are hashed using bcrypt
- Hash verification on login
- Passwords never returned in API responses

---

## Database Schema

**Database Type**: SQLite (via libsql)

**Default Location**: `file:dust.db` (configurable via `DATABASE_URL`)

### Tables

#### users
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### sessions
```sql
CREATE TABLE sessions (
    session_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    user_id INTEGER
)
```

#### books
```sql
CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    author INTEGER,
    file_path TEXT NOT NULL UNIQUE,
    isbn TEXT,
    publication_date TEXT,
    publisher TEXT,
    description TEXT,
    page_count INTEGER,
    file_size INTEGER,
    file_format TEXT,
    cover_image_path TEXT,
    status TEXT DEFAULT 'active',
    archived_at DATETIME,
    archive_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### authors
```sql
CREATE TABLE authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    biography TEXT,
    birth_date TEXT,
    death_date TEXT,
    nationality TEXT,
    image_url TEXT,
    wikipedia_url TEXT,
    goodreads_url TEXT,
    website TEXT,
    aliases TEXT,
    genres TEXT,
    created_at DATETIME,
    updated_at DATETIME
)
```

#### tags
```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT,
    color TEXT,
    requires_permission TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Tag Categories**:
- `content-rating`: NSFW, Adult, Mature, Teen, All Ages
- `genre`: Fiction, Non-Fiction, Biography, Science, etc.
- `format`: PDF, EPUB, MOBI, AZW3, CBR, CBZ
- `collection`: Series, Standalone, Reference, Textbook
- `status`: New Addition, Featured, Popular, Recommended
- `language`: English, Spanish, French, German, Japanese

#### book_tags
```sql
CREATE TABLE book_tags (
    book_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    applied_by INTEGER,
    auto_applied BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (book_id, tag_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (applied_by) REFERENCES users(id)
)
```

#### roles
```sql
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Default Roles**:
- `admin`: Full system access
- `librarian`: Can manage books and content
- `user`: Standard user with read access
- `guest`: Limited access

#### permissions
```sql
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    resource_type TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Permission Constants** (from `permissions.ts`):
```typescript
PERMISSIONS = {
  // Books
  BOOKS_READ: 'books.read',
  BOOKS_WRITE: 'books.write',
  BOOKS_DELETE: 'books.delete',
  BOOKS_MANAGE: 'books.manage',
  
  // Genres
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
  
  // Content-specific
  CONTENT_NSFW: 'content.nsfw',
  CONTENT_RESTRICTED: 'content.restricted'
}
```

#### user_roles
```sql
CREATE TABLE user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
)
```

#### role_permissions
```sql
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
)
```

#### user_permissions
```sql
CREATE TABLE user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    resource_id INTEGER,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id, resource_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
)
```

**Key Feature**: Supports both role-based permissions and direct user permissions. The `resource_id` allows granular permissions on specific resources.

#### reading_progress
```sql
CREATE TABLE reading_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    current_page INTEGER DEFAULT 0,
    total_pages INTEGER,
    percentage_complete REAL DEFAULT 0.0,
    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
)
```

### Migration Pattern

Migrations are run during module initialization:

```typescript
async runMigrations(config: DustConfig, database: Database) {
    await migrate(database);
    // Additional initialization...
}
```

**Important**: Columns are added safely using try-catch blocks to handle duplicate column errors.

---

## Core Services

### Module Architecture

The application uses a **Module** pattern where features are organized into independent modules:

```typescript
abstract class Module {
    abstract runMigrations(config: DustConfig, database: Database): Promise<void>;
    abstract registerRoutes(config: DustConfig, router: Router): void;
    registerTimers(config: DustConfig, timerManager: TimerManager): void {}
}
```

**Registered Modules**:
1. `UsersModule` - Authentication, authorization, user management
2. `BooksModule` - Book management, reading progress, tags
3. `GenresModule` - Genre management and filtering

### DustService (Main Application)

**File**: `main.ts`

**Responsibilities**:
- Application lifecycle management
- Module registration and initialization
- Router and middleware setup
- Graceful shutdown handling
- CORS configuration

**Key Features**:
- Listens for SIGINT for graceful shutdown
- Clears all timers on shutdown
- Global error handler for HTTP errors
- Default port: 4001 (configurable)

### UserService

**File**: `src/users/user-service.ts`

**Responsibilities**:
- User registration with bcrypt password hashing
- User authentication with JWT generation
- JWT validation and user extraction
- Permission system initialization
- Role assignment to new users

**Key Methods**:
- `handleSignUp(user)`: Register new user, hash password, assign default role
- `handleSignIn(user)`: Authenticate user, generate JWT, create session
- `validateJWT(token)`: Verify JWT signature and extract payload
- `getUserFromToken(token)`: Get full user with roles and permissions
- `initializePermissionSystem()`: Set up default roles and permissions

**JWT Configuration**:
- Issuer: `urn:dust:server`
- Audience: `urn:dust:client`
- Algorithm: HS256
- Expiration: 1 day

### PermissionService

**File**: `src/users/permission-service.ts`

**Responsibilities**:
- Check if user has specific permission
- Initialize default roles and permissions
- Assign/remove roles to/from users
- Get user's roles and permissions

**Permission Check Logic**:
1. Check direct user permissions (with optional resource_id)
2. Check role-based permissions
3. Return true if either check passes

**Default Role Setup**:
- Admin role gets: `admin.full`
- Librarian role gets: `books.manage`, `books.write`, `books.read`, `users.read`
- User role gets: `books.read`, `genres.read`
- Guest role gets: `books.read` (limited)

### BookService

**File**: `src/books/book-service.ts`

**Responsibilities**:
- Populate books database from filesystem
- Crawl directories for books
- Extract metadata from files
- Fetch external metadata (Google Books API)
- Auto-tag books based on content
- Update file formats
- Coordinate with ArchiveService for validation

**Key Methods**:
- `populateBooksDB(dirs, apiKey, enableExternal)`: Full crawl with metadata
- `populateBooksDBBasic(dirs)`: Basic crawl without external lookup
- `updateExistingBookFormats()`: Update legacy books without format info

**Supported File Types**: PDF, EPUB, MOBI, AZW3, CBR, CBZ

**Process Flow**:
1. Walk filesystem to find book files
2. Extract ISBN from filename (if present)
3. Extract metadata from file itself
4. Fetch external metadata if ISBN available
5. Group books by author
6. Add authors with enhanced metadata
7. Add books with all metadata
8. Auto-apply tags
9. Validate existing books and archive missing ones

### BookCrawler

**File**: `src/books/book-crawler.ts`

**Responsibilities**:
- Walk filesystem using FSWalker
- Parse directory structure to extract author/title
- Extract ISBN from filenames
- Coordinate metadata extraction
- Suggest tags based on content

**Directory Structure Expected**:
```
/base/path/books/{Author Name}/{Book Title}/book-file.epub
```

**Regex Pattern**: `/(?:.*?)\/books\/([^/]+)\/([^/]+)/`

**ISBN Detection**:
- Extracts ISBN-10 or ISBN-13 from filename
- Validates checksum
- Cleans hyphens and spaces

**Enhanced Crawl Result**:
```typescript
{
  name: string,
  filepath: string,
  author: string,
  metadata: BookMetadata,
  externalMetadata?: ExternalBookMetadata,
  isbn?: string,
  suggestedTags: string[]
}
```

### MetadataExtractor

**File**: `src/books/metadata-extractor.ts`

**Responsibilities**:
- Extract metadata from book files
- Detect file format
- Get file size
- Extract page count (where supported)
- Locate cover images

**Extraction Methods**:
- For EPUB: Parse OPF file for metadata
- For PDF: Read PDF metadata
- For others: Basic file info

### ExternalMetadataService

**File**: `src/books/external-metadata-service.ts`

**Supported APIs**:
1. Google Books API (primary)
2. OpenLibrary API (fallback)

**Metadata Retrieved**:
- Book title and subtitle
- Authors and author details
- Publisher and publication date
- Description
- Page count
- Categories/genres
- Cover images
- Language
- ISBN
- Maturity rating (for content filtering)

**Author Metadata**:
- Biography
- Birth/death dates
- Nationality
- Genres
- Awards
- Website/social links
- Aliases

### TagService

**File**: `src/books/tag-service.ts`

**Responsibilities**:
- Initialize default tags
- Add/remove tags from books
- Get books by tag
- Get tags by category
- Auto-tag books during crawl

**Tag Features**:
- Tags can require specific permissions
- Tags have categories and colors
- Tags can be auto-applied or manually applied
- Tracks who applied each tag

**Permission-Required Tags**:
- `NSFW` → requires `content.nsfw` permission
- `Adult` → requires `content.nsfw` permission
- `Magic` → requires `content.restricted` permission

### BookPermissionService

**File**: `src/books/permission-service.ts`

**Responsibilities**:
- Check if user can access specific book
- Filter books based on user's tag permissions
- Get books accessible to user
- Get user content preferences

**Access Logic**:
1. Get all tags on book
2. For each tag, check if it requires permission
3. If user lacks required permission, deny access
4. Return books user can access with reason

**Key Insight**: This implements fine-grained content filtering where books can be hidden from users who lack permission for specific tags.

### ReadingProgressService

**File**: `src/books/reading-progress-service.ts`

**Responsibilities**:
- Track reading progress per user per book
- Update current page and calculate percentage
- Start reading session
- Mark books as completed
- Get recently read books
- Get currently reading books
- Get completed books
- Calculate reading statistics
- Calculate reading streak

**Statistics Tracked**:
- Total books started
- Total books completed
- Average completion rate
- Total pages read
- Reading streak (consecutive days)
- Recent activity

### ArchiveService

**File**: `src/books/archive-service.ts`

**Responsibilities**:
- Validate books exist on filesystem
- Archive books with missing files
- Unarchive books when files return
- Track archive reasons
- Provide archive statistics

**Auto-Archive Process**:
1. Get all active books
2. Check if file exists at filepath
3. If missing, set status='archived', record reason
4. If previously archived and now exists, unarchive

**Manual Archive**: Admin can manually archive with custom reason

### UserManagementService

**File**: `src/users/user-management-service.ts`

**Responsibilities**:
- CRUD operations for users
- CRUD operations for roles
- Manage role-permission relationships
- Get user statistics

**User Stats**:
- Total users
- Active users
- Users by role

---

## File System Operations

### FSWalker

**File**: `src/books/fs/fs-walker.ts`

**Responsibilities**:
- Walk directory tree recursively
- Filter by supported file types
- Collect file entries

**Configuration**:
```typescript
{
  supportedFiletypes: ["pdf", "epub", "mobi", "azw3", "cbr", "cbz"]
}
```

**Process**:
1. Start from root directories
2. Recursively walk subdirectories
3. Filter files by extension
4. Return array of file entries with paths

---

## Metadata & External APIs

### Google Books API

**Base URL**: `https://www.googleapis.com/books/v1/volumes`

**API Key**: Optional (configured via `GOOGLE_BOOKS_API_KEY`)

**Lookup Methods**:
- By ISBN: `?q=isbn:{isbn}`
- By Title: `?q=intitle:{title}+inauthor:{author}`

**Response Mapping**:
- `volumeInfo.title` → title
- `volumeInfo.authors[]` → authors
- `volumeInfo.publisher` → publisher
- `volumeInfo.publishedDate` → publication_date
- `volumeInfo.description` → description
- `volumeInfo.pageCount` → page_count
- `volumeInfo.categories[]` → genre tags
- `volumeInfo.imageLinks.thumbnail` → cover_image_url
- `volumeInfo.maturityRating` → content rating tag

### OpenLibrary API

**Base URL**: `https://openlibrary.org/api`

**Endpoints Used**:
- `/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`
- `/search.json?title={title}&author={author}`

**Used As**: Fallback when Google Books fails

---

## Permission System

### Permission Hierarchy

```
admin.full
  ├─ Grants all permissions
  ├─ Can manage users
  ├─ Can manage roles
  └─ Can access all content

books.manage
  ├─ books.write
  │   ├─ books.read
  │   └─ Can modify books/tags
  └─ Can trigger archive validation

users.manage
  ├─ users.write
  │   ├─ users.read
  │   └─ Can create/update users
  └─ Can list all users

content.nsfw
  ├─ Access NSFW-tagged content
  └─ Access Adult-tagged content

content.restricted
  └─ Access restricted content (e.g., Magic)
```

### Middleware Patterns

**1. requirePermission** - Require single permission
```typescript
requirePermission(database, PERMISSIONS.BOOKS_READ)
```

**2. requireAnyPermission** - Require any of several permissions
```typescript
requireAnyPermission(database, [
  PERMISSIONS.ADMIN_FULL,
  PERMISSIONS.USERS_MANAGE
])
```

**3. requireAllPermissions** - Require all specified permissions
```typescript
requireAllPermissions(database, [
  PERMISSIONS.BOOKS_READ,
  PERMISSIONS.CONTENT_NSFW
])
```

**4. requireAdmin** - Shortcut for admin.full permission

**5. requireUserManager** - Shortcut for users.manage or admin.full

**6. requireSelfOrAdmin** - Allow self-access or admin

**7. requirePermissionForResource** - Check permission for specific resource
```typescript
requirePermissionForResource(database, PERMISSIONS.BOOKS_READ, 'id')
```

### Permission Check Flow

1. Extract user from JWT in ctx.state
2. Query database for user's direct permissions
3. Query database for role-based permissions
4. Check optional resource_id constraints
5. Return true if any check passes
6. Return 401 if not authenticated
7. Return 403 if not authorized

---

## Tag-Based Content Filtering

### Core Concept

Books are tagged with content descriptors. Tags can require specific permissions. Users without the required permission cannot see books with those tags.

### Filtering Flow

**When fetching books**:
1. Get all books user might access
2. For each book, get its tags
3. For each tag, check if it requires permission
4. If tag requires permission user lacks, filter out book
5. Return only accessible books

**Access Check Example**:
```typescript
async canUserAccessBook(userId: number, bookId: number): 
  Promise<{canAccess: boolean, reason: string}>
{
  const tags = await getBookTags(bookId);
  for (const tag of tags) {
    if (tag.requires_permission) {
      const hasPermission = await userHasPermission(
        userId, 
        tag.requires_permission
      );
      if (!hasPermission) {
        return {
          canAccess: false,
          reason: `Content requires ${tag.requires_permission}`
        };
      }
    }
  }
  return { canAccess: true, reason: "Access granted" };
}
```

### Use Cases

1. **NSFW Content**: Tag with "NSFW", requires `content.nsfw` permission
2. **Age-Restricted**: Tag with "Adult", requires `content.nsfw` permission
3. **Restricted Topics**: Tag with "Magic", requires `content.restricted` permission
4. **Custom Restrictions**: Create any tag with any permission requirement

### Tag Categories

- **content-rating**: Age/content restrictions
- **genre**: Fiction, Mystery, Romance, etc.
- **format**: File format indicators
- **collection**: Series, standalone, reference
- **status**: New, featured, popular
- **language**: Book language

---

## Reading Progress Tracking

### Features

- Track current page and total pages per book per user
- Calculate completion percentage automatically
- Track last read timestamp
- Identify currently reading books (0% < progress < 100%)
- Track completed books (progress = 100%)
- Calculate reading streak (consecutive days)
- Get recent reading activity

### Progress States

1. **Not Started**: No progress record exists
2. **In Progress**: 0 < current_page < total_pages
3. **Completed**: current_page = total_pages (or marked complete)

### Statistics

**Reading Stats Object**:
```typescript
{
  totalBooksStarted: number,
  totalBooksCompleted: number,
  averageCompletionRate: number,
  totalPagesRead: number,
  readingStreak: number,  // days
  recentActivity: [
    {
      book_id: number,
      book_name: string,
      last_read_at: string,
      percentage_complete: number
    }
  ]
}
```

### Streak Calculation

1. Get all progress records ordered by last_read_at
2. Starting from today, check if user read yesterday
3. If yes, increment streak and check day before
4. If no, streak ends
5. Return consecutive days

---

## Archive Management

### Purpose

Automatically handle books whose files are missing from the filesystem (deleted, moved, drive unmounted, etc.) without losing database records.

### Status Values

- `active`: Book file exists and is accessible
- `archived`: Book file is missing or inaccessible

### Archive Record

```typescript
{
  id: number,
  status: 'archived',
  archived_at: string,  // timestamp
  archive_reason: string  // e.g., "File not found at /path/to/book.epub"
}
```

### Validation Process

**Triggered**:
- Automatically during book crawl (every hour)
- Manually via `/books/archive/validate` endpoint

**Logic**:
1. Get all books with status != 'archived'
2. For each book, check `Deno.stat(filepath)`
3. If stat fails (file missing):
   - Set status = 'archived'
   - Set archived_at = now
   - Set archive_reason = "File not found"
4. Get all archived books
5. For each archived book, check if file now exists
6. If exists:
   - Set status = 'active'
   - Clear archived_at and archive_reason

**Manual Archive**:
- Admin can manually archive with custom reason
- Useful for temporarily hiding books

### Archive Statistics

```typescript
{
  totalArchived: number,
  archivedThisWeek: number,
  archivedThisMonth: number,
  reasonBreakdown: {
    "File not found": number,
    "Manual archive": number,
    // ... other reasons
  }
}
```

---

## Configuration

### Environment Variables

**Required**:
- `JWT_SECRET`: Secret key for JWT signing (generate with `openssl rand -base64 32`)

**Optional**:
- `dirs`: Comma-separated paths to scan (e.g., `/books,/comics`)
- `PORT`: Server port (default: 4001)
- `DATABASE_URL`: Database connection string (default: `file:dust.db`)
- `GOOGLE_BOOKS_API_KEY`: Google Books API key for metadata

### DustConfig Class

**File**: `config.ts`

```typescript
interface SupportedConfig {
  libraryDirectories: Array<string>;
  googleBooksApiKey?: string;
  port: number;
}
```

**Methods**:
- `collect()`: Load config from environment
- `get(key)`: Get config value
- `getLibraryDirectories()`: Get dirs array
- `getGoogleBooksApiKey()`: Get API key
- `getPort()`: Get port number

---

## Interesting Behaviors & Patterns

### 1. Timer-Based Book Scanning

**Location**: `src/books/module.ts`

Books are automatically re-scanned:
- Once on startup (after 1 second delay)
- Every hour thereafter

```typescript
registerTimers(config, timerManager) {
  const EVERY_HOUR = 1000 * 60 * 60;
  setTimeout(() => {
    bookService.populateBooksDB(/*...*/);
  }, 1000);
  timerManager.registerTimer(() => {
    bookService.populateBooksDB(/*...*/);
  }, EVERY_HOUR);
}
```

### 2. Combined Auth+Permission Middleware

Instead of separate middleware for authentication and permission checking, routes use combined middleware:

```typescript
const authenticateAndRequirePermission = (permission) => {
  return async (ctx, next) => {
    // Extract and validate JWT
    // Check permission
    // Single middleware, single point of failure
  };
};
```

**Tradeoff**: Less composable but fewer middleware calls per request.

### 3. Self-Or-Admin Pattern

Many routes allow users to access their own data OR admins to access any data:

```typescript
requireSelfOrAdmin(database, userIdParam) {
  const targetUserId = parseInt(ctx.params[userIdParam]);
  if (ctx.state.user.id === targetUserId) {
    // Allow self-access
    await next();
    return;
  }
  // Otherwise require admin
  requireAdmin(database)(ctx, next);
}
```

### 4. ISBN-Based Filename Metadata

If a book filename is an ISBN, external metadata is automatically fetched:

- `9781789349917.epub` → Fetches metadata
- `my-book.epub` → No external metadata

This enables "dump and go" workflows where users can rename files to ISBNs for automatic organization.

### 5. Defensive Column Addition

When adding columns to existing tables during migrations:

```typescript
for (const column of authorColumns) {
  try {
    await database.execute(`ALTER TABLE authors ADD COLUMN ${column}`);
  } catch (error) {
    // Ignore duplicate column errors
    if (!error.message.includes('duplicate column name')) {
      throw error;
    }
  }
}
```

This allows the app to safely run migrations multiple times.

### 6. Global Error Handler

**Location**: `main.ts`

All HTTP errors are caught and formatted:

```typescript
app.use(async (context, next) => {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      context.response.status = err.status;
      if (context.request.accepts("json")) {
        context.response.body = { 
          message: err.message, 
          status: err.status, 
          stack: err.stack 
        };
      } else {
        context.response.body = `${err.status} ${err.message}\n\n${err.stack}`;
      }
    } else {
      throw err;
    }
  }
});
```

### 7. Graceful Shutdown

**Location**: `main.ts`

The application handles SIGINT for graceful shutdown:

```typescript
constructor() {
  const { signal } = this.abortController;
  Deno.addSignalListener('SIGINT', this._abort);
  signal.addEventListener("abort", this._stop);
}

stop() {
  this.timerManager.clearAll();
  Deno.removeSignalListener('SIGINT', this._abort);
  // Clean up resources
}
```

### 8. CORS Configuration

**Location**: `main.ts`

Development-friendly CORS setup:

```typescript
this.app.use(oakCors({
  origin: true,  // Allow all origins
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));
```

**Note**: In production, `origin` should be restricted to specific domains.

### 9. File Streaming

**Location**: `src/books/routes.ts` - `/books/:id/stream`

Books are streamed directly from filesystem:

```typescript
const file = await Deno.open(book.filepath, { read: true });
ctx.response.body = file.readable;
// Don't close file - let stream handle it
```

Content-Type is set based on extension:
- `.pdf` → `application/pdf`
- `.epub` → `application/epub+zip`

### 10. Auto-Tagging Based on Metadata

When adding books, tags are automatically applied based on:
- File format (PDF, EPUB, etc.)
- Categories from external metadata
- Maturity rating
- Language

Example: A book with `maturityRating: "MATURE"` gets auto-tagged with "Mature".

### 11. Permission Cascading

Permissions don't explicitly cascade, but the pattern is:
- Check for direct user permission first
- Then check role-based permissions
- Return true if either exists

This allows temporary permission grants without role changes.

### 12. Database Access Pattern

Services receive database instance in constructor:

```typescript
class BookService {
  constructor(private database: Database) {}
}
```

But in routes, database is accessed via global `dustService`:

```typescript
const bookService = new BookService(dustService.database);
```

**Tradeoff**: Global state makes testing harder but simplifies code.

---

## Module Architecture

### Module Lifecycle

1. **Registration**: Modules are registered in `main.ts`
   ```typescript
   await dustService.registerModule(new UsersModule());
   await dustService.registerModule(new BooksModule());
   await dustService.registerModule(new GenresModule());
   ```

2. **Migration**: `runMigrations()` called on each module
   - Creates tables
   - Adds columns
   - Initializes default data

3. **Route Registration**: `registerRoutes()` called on each module
   - Adds routes to shared router
   - Attaches middleware

4. **Timer Registration**: `registerTimers()` called on each module
   - Schedules recurring tasks
   - Stores timer IDs for cleanup

5. **Start**: Application starts listening on configured port

6. **Shutdown**: On SIGINT:
   - Clear all timers
   - Remove signal listeners
   - Clean up resources

### Module Responsibilities

**UsersModule**:
- User authentication routes
- Admin user management routes
- Role/permission management routes
- Permission system initialization

**BooksModule**:
- Book listing and detail routes
- Book streaming route
- Tag management routes
- Reading progress routes
- Archive management routes
- Periodic book scanning timer

**GenresModule**:
- Genre listing route
- Genre detail route with filtered books

---

## Summary for Zig Implementation

### Critical Features to Preserve

1. **JWT-based authentication** with HS256 signing
2. **Role-based permissions** with direct user permissions
3. **Tag-based content filtering** for NSFW/restricted content
4. **Automatic book scanning** with metadata extraction
5. **ISBN-based external metadata fetching**
6. **Reading progress tracking** with statistics
7. **Archive management** for missing files
8. **Fine-grained permission checks** on routes
9. **Graceful shutdown** with timer cleanup
10. **File streaming** for book content

### Performance Considerations

1. **Database queries**: Many routes make multiple sequential queries. Consider connection pooling and query optimization.

2. **Permission checks**: Every authenticated request checks permissions. Consider caching user permissions in JWT or session.

3. **Tag filtering**: Filtering books by user permissions requires N queries (one per book). Consider denormalized views or caching.

4. **External API calls**: Metadata fetching can be slow. Consider async processing or background jobs.

5. **File system operations**: Book scanning walks entire directory tree. Consider incremental updates or file system watchers.

### Simplified Architecture Opportunities

1. **Remove global state**: Pass database through context instead of global `dustService`

2. **Separate auth middleware**: Split combined auth+permission middleware for better composition

3. **Cache permissions**: Store user permissions in JWT claims to reduce database queries

4. **Batch operations**: When filtering books, use a single query with JOINs instead of N queries

5. **Event-driven scanning**: Use file system watchers instead of hourly full scans

### Security Considerations

1. **JWT secret**: Must be strong and never committed to version control
2. **CORS**: Restrict origins in production
3. **File access**: Validate file paths to prevent directory traversal
4. **SQL injection**: All queries use parameterized statements (already good!)
5. **Rate limiting**: No rate limiting currently implemented
6. **Password requirements**: No enforcement of password complexity
7. **Session invalidation**: No ability to invalidate active JWTs

---

## Additional Resources

- **Project README**: `/README.md`
- **Docker Setup**: `/DOCKER-SETUP-SUMMARY.md`
- **ADR**: `/adr/00000-Use-SQLite.md`
- **Environment Variables**: `/.env.example`

---

*Document generated: 2025-11-23*
*For: Zig rewrite planning*
*Version: 1.0*
