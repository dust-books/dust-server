import { RouterContext, type Router } from "@oak/oak";
import { dustService } from "../../main.ts";
import { requirePermission, type AuthenticatedState } from "../users/permission-middleware.ts";
import { PERMISSIONS } from "../users/permissions.ts";
import { TagService } from "../books/tag-service.ts";
import { BookPermissionService } from "../books/permission-service.ts";
import { UserService } from "../users/user-service.ts";

// Combined authentication + permission middleware for genre routes
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
        console.warn("Invalid JWT token:", e.message);
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
    
    // GET /genres/ - List all genre tags with book counts
    router.get("/genres/", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx: RouterContext<"/genres/">) => {
        try {
            const tagService = new TagService(dustService.database);
            const genreTags = await tagService.getTagsByCategory('genre');
            
            // Get book counts for each genre
            const genresWithCounts = await Promise.all(
                genreTags.map(async (tag) => {
                    const books = await tagService.getBooksWithTag(tag.name);
                    return {
                        id: tag.id,
                        name: tag.name,
                        description: tag.description,
                        color: tag.color,
                        bookCount: books.length
                    };
                })
            );
            
            ctx.response.body = {
                genres: genresWithCounts
            };
        } catch (error) {
            console.error('Failed to fetch genres:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Failed to fetch genres' };
        }
    });

    // GET /genres/:id - Get specific genre and its books (with permission filtering)
    router.get("/genres/:id", authenticateAndRequirePermission(PERMISSIONS.BOOKS_READ), async (ctx: RouterContext<"/genres/:id">) => {
        const user = (ctx.state as AuthenticatedState).user;
        if (!user) {
            ctx.response.status = 401;
            return;
        }

        try {
            const genreId = parseInt(ctx.params.id!, 10);
            if (isNaN(genreId)) {
                ctx.response.status = 400;
                ctx.response.body = { error: 'Invalid genre ID' };
                return;
            }

            const tagService = new TagService(dustService.database);
            const bookPermissionService = new BookPermissionService(dustService.database);
            
            // Get the genre tag
            const genreTags = await tagService.getAllTags();
            const genre = genreTags.find(tag => tag.id === genreId && tag.category === 'genre');
            
            if (!genre) {
                ctx.response.status = 404;
                ctx.response.body = { error: 'Genre not found' };
                return;
            }

            // Get books with this genre tag
            const allGenreBooks = await tagService.getBooksWithTag(genre.name);
            
            // Filter books based on user's tag permissions
            const accessibleBooks = [];
            for (const book of allGenreBooks) {
                const { canAccess } = await bookPermissionService.canUserAccessBook(user.id, book.id);
                if (canAccess) {
                    accessibleBooks.push(book);
                }
            }

            ctx.response.body = {
                genre: {
                    id: genre.id,
                    name: genre.name,
                    description: genre.description,
                    color: genre.color
                },
                books: accessibleBooks,
                totalBooks: accessibleBooks.length
            };
        } catch (error) {
            console.error('Failed to fetch genre:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Failed to fetch genre' };
        }
    });
}