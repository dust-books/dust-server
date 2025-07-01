/**
 * Author Detail Page Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';
import type { Book } from '../../types/app.js';

interface AuthorDetails {
  author: {
    id: number;
    name: string;
  };
  books: Book[];
  totalBooks: number;
}

@customElement('author-detail-page')
export class AuthorDetailPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @property({ type: Number })
  authorId: number | null = null;

  @state()
  private authorDetails: AuthorDetails | null = null;

  @state()
  private isLoading = false;

  @state()
  private error: string | null = null;

  @state()
  private sortBy: 'name' | 'recent' = 'name';

  @state()
  private viewMode: 'grid' | 'list' = 'grid';

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

    .author-header {
      display: flex;
      align-items: center;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .author-avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 3rem;
      font-weight: 600;
    }

    .author-info {
      flex: 1;
    }

    .author-name {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--text-color);
      margin: 0 0 0.5rem;
      line-height: 1.2;
    }

    .author-stats {
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
      color: var(--primary-color);
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
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
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
      background: var(--primary-color);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.75rem;
      color: var(--text-light);
      margin-top: 0.25rem;
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

    @media (max-width: 768px) {
      .author-header {
        flex-direction: column;
        text-align: center;
        gap: 1rem;
      }

      .author-avatar {
        width: 80px;
        height: 80px;
        font-size: 2rem;
      }

      .author-name {
        font-size: 2rem;
      }

      .author-stats {
        justify-content: center;
      }

      .controls-bar {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .books-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
      }
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    if (this.authorId) {
      await this.loadAuthorDetails();
    }
  }

  async updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('authorId') && this.authorId) {
      await this.loadAuthorDetails();
    }
  }

  private async loadAuthorDetails() {
    if (!this.authorId) return;

    this.isLoading = true;
    this.error = null;

    try {
      const details = await this.appStateService.loadAuthor(this.authorId);
      if (details) {
        this.authorDetails = details;
      } else {
        this.error = 'Author not found';
      }
    } catch (error) {
      console.error('Failed to load author details:', error);
      this.error = 'Failed to load author details';
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
    this.sortBy = (event.target as HTMLSelectElement).value as 'name' | 'recent';
  }

  private toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  private getAuthorInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  private getSortedBooks(): Book[] {
    if (!this.authorDetails) return [];

    const books = [...this.authorDetails.books];
    
    if (this.sortBy === 'name') {
      books.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Add more sorting options as needed

    return books;
  }

  private getReadingProgress(bookId: number): number {
    const progress = this.appStateService.getReadingProgress(bookId);
    return progress?.percentage_complete || 0;
  }

  private renderBookCard(book: Book) {
    const progress = this.getReadingProgress(book.id);

    return html`
      <div class="book-card" @click=${() => this.handleBookClick(book)}>
        <div class="book-cover">
          ${book.cover_image_url
            ? html`<img src="${book.cover_image_url}" alt="${book.name}" />`
            : '📖'}
        </div>

        <div class="book-info">
          <h3 class="book-title">${book.name}</h3>

          ${progress > 0
            ? html`
                <div class="book-progress">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      style="width: ${progress}%"
                    ></div>
                  </div>
                  <div class="progress-text">
                    ${Math.round(progress)}% complete
                  </div>
                </div>
              `
            : ''}
        </div>
      </div>
    `;
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading author details...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-state">
          <h2>Error</h2>
          <p>${this.error}</p>
          <button class="back-button" @click=${this.handleBack}>
            ← Back to Authors
          </button>
        </div>
      `;
    }

    if (!this.authorDetails) {
      return html``;
    }

    const sortedBooks = this.getSortedBooks();

    return html`
      <div class="page-header">
        <button class="back-button" @click=${this.handleBack}>
          ← Back to Authors
        </button>

        <div class="author-header">
          <div class="author-avatar">
            ${this.getAuthorInitials(this.authorDetails.author.name)}
          </div>
          
          <div class="author-info">
            <h1 class="author-name">${this.authorDetails.author.name}</h1>
            
            <div class="author-stats">
              <div class="stat-item">
                <span class="stat-value">${this.authorDetails.totalBooks}</span>
                <span class="stat-label">${this.authorDetails.totalBooks === 1 ? 'Book' : 'Books'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="controls-bar">
        <div class="controls-left">
          <h2 class="section-title">Books by ${this.authorDetails.author.name}</h2>
        </div>
        
        <div class="controls-right">
          <select class="sort-select" @change=${this.handleSortChange}>
            <option value="name">Sort by Title</option>
            <option value="recent">Recently Added</option>
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

      ${sortedBooks.length > 0
        ? html`
            <div class="${this.viewMode === 'grid' ? 'books-grid' : 'books-list'}">
              ${sortedBooks.map(book => this.renderBookCard(book))}
            </div>
          `
        : html`
            <div class="empty-state">
              <p>No accessible books found for this author.</p>
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'author-detail-page': AuthorDetailPage;
  }
}