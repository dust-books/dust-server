/**
 * Genre Detail Page Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';
import type { Book } from '../../types/app.js';

interface GenreDetails {
  genre: {
    id: number;
    name: string;
    description?: string;
    color?: string;
  };
  books: Book[];
  totalBooks: number;
}

@customElement('genre-detail-page')
export class GenreDetailPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @property({ type: Number })
  genreId: number | null = null;

  @state()
  private genreDetails: GenreDetails | null = null;

  @state()
  private isLoading = false;

  @state()
  private error: string | null = null;

  @state()
  private sortBy: 'name' | 'recent' | 'progress' = 'name';

  @state()
  private viewMode: 'grid' | 'list' = 'grid';

  @state()
  private filterBy: 'all' | 'unread' | 'reading' | 'completed' = 'all';

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .back-button {
      background: none;
      border: 1px solid var(--border-color);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      color: var(--text-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      transition: background-color 0.2s ease;
    }

    .back-button:hover {
      background: var(--border-color);
    }

    .genre-header {
      display: flex;
      align-items: center;
      gap: 2rem;
      margin-bottom: 2rem;
      padding: 2rem;
      background: var(--surface-color);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      position: relative;
      overflow: hidden;
    }

    .genre-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: var(--genre-color, var(--primary-color));
    }

    .genre-icon {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: var(--genre-color, var(--primary-color));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 3rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .genre-info {
      flex: 1;
    }

    .genre-name {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--text-color);
      margin: 0 0 0.5rem;
      line-height: 1.2;
    }

    .genre-description {
      font-size: 1.1rem;
      color: var(--text-light);
      margin: 0 0 1rem;
      line-height: 1.5;
    }

    .genre-stats {
      display: flex;
      gap: 2rem;
      margin-top: 1rem;
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--genre-color, var(--primary-color));
      display: block;
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.05em;
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

    .filter-select,
    .sort-select {
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

    .books-section {
      margin-top: 2rem;
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 1rem;
    }

    .books-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .book-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .book-cover {
      width: 100%;
      height: 250px;
      background: linear-gradient(135deg, var(--genre-color, var(--primary-color)), var(--primary-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 3rem;
      position: relative;
    }

    .book-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .book-info {
      padding: 1rem;
    }

    .book-title {
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
      font-size: 0.875rem;
      margin: 0 0 0.5rem;
    }

    .book-progress {
      margin-top: 0.5rem;
    }

    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--border-color);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--genre-color, var(--primary-color));
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.75rem;
      color: var(--text-light);
      margin-top: 0.25rem;
    }

    .book-status {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      margin-top: 0.5rem;
    }

    .status-unread {
      background: var(--border-color);
      color: var(--text-light);
    }

    .status-reading {
      background: var(--genre-color, var(--primary-color));
      color: white;
    }

    .status-completed {
      background: #4CAF50;
      color: white;
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

    .error-state {
      text-align: center;
      padding: 4rem;
      color: var(--error-color);
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

    @media (max-width: 768px) {
      .genre-header {
        flex-direction: column;
        text-align: center;
        gap: 1rem;
        padding: 1.5rem;
      }

      .genre-icon {
        width: 80px;
        height: 80px;
        font-size: 2rem;
      }

      .genre-name {
        font-size: 2rem;
      }

      .genre-stats {
        justify-content: center;
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

      .books-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
      }
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    if (this.genreId) {
      await this.loadGenreDetails();
    }
  }

  async updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('genreId') && this.genreId) {
      await this.loadGenreDetails();
    }
  }

  private async loadGenreDetails() {
    if (!this.genreId) return;

    this.isLoading = true;
    this.error = null;

    try {
      const details = await this.appStateService.loadGenre(this.genreId);
      if (details) {
        this.genreDetails = details;
      } else {
        this.error = 'Genre not found';
      }
    } catch (error) {
      console.error('Failed to load genre details:', error);
      this.error = 'Failed to load genre details';
    } finally {
      this.isLoading = false;
    }
  }

  private handleBack() {
    this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true }));
  }

  private handleBookClick(book: Book) {
    this.dispatchEvent(
      new CustomEvent('book-select', {
        detail: { bookId: book.id },
        bubbles: true,
      })
    );
  }

  private handleSortChange(event: Event) {
    this.sortBy = (event.target as HTMLSelectElement).value as 'name' | 'recent' | 'progress';
  }

  private handleFilterChange(event: Event) {
    this.filterBy = (event.target as HTMLSelectElement).value as 'all' | 'unread' | 'reading' | 'completed';
  }

  private toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  private getGenreIcon(genreName: string): string {
    const iconMap: Record<string, string> = {
      'Fiction': '📚',
      'Non-Fiction': '📖',
      'Romance': '💕',
      'Mystery': '🔍',
      'Thriller': '⚡',
      'Horror': '👻',
      'Fantasy': '🧙',
      'Sci-Fi': '🚀',
      'Biography': '👤',
      'History': '🏛️',
      'Science': '🔬',
      'Technology': '💻',
      'Self-Help': '🌱',
      'Cooking': '👨‍🍳',
      'Magic': '🎩'
    };
    
    return iconMap[genreName] || '📚';
  }

  private getReadingProgress(bookId: number): number {
    const progress = this.appStateService.getReadingProgress(bookId);
    return progress?.percentage_complete || 0;
  }

  private getBookStatus(book: Book): 'unread' | 'reading' | 'completed' {
    const progress = this.getReadingProgress(book.id);
    if (progress >= 100) return 'completed';
    if (progress > 0) return 'reading';
    return 'unread';
  }

  private getFilteredAndSortedBooks(): Book[] {
    if (!this.genreDetails) return [];

    let books = [...this.genreDetails.books];

    // Apply status filter
    if (this.filterBy !== 'all') {
      books = books.filter(book => this.getBookStatus(book) === this.filterBy);
    }

    // Apply sorting
    if (this.sortBy === 'name') {
      books.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.sortBy === 'progress') {
      books.sort((a, b) => this.getReadingProgress(b.id) - this.getReadingProgress(a.id));
    }
    // Add more sorting options as needed

    return books;
  }

  private renderBookCard(book: Book) {
    const progress = this.getReadingProgress(book.id);
    const status = this.getBookStatus(book);
    const genreColor = this.genreDetails?.genre.color || '#4169E1';

    return html`
      <div class="book-card" @click=${() => this.handleBookClick(book)}>
        <div class="book-cover" style="--genre-color: ${genreColor}">
          ${book.cover_image_url
            ? html`<img src="${book.cover_image_url}" alt="${book.name}" />`
            : '📖'}
        </div>

        <div class="book-info">
          <h3 class="book-title">${book.name}</h3>
          <p class="book-author">by ${book.author.name}</p>

          ${progress > 0
            ? html`
                <div class="book-progress">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      style="--genre-color: ${genreColor}; width: ${progress}%"
                    ></div>
                  </div>
                  <div class="progress-text">
                    ${Math.round(progress)}% complete
                  </div>
                </div>
              `
            : ''}

          <span class="book-status status-${status}">
            ${status === 'unread' ? 'Not Started' : 
              status === 'reading' ? 'In Progress' : 'Completed'}
          </span>
        </div>
      </div>
    `;
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading genre details...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-state">
          <h2>Error</h2>
          <p>${this.error}</p>
          <button class="back-button" @click=${this.handleBack}>
            ← Back to Genres
          </button>
        </div>
      `;
    }

    if (!this.genreDetails) {
      return html``;
    }

    const filteredBooks = this.getFilteredAndSortedBooks();
    const genreColor = this.genreDetails.genre.color || '#4169E1';

    return html`
      <div class="page-header">
        <button class="back-button" @click=${this.handleBack}>
          ← Back to Genres
        </button>

        <div class="genre-header" style="--genre-color: ${genreColor}">
          <div class="genre-icon">
            ${this.getGenreIcon(this.genreDetails.genre.name)}
          </div>
          
          <div class="genre-info">
            <h1 class="genre-name">${this.genreDetails.genre.name}</h1>
            ${this.genreDetails.genre.description ? html`
              <p class="genre-description">${this.genreDetails.genre.description}</p>
            ` : ''}
            
            <div class="genre-stats">
              <div class="stat-item">
                <span class="stat-value">${this.genreDetails.totalBooks}</span>
                <span class="stat-label">${this.genreDetails.totalBooks === 1 ? 'Book' : 'Books'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="controls-bar">
        <div class="controls-left">
          <select class="filter-select" @change=${this.handleFilterChange}>
            <option value="all">All Books</option>
            <option value="unread">Not Started</option>
            <option value="reading">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          
          <select class="sort-select" @change=${this.handleSortChange}>
            <option value="name">Sort by Title</option>
            <option value="recent">Recently Added</option>
            <option value="progress">By Progress</option>
          </select>
        </div>
        
        <div class="controls-right">
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

      ${filteredBooks.length > 0
        ? html`
            <div class="${this.viewMode === 'grid' ? 'books-grid' : 'books-list'}">
              ${filteredBooks.map(book => this.renderBookCard(book))}
            </div>
          `
        : html`
            <div class="empty-state">
              <div class="empty-icon">📚</div>
              <h2>No books found</h2>
              <p>No books match your current filter criteria in this genre.</p>
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'genre-detail-page': GenreDetailPage;
  }
}