/**
 * Application State Management using Lit Context
 */

import { createContext } from '@lit/context';
import type { AppState, Book, ReadingProgress, Toast } from '../types/app.js';
import { apiService, ApiError } from './api.js';
import { serverManager } from './server-manager.js';

export const appStateContext = createContext<AppStateService>('app-state');

export class AppStateService {
  private state: AppState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    theme: 'auto',
    currentBook: null,
    readingProgress: new Map()
  };

  private listeners = new Set<() => void>();
  private toasts: Toast[] = [];
  private toastId = 0;

  constructor() {
    this.initializeFromStorage();
  }

  // State management
  getState(): AppState {
    return { ...this.state };
  }

  private setState(updates: Partial<AppState>): void {
    const prevState = this.state;
    this.state = { ...this.state, ...updates };
    
    // Only notify if something actually changed
    if (this.hasStateChanged(prevState, this.state)) {
      this.notifyListeners();
    }
  }

  private hasStateChanged(prev: AppState, current: AppState): boolean {
    // Check for meaningful changes that should trigger re-renders
    // NOTE: Removed isLoading from comparison to prevent re-render loops during async operations
    return (
      prev.user !== current.user ||
      prev.isAuthenticated !== current.isAuthenticated ||
      prev.theme !== current.theme ||
      prev.currentBook !== current.currentBook
      // prev.isLoading !== current.isLoading  // Commented out to prevent loops
    );
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  private initializeFromStorage(): void {
    // Load theme preference
    const savedTheme = localStorage.getItem('dust_theme') as 'light' | 'dark' | 'auto';
    if (savedTheme) {
      this.setState({ theme: savedTheme });
    }

    // Check if we have any servers configured
    const activeServer = serverManager.getActiveServer();
    if (!activeServer) {
      // No servers configured, user needs to connect to a server first
      this.setState({ isLoading: false, isAuthenticated: false });
      return;
    }

    // Check if user is authenticated with the active server
    try {
      if (apiService.isAuthenticated()) {
        this.setState({ isAuthenticated: true, isLoading: true });
        this.loadCurrentUser();
      } else {
        // Ensure loading is false if not authenticated
        this.setState({ isLoading: false });
      }
    } catch (error) {
      // Handle case where API service fails (no active server, etc.)
      console.warn('Failed to check authentication status:', error);
      this.setState({ isLoading: false, isAuthenticated: false });
    }
  }

  // Authentication methods
  async login(email: string, password: string): Promise<void> {
    this.setState({ isLoading: true });
    
    try {
      const response = await apiService.login({ email, password });
      this.setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });
      
      this.showToast({
        type: 'success',
        title: 'Welcome back!',
        message: `Logged in as ${response.user.displayName}`,
      });
    } catch (error) {
      this.setState({ isLoading: false });
      this.handleError(error, 'Login failed');
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.setState({ isLoading: true });
    
    try {
      await apiService.logout();
      this.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        currentBook: null,
        readingProgress: new Map()
      });
      
      this.showToast({
        type: 'success',
        title: 'Logged out',
        message: 'See you next time!',
      });
    } catch (error) {
      this.setState({ isLoading: false });
      this.handleError(error, 'Logout failed');
    }
  }

  async register(userData: { username: string; email: string; password: string; display_name?: string }): Promise<void> {
    this.setState({ isLoading: true });
    
    try {
      await apiService.register(userData);
      this.setState({ isLoading: false });
      
      this.showToast({
        type: 'success',
        title: 'Account created!',
        message: 'Please log in to continue.',
      });
    } catch (error) {
      this.setState({ isLoading: false });
      this.handleError(error, 'Registration failed');
      throw error;
    }
  }

  private async loadCurrentUser(): Promise<void> {
    try {
      const user = await apiService.getCurrentUser();
      this.setState({ user, isLoading: false });
    } catch (error) {
      // If user fetch fails, clear authentication
      this.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
      this.handleError(error, 'Failed to load user profile');
    }
  }

  async updateProfile(updates: { username?: string; email?: string; display_name?: string }): Promise<void> {
    if (!this.state.user) throw new Error('No user logged in');

    try {
      const updatedUser = await apiService.updateProfile(updates);
      this.setState({ user: updatedUser });
      
      this.showToast({
        type: 'success',
        title: 'Profile updated',
        message: 'Your changes have been saved.',
      });
    } catch (error) {
      this.handleError(error, 'Failed to update profile');
      throw error;
    }
  }

  // Book methods
  async loadBooks(filters?: any): Promise<Book[]> {
    this.setState({ isLoading: true });
    
    try {
      console.log('AppState: Loading books from current server');
      const response = await apiService.getBooks(filters);
      this.setState({ isLoading: false });
      console.log('AppState: Successfully loaded books:', response.books.length);
      return response.books;
    } catch (error) {
      this.setState({ isLoading: false });
      this.handleError(error, 'Failed to load books');
      console.error('AppState: Failed to load books:', error);
      return [];
    }
  }

  async selectBook(bookId: number): Promise<Book | null> {
    try {
      const response = await apiService.getBook(bookId);
      this.setState({ currentBook: response.book });
      return response.book;
    } catch (error) {
      this.handleError(error, 'Failed to load book');
      return null;
    }
  }

  clearCurrentBook(): void {
    this.setState({ currentBook: null });
  }

  // Author methods
  async loadAuthors(): Promise<Array<{ id: number; name: string; bookCount: number }>> {
    this.setState({ isLoading: true });
    
    try {
      const response = await apiService.getAuthors();
      this.setState({ isLoading: false });
      return response.authors;
    } catch (error) {
      this.setState({ isLoading: false });
      this.handleError(error, 'Failed to load authors');
      return [];
    }
  }

  async loadAuthor(authorId: number): Promise<{ author: { id: number; name: string }; books: Book[]; totalBooks: number } | null> {
    try {
      const response = await apiService.getAuthor(authorId);
      return response;
    } catch (error) {
      this.handleError(error, 'Failed to load author');
      return null;
    }
  }

  // Genre methods
  async loadGenres(): Promise<Array<{ id: number; name: string; description?: string; color?: string; bookCount: number }>> {
    this.setState({ isLoading: true });
    
    try {
      const response = await apiService.getGenres();
      this.setState({ isLoading: false });
      return response.genres;
    } catch (error) {
      this.setState({ isLoading: false });
      this.handleError(error, 'Failed to load genres');
      return [];
    }
  }

  async loadGenre(genreId: number): Promise<{ genre: { id: number; name: string; description?: string; color?: string }; books: Book[]; totalBooks: number } | null> {
    try {
      const response = await apiService.getGenre(genreId);
      return response;
    } catch (error) {
      this.handleError(error, 'Failed to load genre');
      return null;
    }
  }

  // Reading Progress methods  
  async loadCurrentlyReading(): Promise<any[]> {
    this.setState({ isLoading: true });
    
    try {
      const response = await apiService.getCurrentlyReading();
      this.setState({ isLoading: false });
      return response.books;
    } catch (error) {
      this.setState({ isLoading: false });
      this.handleError(error, 'Failed to load currently reading books');
      return [];
    }
  }

  async loadRecentlyRead(limit: number = 10): Promise<any[]> {
    try {
      const response = await apiService.getRecentlyRead(limit);
      return response.books;
    } catch (error) {
      this.handleError(error, 'Failed to load recently read books');
      return [];
    }
  }

  async loadCompletedBooks(): Promise<any[]> {
    try {
      const response = await apiService.getCompletedBooks();
      return response.books;
    } catch (error) {
      this.handleError(error, 'Failed to load completed books');
      return [];
    }
  }

  async loadReadingStats(): Promise<{ stats: any; recentActivity: any[] } | null> {
    try {
      const response = await apiService.getReadingStats();
      return response;
    } catch (error) {
      this.handleError(error, 'Failed to load reading statistics');
      return null;
    }
  }

  // Reading Progress methods
  async loadReadingProgress(bookId: number): Promise<ReadingProgress | null> {
    try {
      const response = await apiService.getReadingProgress(bookId);
      
      if (response.progress) {
        const newProgress = new Map(this.state.readingProgress);
        newProgress.set(bookId, response.progress);
        this.setState({ readingProgress: newProgress });
      }
      
      return response.progress;
    } catch (error) {
      this.handleError(error, 'Failed to load reading progress');
      return null;
    }
  }

  async updateReadingProgress(progressData: {
    book_id: number;
    current_page: number;
    total_pages: number;
    percentage_complete: number;
    current_location: string;
    session_duration: number;
  }): Promise<void> {
    try {
      const response = await apiService.updateReadingProgress(
        progressData.book_id, 
        progressData.current_page, 
        progressData.total_pages,
        progressData.percentage_complete,
        progressData.current_location
      );
      
      const newProgress = new Map(this.state.readingProgress);
      newProgress.set(progressData.book_id, response.progress);
      this.setState({ readingProgress: newProgress });
    } catch (error) {
      this.handleError(error, 'Failed to update reading progress');
    }
  }

  async startReading(bookId: number, totalPages?: number): Promise<void> {
    try {
      const response = await apiService.startReading(bookId, totalPages);
      
      const newProgress = new Map(this.state.readingProgress);
      newProgress.set(bookId, response.progress);
      this.setState({ readingProgress: newProgress });
      
      this.showToast({
        type: 'success',
        title: 'Started reading',
        message: 'Your progress will be tracked automatically.',
      });
    } catch (error) {
      this.handleError(error, 'Failed to start reading');
    }
  }

  async markBookCompleted(bookId: number): Promise<void> {
    try {
      const response = await apiService.markBookCompleted(bookId);
      
      const newProgress = new Map(this.state.readingProgress);
      newProgress.set(bookId, response.progress);
      this.setState({ readingProgress: newProgress });
      
      this.showToast({
        type: 'success',
        title: 'Book completed!',
        message: 'Congratulations on finishing your book!',
      });
    } catch (error) {
      this.handleError(error, 'Failed to mark book as completed');
    }
  }

  async resetProgress(bookId: number): Promise<void> {
    try {
      await apiService.resetProgress(bookId);
      
      const newProgress = new Map(this.state.readingProgress);
      newProgress.delete(bookId);
      this.setState({ readingProgress: newProgress });
      
      this.showToast({
        type: 'success',
        title: 'Progress reset',
        message: 'Your reading progress has been reset to the beginning.',
      });
    } catch (error) {
      this.handleError(error, 'Failed to reset reading progress');
    }
  }

  getReadingProgress(bookId: number): ReadingProgress | null {
    return this.state.readingProgress.get(bookId) || null;
  }

  // Theme management
  setTheme(theme: 'light' | 'dark' | 'auto'): void {
    this.setState({ theme });
    localStorage.setItem('dust_theme', theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: 'light' | 'dark' | 'auto'): void {
    const root = document.documentElement;
    
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  // Toast notifications
  showToast(toast: Omit<Toast, 'id'>): string {
    const id = `toast-${++this.toastId}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration || 5000
    };
    
    this.toasts.push(newToast);
    this.notifyListeners();
    
    // Auto-remove toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => this.removeToast(id), newToast.duration);
    }
    
    return id;
  }

  removeToast(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  getToasts(): Toast[] {
    return [...this.toasts];
  }

  // Error handling
  private handleError(error: unknown, defaultMessage: string): void {
    let message = defaultMessage;
    
    if (error instanceof ApiError) {
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }
    
    this.showToast({
      type: 'error',
      title: 'Error',
      message,
      duration: 8000
    });
    
    console.error('App State Error:', error);
  }

  // Utility methods
  hasPermission(permission: string): boolean {
    return this.state.user?.permissions.includes(permission) || false;
  }

  hasRole(role: string): boolean {
    return this.state.user?.roles.includes(role) || false;
  }

  isAdmin(): boolean {
    return this.hasPermission('admin.full') || this.hasRole('admin');
  }

  // Server management
  async refreshAfterServerChange(): Promise<void> {
    console.log('Refreshing app state after server change');
    
    // Clear current state - this will trigger re-renders and library page will reload
    this.setState({
      currentBook: null,
      readingProgress: new Map(),
      isLoading: true
    });

    // Check if the new server has authentication
    const activeServer = serverManager.getActiveServer();
    if (!activeServer?.auth) {
      // No auth for new server, user needs to login
      this.setState({ 
        isAuthenticated: false, 
        user: null,
        isLoading: false 
      });
      return;
    }

    // Try to load user data from new server
    try {
      const userData = await apiService.getCurrentUser();
      this.setState({
        user: userData,
        isAuthenticated: true,
        isLoading: false
      });

      this.showToast({
        type: 'success',
        title: 'Server Changed',
        message: `Connected to ${activeServer.name}`,
        duration: 3000
      });
    } catch (error) {
      // Auth failed, user needs to login to new server
      this.setState({ 
        isAuthenticated: false, 
        user: null,
        isLoading: false 
      });
      
      this.showToast({
        type: 'info',
        title: 'Authentication Required',
        message: `Please sign in to ${activeServer.name}`,
        duration: 5000
      });
    }
  }
}

// Export singleton instance
export const appState = new AppStateService();