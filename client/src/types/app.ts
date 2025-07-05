/**
 * Application-specific type definitions
 */

import type { User, Book, ReadingProgress } from './api.js';

export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  theme: 'light' | 'dark' | 'auto';
  currentBook: Book | null;
  readingProgress: Map<number, ReadingProgress>;
}

export interface BookReaderState {
  currentPage: number;
  totalPages: number;
  fontSize: number;
  lineHeight: number;
  theme: 'light' | 'dark' | 'sepia';
  showToolbar: boolean;
  isFullscreen: boolean;
}

export interface NavigationItem {
  name: string;
  path: string;
  icon: string;
  requiresAuth?: boolean;
  requiresPermission?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  action: () => void;
}

export interface BookFilter {
  genres?: string[];
  authors?: string[];
  tags?: string[];
  rating?: [number, number];
  search?: string;
  sortBy?: 'title' | 'author' | 'date_added' | 'rating' | 'progress';
  sortOrder?: 'asc' | 'desc';
}

export interface BookGridOptions {
  view: 'grid' | 'list' | 'compact';
  showProgress: boolean;
  showTags: boolean;
  showDescription: boolean;
  itemsPerPage: number;
}

// Re-export common types from API
export type {
  User,
  Book,
  Tag,
  ReadingProgress,
  ReadingSession,
  ReadingStats
} from './api.js';