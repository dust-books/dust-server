const std = @import("std");
const httpz = @import("httpz");

/// Add CORS headers to a response
pub fn addCorsHeaders(req: *httpz.Request, res: *httpz.Response) void {
    // Get origin from request
    const origin = req.header("origin");
    
    // Allow specific origins or all origins in development
    const allowed_origins = [_][]const u8{
        "https://client.dustbooks.org",
        "http://localhost:3000",
        "http://localhost:5173",
    };
    
    var allow_origin: []const u8 = "https://client.dustbooks.org";
    if (origin) |o| {
        for (allowed_origins) |allowed| {
            if (std.mem.eql(u8, o, allowed)) {
                allow_origin = o;
                break;
            }
        }
    }
    
    // Set CORS headers
    res.header("Access-Control-Allow-Origin", allow_origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400");
}

/// Handle OPTIONS preflight requests
pub fn handlePreflight(req: *httpz.Request, res: *httpz.Response) void {
    addCorsHeaders(req, res);
    res.status = 204;
}
