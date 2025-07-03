/**
 * ISBN Utilities - Extract and validate ISBN from filenames and metadata
 */

export interface ISBNInfo {
    isbn: string;
    type: 'ISBN-10' | 'ISBN-13';
    isValid: boolean;
}

/**
 * Extract ISBN from filename
 * Supports formats like:
 * - 9781789349917.epub
 * - 978-1-789-34991-7.pdf
 * - isbn_9781789349917_title.mobi
 */
export function extractISBNFromFilename(filename: string): string | null {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    // Pattern 1: Pure ISBN as filename (with or without hyphens/underscores)
    const isbnPattern1 = /^(97[89][\d\-_]{10,}|\d{9}[\dX]|\d{10})$/i;
    const match1 = nameWithoutExt.match(isbnPattern1);
    if (match1) {
        const cleaned = cleanISBN(match1[1]);
        // Validate that it's a proper length after cleaning
        if (cleaned.length === 10 || cleaned.length === 13) {
            return cleaned;
        }
    }
    
    // Pattern 2: ISBN somewhere in filename (prefixed/suffixed with underscores or other chars)
    const isbnPattern2 = /(?:isbn[_\-]?)?(97[89][\d\-_]{10,}|\d{9}[\dX])/i;
    const match2 = nameWithoutExt.match(isbnPattern2);
    if (match2) {
        const cleaned = cleanISBN(match2[1]);
        // Validate that it's a proper length after cleaning
        if (cleaned.length === 10 || cleaned.length === 13) {
            return cleaned;
        }
    }
    
    return null;
}

/**
 * Clean ISBN by removing all non-digit characters except X
 * Also handles common ISBN prefixes and formats
 */
export function cleanISBN(isbn: string): string {
    // First, handle common patterns like "ISBN-13: 978..." or "ISBN: 123..."
    let cleaned = isbn;
    
    // Remove common ISBN prefixes
    cleaned = cleaned.replace(/^(?:isbn[-:\s]*(?:1[03][-:\s]*)?)/i, '');
    
    // Remove everything that's not a digit or X
    cleaned = cleaned.replace(/[^\dX]/gi, '').toUpperCase();
    
    // If we got more than 13 characters, try to extract the most likely ISBN
    if (cleaned.length > 13) {
        // Look for a 13-digit sequence starting with 978 or 979
        const isbn13Match = cleaned.match(/(97[89]\d{10})/);
        if (isbn13Match) {
            return isbn13Match[1];
        }
        
        // Look for a 10-digit sequence 
        const isbn10Match = cleaned.match(/(\d{9}[\dX])/);
        if (isbn10Match) {
            return isbn10Match[1];
        }
        
        // If still too long, take the first 13 or 10 characters
        if (cleaned.length >= 13 && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
            return cleaned.slice(0, 13);
        } else if (cleaned.length >= 10) {
            return cleaned.slice(0, 10);
        }
    }
    
    return cleaned;
}

/**
 * Validate ISBN-10 or ISBN-13
 */
export function validateISBN(isbn: string): ISBNInfo | null {
    const cleaned = cleanISBN(isbn);
    
    if (cleaned.length === 10) {
        return {
            isbn: cleaned,
            type: 'ISBN-10',
            isValid: validateISBN10(cleaned)
        };
    } else if (cleaned.length === 13) {
        return {
            isbn: cleaned,
            type: 'ISBN-13',
            isValid: validateISBN13(cleaned)
        };
    }
    
    return null;
}

/**
 * Validate ISBN-10 checksum
 */
function validateISBN10(isbn: string): boolean {
    if (isbn.length !== 10) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        const digit = parseInt(isbn[i], 10);
        if (isNaN(digit)) return false;
        sum += digit * (10 - i);
    }
    
    const checkDigit = isbn[9];
    const expectedCheck = (11 - (sum % 11)) % 11;
    const expectedCheckStr = expectedCheck === 10 ? 'X' : expectedCheck.toString();
    
    return checkDigit === expectedCheckStr;
}

/**
 * Validate ISBN-13 checksum
 */
function validateISBN13(isbn: string): boolean {
    if (isbn.length !== 13) return false;
    if (!isbn.startsWith('978') && !isbn.startsWith('979')) return false;
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(isbn[i], 10);
        if (isNaN(digit)) return false;
        sum += digit * (i % 2 === 0 ? 1 : 3);
    }
    
    const checkDigit = parseInt(isbn[12], 10);
    const expectedCheck = (10 - (sum % 10)) % 10;
    
    return checkDigit === expectedCheck;
}

/**
 * Convert ISBN-10 to ISBN-13
 */
export function isbn10ToIsbn13(isbn10: string): string | null {
    const cleaned = cleanISBN(isbn10);
    if (cleaned.length !== 10) return null;
    
    // Remove check digit and add 978 prefix
    const withoutCheck = cleaned.slice(0, 9);
    const isbn13Base = '978' + withoutCheck;
    
    // Calculate new check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(isbn13Base[i], 10);
        sum += digit * (i % 2 === 0 ? 1 : 3);
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return isbn13Base + checkDigit.toString();
}

/**
 * Format ISBN with hyphens for display
 */
export function formatISBN(isbn: string): string {
    const cleaned = cleanISBN(isbn);
    
    if (cleaned.length === 10) {
        // Format ISBN-10: 0-123-45678-9
        return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 4)}-${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 13) {
        // Format ISBN-13: 978-0-123-45678-9
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7, 12)}-${cleaned.slice(12)}`;
    }
    
    return isbn; // Return original if can't format
}

/**
 * Extract all possible ISBNs from a string (useful for metadata descriptions, etc.)
 */
export function extractAllISBNs(text: string): string[] {
    const isbns: string[] = [];
    
    // Pattern for ISBN-13 and ISBN-10
    const isbnPattern = /(?:isbn[:\-\s]*)?(\d{3}[\d\s\-]{10,}|\d{9}[\dX]|\d{10})/gi;
    
    let match;
    while ((match = isbnPattern.exec(text)) !== null) {
        const potential = cleanISBN(match[1]);
        const validation = validateISBN(potential);
        
        if (validation && validation.isValid) {
            isbns.push(potential);
        }
    }
    
    return [...new Set(isbns)]; // Remove duplicates
}