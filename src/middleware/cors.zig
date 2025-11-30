const std = @import("std");
const httpz = @import("httpz");

/// CORS middleware - adds Cross-Origin Resource Sharing headers to all responses
pub fn cors(comptime T: type) httpz.Middleware(T) {
    return struct {
        pub fn execute(_: T, req: *httpz.Request, res: *httpz.Response, next: anytype) !void {
            // Set CORS headers
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.header("Access-Control-Max-Age", "86400");
            
            // Handle preflight OPTIONS requests
            if (std.mem.eql(u8, req.method, "OPTIONS")) {
                res.status = 204;
                return;
            }
            
            // Continue to next middleware/handler
            try next();
        }
    };
}
