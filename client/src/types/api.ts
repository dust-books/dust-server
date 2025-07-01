/**
 * Type definitions for the Dust API
 * These should match the server-side interfaces
 */

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  created?: string;
  lastLogin?: string;
}

export interface Book {
  id: number;
  name: string;
  filepath: string;
  author: {
    id: number;
    name: string;
  };
  isbn?: string;
  publication_date?: string;
  publisher?: string;
  description?: string;
  page_count?: number;
  file_size?: number;
  file_format?: string;
  cover_image_path?: string;
  cover_image_url?: string;
  genre?: string[];
  series?: string;
  series_number?: number;
  rating?: number;
  ratings_count?: number;
  categories?: string[];
  maturity_rating?: string;
  tags?: Tag[];
  status?: string;
  archived_at?: string;
  archive_reason?: string;
}

export interface Tag {
  id: number;
  name: string;
  category: string;
  description?: string;
  color?: string;
  requires_permission?: string;
  created_at: string;
}

export interface ReadingProgress {
  id: number;
  user_id: number;
  book_id: number;
  current_page: number;
  total_pages?: number;
  percentage_complete: number;
  current_location?: string;
  session_duration?: number;
  last_read_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingSession {
  book: Book;
  progress: ReadingProgress | null;
}

export interface ReadingStats {
  totalBooksStarted: number;
  totalBooksCompleted: number;
  totalPagesRead: number;
  averageProgress: number;
  currentlyReading: number;
  readingStreak: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expires_at: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  roles?: string[];
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  display_name?: string;
  is_active?: boolean;
  roles?: string[];
}

export interface DashboardStats {
  userStats: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    recentUsers: User[];
  };
  systemInfo: {
    version: string;
    uptime: string;
    denoVersion: string;
  };
}