/**
 * API Service for communicating with the Dust server
 */

import type {
  User,
  Book,
  ReadingProgress,
  ReadingStats,
  LoginRequest,
  LoginResponse,
  CreateUserRequest,
  UpdateUserRequest,
  DashboardStats,
  ApiResponse
} from '../types/api.js';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken(): void {
    this.token = localStorage.getItem('dust_token');
  }

  private saveToken(token: string): void {
    this.token = token;
    localStorage.setItem('dust_token', token);
  }

  private clearToken(): void {
    this.token = null;
    localStorage.removeItem('dust_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If we can't parse the error response, use the generic message
        }

        throw new ApiError(errorMessage, response.status, response);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    this.saveToken(response.token);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.clearToken();
    }
  }

  async register(userData: CreateUserRequest): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/profile');
  }

  async updateProfile(updates: Partial<UpdateUserRequest>): Promise<User> {
    return this.request<User>('/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Book methods
  async getBooks(filters?: {
    includeGenres?: string[];
    excludeGenres?: string[];
    includeTags?: string[];
    excludeTags?: string[];
  }): Promise<{ books: Book[]; userPreferences: any }> {
    const params = new URLSearchParams();
    
    if (filters?.includeGenres?.length) {
      params.set('includeGenres', filters.includeGenres.join(','));
    }
    if (filters?.excludeGenres?.length) {
      params.set('excludeGenres', filters.excludeGenres.join(','));
    }
    if (filters?.includeTags?.length) {
      params.set('includeTags', filters.includeTags.join(','));
    }
    if (filters?.excludeTags?.length) {
      params.set('excludeTags', filters.excludeTags.join(','));
    }

    const queryString = params.toString();
    const url = `/books/${queryString ? `?${queryString}` : ''}`;
    
    return this.request<{ books: Book[]; userPreferences: any }>(url);
  }

  async getBook(id: number): Promise<{ book: Book; tags: any[] }> {
    return this.request<{ book: Book; tags: any[] }>(`/books/${id}`);
  }

  async streamBook(id: number): Promise<Response> {
    const url = `${this.baseUrl}/books/${id}/stream`;
    const headers: HeadersInit = {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new ApiError(`Failed to stream book: ${response.statusText}`, response.status, response);
    }

    return response;
  }

  // Author methods
  async getAuthors(): Promise<{ authors: Array<{ id: number; name: string; bookCount: number }> }> {
    return this.request<{ authors: Array<{ id: number; name: string; bookCount: number }> }>('/books/authors');
  }

  async getAuthor(id: number): Promise<{ author: { id: number; name: string }; books: Book[]; totalBooks: number }> {
    return this.request<{ author: { id: number; name: string }; books: Book[]; totalBooks: number }>(`/books/authors/${id}`);
  }

  // Genre methods
  async getGenres(): Promise<{ genres: Array<{ id: number; name: string; description?: string; color?: string; bookCount: number }> }> {
    return this.request<{ genres: Array<{ id: number; name: string; description?: string; color?: string; bookCount: number }> }>('/genres/');
  }

  async getGenre(id: number): Promise<{ genre: { id: number; name: string; description?: string; color?: string }; books: Book[]; totalBooks: number }> {
    return this.request<{ genre: { id: number; name: string; description?: string; color?: string }; books: Book[]; totalBooks: number }>(`/genres/${id}`);
  }

  // Reading Progress methods
  async getReadingProgress(bookId: number): Promise<{ book: { id: number }; progress: ReadingProgress | null }> {
    return this.request<{ book: { id: number }; progress: ReadingProgress | null }>(`/books/${bookId}/progress`);
  }

  async updateReadingProgress(
    bookId: number,
    currentPage: number,
    totalPages?: number,
    percentageComplete?: number,
    currentLocation?: string
  ): Promise<{ progress: ReadingProgress }> {
    return this.request<{ progress: ReadingProgress }>(`/books/${bookId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ 
        current_page: currentPage, 
        total_pages: totalPages,
        percentage_complete: percentageComplete,
        current_location: currentLocation
      }),
    });
  }

  async startReading(bookId: number, totalPages?: number): Promise<{ progress: ReadingProgress }> {
    return this.request<{ progress: ReadingProgress }>(`/books/${bookId}/progress/start`, {
      method: 'POST',
      body: JSON.stringify({ total_pages: totalPages }),
    });
  }

  async markBookCompleted(bookId: number): Promise<{ progress: ReadingProgress }> {
    return this.request<{ progress: ReadingProgress }>(`/books/${bookId}/progress/complete`, {
      method: 'POST',
    });
  }

  async resetProgress(bookId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/books/${bookId}/progress`, {
      method: 'DELETE',
    });
  }

  // Reading Dashboard methods
  async getAllProgress(): Promise<{ progress: ReadingProgress[] }> {
    return this.request<{ progress: ReadingProgress[] }>('/reading/progress');
  }

  async getRecentlyRead(limit: number = 10): Promise<{ books: any[] }> {
    return this.request<{ books: any[] }>(`/reading/recent?limit=${limit}`);
  }

  async getCurrentlyReading(): Promise<{ books: any[] }> {
    return this.request<{ books: any[] }>('/reading/currently-reading');
  }

  async getCompletedBooks(): Promise<{ books: any[] }> {
    return this.request<{ books: any[] }>('/reading/completed');
  }

  async getReadingStats(): Promise<{ stats: ReadingStats; recentActivity: any[] }> {
    return this.request<{ stats: ReadingStats; recentActivity: any[] }>('/reading/stats');
  }

  // Admin methods (require admin permissions)
  async getUsers(): Promise<{ users: User[] }> {
    return this.request<{ users: User[] }>('/admin/users');
  }

  async createUser(userData: CreateUserRequest): Promise<{ user: User }> {
    return this.request<{ user: User }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: number, updates: UpdateUserRequest): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(userId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getDashboard(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/admin/dashboard');
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }
}

// Export a singleton instance
export const apiService = new ApiService();