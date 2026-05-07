const zqlite = @import("zqlite");

// Genres are handled via tags with category='genre'
pub fn migrate(database: *zqlite.Conn) !void {
    _ = database;
}
