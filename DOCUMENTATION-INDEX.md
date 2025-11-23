# Dust Server Documentation Index

> Quick reference guide to all documentation for the Dust media server and its planned Zig rewrite

---

## Documentation Overview

This repository contains comprehensive documentation analyzing the Dust server codebase and providing a detailed roadmap for reimplementing it in Zig.

### 📚 Available Documents

| Document | Size | Purpose | Audience |
|----------|------|---------|----------|
| [CODEBASE-ANALYSIS.md](./CODEBASE-ANALYSIS.md) | 40KB | Deep technical analysis of current implementation | Developers, Architects |
| [API-REFERENCE.md](./API-REFERENCE.md) | 23KB | Complete REST API specification | Developers, API Consumers |
| [ZIG-MIGRATION-GUIDE.md](./ZIG-MIGRATION-GUIDE.md) | 26KB | Practical Zig implementation guide | Zig Developers |
| [README.md](./README.md) | - | Project overview and setup | All Users |
| [.env.example](./.env.example) | - | Environment configuration template | Operators |

---

## Quick Navigation

### For Understanding Current System

**Start here if you want to understand how Dust currently works:**

1. Read [README.md](./README.md) for project overview
2. Review [CODEBASE-ANALYSIS.md](./CODEBASE-ANALYSIS.md) for architecture details
3. Check [API-REFERENCE.md](./API-REFERENCE.md) for endpoint specifications

### For API Integration

**Start here if you're building a client application:**

1. Read [API-REFERENCE.md](./API-REFERENCE.md) for complete API documentation
2. Review authentication section in [CODEBASE-ANALYSIS.md](./CODEBASE-ANALYSIS.md#authentication--authorization)
3. Check [.env.example](./.env.example) for server configuration

### For Zig Migration

**Start here if you're implementing the Zig rewrite:**

1. Read [ZIG-MIGRATION-GUIDE.md](./ZIG-MIGRATION-GUIDE.md) for implementation roadmap
2. Review [CODEBASE-ANALYSIS.md](./CODEBASE-ANALYSIS.md) for detailed behavior documentation
3. Reference [API-REFERENCE.md](./API-REFERENCE.md) for API compatibility requirements

---

## Document Summaries

### CODEBASE-ANALYSIS.md

**What it contains:**
- System architecture overview
- Technology stack details
- Complete route catalog (50+ endpoints)
- Authentication patterns (JWT, bcrypt, sessions)
- Database schema (10 tables with relationships)
- Core services documentation
- Permission system architecture
- Tag-based content filtering
- Reading progress tracking
- Archive management
- File system operations
- External API integrations
- Interesting behavioral patterns
- Performance considerations
- Security considerations
- Zig implementation recommendations

**Key sections:**
- [API Routes](./CODEBASE-ANALYSIS.md#api-routes) - All endpoints documented
- [Database Schema](./CODEBASE-ANALYSIS.md#database-schema) - Complete schema
- [Permission System](./CODEBASE-ANALYSIS.md#permission-system) - RBAC details
- [Interesting Behaviors](./CODEBASE-ANALYSIS.md#interesting-behaviors--patterns) - Critical patterns

### API-REFERENCE.md

**What it contains:**
- Base URL and configuration
- Authentication methods
- Error response formats
- All 50+ endpoints with:
  - HTTP method
  - Path
  - Request body schemas
  - Response schemas
  - Authentication requirements
  - Permission requirements
  - Query parameters
  - Path parameters

**Organized by category:**
- Health & Status
- Authentication
- User Profile
- Books
- Authors
- Tags
- Reading Progress
- Archive Management
- Genres
- Admin User Management
- Admin Role Management
- Admin Dashboard

### ZIG-MIGRATION-GUIDE.md

**What it contains:**
- Architecture mapping (TypeScript → Zig)
- Technology stack equivalents
- 10-phase implementation plan (20 weeks)
- Complete code examples for:
  - Database layer
  - HTTP server
  - Routing
  - JWT authentication
  - Password hashing
  - Middleware
  - Service pattern
- Testing strategy
- Performance targets
- Memory management patterns
- Error handling patterns
- Migration checklist

**Key sections:**
- [Implementation Phases](./ZIG-MIGRATION-GUIDE.md#implementation-phases) - 20-week roadmap
- [Database Layer](./ZIG-MIGRATION-GUIDE.md#database-layer) - SQLite implementation
- [HTTP Server Layer](./ZIG-MIGRATION-GUIDE.md#http-server-layer) - httpz usage
- [Authentication Layer](./ZIG-MIGRATION-GUIDE.md#authentication-layer) - JWT & bcrypt
- [Performance Targets](./ZIG-MIGRATION-GUIDE.md#performance-targets) - Benchmarks

---

## Key Statistics

### Current System (TypeScript/Deno)

- **Languages**: TypeScript, JavaScript
- **Runtime**: Deno 1.40+
- **Lines of Code**: ~5,000 (estimated)
- **TypeScript Files**: 41
- **Modules**: 3 (Users, Books, Genres)
- **API Endpoints**: 50+
- **Database Tables**: 10
- **Default Tags**: 60+
- **Default Roles**: 4
- **Default Permissions**: 18+

### Target System (Zig)

- **Language**: Zig
- **Estimated Lines**: ~8,000-10,000
- **Implementation Time**: 20 weeks
- **Expected Performance**: 20-50% faster
- **Expected Memory**: 50-70% less
- **Deployment**: Single binary

---

## Technology Stacks

### Current Stack

```
Runtime:        Deno
Language:       TypeScript
Web Framework:  Oak (@oak/oak)
Database:       SQLite (libsql/client)
Authentication: jose (JWT)
Password:       bcrypt (@ts-rex/bcrypt)
CORS:           oakCors
Testing:        Deno test
```

### Proposed Stack

```
Compiler:       Zig
Web Framework:  httpz
Database:       SQLite (C bindings)
Authentication: jwt-zig
Password:       bcrypt (C library)
Testing:        Zig test
```

---

## Architecture Diagrams

### Module Structure

```
┌─────────────────────────────────┐
│      DustService (main.ts)      │
│  ┌───────────────────────────┐  │
│  │   Router (Oak)            │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Database (SQLite)       │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Config                  │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   TimerManager            │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │        │        │
    ┌────┘        │        └────┐
    │             │             │
┌───▼────┐   ┌───▼────┐   ┌───▼────┐
│ Users  │   │ Books  │   │ Genres │
│ Module │   │ Module │   │ Module │
└────────┘   └────────┘   └────────┘
```

### Request Flow

```
1. Client Request
   ↓
2. CORS Middleware
   ↓
3. Route Matching
   ↓
4. Auth Middleware (Extract JWT)
   ↓
5. Permission Middleware (Check Permission)
   ↓
6. Route Handler
   ↓
7. Business Logic (Service Layer)
   ↓
8. Database Query (Data Layer)
   ↓
9. Response Formatting
   ↓
10. Client Response
```

### Database Schema Overview

```
users ───┐
         ├──── user_roles ──── roles ──── role_permissions ──── permissions
         │
         └──── user_permissions ──── permissions
         
         
users ──── reading_progress ──── books ──── authors
                              │
                              └──── book_tags ──── tags
```

---

## Common Use Cases

### Use Case 1: Understanding Authentication

1. Start with [API-REFERENCE.md - Authentication](./API-REFERENCE.md#authentication-endpoints)
2. Review [CODEBASE-ANALYSIS.md - Authentication](./CODEBASE-ANALYSIS.md#authentication--authorization)
3. For Zig: See [ZIG-MIGRATION-GUIDE.md - Authentication Layer](./ZIG-MIGRATION-GUIDE.md#authentication-layer)

### Use Case 2: Understanding Permissions

1. Start with [CODEBASE-ANALYSIS.md - Permission System](./CODEBASE-ANALYSIS.md#permission-system)
2. Review database schema for permission tables
3. Check [API-REFERENCE.md](./API-REFERENCE.md) for permission requirements per endpoint
4. For Zig: See middleware implementation in migration guide

### Use Case 3: Understanding Tag-Based Filtering

1. Read [CODEBASE-ANALYSIS.md - Tag-Based Content Filtering](./CODEBASE-ANALYSIS.md#tag-based-content-filtering)
2. Review [API-REFERENCE.md - Tags](./API-REFERENCE.md#tags)
3. Check TagService implementation details

### Use Case 4: Implementing Book Streaming

1. Review [API-REFERENCE.md - Stream Book Content](./API-REFERENCE.md#stream-book-content)
2. Read [CODEBASE-ANALYSIS.md - File Streaming](./CODEBASE-ANALYSIS.md#9-file-streaming)
3. For Zig: Implement file reading and HTTP streaming

### Use Case 5: Adding a New Permission

1. Review [CODEBASE-ANALYSIS.md - Permission System](./CODEBASE-ANALYSIS.md#permission-system)
2. Add permission constant to `permissions.ts`
3. Update permission initialization in UserService
4. Add middleware to routes requiring new permission
5. Update [API-REFERENCE.md](./API-REFERENCE.md) with new permission

---

## FAQ

### Q: Where do I start if I want to understand the system?

**A:** Start with [README.md](./README.md) for overview, then read [CODEBASE-ANALYSIS.md](./CODEBASE-ANALYSIS.md) for detailed architecture.

### Q: Where can I find the complete API specification?

**A:** See [API-REFERENCE.md](./API-REFERENCE.md) for all endpoints, request/response formats, and examples.

### Q: How long will the Zig migration take?

**A:** The [ZIG-MIGRATION-GUIDE.md](./ZIG-MIGRATION-GUIDE.md) estimates 20 weeks (5 months) for complete implementation and testing.

### Q: What performance improvements can we expect from Zig?

**A:** Target 20-50% faster response times and 50-70% lower memory usage. See [Performance Targets](./ZIG-MIGRATION-GUIDE.md#performance-targets).

### Q: Is the Zig version API-compatible with the current version?

**A:** Yes, 100% API compatibility is a goal. The migration guide provides detailed specifications to ensure compatibility.

### Q: What database is used?

**A:** SQLite for simplicity. See [Database Schema](./CODEBASE-ANALYSIS.md#database-schema) for complete schema.

### Q: How does authentication work?

**A:** JWT tokens with HS256 signing, 24-hour expiration. See [Authentication & Authorization](./CODEBASE-ANALYSIS.md#authentication--authorization).

### Q: How does the permission system work?

**A:** Role-based access control (RBAC) with direct user permissions. See [Permission System](./CODEBASE-ANALYSIS.md#permission-system).

### Q: How does content filtering work?

**A:** Tag-based filtering where tags can require specific permissions. See [Tag-Based Content Filtering](./CODEBASE-ANALYSIS.md#tag-based-content-filtering).

### Q: What file formats are supported?

**A:** PDF, EPUB, MOBI, AZW3, CBR, CBZ. See [API-REFERENCE.md - Content Types](./API-REFERENCE.md#content-types).

---

## Contributing

When updating documentation:

1. **Keep all documents in sync** - Changes to behavior should be reflected in all relevant docs
2. **Update this index** - Add new documents to the table above
3. **Maintain examples** - Keep code examples accurate and tested
4. **Version documents** - Note version and last updated date

---

## Glossary

- **RBAC**: Role-Based Access Control
- **JWT**: JSON Web Token
- **NSFW**: Not Safe For Work (content rating)
- **ISBN**: International Standard Book Number
- **EPUB**: Electronic Publication (ebook format)
- **SQLite**: Embedded SQL database
- **CORS**: Cross-Origin Resource Sharing
- **Middleware**: Request/response processing layer
- **ORM**: Object-Relational Mapping (not used in Dust)
- **DAL**: Data Access Layer

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-23 | Initial documentation release |

---

## Contact & Support

For questions about this documentation:
- Create an issue in the GitHub repository
- Review existing issues for answers
- Check the [README.md](./README.md) for contribution guidelines

---

*Documentation Index Version: 1.0*
*Last Updated: 2025-11-23*
*Total Documentation: ~90KB across 3 main documents*
