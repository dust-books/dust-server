const sqlite = @import("sqlite");

// Genres are handled via tags with category='genre'
// No separate table needed
pub fn migrate(database: *sqlite.Db) !void {
    _ = database;
}
