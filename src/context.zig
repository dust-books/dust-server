const std = @import("std");
const httpz = @import("httpz");
const AuthService = @import("modules/users/auth.zig").AuthService;
const JWT = @import("auth/jwt.zig").JWT;
const PermissionService = @import("auth/permission_service.zig").PermissionService;
const PermissionRepository = @import("auth/permission_repository.zig").PermissionRepository;
const Database = @import("database.zig").Database;
const BookRepository = @import("modules/books/model.zig").BookRepository;
const AuthorRepository = @import("modules/books/model.zig").AuthorRepository;
const TagRepository = @import("modules/books/model.zig").TagRepository;

/// Context specific to authentication behaviors
pub const AuthContext = struct {
    auth_service: *AuthService,
    jwt: JWT,
    allocator: std.mem.Allocator,
};

/// Server-wide context holding services and repositories
pub const ServerContext = struct {
    auth_context: AuthContext,
    permission_service: *PermissionService,
    permission_repo: *PermissionRepository,
    db: *Database,
    book_repo: *BookRepository,
    author_repo: *AuthorRepository,
    tag_repo: *TagRepository,
    library_directories: []const []const u8,

    pub fn notFound(_: *ServerContext, req: *httpz.Request, res: *httpz.Response) !void {
        std.log.debug("404 Not Found: {s}\n", .{req.url.path});
        res.status = 404;
        res.body = "Not Found";
    }

    pub fn uncaughtError(_: *ServerContext, req: *httpz.Request, res: *httpz.Response, err: anyerror) void {
        std.log.err("Uncaught error at {s}: {}\n", .{ req.url.path, err });
        res.status = 500;
        res.body = "Internal Server Error";
    }
};
