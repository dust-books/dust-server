const std = @import("std");
const sqlite = @import("sqlite");

pub const ArchiveService = struct {
    db: *sqlite.Db,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) ArchiveService {
        return .{
            .allocator = allocator,
            .db = db,
        };
    }
    
    pub fn archiveBook(self: *ArchiveService, book_id: i64, reason: []const u8) !void {
        const query =
            \\UPDATE books 
            \\SET archived = 1,
            \\    archived_at = datetime('now'),
            \\    archive_reason = ?,
            \\    updated_at = datetime('now')
            \\WHERE id = ?
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, reason);
        try stmt.bind(2, book_id);
        
        try stmt.exec();
        std.log.info("📚 Archive Service: Archived book {d}: {s}", .{ book_id, reason });
    }
    
    pub fn unarchiveBook(self: *ArchiveService, book_id: i64) !void {
        const query =
            \\UPDATE books 
            \\SET archived = 0,
            \\    archived_at = NULL,
            \\    archive_reason = NULL,
            \\    updated_at = datetime('now')
            \\WHERE id = ?
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        try stmt.bind(1, book_id);
        
        try stmt.exec();
        std.log.info("📚 Archive Service: Unarchived book {d}", .{book_id});
    }
    
    fn checkFileExists(filepath: []const u8) bool {
        std.fs.cwd().access(filepath, .{}) catch {
            return false;
        };
        return true;
    }
    
    pub fn validateAndArchiveMissingBooks(self: *ArchiveService) !struct {
        archived_count: usize,
        unarchived_count: usize,
    } {
        var archived_count: usize = 0;
        var unarchived_count: usize = 0;
        
        // Get all active books
        {
            const query = "SELECT id, filepath, name FROM books WHERE archived = 0";
            var stmt = try self.db.prepare(query);
            defer stmt.deinit();
            
            stmt.reset();
            
            while (try stmt.step()) {
                const book_id = stmt.column(i64, 0);
                const filepath = stmt.column([]const u8, 1);
                const name = stmt.column([]const u8, 2);
                
                if (!checkFileExists(filepath)) {
                    std.log.info("📚 Archive Service: File not found, archiving book: {s} ({s})", .{ name, filepath });
                    try self.archiveBook(book_id, "File not found during validation scan");
                    archived_count += 1;
                }
            }
        }
        
        // Check for previously archived books that might have been restored
        {
            const query =
                \\SELECT id, filepath, name, archive_reason 
                \\FROM books 
                \\WHERE archived = 1 
                \\  AND (archive_reason LIKE '%File not found%' OR archive_reason LIKE '%missing%')
            ;
            var stmt = try self.db.prepare(query);
            defer stmt.deinit();
            
            stmt.reset();
            
            while (try stmt.step()) {
                const book_id = stmt.column(i64, 0);
                const filepath = stmt.column([]const u8, 1);
                const name = stmt.column([]const u8, 2);
                
                if (checkFileExists(filepath)) {
                    std.log.info("📚 Archive Service: File restored, unarchiving book: {s} ({s})", .{ name, filepath });
                    try self.unarchiveBook(book_id);
                    unarchived_count += 1;
                }
            }
        }
        
        std.log.info("📚 Archive Service: Validation complete. Archived: {d}, Unarchived: {d}", .{ archived_count, unarchived_count });
        
        return .{
            .archived_count = archived_count,
            .unarchived_count = unarchived_count,
        };
    }
    
    pub fn getArchiveStats(self: *ArchiveService) !struct {
        total_books: i64,
        active_books: i64,
        archived_books: i64,
        archived_due_to_missing_files: i64,
    } {
        const query =
            \\SELECT 
            \\  COUNT(*) as total_books,
            \\  SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) as active_books,
            \\  SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) as archived_books,
            \\  SUM(CASE WHEN archived = 1 AND (archive_reason LIKE '%File not found%' OR archive_reason LIKE '%missing%') THEN 1 ELSE 0 END) as archived_missing
            \\FROM books
        ;
        
        var stmt = try self.db.prepare(query);
        defer stmt.deinit();
        
        stmt.reset();
        
        if (try stmt.step()) {
            return .{
                .total_books = stmt.column(i64, 0),
                .active_books = stmt.column(i64, 1),
                .archived_books = stmt.column(i64, 2),
                .archived_due_to_missing_files = stmt.column(i64, 3),
            };
        }
        
        return .{
            .total_books = 0,
            .active_books = 0,
            .archived_books = 0,
            .archived_due_to_missing_files = 0,
        };
    }
};
