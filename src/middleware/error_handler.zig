const std = @import("std");
const httpz = @import("httpz");

/// Error handling middleware - catches errors and returns appropriate JSON responses
pub fn errorHandler(comptime T: type) httpz.Middleware(T) {
    return struct {
        pub fn execute(_: T, req: *httpz.Request, res: *httpz.Response, next: anytype) !void {
            // Try to execute the next middleware/handler
            next() catch |err| {
                // Log the error with request context
                std.log.err("Request error on {s} {s}: {} ({s})", .{ @tagName(req.method), req.url.path, err, @errorName(err) });

                // Log stack trace for unexpected errors
                if (@errorReturnTrace()) |trace| {
                    std.debug.dumpStackTrace(trace.*);
                }

                // Set error response
                res.status = switch (err) {
                    error.UserAlreadyExists => 409,
                    error.InvalidCredentials => 401,
                    error.MissingJWTSecret => 500,
                    error.NotFound => 404,
                    error.Unauthorized => 401,
                    error.Forbidden => 403,
                    error.BadRequest => 400,
                    error.FileNotFound => 404,
                    error.AccessDenied => 403,
                    else => 500,
                };

                res.header("content-type", "application/json");

                // Format error message
                const error_name = @errorName(err);
                var buf: [256]u8 = undefined;
                const json = try std.fmt.bufPrint(&buf,
                    \\{{"error": "{s}", "message": "{s}"}}
                , .{ error_name, getErrorMessage(err) });

                res.body = json;
                return;
            };
        }
    };
}

fn getErrorMessage(err: anyerror) []const u8 {
    return switch (err) {
        error.UserAlreadyExists => "User with this email already exists",
        error.InvalidCredentials => "Invalid email or password",
        error.MissingJWTSecret => "Server configuration error",
        error.NotFound => "Resource not found",
        error.Unauthorized => "Authentication required",
        error.Forbidden => "Insufficient permissions",
        error.BadRequest => "Invalid request",
        error.FileNotFound => "File not found",
        error.AccessDenied => "Access denied to file or directory",
        else => "An unexpected error occurred",
    };
}
