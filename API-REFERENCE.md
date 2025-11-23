# Dust Server API Reference

> Complete REST API documentation for Dust media server

## Base URL

```
http://localhost:4001
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Error Responses

All endpoints may return these standard error responses:

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Permission denied: books.read required"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Detailed error message",
  "stack": "Error stack trace (development only)"
}
```

---

## Health & Status

### Get Server Health

```
GET /health
```

**Authentication**: Not required

**Response**: 200 OK
```json
{
  "status": "ok",
  "version": "1.0.0",
  "service": "dust-server"
}
```

### Get Root Page

```
GET /
```

**Authentication**: Not required

**Response**: 200 OK (HTML with embedded Giphy iframe)

---

## Authentication Endpoints

### Login

```
POST /auth/login
```

**Authentication**: Not required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**: 200 OK
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "displayName": "User Name",
    "display_name": "User Name",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "roles": ["user"],
    "permissions": ["books.read", "genres.read"],
    "created": "2024-01-01T00:00:00Z",
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses**:
- 400 Bad Request: Invalid login data
- 401 Unauthorized: Invalid credentials
- 500 Internal Server Error: Login failed

### Register

```
POST /auth/register
```

**Authentication**: Not required

**Request Body**:
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "displayName": "User Name"
}
```

**Response**: 201 Created
```json
{
  "id": 2,
  "username": "newuser",
  "email": "user@example.com",
  "displayName": "User Name",
  "display_name": "User Name",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "roles": ["user"],
  "permissions": ["books.read", "genres.read"]
}
```

**Error Responses**:
- 400 Bad Request: Invalid registration data
- 500 Internal Server Error: Registration failed

### Logout

```
POST /auth/logout
```

**Authentication**: Not required (client-side token clearing)

**Response**: 200 OK
```json
{
  "message": "Logged out successfully"
}
```

---

## User Profile

### Get Current User Profile

```
GET /profile
```

**Authentication**: Required

**Permission**: `books.read` (or any permission)

**Response**: 200 OK
```json
{
  "id": 1,
  "username": "user",
  "email": "user@example.com",
  "displayName": "User Name",
  "display_name": "User Name",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "roles": ["user"],
  "permissions": ["books.read", "genres.read"]
}
```

---

## Books

### List All Books

```
GET /books/
```

**Authentication**: Required

**Permission**: `books.read`

**Query Parameters**:
- `includeGenres`: Comma-separated genre tag names to include
- `excludeGenres`: Comma-separated genre tag names to exclude
- `includeTags`: Comma-separated tag names to include
- `excludeTags`: Comma-separated tag names to exclude

**Example**:
```
GET /books/?includeGenres=Fiction,Mystery&excludeTags=NSFW
```

**Response**: 200 OK
```json
{
  "books": [
    {
      "id": 1,
      "name": "The Great Gatsby",
      "author": 1,
      "filepath": "/books/F. Scott Fitzgerald/The Great Gatsby/gatsby.epub",
      "isbn": "9780743273565",
      "publication_date": "1925-04-10",
      "publisher": "Scribner",
      "description": "A novel about the American Dream...",
      "page_count": 180,
      "file_size": 2456789,
      "file_format": "epub",
      "cover_image_path": "/books/F. Scott Fitzgerald/The Great Gatsby/cover.jpg",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "userPreferences": {
    "allowedTags": ["Fiction", "Mystery"],
    "deniedTags": ["NSFW", "Adult"]
  }
}
```

### Get Book Details

```
GET /books/:id
```

**Authentication**: Required

**Permission**: `books.read` + tag-based permissions

**Response**: 200 OK
```json
{
  "book": {
    "id": 1,
    "name": "The Great Gatsby",
    "author": 1,
    "filepath": "/books/F. Scott Fitzgerald/The Great Gatsby/gatsby.epub",
    "isbn": "9780743273565",
    "publication_date": "1925-04-10",
    "publisher": "Scribner",
    "description": "A novel about the American Dream...",
    "page_count": 180,
    "file_size": 2456789,
    "file_format": "epub",
    "cover_image_path": "/books/F. Scott Fitzgerald/The Great Gatsby/cover.jpg",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "tags": [
    {
      "id": 3,
      "name": "Fiction",
      "category": "genre",
      "description": "Fiction books",
      "color": "#4169E1",
      "requires_permission": null
    },
    {
      "id": 7,
      "name": "EPUB",
      "category": "format",
      "description": "EPUB format",
      "color": "#4ECDC4",
      "requires_permission": null
    }
  ]
}
```

**Error Responses**:
- 403 Forbidden: User lacks permission for one or more tags on this book

### Stream Book Content

```
GET /books/:id/stream
```

**Authentication**: Required

**Permission**: `books.read` + tag-based permissions

**Response**: 200 OK (streaming file content)

**Headers**:
- `Content-Type`: `application/pdf` or `application/epub+zip` based on file format

**Error Responses**:
- 403 Forbidden: User lacks permission for this book
- 404 Not Found: Book file not found on filesystem
- 500 Internal Server Error: Failed to open file

---

## Authors

### List All Authors

```
GET /books/authors
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "authors": [
    {
      "id": 1,
      "name": "F. Scott Fitzgerald",
      "biography": "Francis Scott Key Fitzgerald was an American novelist...",
      "birth_date": "1896-09-24",
      "death_date": "1940-12-21",
      "nationality": "American",
      "image_url": "https://example.com/fitzgerald.jpg",
      "wikipedia_url": "https://en.wikipedia.org/wiki/F._Scott_Fitzgerald",
      "bookCount": 5
    }
  ]
}
```

### Get Author Details

```
GET /books/authors/:id
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "author": {
    "id": 1,
    "name": "F. Scott Fitzgerald",
    "biography": "Francis Scott Key Fitzgerald was an American novelist...",
    "birth_date": "1896-09-24",
    "death_date": "1940-12-21",
    "nationality": "American",
    "image_url": "https://example.com/fitzgerald.jpg",
    "wikipedia_url": "https://en.wikipedia.org/wiki/F._Scott_Fitzgerald"
  },
  "books": [
    {
      "id": 1,
      "name": "The Great Gatsby",
      "filepath": "/books/F. Scott Fitzgerald/The Great Gatsby/gatsby.epub",
      "file_format": "epub",
      "page_count": 180
    }
  ],
  "totalBooks": 1
}
```

**Note**: Books list is filtered by user's tag permissions.

---

## Tags

### List All Tags

```
GET /tags
```

**Authentication**: Required

**Permission**: `books.manage`

**Response**: 200 OK
```json
{
  "tags": [
    {
      "id": 1,
      "name": "NSFW",
      "category": "content-rating",
      "description": "Not Safe For Work content",
      "color": "#FF4444",
      "requires_permission": "content.nsfw",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 3,
      "name": "Fiction",
      "category": "genre",
      "description": "Fiction books",
      "color": "#4169E1",
      "requires_permission": null,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Tags by Category

```
GET /tags/categories/:category
```

**Authentication**: Required

**Permission**: `books.read`

**Path Parameters**:
- `category`: Tag category (e.g., "genre", "content-rating", "format")

**Response**: 200 OK
```json
{
  "tags": [
    {
      "id": 3,
      "name": "Fiction",
      "category": "genre",
      "description": "Fiction books",
      "color": "#4169E1",
      "requires_permission": null
    },
    {
      "id": 4,
      "name": "Non-Fiction",
      "category": "genre",
      "description": "Non-fiction books",
      "color": "#228B22",
      "requires_permission": null
    }
  ]
}
```

### Add Tag to Book

```
POST /books/:id/tags
```

**Authentication**: Required

**Permission**: `books.write`

**Request Body**:
```json
{
  "tagName": "Fiction"
}
```

**Response**: 200 OK
```json
{
  "message": "Tag Fiction added to book 1"
}
```

### Remove Tag from Book

```
DELETE /books/:id/tags/:tagName
```

**Authentication**: Required

**Permission**: `books.write`

**Response**: 200 OK
```json
{
  "message": "Tag Fiction removed from book 1"
}
```

### Get Books by Tag

```
GET /books/by-tag/:tagName
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "books": [
    {
      "id": 1,
      "name": "The Great Gatsby",
      "author": 1,
      "file_format": "epub"
    }
  ]
}
```

**Note**: Results are filtered by user's tag permissions.

---

## Reading Progress

### Get Book Progress

```
GET /books/:id/progress
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "book": {
    "id": 1
  },
  "progress": {
    "current_page": 45,
    "total_pages": 180,
    "percentage_complete": 25.0,
    "last_read_at": "2024-01-15T10:30:00Z"
  }
}
```

**Note**: If no progress exists, `progress` will be `null`.

### Update Book Progress

```
PUT /books/:id/progress
```

**Authentication**: Required

**Permission**: `books.read`

**Request Body**:
```json
{
  "current_page": 50,
  "total_pages": 180
}
```

**Response**: 200 OK
```json
{
  "progress": {
    "current_page": 50,
    "total_pages": 180,
    "percentage_complete": 27.78,
    "last_read_at": "2024-01-15T10:35:00Z"
  }
}
```

### Start Reading Book

```
POST /books/:id/progress/start
```

**Authentication**: Required

**Permission**: `books.read`

**Request Body** (optional):
```json
{
  "total_pages": 180
}
```

**Response**: 200 OK
```json
{
  "progress": {
    "current_page": 0,
    "total_pages": 180,
    "percentage_complete": 0.0,
    "last_read_at": "2024-01-15T10:30:00Z"
  }
}
```

### Mark Book as Completed

```
POST /books/:id/progress/complete
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "progress": {
    "current_page": 180,
    "total_pages": 180,
    "percentage_complete": 100.0,
    "last_read_at": "2024-01-15T10:30:00Z"
  }
}
```

### Reset Book Progress

```
DELETE /books/:id/progress
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "message": "Reading progress reset"
}
```

### Get All Reading Progress

```
GET /reading/progress
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "progress": [
    {
      "id": 1,
      "user_id": 1,
      "book_id": 1,
      "current_page": 50,
      "total_pages": 180,
      "percentage_complete": 27.78,
      "last_read_at": "2024-01-15T10:35:00Z",
      "created_at": "2024-01-10T09:00:00Z"
    }
  ]
}
```

### Get Recently Read Books

```
GET /reading/recent?limit=10
```

**Authentication**: Required

**Permission**: `books.read`

**Query Parameters**:
- `limit`: Number of books to return (default: 10)

**Response**: 200 OK
```json
{
  "books": [
    {
      "book_id": 1,
      "book_name": "The Great Gatsby",
      "current_page": 50,
      "total_pages": 180,
      "percentage_complete": 27.78,
      "last_read_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

### Get Currently Reading Books

```
GET /reading/currently-reading
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "books": [
    {
      "book_id": 1,
      "book_name": "The Great Gatsby",
      "current_page": 50,
      "total_pages": 180,
      "percentage_complete": 27.78,
      "last_read_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

### Get Completed Books

```
GET /reading/completed
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "books": [
    {
      "book_id": 2,
      "book_name": "To Kill a Mockingbird",
      "current_page": 281,
      "total_pages": 281,
      "percentage_complete": 100.0,
      "last_read_at": "2024-01-14T15:20:00Z"
    }
  ]
}
```

### Get Reading Statistics

```
GET /reading/stats
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "stats": {
    "totalBooksStarted": 15,
    "totalBooksCompleted": 8,
    "averageCompletionRate": 53.33,
    "totalPagesRead": 2450,
    "readingStreak": 7
  },
  "recentActivity": [
    {
      "book_id": 1,
      "book_name": "The Great Gatsby",
      "last_read_at": "2024-01-15T10:35:00Z",
      "percentage_complete": 27.78
    }
  ]
}
```

---

## Archive Management

### List Archived Books

```
GET /books/archive
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "books": [
    {
      "id": 5,
      "name": "Missing Book",
      "author": 3,
      "filepath": "/books/Author/Missing Book/book.epub",
      "status": "archived",
      "archived_at": "2024-01-10T08:00:00Z",
      "archive_reason": "File not found at /books/Author/Missing Book/book.epub"
    }
  ],
  "total": 1
}
```

### Archive a Book

```
POST /books/:id/archive
```

**Authentication**: Required

**Permission**: `books.write`

**Request Body**:
```json
{
  "reason": "Temporarily removing from library"
}
```

**Response**: 200 OK
```json
{
  "message": "Book archived successfully",
  "bookId": 1,
  "reason": "Temporarily removing from library (archived by User Name)"
}
```

### Unarchive a Book

```
DELETE /books/:id/archive
```

**Authentication**: Required

**Permission**: `books.write`

**Response**: 200 OK
```json
{
  "message": "Book unarchived successfully",
  "bookId": 1
}
```

### Get Archive Statistics

```
GET /books/archive/stats
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "stats": {
    "totalArchived": 5,
    "archivedThisWeek": 2,
    "archivedThisMonth": 3,
    "reasonBreakdown": {
      "File not found": 3,
      "Manual archive": 2
    }
  }
}
```

### Trigger Archive Validation

```
POST /books/archive/validate
```

**Authentication**: Required

**Permission**: `books.manage`

**Response**: 200 OK
```json
{
  "message": "Archive validation completed",
  "result": {
    "archivedCount": 2,
    "unarchivedCount": 1,
    "errors": []
  }
}
```

---

## Genres

### List All Genres

```
GET /genres/
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "genres": [
    {
      "id": 3,
      "name": "Fiction",
      "description": "Fiction books",
      "color": "#4169E1",
      "bookCount": 25
    },
    {
      "id": 4,
      "name": "Non-Fiction",
      "description": "Non-fiction books",
      "color": "#228B22",
      "bookCount": 15
    }
  ]
}
```

### Get Genre Details

```
GET /genres/:id
```

**Authentication**: Required

**Permission**: `books.read`

**Response**: 200 OK
```json
{
  "genre": {
    "id": 3,
    "name": "Fiction",
    "description": "Fiction books",
    "color": "#4169E1"
  },
  "books": [
    {
      "id": 1,
      "name": "The Great Gatsby",
      "author": 1,
      "file_format": "epub"
    }
  ],
  "totalBooks": 1
}
```

**Note**: Books list is filtered by user's tag permissions.

---

## Admin - User Management

### List All Users

```
GET /admin/users
```

**Authentication**: Required

**Permission**: `users.manage` or `admin.full`

**Response**: 200 OK
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "displayName": "Administrator",
      "display_name": "Administrator",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "roles": ["admin"],
      "permissions": ["admin.full"]
    },
    {
      "id": 2,
      "username": "user",
      "email": "user@example.com",
      "displayName": "Regular User",
      "display_name": "Regular User",
      "is_active": true,
      "created_at": "2024-01-05T00:00:00Z",
      "updated_at": "2024-01-05T00:00:00Z",
      "roles": ["user"],
      "permissions": ["books.read", "genres.read"]
    }
  ]
}
```

### Get User by ID

```
GET /admin/users/:id
```

**Authentication**: Required

**Permission**: Self or `admin.full`

**Response**: 200 OK
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "displayName": "Administrator",
    "display_name": "Administrator",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "roles": ["admin"],
    "permissions": ["admin.full"]
  }
}
```

### Create User

```
POST /admin/users
```

**Authentication**: Required

**Permission**: `admin.full`

**Request Body**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "display_name": "New User",
  "roles": ["user"]
}
```

**Response**: 201 Created
```json
{
  "user": {
    "id": 3,
    "username": "newuser",
    "email": "newuser@example.com",
    "displayName": "New User",
    "display_name": "New User",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "roles": ["user"]
  }
}
```

### Update User

```
PUT /admin/users/:id
```

**Authentication**: Required

**Permission**: Self (limited fields) or `admin.full` (all fields)

**Request Body (Self-update)**:
```json
{
  "username": "newusername",
  "email": "newemail@example.com",
  "display_name": "New Display Name"
}
```

**Request Body (Admin-update)**:
```json
{
  "username": "newusername",
  "email": "newemail@example.com",
  "display_name": "New Display Name",
  "roles": ["librarian"],
  "is_active": false
}
```

**Response**: 200 OK
```json
{
  "user": {
    "id": 2,
    "username": "newusername",
    "email": "newemail@example.com",
    "displayName": "New Display Name",
    "is_active": true,
    "updated_at": "2024-01-15T10:35:00Z"
  }
}
```

**Error Responses**:
- 403 Forbidden: User cannot modify their own roles or is_active status

### Delete User

```
DELETE /admin/users/:id
```

**Authentication**: Required

**Permission**: `admin.full`

**Response**: 200 OK
```json
{
  "message": "User deactivated successfully"
}
```

**Error Responses**:
- 400 Bad Request: Cannot delete your own account

---

## Admin - Role Management

### List All Roles

```
GET /admin/roles
```

**Authentication**: Required

**Permission**: `admin.full`

**Response**: 200 OK
```json
{
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "Full system administrator",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "name": "librarian",
      "description": "Can manage books and content",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 3,
      "name": "user",
      "description": "Standard user with read access",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Role

```
POST /admin/roles
```

**Authentication**: Required

**Permission**: `admin.full`

**Request Body**:
```json
{
  "name": "moderator",
  "description": "Can moderate content",
  "permissions": ["books.read", "books.write", "users.read"]
}
```

**Response**: 201 Created
```json
{
  "role": {
    "id": 5,
    "name": "moderator",
    "description": "Can moderate content",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Update Role

```
PUT /admin/roles/:id
```

**Authentication**: Required

**Permission**: `admin.full`

**Request Body**:
```json
{
  "name": "moderator",
  "description": "Can moderate content and users",
  "permissions": ["books.read", "books.write", "users.read", "users.write"]
}
```

**Response**: 200 OK
```json
{
  "role": {
    "id": 5,
    "name": "moderator",
    "description": "Can moderate content and users"
  }
}
```

### Delete Role

```
DELETE /admin/roles/:id
```

**Authentication**: Required

**Permission**: `admin.full`

**Response**: 200 OK
```json
{
  "message": "Role deleted successfully"
}
```

---

## Admin - Permission Management

### List All Permissions

```
GET /admin/permissions
```

**Authentication**: Required

**Permission**: `admin.full`

**Response**: 200 OK
```json
{
  "permissions": [
    {
      "id": 1,
      "name": "books.read",
      "resource_type": "book",
      "description": "Read access to books",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "name": "books.write",
      "resource_type": "book",
      "description": "Write access to books",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 10,
      "name": "admin.full",
      "resource_type": "system",
      "description": "Full administrative access",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Admin - Dashboard

### Get Dashboard Data

```
GET /admin/dashboard
```

**Authentication**: Required

**Permission**: `admin.full`

**Response**: 200 OK
```json
{
  "userStats": {
    "totalUsers": 25,
    "activeUsers": 22,
    "usersByRole": {
      "admin": 2,
      "librarian": 3,
      "user": 20
    }
  },
  "systemInfo": {
    "version": "1.0.0",
    "uptime": "N/A",
    "denoVersion": "1.40.0"
  }
}
```

---

## Rate Limits

**Note**: Currently, no rate limiting is implemented. This should be added in production.

---

## Pagination

**Note**: Currently, no pagination is implemented. All endpoints return full result sets. This should be added for production use, especially for:
- `/books/` (potentially thousands of books)
- `/admin/users` (many users)
- `/reading/progress` (many progress records)

---

## WebSocket Support

**Status**: Not currently implemented

---

## File Upload

**Status**: Not currently implemented. Books must be added via filesystem scanning.

---

## Content Types

### Supported Book Formats

- PDF (`.pdf`)
- EPUB (`.epub`)
- MOBI (`.mobi`)
- AZW3 (`.azw3`)
- Comic Book RAR (`.cbr`)
- Comic Book ZIP (`.cbz`)

### API Content Types

- **Request**: `application/json`
- **Response**: `application/json` (except streaming endpoints)
- **Streaming**: `application/pdf` or `application/epub+zip`

---

## CORS Configuration

**Development Mode**:
- Origin: `*` (all origins allowed)
- Credentials: Allowed
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Content-Type, Authorization, Accept

**Production Recommendation**: Restrict `origin` to specific client domains.

---

*API Reference Version: 1.0*
*Last Updated: 2025-11-23*
