/**
 * API Service for communicating with Dust servers (multi-server support)
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
} from '../types/api.js';

import { serverManager } from './server-manager.js';
import type { ServerWithAuth } from '../types/server.js';

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
  constructor() {
    // No longer store baseUrl or token directly - get from server manager
  }

  /**
   * Get current server configuration
   */
  private getCurrentServer(): ServerWithAuth {
    const server = serverManager.getActiveServer();
    if (!server) {
      throw new ApiError('No active server selected');
    }
    return server;
  }

  /**
   * Get auth token for current server
   */
  private getCurrentToken(): string | null {
    const server = this.getCurrentServer();
    return server.auth?.token || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const server = this.getCurrentServer();
    const token = this.getCurrentToken();
    
    const url = `${server.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
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
    // Use server manager to handle authentication with current server
    const server = this.getCurrentServer();
    const result = await serverManager.authenticateWithServer(server.id, credentials.email, credentials.password);
    
    if (!result.success) {
      throw new ApiError(result.error || 'Authentication failed');
    }

    // Return the expected response format with user data from authentication result
    return {
      token: result.auth!.token,
      user: result.user, // User data from the authentication response
      expires_at: result.auth!.expiresAt || ''
    };
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      // Clear auth from memory and localStorage so refresh does not restore session
      try {
        const server = this.getCurrentServer();
        serverManager.clearAuthForServer(server.id);
      } catch {
        // No active server, nothing to clear
      }
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
    const server = this.getCurrentServer();
    console.log('API: Getting books from server:', server.name, server.baseUrl);
    
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
    
    const result = await this.request<{ books: Book[]; userPreferences: any }>(url);
    console.log('API: Received books from server:', result.books.length);
    return result;
  }

  async getBook(id: number): Promise<{ book: Book; tags: any[] }> {
    return this.request<{ book: Book; tags: any[] }>(`/books/${id}`);
  }

  async streamBook(id: number): Promise<Response> {
    const server = this.getCurrentServer();
    const token = this.getCurrentToken();
    
    const url = `${server.baseUrl}/books/${id}/stream`;
    const headers: HeadersInit = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
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

  async getAuthor(id: number): Promise<{ id: number; name: string; books: Book[]; totalBooks: number }> {
    return this.request<{ id: number; name: string; books: Book[]; totalBooks: number }>(`/books/authors/${id}`);
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

  // Admin settings methods
  async getAdminAuthSettings(): Promise<{ auth_flow: 'signup' | 'invitation' }> {
    return this.request<{ auth_flow: 'signup' | 'invitation' }>('/admin/auth-settings');
  }

  async updateAdminAuthSettings(
    authFlow: 'signup' | 'invitation'
  ): Promise<{ auth_flow: 'signup' | 'invitation' }> {
    return this.request<{ auth_flow: 'signup' | 'invitation' }>('/admin/auth-settings', {
      method: 'PUT',
      body: JSON.stringify({ auth_flow: authFlow }),
    });
  }

  // Public auth settings (used by login/register UI)
  async getAuthSettings(): Promise<{ auth_flow: 'signup' | 'invitation' }> {
    return this.request<{ auth_flow: 'signup' | 'invitation' }>('/auth/settings');
  }

  // Invitation methods
  async createInvitation(email: string): Promise<{ token: string }> {
    return this.request<{ token: string }>('/admin/invitations', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async refreshBookMetadata(bookId: number): Promise<{ success: boolean; message: string; book_id: number }> {
    return this.request<{ success: boolean; message: string; book_id: number }>(`/admin/books/${bookId}/refresh-metadata`, {
      method: 'POST',
    });
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.getCurrentToken();
  }

  getToken(): string | null {
    return this.getCurrentToken();
  }
}

// Export a singleton instance
export const apiService = new ApiService();