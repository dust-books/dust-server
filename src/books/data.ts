import type { Database } from "../../database.ts";
import type { Author, AuthorWithId } from "./author.ts";
import type { Book, BookWithId } from "./book.ts";

export type { BookWithId };

export const migrate = async (database: Database) => {
    // First run the basic table creation migrations
    await database.migrate([
        `CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            author INTEGER,
            file_path TEXT NOT NULL UNIQUE,
            isbn TEXT,
            publication_date TEXT,
            publisher TEXT,
            description TEXT,
            page_count INTEGER,
            file_size INTEGER,
            file_format TEXT,
            cover_image_path TEXT,
            status TEXT DEFAULT 'active',
            archived_at DATETIME,
            archive_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS authors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            description TEXT,
            color TEXT,
            requires_permission TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS book_tags (
            book_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            applied_by INTEGER,
            auto_applied BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (book_id, tag_id),
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            FOREIGN KEY (applied_by) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS reading_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            current_page INTEGER DEFAULT 0,
            total_pages INTEGER,
            percentage_complete REAL DEFAULT 0.0,
            last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, book_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )`
    ]);

    // Add author metadata columns safely - only if they don't exist
    const authorColumns = [
        'biography TEXT',
        'birth_date TEXT', 
        'death_date TEXT',
        'nationality TEXT',
        'image_url TEXT',
        'wikipedia_url TEXT',
        'goodreads_url TEXT',
        'website TEXT',
        'aliases TEXT',
        'genres TEXT',
        'created_at DATETIME',
        'updated_at DATETIME'
    ];

    for (const column of authorColumns) {
        try {
            await database.execute(`ALTER TABLE authors ADD COLUMN ${column}`);
        } catch (error) {
            // Column likely already exists, ignore the error
            if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
                throw error;
            }
        }
    }
}

export const getAllBooks = async (database: Database): Promise<BookWithId[]> => {
    const resp = await database.execute(`
        SELECT * FROM books;
    `);

    return resp.rows.map((r) => {
        return {
            id: r['id'] as number,
            name: r['name'] as string,
            filepath: r['file_path'] as string,
            author: r['author'] as number,
            file_format: r['file_format'] as string,
            file_size: r['file_size'] as number,
            page_count: r['page_count'] as number,
            cover_image_path: r['cover_image_path'] as string,
            isbn: r['isbn'] as string,
            publication_date: r['publication_date'] as string,
            publisher: r['publisher'] as string,
            description: r['description'] as string,
            status: r['status'] as string || 'active',
            archived_at: r['archived_at'] as string,
            archive_reason: r['archive_reason'] as string,
        };
    })
}

export const getBook = async (database: Database, id: string): Promise<BookWithId> => {
    const resp = await database.execute({
        sql: "SELECT * FROM books where id = $id;",
        args: { id }
    });

    return {
        id: resp.rows[0]['id'] as number,
        name: resp.rows[0]['name'] as string,
        author: resp.rows[0]['author'] as number,
        filepath: resp.rows[0]['file_path'] as string,
        file_format: resp.rows[0]['file_format'] as string,
        file_size: resp.rows[0]['file_size'] as number,
        page_count: resp.rows[0]['page_count'] as number,
        cover_image_path: resp.rows[0]['cover_image_path'] as string,
        isbn: resp.rows[0]['isbn'] as string,
        publication_date: resp.rows[0]['publication_date'] as string,
        publisher: resp.rows[0]['publisher'] as string,
        description: resp.rows[0]['description'] as string,
        status: resp.rows[0]['status'] as string || 'active',
        archived_at: resp.rows[0]['archived_at'] as string,
        archive_reason: resp.rows[0]['archive_reason'] as string,
    }
}

export const getBookByName = (database: Database, name: string) => {
    return database.execute({
        sql: "SELECT * FROM books WHERE name = $name",
        args: {name: name}
    })
}

// TODO: Need to ensure author exists when we put the book in the DB.
export const addBookIfNotExists = async (database: Database, book: Book) => {
    const existing = await getBookByName(database, book.name);
    if (existing.rows.length != 0) {
        return;
    }
    
    // Extract file format from filepath if not provided
    const file_format = book.file_format || book.filepath.split('.').pop()?.toLowerCase();
    
    return database.execute({
        sql: `INSERT INTO books (name, author, file_path, file_format, file_size, page_count, isbn, publication_date, publisher, description) 
              VALUES ($name, $author, $filePath, $file_format, $file_size, $page_count, $isbn, $publication_date, $publisher, $description) RETURNING id, *`, 
        args: {
            name: book.name, 
            filePath: book.filepath, 
            author: book.author,
            file_format: file_format || null,
            file_size: book.file_size ?? null,
            page_count: book.page_count ?? null,
            isbn: book.isbn ?? null,
            publication_date: book.publication_date ?? null,
            publisher: book.publisher ?? null,
            description: book.description ?? null
        }
    });
}

export const updateBookFileFormat = async (database: Database, bookId: number, file_format: string) => {
    return database.execute({
        sql: "UPDATE books SET file_format = $file_format WHERE id = $id",
        args: { id: bookId, file_format }
    });
}

export const updateBookMetadata = async (database: Database, bookId: number, metadata: Partial<Book>) => {
    const fields: string[] = [];
    const args: any = { id: bookId };
    
    if (metadata.isbn !== undefined) {
        fields.push("isbn = $isbn");
        args.isbn = metadata.isbn;
    }
    if (metadata.publication_date !== undefined) {
        fields.push("publication_date = $publication_date");
        args.publication_date = metadata.publication_date;
    }
    if (metadata.publisher !== undefined) {
        fields.push("publisher = $publisher");
        args.publisher = metadata.publisher;
    }
    if (metadata.description !== undefined) {
        fields.push("description = $description");
        args.description = metadata.description;
    }
    if (metadata.page_count !== undefined) {
        fields.push("page_count = $page_count");
        args.page_count = metadata.page_count;
    }
    if (metadata.cover_image_path !== undefined) {
        fields.push("cover_image_path = $cover_image_path");
        args.cover_image_path = metadata.cover_image_path;
    }
    
    if (fields.length === 0) {
        return null; // Nothing to update
    }
    
    fields.push("updated_at = CURRENT_TIMESTAMP");
    
    return database.execute({
        sql: `UPDATE books SET ${fields.join(', ')} WHERE id = $id`,
        args
    });
}

export const getBookByISBN = async (database: Database, isbn: string): Promise<BookWithId | null> => {
    const resp = await database.execute({
        sql: "SELECT * FROM books WHERE isbn = $isbn LIMIT 1",
        args: { isbn }
    });

    if (resp.rows.length === 0) {
        return null;
    }

    const row = resp.rows[0];
    return {
        id: row['id'] as number,
        name: row['name'] as string,
        author: row['author'] as number,
        filepath: row['file_path'] as string,
        file_format: row['file_format'] as string,
        file_size: row['file_size'] as number,
        page_count: row['page_count'] as number,
        cover_image_path: row['cover_image_path'] as string,
        isbn: row['isbn'] as string,
        publication_date: row['publication_date'] as string,
        publisher: row['publisher'] as string,
        description: row['description'] as string,
        status: row['status'] as string || 'active',
        archived_at: row['archived_at'] as string,
        archive_reason: row['archive_reason'] as string,
    };
}

export const getAuthorById = async (database: Database, id: number): Promise<AuthorWithId> => {
    const resp = await database.execute({
        sql: "SELECT * FROM authors where id = $id",
        args: {id}
    });
    const row = resp.rows[0];
    return {
        id: row['id'] as number,
        name: row['name'] as string,
        biography: row['biography'] as string,
        birth_date: row['birth_date'] as string,
        death_date: row['death_date'] as string,
        nationality: row['nationality'] as string,
        image_url: row['image_url'] as string,
        wikipedia_url: row['wikipedia_url'] as string,
        goodreads_url: row['goodreads_url'] as string,
        website: row['website'] as string,
        aliases: row['aliases'] as string,
        genres: row['genres'] as string,
        created_at: row['created_at'] as string,
        updated_at: row['updated_at'] as string,
    }
}

export const getAuthorByName = (database: Database, name: string) => {
    return database.execute({
        sql: "SELECT * FROM authors WHERE name = $name",
        args: {name: name}
    })
}

export const getAllAuthors = async (database: Database): Promise<AuthorWithId[]> => {
    const resp = await database.execute({
        sql: "SELECT * FROM authors ORDER BY name",
        args: {}
    });

    return resp.rows.map((r) => {
        return {
            id: r['id'] as number,
            name: r['name'] as string,
            biography: r['biography'] as string,
            birth_date: r['birth_date'] as string,
            death_date: r['death_date'] as string,
            nationality: r['nationality'] as string,
            image_url: r['image_url'] as string,
            wikipedia_url: r['wikipedia_url'] as string,
            goodreads_url: r['goodreads_url'] as string,
            website: r['website'] as string,
            aliases: r['aliases'] as string,
            genres: r['genres'] as string,
            created_at: r['created_at'] as string,
            updated_at: r['updated_at'] as string,
        }
    })
}

// TODO: Need to ensure author exists when we put the book in the DB.
export const addAuthorIfNotExists = async (database: Database, authorName: string): Promise<AuthorWithId> => {
    const existing = await getAuthorByName(database, authorName);
    if (existing.rows.length != 0) {
        const row = existing.rows[0];
        return {
            id: row['id'] as number,
            name: row['name'] as string,
            biography: row['biography'] as string,
            birth_date: row['birth_date'] as string,
            death_date: row['death_date'] as string,
            nationality: row['nationality'] as string,
            image_url: row['image_url'] as string,
            wikipedia_url: row['wikipedia_url'] as string,
            goodreads_url: row['goodreads_url'] as string,
            website: row['website'] as string,
            aliases: row['aliases'] as string,
            genres: row['genres'] as string,
            created_at: row['created_at'] as string,
            updated_at: row['updated_at'] as string,
        };
    }

    const resp = await database.execute({
        sql: "INSERT INTO authors (name, created_at, updated_at) VALUES ($name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *", 
        args: {name: authorName}
    });

    const row = resp.rows[0];
    return {
        id: row['id'] as number,
        name: row['name'] as string,
        biography: row['biography'] as string,
        birth_date: row['birth_date'] as string,
        death_date: row['death_date'] as string,
        nationality: row['nationality'] as string,
        image_url: row['image_url'] as string,
        wikipedia_url: row['wikipedia_url'] as string,
        goodreads_url: row['goodreads_url'] as string,
        website: row['website'] as string,
        aliases: row['aliases'] as string,
        genres: row['genres'] as string,
        created_at: row['created_at'] as string,
        updated_at: row['updated_at'] as string,
    }
}

export const addAuthorWithMetadata = async (
    database: Database, 
    authorData: Author
): Promise<AuthorWithId> => {
    const existing = await getAuthorByName(database, authorData.name);
    if (existing.rows.length != 0) {
        // Update existing author with new metadata
        return await updateAuthorMetadata(database, existing.rows[0]['id'] as number, authorData);
    }

    const resp = await database.execute({
        sql: `INSERT INTO authors (
            name, biography, birth_date, death_date, nationality, 
            image_url, wikipedia_url, goodreads_url, website, aliases, genres,
            created_at, updated_at
        ) VALUES (
            $name, $biography, $birth_date, $death_date, $nationality,
            $image_url, $wikipedia_url, $goodreads_url, $website, $aliases, $genres,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *`, 
        args: {
            name: authorData.name,
            biography: authorData.biography || null,
            birth_date: authorData.birth_date || null,
            death_date: authorData.death_date || null,
            nationality: authorData.nationality || null,
            image_url: authorData.image_url || null,
            wikipedia_url: authorData.wikipedia_url || null,
            goodreads_url: authorData.goodreads_url || null,
            website: authorData.website || null,
            aliases: authorData.aliases || null,
            genres: authorData.genres || null
        }
    });

    const row = resp.rows[0];
    return {
        id: row['id'] as number,
        name: row['name'] as string,
        biography: row['biography'] as string,
        birth_date: row['birth_date'] as string,
        death_date: row['death_date'] as string,
        nationality: row['nationality'] as string,
        image_url: row['image_url'] as string,
        wikipedia_url: row['wikipedia_url'] as string,
        goodreads_url: row['goodreads_url'] as string,
        website: row['website'] as string,
        aliases: row['aliases'] as string,
        genres: row['genres'] as string,
        created_at: row['created_at'] as string,
        updated_at: row['updated_at'] as string,
    }
}

export const updateAuthorMetadata = async (
    database: Database, 
    authorId: number, 
    authorData: Partial<Author>
): Promise<AuthorWithId> => {
    const fields: string[] = [];
    const args: any = { id: authorId };
    
    if (authorData.biography !== undefined) {
        fields.push("biography = $biography");
        args.biography = authorData.biography;
    }
    if (authorData.birth_date !== undefined) {
        fields.push("birth_date = $birth_date");
        args.birth_date = authorData.birth_date;
    }
    if (authorData.death_date !== undefined) {
        fields.push("death_date = $death_date");
        args.death_date = authorData.death_date;
    }
    if (authorData.nationality !== undefined) {
        fields.push("nationality = $nationality");
        args.nationality = authorData.nationality;
    }
    if (authorData.image_url !== undefined) {
        fields.push("image_url = $image_url");
        args.image_url = authorData.image_url;
    }
    if (authorData.wikipedia_url !== undefined) {
        fields.push("wikipedia_url = $wikipedia_url");
        args.wikipedia_url = authorData.wikipedia_url;
    }
    if (authorData.goodreads_url !== undefined) {
        fields.push("goodreads_url = $goodreads_url");
        args.goodreads_url = authorData.goodreads_url;
    }
    if (authorData.website !== undefined) {
        fields.push("website = $website");
        args.website = authorData.website;
    }
    if (authorData.aliases !== undefined) {
        fields.push("aliases = $aliases");
        args.aliases = authorData.aliases;
    }
    if (authorData.genres !== undefined) {
        fields.push("genres = $genres");
        args.genres = authorData.genres;
    }
    
    if (fields.length > 0) {
        fields.push("updated_at = CURRENT_TIMESTAMP");
        
        await database.execute({
            sql: `UPDATE authors SET ${fields.join(', ')} WHERE id = $id`,
            args
        });
    }
    
    return await getAuthorById(database, authorId);
}

// Tag management functions
export interface Tag {
    id: number;
    name: string;
    category: string;
    description?: string;
    color?: string;
    requires_permission?: string;
    created_at: string;
}

export interface BookTag {
    book_id: number;
    tag_id: number;
    applied_at: string;
    applied_by?: number;
    auto_applied: boolean;
}

export const createTag = (database: Database, name: string, category: string, description?: string, color?: string, requires_permission?: string) => {
    return database.execute({
        sql: `INSERT INTO tags (name, category, description, color, requires_permission) VALUES ($name, $category, $description, $color, $requires_permission) RETURNING *`,
        args: { name, category, description: description || null, color: color || null, requires_permission: requires_permission || null }
    });
}

export const getTag = async (database: Database, id: number): Promise<Tag> => {
    const result = await database.execute({
        sql: `SELECT * FROM tags WHERE id = $id`,
        args: { id }
    });
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        name: row.name as string,
        category: row.category as string,
        description: row.description as string,
        color: row.color as string,
        requires_permission: row.requires_permission as string,
        created_at: row.created_at as string
    };
}

export const getTagByName = async (database: Database, name: string): Promise<Tag | null> => {
    const result = await database.execute({
        sql: `SELECT * FROM tags WHERE name = $name`,
        args: { name }
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        name: row.name as string,
        category: row.category as string,
        description: row.description as string,
        color: row.color as string,
        requires_permission: row.requires_permission as string,
        created_at: row.created_at as string
    };
}

export const getAllTags = async (database: Database): Promise<Tag[]> => {
    const result = await database.execute({
        sql: `SELECT * FROM tags ORDER BY category, name`,
        args: {}
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        category: row.category as string,
        description: row.description as string,
        color: row.color as string,
        requires_permission: row.requires_permission as string,
        created_at: row.created_at as string
    }));
}

export const getTagsByCategory = async (database: Database, category: string): Promise<Tag[]> => {
    const result = await database.execute({
        sql: `SELECT * FROM tags WHERE category = $category ORDER BY name`,
        args: { category }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        category: row.category as string,
        description: row.description as string,
        color: row.color as string,
        requires_permission: row.requires_permission as string,
        created_at: row.created_at as string
    }));
}

export const addTagToBook = (database: Database, book_id: number, tag_id: number, applied_by?: number, auto_applied: boolean = false) => {
    return database.execute({
        sql: `INSERT INTO book_tags (book_id, tag_id, applied_by, auto_applied) VALUES ($book_id, $tag_id, $applied_by, $auto_applied)`,
        args: { book_id, tag_id, applied_by: applied_by || null, auto_applied }
    });
}

export const removeTagFromBook = (database: Database, book_id: number, tag_id: number) => {
    return database.execute({
        sql: `DELETE FROM book_tags WHERE book_id = $book_id AND tag_id = $tag_id`,
        args: { book_id, tag_id }
    });
}

export const getBookTags = async (database: Database, book_id: number): Promise<Tag[]> => {
    const result = await database.execute({
        sql: `
            SELECT t.* FROM tags t
            JOIN book_tags bt ON t.id = bt.tag_id
            WHERE bt.book_id = $book_id
            ORDER BY t.category, t.name
        `,
        args: { book_id }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        category: row.category as string,
        description: row.description as string,
        color: row.color as string,
        requires_permission: row.requires_permission as string,
        created_at: row.created_at as string
    }));
}

export const getBooksWithTag = async (database: Database, tag_id: number): Promise<BookWithId[]> => {
    const result = await database.execute({
        sql: `
            SELECT b.* FROM books b
            JOIN book_tags bt ON b.id = bt.book_id
            WHERE bt.tag_id = $tag_id
            ORDER BY b.name
        `,
        args: { tag_id }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        name: row.name as string,
        filepath: row.file_path as string,
        author: row.author as number,
    }));
}

// Reading Progress Management
export interface ReadingProgress {
    id: number;
    user_id: number;
    book_id: number;
    current_page: number;
    total_pages?: number;
    percentage_complete: number;
    last_read_at: string;
    created_at: string;
    updated_at: string;
}

export interface ReadingSession {
    user_id: number;
    book_id: number;
    start_page: number;
    end_page: number;
    session_start: string;
    session_end: string;
    pages_read: number;
    reading_time_minutes: number;
}

// Get reading progress for a specific user and book
export const getReadingProgress = async (database: Database, user_id: number, book_id: number): Promise<ReadingProgress | null> => {
    const result = await database.execute({
        sql: `SELECT * FROM reading_progress WHERE user_id = $user_id AND book_id = $book_id`,
        args: { user_id, book_id }
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        user_id: row.user_id as number,
        book_id: row.book_id as number,
        current_page: row.current_page as number,
        total_pages: row.total_pages as number,
        percentage_complete: row.percentage_complete as number,
        last_read_at: row.last_read_at as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string
    };
}

// Get all reading progress for a user
export const getUserReadingProgress = async (database: Database, user_id: number): Promise<ReadingProgress[]> => {
    const result = await database.execute({
        sql: `SELECT * FROM reading_progress WHERE user_id = $user_id ORDER BY last_read_at DESC`,
        args: { user_id }
    });
    
    return result.rows.map(row => ({
        id: row.id as number,
        user_id: row.user_id as number,
        book_id: row.book_id as number,
        current_page: row.current_page as number,
        total_pages: row.total_pages as number,
        percentage_complete: row.percentage_complete as number,
        last_read_at: row.last_read_at as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string
    }));
}

// Create or update reading progress
export const upsertReadingProgress = async (
    database: Database, 
    user_id: number, 
    book_id: number, 
    current_page: number, 
    total_pages?: number
): Promise<ReadingProgress> => {
    const percentage_complete = total_pages ? (current_page / total_pages) * 100 : 0;
    
    const result = await database.execute({
        sql: `
            INSERT INTO reading_progress (user_id, book_id, current_page, total_pages, percentage_complete, last_read_at, updated_at)
            VALUES ($user_id, $book_id, $current_page, $total_pages, $percentage_complete, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, book_id) DO UPDATE SET
                current_page = $current_page,
                total_pages = COALESCE($total_pages, total_pages),
                percentage_complete = $percentage_complete,
                last_read_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `,
        args: { user_id, book_id, current_page, total_pages: total_pages || null, percentage_complete }
    });
    
    const row = result.rows[0];
    return {
        id: row.id as number,
        user_id: row.user_id as number,
        book_id: row.book_id as number,
        current_page: row.current_page as number,
        total_pages: row.total_pages as number,
        percentage_complete: row.percentage_complete as number,
        last_read_at: row.last_read_at as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string
    };
}

// Get recently read books for a user
export const getRecentlyReadBooks = async (database: Database, user_id: number, limit: number = 10): Promise<(ReadingProgress & BookWithId)[]> => {
    const result = await database.execute({
        sql: `
            SELECT 
                rp.*,
                b.id as book_id,
                b.name as book_name,
                b.file_path as book_filepath,
                b.author as book_author
            FROM reading_progress rp
            JOIN books b ON rp.book_id = b.id
            WHERE rp.user_id = $user_id
            ORDER BY rp.last_read_at DESC
            LIMIT $limit
        `,
        args: { user_id, limit }
    });
    
    return result.rows.map(row => ({
        // Reading progress data
        id: row.id as number,
        user_id: row.user_id as number,
        book_id: row.book_id as number,
        current_page: row.current_page as number,
        total_pages: row.total_pages as number,
        percentage_complete: row.percentage_complete as number,
        last_read_at: row.last_read_at as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        // Book data
        name: row.book_name as string,
        filepath: row.book_filepath as string,
        author: row.book_author as number
    }));
}

// Get reading statistics for a user
export const getUserReadingStats = async (database: Database, user_id: number): Promise<{
    totalBooksStarted: number,
    totalBooksCompleted: number,
    totalPagesRead: number,
    averageProgress: number,
    currentlyReading: number
}> => {
    const result = await database.execute({
        sql: `
            SELECT 
                COUNT(*) as total_books_started,
                COUNT(CASE WHEN percentage_complete >= 100 THEN 1 END) as total_books_completed,
                SUM(current_page) as total_pages_read,
                AVG(percentage_complete) as average_progress,
                COUNT(CASE WHEN percentage_complete > 0 AND percentage_complete < 100 THEN 1 END) as currently_reading
            FROM reading_progress 
            WHERE user_id = $user_id
        `,
        args: { user_id }
    });
    
    const row = result.rows[0];
    return {
        totalBooksStarted: row.total_books_started as number || 0,
        totalBooksCompleted: row.total_books_completed as number || 0,
        totalPagesRead: row.total_pages_read as number || 0,
        averageProgress: row.average_progress as number || 0,
        currentlyReading: row.currently_reading as number || 0
    };
}

// Mark a book as completed
export const markBookAsCompleted = async (database: Database, user_id: number, book_id: number): Promise<ReadingProgress> => {
    // First get the book's total pages if available
    const progressResult = await database.execute({
        sql: `SELECT total_pages FROM reading_progress WHERE user_id = $user_id AND book_id = $book_id`,
        args: { user_id, book_id }
    });
    
    const total_pages = progressResult.rows[0]?.total_pages as number || 100; // Default to 100 if unknown
    
    return await upsertReadingProgress(database, user_id, book_id, total_pages, total_pages);
}

// Delete reading progress (if user wants to restart)
export const deleteReadingProgress = async (database: Database, user_id: number, book_id: number): Promise<void> => {
    await database.execute({
        sql: `DELETE FROM reading_progress WHERE user_id = $user_id AND book_id = $book_id`,
        args: { user_id, book_id }
    });
}

// Archive book functions
export const archiveBook = async (database: Database, bookId: number, reason: string): Promise<void> => {
    await database.execute({
        sql: `UPDATE books SET status = 'archived', archived_at = datetime('now'), archive_reason = $reason WHERE id = $bookId`,
        args: { bookId, reason }
    });
}

export const unarchiveBook = async (database: Database, bookId: number): Promise<void> => {
    await database.execute({
        sql: `UPDATE books SET status = 'active', archived_at = NULL, archive_reason = NULL WHERE id = $bookId`,
        args: { bookId }
    });
}

export const getArchivedBooks = async (database: Database): Promise<BookWithId[]> => {
    const resp = await database.execute(`
        SELECT * FROM books WHERE status = 'archived';
    `);

    return resp.rows.map((r) => {
        return {
            id: r['id'] as number,
            name: r['name'] as string,
            filepath: r['file_path'] as string,
            author: r['author'] as number,
            file_format: r['file_format'] as string,
            file_size: r['file_size'] as number,
            page_count: r['page_count'] as number,
            cover_image_path: r['cover_image_path'] as string,
            isbn: r['isbn'] as string,
            publication_date: r['publication_date'] as string,
            publisher: r['publisher'] as string,
            description: r['description'] as string,
            status: r['status'] as string,
            archived_at: r['archived_at'] as string,
            archive_reason: r['archive_reason'] as string,
        };
    })
}

export const getActiveBooks = async (database: Database): Promise<BookWithId[]> => {
    const resp = await database.execute(`
        SELECT * FROM books WHERE status = 'active' OR status IS NULL;
    `);

    return resp.rows.map((r) => {
        return {
            id: r['id'] as number,
            name: r['name'] as string,
            filepath: r['file_path'] as string,
            author: r['author'] as number,
            file_format: r['file_format'] as string,
            file_size: r['file_size'] as number,
            page_count: r['page_count'] as number,
            cover_image_path: r['cover_image_path'] as string,
            isbn: r['isbn'] as string,
            publication_date: r['publication_date'] as string,
            publisher: r['publisher'] as string,
            description: r['description'] as string,
            status: r['status'] as string || 'active',
            archived_at: r['archived_at'] as string,
            archive_reason: r['archive_reason'] as string,
        };
    })
}