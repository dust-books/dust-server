import type { Database } from "../../database.ts";
import * as bookData from "./data.ts";

export class ReadingProgressService {
    constructor(private database: Database) {}

    /**
     * Update reading progress for a user
     */
    async updateProgress(
        user_id: number, 
        book_id: number, 
        current_page: number, 
        total_pages?: number
    ): Promise<bookData.ReadingProgress> {
        // Validate page numbers
        if (current_page < 0) {
            throw new Error("Current page cannot be negative");
        }
        
        if (total_pages && total_pages <= 0) {
            throw new Error("Total pages must be positive");
        }
        
        if (total_pages && current_page > total_pages) {
            throw new Error("Current page cannot exceed total pages");
        }

        return await bookData.upsertReadingProgress(
            this.database, 
            user_id, 
            book_id, 
            current_page, 
            total_pages
        );
    }

    /**
     * Get reading progress for a specific book
     */
    async getProgress(user_id: number, book_id: number): Promise<bookData.ReadingProgress | null> {
        return await bookData.getReadingProgress(this.database, user_id, book_id);
    }

    /**
     * Get all reading progress for a user
     */
    async getAllProgress(user_id: number): Promise<bookData.ReadingProgress[]> {
        return await bookData.getUserReadingProgress(this.database, user_id);
    }

    /**
     * Get recently read books for a user
     */
    async getRecentlyRead(user_id: number, limit: number = 10): Promise<(bookData.ReadingProgress & bookData.BookWithId)[]> {
        return await bookData.getRecentlyReadBooks(this.database, user_id, limit);
    }

    /**
     * Get reading statistics for a user
     */
    async getReadingStats(user_id: number) {
        return await bookData.getUserReadingStats(this.database, user_id);
    }

    /**
     * Mark a book as completed
     */
    async markAsCompleted(user_id: number, book_id: number): Promise<bookData.ReadingProgress> {
        return await bookData.markBookAsCompleted(this.database, user_id, book_id);
    }

    /**
     * Start reading a book (set to page 1 if no progress exists)
     */
    async startReading(user_id: number, book_id: number, total_pages?: number): Promise<bookData.ReadingProgress> {
        const existingProgress = await this.getProgress(user_id, book_id);
        
        if (existingProgress) {
            // Book already started, return existing progress
            return existingProgress;
        }
        
        // Start from page 1
        return await this.updateProgress(user_id, book_id, 1, total_pages);
    }

    /**
     * Reset reading progress (restart book)
     */
    async resetProgress(user_id: number, book_id: number): Promise<void> {
        await bookData.deleteReadingProgress(this.database, user_id, book_id);
    }

    /**
     * Update progress by percentage (0-100)
     */
    async updateProgressByPercentage(
        user_id: number, 
        book_id: number, 
        percentage: number, 
        total_pages?: number
    ): Promise<bookData.ReadingProgress> {
        if (percentage < 0 || percentage > 100) {
            throw new Error("Percentage must be between 0 and 100");
        }
        
        // If we don't have total pages, get it from existing progress or default
        let actualTotalPages = total_pages;
        if (!actualTotalPages) {
            const existingProgress = await this.getProgress(user_id, book_id);
            actualTotalPages = existingProgress?.total_pages || 100; // Default to 100 pages
        }
        
        const current_page = Math.round((percentage / 100) * actualTotalPages);
        return await this.updateProgress(user_id, book_id, current_page, actualTotalPages);
    }

    /**
     * Get currently reading books (in progress, not completed)
     */
    async getCurrentlyReading(user_id: number): Promise<(bookData.ReadingProgress & bookData.BookWithId)[]> {
        const allProgress = await this.getRecentlyRead(user_id, 50); // Get more to filter
        return allProgress.filter(progress => 
            progress.percentage_complete > 0 && progress.percentage_complete < 100
        );
    }

    /**
     * Get completed books
     */
    async getCompletedBooks(user_id: number): Promise<(bookData.ReadingProgress & bookData.BookWithId)[]> {
        const allProgress = await this.getRecentlyRead(user_id, 100); // Get more to filter
        return allProgress.filter(progress => progress.percentage_complete >= 100);
    }

    /**
     * Get reading streak (days in a row with reading activity)
     */
    async getReadingStreak(user_id: number): Promise<number> {
        const result = await this.database.execute({
            sql: `
                WITH daily_reading AS (
                    SELECT DISTINCT DATE(last_read_at) as read_date
                    FROM reading_progress 
                    WHERE user_id = $user_id
                    ORDER BY read_date DESC
                ),
                consecutive_days AS (
                    SELECT 
                        read_date,
                        ROW_NUMBER() OVER (ORDER BY read_date DESC) as row_num,
                        DATE(read_date, '+' || (ROW_NUMBER() OVER (ORDER BY read_date DESC) - 1) || ' days') as expected_date
                    FROM daily_reading
                )
                SELECT COUNT(*) as streak
                FROM consecutive_days
                WHERE read_date = expected_date
                AND read_date >= DATE('now', '-' || (
                    SELECT COUNT(*) FROM consecutive_days
                ) || ' days')
            `,
            args: { user_id }
        });

        return result.rows[0]?.streak as number || 0;
    }

    /**
     * Get reading activity for the last 30 days
     */
    async getReadingActivity(user_id: number, days: number = 30): Promise<{ date: string; pages_read: number; books_read: number }[]> {
        const result = await this.database.execute({
            sql: `
                SELECT 
                    DATE(last_read_at) as date,
                    SUM(current_page) as pages_read,
                    COUNT(DISTINCT book_id) as books_read
                FROM reading_progress 
                WHERE user_id = $user_id 
                AND last_read_at >= DATE('now', '-$days days')
                GROUP BY DATE(last_read_at)
                ORDER BY date DESC
            `,
            args: { user_id, days }
        });

        return result.rows.map(row => ({
            date: row.date as string,
            pages_read: row.pages_read as number,
            books_read: row.books_read as number
        }));
    }
}