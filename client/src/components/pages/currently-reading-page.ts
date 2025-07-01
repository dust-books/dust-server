/**
 * Currently Reading Page Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';
import type { Book } from '../../types/app.js';

interface CurrentlyReadingBook {
  // Reading progress data
  id: number;
  user_id: number;
  book_id: number;
  current_page: number;
  total_pages?: number;
  percentage_complete: number;
  last_read_at: string;
  created_at: string;
  updated_at: string;
  // Book data
  name: string;
  filepath: string;
  author: number;
}

@customElement('currently-reading-page')
export class CurrentlyReadingPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @property({ type: Array })
  books: CurrentlyReadingBook[] = [];

  @state()
  private isLoading = false;

  @state()
  private hasLoaded = false;

  @state()
  private sortBy: 'recent' | 'progress' | 'title' | 'started' = 'recent';

  @state()
  private viewMode: 'grid' | 'list' = 'grid';

  @state()
  private filterBy: 'all' | 'recently-read' | 'stalled' = 'all';

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-color);
      margin: 0;
    }

    .page-subtitle {
      color: var(--text-light);
      margin: 0.5rem 0 0;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .sort-select,
    .filter-select {
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--background-color);
      color: var(--text-color);
      font-size: 0.9rem;
    }

    .view-toggle {
      display: flex;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
    }

    .view-button {
      background: var(--background-color);
      border: none;
      padding: 0.5rem;
      cursor: pointer;
      color: var(--text-light);
      font-size: 1.2rem;
    }

    .view-button.active {
      background: var(--primary-color);
      color: white;
    }

    .controls-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--surface-color);
      border-radius: 8px;
      border: 1px solid var(--border-color);
      gap: 1rem;
    }

    .controls-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .controls-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .stats-summary {
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--surface-color);
      border-radius: 12px;
      border: 1px solid var(--border-color);
    }

    .stat-item {
      text-align: center;
      flex: 1;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary-color);
      display: block;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .books-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .books-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .book-card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
    }

    .book-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    }

    .book-header {
      padding: 1.5rem;
      display: flex;
      gap: 1rem;
    }

    .book-cover {
      width: 80px;
      height: 120px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 2rem;
      flex-shrink: 0;
    }

    .book-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }

    .book-info {
      flex: 1;
      min-width: 0;
    }

    .book-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0 0 0.5rem;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .book-author {
      color: var(--text-light);
      font-size: 0.9rem;
      margin: 0 0 1rem;
    }

    .reading-stats {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .reading-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.5rem;
      background: var(--background-color);
      border-radius: 8px;
      min-width: 60px;
    }

    .reading-stat-value {
      font-weight: 600;
      color: var(--primary-color);
      font-size: 0.9rem;
    }

    .reading-stat-label {
      font-size: 0.75rem;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.25rem;
    }

    .progress-section {
      padding: 0 1.5rem 1.5rem;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .progress-percentage {
      font-weight: 600;
      color: var(--primary-color);
      font-size: 1.1rem;
    }

    .last-read {
      font-size: 0.8rem;
      color: var(--text-light);
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: var(--border-color);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.75rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary-color), var(--primary-dark));
      transition: width 0.3s ease;
      border-radius: 4px;
    }

    .progress-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: var(--text-light);
    }

    .pages-info {
      display: flex;
      gap: 0.25rem;
    }

    .continue-reading-btn {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .continue-reading-btn:hover {
      background: var(--primary-dark);
    }

    .stalled-indicator {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #FF9800;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .recently-read-indicator {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #4CAF50;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-light);
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .empty-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
    }

    .empty-description {
      font-size: 1rem;
      line-height: 1.5;
      margin-bottom: 2rem;
    }

    .browse-books-btn {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .browse-books-btn:hover {
      background: var(--primary-dark);
    }

    .loading-state {
      text-align: center;
      padding: 4rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-radius: 50%;
      border-top-color: var(--primary-color);
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* List view specific styles */
    .books-list .book-card {
      display: flex;
      align-items: center;
      padding: 1rem;
    }

    .books-list .book-header {
      padding: 0;
      flex: 1;
    }

    .books-list .progress-section {
      padding: 0;
      margin-left: 1rem;
      min-width: 200px;
    }

    @media (max-width: 768px) {
      .books-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .controls-bar {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .controls-left,
      .controls-right {
        justify-content: center;
      }

      .stats-summary {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .stat-item {
        padding: 1rem;
        background: var(--background-color);
        border-radius: 8px;
      }

      .reading-stats {
        justify-content: space-around;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadCurrentlyReading();
  }

  private async loadCurrentlyReading() {
    if (this.isLoading || this.hasLoaded) {
      return;
    }

    this.isLoading = true;
    try {
      const books = await this.appStateService.loadCurrentlyReading();
      this.books = books;
      this.hasLoaded = true;
    } catch (error) {
      console.error('Failed to load currently reading books:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private handleBookClick(book: CurrentlyReadingBook) {
    this.dispatchEvent(
      new CustomEvent('book-select', {
        detail: { bookId: book.book_id },
        bubbles: true,
      })
    );
  }

  private handleBrowseBooks() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { page: 'library' },
        bubbles: true,
      })
    );
  }

  private handleSortChange(event: Event) {
    this.sortBy = (event.target as HTMLSelectElement).value as 'recent' | 'progress' | 'title' | 'started';
  }

  private handleFilterChange(event: Event) {
    this.filterBy = (event.target as HTMLSelectElement).value as 'all' | 'recently-read' | 'stalled';
  }

  private toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  private getFilteredAndSortedBooks(): CurrentlyReadingBook[] {
    let filtered = [...this.books];

    // Apply filter
    if (this.filterBy === 'recently-read') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter(book => new Date(book.last_read_at) > oneDayAgo);
    } else if (this.filterBy === 'stalled') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(book => new Date(book.last_read_at) < oneWeekAgo);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'recent':
          return new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime();
        case 'progress':
          return b.percentage_complete - a.percentage_complete;
        case 'title':
          return a.name.localeCompare(b.name);
        case 'started':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }

  private formatLastRead(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    
    return date.toLocaleDateString();
  }

  private isRecentlyRead(dateString: string): boolean {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(dateString) > oneDayAgo;
  }

  private isStalled(dateString: string): boolean {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(dateString) < oneWeekAgo;
  }

  private getAverageProgress(): number {
    if (this.books.length === 0) return 0;
    const total = this.books.reduce((sum, book) => sum + book.percentage_complete, 0);
    return Math.round(total / this.books.length);
  }

  private renderBookCard(book: CurrentlyReadingBook) {
    const isRecent = this.isRecentlyRead(book.last_read_at);
    const isBookStalled = this.isStalled(book.last_read_at);

    return html`
      <div class="book-card" @click=${() => this.handleBookClick(book)}>
        ${isRecent ? html`<div class="recently-read-indicator">Recently Read</div>` : ''}
        ${isBookStalled ? html`<div class="stalled-indicator">Stalled</div>` : ''}
        
        <div class="book-header">
          <div class="book-cover">
            📖
          </div>
          
          <div class="book-info">
            <h3 class="book-title">${book.name}</h3>
            <p class="book-author">by Author</p>
            
            <div class="reading-stats">
              <div class="reading-stat">
                <div class="reading-stat-value">${book.current_page}</div>
                <div class="reading-stat-label">Page</div>
              </div>
              ${book.total_pages ? html`
                <div class="reading-stat">
                  <div class="reading-stat-value">${book.total_pages}</div>
                  <div class="reading-stat-label">Total</div>
                </div>
              ` : ''}
              <div class="reading-stat">
                <div class="reading-stat-value">${Math.round(book.percentage_complete)}%</div>
                <div class="reading-stat-label">Done</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-percentage">${Math.round(book.percentage_complete)}% complete</span>
            <span class="last-read">${this.formatLastRead(book.last_read_at)}</span>
          </div>
          
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              style="width: ${book.percentage_complete}%"
            ></div>
          </div>
          
          <div class="progress-details">
            <div class="pages-info">
              <span>Page ${book.current_page}</span>
              ${book.total_pages ? html`<span>of ${book.total_pages}</span>` : ''}
            </div>
            
            <button class="continue-reading-btn" @click=${(e: Event) => {
              e.stopPropagation();
              this.handleBookClick(book);
            }}>
              Continue Reading
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <h2 class="empty-title">No books in progress</h2>
        <p class="empty-description">
          You haven't started reading any books yet. Browse your library to find something interesting to read!
        </p>
        <button class="browse-books-btn" @click=${this.handleBrowseBooks}>
          Browse Library
        </button>
      </div>
    `;
  }

  private renderLoadingState() {
    return html`
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading your currently reading books...</p>
      </div>
    `;
  }

  render() {
    const filteredBooks = this.getFilteredAndSortedBooks();
    const averageProgress = this.getAverageProgress();

    if (this.isLoading) {
      return this.renderLoadingState();
    }

    if (this.books.length === 0) {
      return this.renderEmptyState();
    }

    return html`
      <div class="page-header">
        <div>
          <h1 class="page-title">Currently Reading</h1>
          <p class="page-subtitle">${this.books.length} books in progress</p>
        </div>

        <div class="header-actions">
          <select class="sort-select" @change=${this.handleSortChange}>
            <option value="recent">Recently Read</option>
            <option value="progress">By Progress</option>
            <option value="title">By Title</option>
            <option value="started">Recently Started</option>
          </select>
          
          <div class="view-toggle">
            <button
              class="view-button ${this.viewMode === 'grid' ? 'active' : ''}"
              @click=${this.toggleViewMode}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              class="view-button ${this.viewMode === 'list' ? 'active' : ''}"
              @click=${this.toggleViewMode}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      <div class="stats-summary">
        <div class="stat-item">
          <span class="stat-value">${this.books.length}</span>
          <span class="stat-label">Books in Progress</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${averageProgress}%</span>
          <span class="stat-label">Average Progress</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${this.books.filter(b => this.isRecentlyRead(b.last_read_at)).length}</span>
          <span class="stat-label">Read Today</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${this.books.filter(b => this.isStalled(b.last_read_at)).length}</span>
          <span class="stat-label">Stalled</span>
        </div>
      </div>

      <div class="controls-bar">
        <div class="controls-left">
          <select class="filter-select" @change=${this.handleFilterChange}>
            <option value="all">All Books</option>
            <option value="recently-read">Recently Read</option>
            <option value="stalled">Stalled (1+ week)</option>
          </select>
        </div>
      </div>

      ${filteredBooks.length > 0
        ? html`
            <div class="${this.viewMode === 'grid' ? 'books-grid' : 'books-list'}">
              ${filteredBooks.map(book => this.renderBookCard(book))}
            </div>
          `
        : html`
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h2 class="empty-title">No books match your filter</h2>
              <p class="empty-description">Try adjusting your filter to see more books.</p>
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'currently-reading-page': CurrentlyReadingPage;
  }
}