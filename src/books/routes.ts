import { RouterContext, Status, type Router } from "@oak/oak";
import { bookService } from "./book-service.ts";
import { dustService } from "../../main.ts";
import { requirePermission, requirePermissionForResource, type AuthenticatedState } from "../users/permission-middleware.ts";
import { PERMISSIONS } from "../users/permissions.ts";
import { BookPermissionService } from "./permission-service.ts";
import { TagService } from "./tag-service.ts";
import { ReadingProgressService } from "./reading-progress-service.ts";
import { UserService } from "../users/user-service.ts";
import { ArchiveService } from "./archive-service.ts";

// Combined authentication + permission middleware for book routes
const authenticateAndRequirePermission = (permission: any) => {
  return async (ctx: any, next: any) => {
    // Authentication step
    const userService = new UserService(dustService.database);
    const bearer = ctx.request.headers.get("authorization");
    const token = bearer?.split(" ")?.[1];
    
    if (token) {
      try {
        const payload = await userService.validateJWT(token);
        ctx.state.user = payload.user;
      } catch (e) {
        console.warn("Invalid JWT token:", e instanceof Error ? e.message : String(e));
      }
    }
    
    // Permission check step
    if (!ctx.state.user) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" };
      return;
    }

    const permissionService = new (await import("../users/permission-service.ts")).PermissionService(dustService.database);
    const hasPermission = await permissionService.userHasPermission(
      ctx.state.user.id, 
      permission
    );

    if (!hasPermission) {
      ctx.response.status = 403;
      ctx.response.body = { error: `Permission denied: ${permission} required` };
      return;
    }

    await next();
  };
};

export const registerRoutes = (router: Router) => {

  // GET /books/authors - List all authors
  router.get("/books/authors", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx: RouterContext<"/books/authors">) => {
    try {
      const authors = await bookService.getAllAuthors(dustService.database);
      
      // Get book counts for each author
      const authorsWithCounts = await Promise.all(
        authors.map(async (author) => {
          const books = await bookService.getBooksByAuthor(dustService.database, author.id);
          return {
            ...author,
            bookCount: books.length
          };
        })
      );
      
      ctx.response.body = {
        authors: authorsWithCounts
      };
    } catch (error) {
      console.error('Failed to fetch authors:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: 'Failed to fetch authors' };
    }
  });

  // GET /books/authors/:id - Get specific author and their books
  router.get("/books/authors/:id", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx: RouterContext<"/books/authors/:id">) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const authorId = parseInt(ctx.params.id!, 10);
      if (isNaN(authorId)) {
        ctx.response.status = 400;
        ctx.response.body = { error: 'Invalid author ID' };
        return;
      }

      const author = await bookService.getAuthorById(dustService.database, authorId);
      if (!author) {
        ctx.response.status = 404;
        ctx.response.body = { error: 'Author not found' };
        return;
      }

      // Get books by this author with tag-based filtering
      const bookPermissionService = new BookPermissionService(dustService.database);
      const allAuthorBooks = await bookService.getBooksByAuthor(dustService.database, authorId);
      
      // Filter books based on user's tag permissions
      const accessibleBooks = [];
      for (const book of allAuthorBooks) {
        const { canAccess } = await bookPermissionService.canUserAccessBook(user.id, book.id);
        if (canAccess) {
          accessibleBooks.push(book);
        }
      }

      ctx.response.body = {
        author: author,
        books: accessibleBooks,
        totalBooks: accessibleBooks.length
      };
    } catch (error) {
      console.error('Failed to fetch author:', error);
      ctx.response.status = 500;
      ctx.response.body = { error: 'Failed to fetch author' };
    }
  });

  // GET /books/ - List all books (filtered by user's tag permissions)
  router.get("/books/", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx: RouterContext<"/books/">) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    const bookPermissionService = new BookPermissionService(dustService.database);
    
    // Get query parameters for filtering
    const url = new URL(ctx.request.url);
    const includeGenres = url.searchParams.get('includeGenres')?.split(',').filter(g => g.trim());
    const excludeGenres = url.searchParams.get('excludeGenres')?.split(',').filter(g => g.trim());
    const includeTags = url.searchParams.get('includeTags')?.split(',').filter(t => t.trim());
    const excludeTags = url.searchParams.get('excludeTags')?.split(',').filter(t => t.trim());
    
    const filters = {
      includeCategories: includeGenres ? ['genre'] : undefined,
      includeTags: [...(includeGenres || []), ...(includeTags || [])],
      excludeTags: [...(excludeGenres || []), ...(excludeTags || [])]
    };

    const books = await bookPermissionService.getBooksForUser(user.id, filters);
    
    ctx.response.body = {
      books: books,
      userPreferences: await bookPermissionService.getUserContentPreferences(user.id)
    };
  });

  // GET /books/:id - Get specific book (requires read permission + tag-based permissions)
  router.get("/books/:id", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx: RouterContext<"/books/:id">) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const bookPermissionService = new BookPermissionService(dustService.database);
      
      // Check if user can access this specific book based on its tags
      const { canAccess, reason } = await bookPermissionService.canUserAccessBook(user.id, bookId);
      
      if (!canAccess) {
        ctx.response.status = 403;
        ctx.response.body = { error: reason };
        return;
      }

      const book = await bookService.getBookById(dustService.database, ctx.params.id);
      const tagService = new TagService(dustService.database);
      const tags = await tagService.getBookTags(bookId);
      
      console.log(`📖 Book API: Returning book data - name: "${book.name}", filepath: "${book.filepath}", file_format: "${book.file_format}"`);
      
      ctx.response.body = {
        book: book,
        tags: tags
      };
      return;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Internal server error" };
    }
  });

  // GET /books/:id/stream - Stream book content (requires read permission + tag-based permissions)
  router.get("/books/:id/stream", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const bookId = ctx.params.id!;
    console.log(`🎬 STREAM: Starting book stream for ID ${bookId}`);
    
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      console.log(`🎬 STREAM: No user in context for book ${bookId}`);
      ctx.response.status = 401;
      return;
    }

    try {
      const bookIdNum = parseInt(bookId, 10);
      console.log(`🎬 STREAM: User ${user.email} requesting book ${bookIdNum}`);
      
      const bookPermissionService = new BookPermissionService(dustService.database);
      
      // Check if user can access this specific book based on its tags
      const { canAccess, reason } = await bookPermissionService.canUserAccessBook(user.id, bookIdNum);
      
      if (!canAccess) {
        console.log(`🎬 STREAM: Access denied for user ${user.email} to book ${bookIdNum}: ${reason}`);
        ctx.response.status = 403;
        ctx.response.body = { error: reason };
        return;
      }

      console.log(`🎬 STREAM: Permission check passed, fetching book data for ${bookIdNum}`);
      const book = await bookService.getBookById(dustService.database, bookId);
      console.log(`🎬 STREAM: Found book "${book.name}" at path: ${book.filepath}`);
      
      // Check if file exists
      try {
        const fileInfo = await Deno.stat(book.filepath);
        console.log(`🎬 STREAM: File exists, size: ${fileInfo.size} bytes`);
      } catch (statError) {
        console.error(`🎬 STREAM: File not found: ${book.filepath}`, statError);
        ctx.response.status = 404;
        ctx.response.body = { error: "Book file not found" };
        return;
      }
      
      console.log(`🎬 STREAM: Opening file for streaming: ${book.filepath}`);
      const file = await Deno.open(book.filepath, { read: true });
      
      // Set appropriate headers
      const ext = book.filepath.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        ctx.response.headers.set('Content-Type', 'application/pdf');
      } else if (ext === 'epub') {
        ctx.response.headers.set('Content-Type', 'application/epub+zip');
      }
      
      console.log(`🎬 STREAM: Starting file stream for ${book.name}`);
      ctx.response.body = file.readable;
      
      // Note: Don't close the file immediately, let the stream handle it
      console.log(`🎬 STREAM: Stream response set up successfully for book ${bookIdNum}`);
      return;
    } catch (e) {
      console.error(`🎬 STREAM: Error streaming book ${bookId}:`, e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Internal server error" };
    }
  });

  // GET /books/:id/progress - Get reading progress (requires read permission)
  router.get("/books/:id/progress", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const readingProgressService = new ReadingProgressService(dustService.database);
      
      const progress = await readingProgressService.getProgress(user.id, bookId);
      
      ctx.response.body = {
        book: {
          id: bookId,
        },
        progress: progress ? {
          current_page: progress.current_page,
          total_pages: progress.total_pages,
          percentage_complete: progress.percentage_complete,
          last_read_at: progress.last_read_at
        } : null
      };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get reading progress" };
    }
  });

  // PUT /books/:id/progress - Update reading progress (requires read permission)
  router.put("/books/:id/progress", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const body = await ctx.request.body.json();
      
      if (!body.current_page && body.current_page !== 0) {
        ctx.response.status = 400;
        ctx.response.body = { error: "current_page is required" };
        return;
      }

      const readingProgressService = new ReadingProgressService(dustService.database);
      
      const progress = await readingProgressService.updateProgress(
        user.id,
        bookId,
        body.current_page,
        body.total_pages
      );
      
      ctx.response.body = { progress };
      ctx.response.status = 200;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to update reading progress" };
    }
  });

  // POST /books/:id/progress/start - Start reading a book
  router.post("/books/:id/progress/start", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const body = await ctx.request.body.json().catch(() => ({}));
      
      const readingProgressService = new ReadingProgressService(dustService.database);
      
      const progress = await readingProgressService.startReading(
        user.id,
        bookId,
        body.total_pages
      );
      
      ctx.response.body = { progress };
      ctx.response.status = 200;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to start reading" };
    }
  });

  // POST /books/:id/progress/complete - Mark book as completed
  router.post("/books/:id/progress/complete", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const readingProgressService = new ReadingProgressService(dustService.database);
      
      const progress = await readingProgressService.markAsCompleted(user.id, bookId);
      
      ctx.response.body = { progress };
      ctx.response.status = 200;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to mark as completed" };
    }
  });

  // DELETE /books/:id/progress - Reset reading progress
  router.delete("/books/:id/progress", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const readingProgressService = new ReadingProgressService(dustService.database);
      
      await readingProgressService.resetProgress(user.id, bookId);
      
      ctx.response.body = { message: "Reading progress reset" };
      ctx.response.status = 200;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to reset progress" };
    }
  });

  // GET /tags - Get all tags (admin/librarian only)
  router.get("/tags", authenticateAndRequirePermission(PERMISSIONS.BOOKS_MANAGE), async (ctx) => {
    const tagService = new TagService(dustService.database);
    const tags = await tagService.getAllTags();
    
    ctx.response.body = { tags };
  });

  // GET /tags/categories/:category - Get tags by category
  router.get("/tags/categories/:category", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const tagService = new TagService(dustService.database);
    const tags = await tagService.getTagsByCategory(ctx.params.category!);
    
    ctx.response.body = { tags };
  });

  // POST /books/:id/tags - Add tag to book (librarian/admin only)
  router.post("/books/:id/tags", authenticateAndRequirePermission(PERMISSIONS.BOOKS_WRITE), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const body = await ctx.request.body.json();
      
      if (!body.tagName) {
        ctx.response.status = 400;
        ctx.response.body = { error: "tagName is required" };
        return;
      }

      const tagService = new TagService(dustService.database);
      await tagService.addTagToBook(bookId, body.tagName, user.id);
      
      ctx.response.body = { message: `Tag ${body.tagName} added to book ${bookId}` };
      ctx.response.status = 200;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to add tag" };
    }
  });

  // DELETE /books/:id/tags/:tagName - Remove tag from book (librarian/admin only)
  router.delete("/books/:id/tags/:tagName", authenticateAndRequirePermission(PERMISSIONS.BOOKS_WRITE), async (ctx) => {
    try {
      const bookId = parseInt(ctx.params.id!, 10);
      const tagName = ctx.params.tagName!;

      const tagService = new TagService(dustService.database);
      await tagService.removeTagFromBook(bookId, tagName);
      
      ctx.response.body = { message: `Tag ${tagName} removed from book ${bookId}` };
      ctx.response.status = 200;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to remove tag" };
    }
  });

  // GET /books/by-tag/:tagName - Get books with specific tag (filtered by user permissions)
  router.get("/books/by-tag/:tagName", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const tagName = ctx.params.tagName!;
      const bookPermissionService = new BookPermissionService(dustService.database);
      const tagService = new TagService(dustService.database);
      
      // Get books with the tag
      const allBooksWithTag = await tagService.getBooksWithTag(tagName);
      
      // Filter by user's permissions
      const accessibleBooks = await bookPermissionService.filterAccessibleBooks(user.id, allBooksWithTag);
      
      ctx.response.body = { books: accessibleBooks };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get books by tag" };
    }
  });

  // User Reading Progress Routes

  // GET /reading/progress - Get all reading progress for the current user
  router.get("/reading/progress", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const readingProgressService = new ReadingProgressService(dustService.database);
      const progress = await readingProgressService.getAllProgress(user.id);
      
      ctx.response.body = { progress };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get reading progress" };
    }
  });

  // GET /reading/recent - Get recently read books
  router.get("/reading/recent", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const url = new URL(ctx.request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      
      const readingProgressService = new ReadingProgressService(dustService.database);
      const recentBooks = await readingProgressService.getRecentlyRead(user.id, limit);
      
      ctx.response.body = { books: recentBooks };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get recently read books" };
    }
  });

  // GET /reading/currently-reading - Get books currently in progress
  router.get("/reading/currently-reading", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const readingProgressService = new ReadingProgressService(dustService.database);
      const currentBooks = await readingProgressService.getCurrentlyReading(user.id);
      
      ctx.response.body = { books: currentBooks };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get currently reading books" };
    }
  });

  // GET /reading/completed - Get completed books
  router.get("/reading/completed", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const readingProgressService = new ReadingProgressService(dustService.database);
      const completedBooks = await readingProgressService.getCompletedBooks(user.id);
      
      ctx.response.body = { books: completedBooks };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get completed books" };
    }
  });

  // GET /reading/stats - Get reading statistics
  router.get("/reading/stats", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    const user = (ctx.state as AuthenticatedState).user;
    if (!user) {
      ctx.response.status = 401;
      return;
    }

    try {
      const readingProgressService = new ReadingProgressService(dustService.database);
      const stats = await readingProgressService.getReadingStats(user.id);
      const streak = await readingProgressService.getReadingStreak(user.id);
      const activity = await readingProgressService.getReadingActivity(user.id, 30);
      
      ctx.response.body = { 
        stats: {
          ...stats,
          readingStreak: streak
        },
        recentActivity: activity
      };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get reading statistics" };
    }
  });

  // Archive Management Routes

  // GET /books/archive - List archived books
  router.get("/books/archive", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    try {
      const user = (ctx.state as AuthenticatedState).user;
      if (!user) {
        ctx.response.status = 401;
        ctx.response.body = { error: "User not authenticated" };
        return;
      }

      console.log(`📦 API: Fetching archived books for user ${user.id}`);

      const archiveService = new ArchiveService(dustService.database);
      const archivedBooks = await archiveService.getArchivedBooks();
      
      // Use permission service to filter books user can access
      const bookPermissionService = new BookPermissionService(dustService.database);
      const accessibleBooks = await bookPermissionService.getBooksForUser(user.id);

      // Filter for archived books only
      const filteredArchivedBooks = accessibleBooks.filter(book => 
        archivedBooks.some(archived => archived.id === book.id)
      );

      ctx.response.body = { 
        books: filteredArchivedBooks,
        total: filteredArchivedBooks.length 
      };
    } catch (error) {
      console.error("Error fetching archived books:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch archived books" };
    }
  });

  // POST /books/:id/archive - Archive a book
  router.post("/books/:id/archive", authenticateAndRequirePermission(PERMISSIONS.BOOKS_WRITE), async (ctx) => {
    try {
      const user = (ctx.state as AuthenticatedState).user;
      if (!user) {
        ctx.response.status = 401;
        ctx.response.body = { error: "User not authenticated" };
        return;
      }

      const bookId = parseInt(ctx.params.id);
      
      if (isNaN(bookId)) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid book ID" };
        return;
      }

      const body = await ctx.request.body.json();
      const reason = body.reason || "Manually archived by user";

      console.log(`📦 API: Archiving book ${bookId} for user ${user.id}: ${reason}`);

      const archiveService = new ArchiveService(dustService.database);
      await archiveService.manualArchive(bookId, `${reason} (archived by ${user.displayName})`);

      ctx.response.body = { 
        message: "Book archived successfully",
        bookId,
        reason 
      };
    } catch (error) {
      console.error("Error archiving book:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to archive book" };
    }
  });

  // DELETE /books/:id/archive - Unarchive a book
  router.delete("/books/:id/archive", authenticateAndRequirePermission(PERMISSIONS.BOOKS_WRITE), async (ctx) => {
    try {
      const user = (ctx.state as AuthenticatedState).user;
      if (!user) {
        ctx.response.status = 401;
        ctx.response.body = { error: "User not authenticated" };
        return;
      }

      const bookId = parseInt(ctx.params.id);
      
      if (isNaN(bookId)) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid book ID" };
        return;
      }

      console.log(`📤 API: Unarchiving book ${bookId} for user ${user.id}`);

      const archiveService = new ArchiveService(dustService.database);
      await archiveService.unarchiveBook(bookId);

      ctx.response.body = { 
        message: "Book unarchived successfully",
        bookId 
      };
    } catch (error) {
      console.error("Error unarchiving book:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to unarchive book" };
    }
  });

  // GET /books/archive/stats - Get archive statistics
  router.get("/books/archive/stats", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx) => {
    try {
      const user = (ctx.state as AuthenticatedState).user;
      if (!user) {
        ctx.response.status = 401;
        ctx.response.body = { error: "User not authenticated" };
        return;
      }

      console.log(`📊 API: Fetching archive stats for user ${user.id}`);

      const archiveService = new ArchiveService(dustService.database);
      const stats = await archiveService.getArchiveStats();

      ctx.response.body = { stats };
    } catch (error) {
      console.error("Error fetching archive stats:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to fetch archive statistics" };
    }
  });

  // POST /books/archive/validate - Manually trigger archive validation
  router.post("/books/archive/validate", authenticateAndRequirePermission(PERMISSIONS.BOOKS_MANAGE), async (ctx) => {
    try {
      const user = (ctx.state as AuthenticatedState).user;
      if (!user) {
        ctx.response.status = 401;
        ctx.response.body = { error: "User not authenticated" };
        return;
      }

      console.log(`🔍 API: Manual archive validation triggered by user ${user.id}`);

      const archiveService = new ArchiveService(dustService.database);
      const result = await archiveService.validateAndArchiveMissingBooks();

      ctx.response.body = { 
        message: "Archive validation completed",
        result 
      };
    } catch (error) {
      console.error("Error during manual archive validation:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to validate and archive books" };
    }
  });
};
