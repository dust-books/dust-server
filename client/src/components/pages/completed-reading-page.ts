/**
 * Completed Reading Page Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';
import { apiService } from '../../services/api.js';
import type { Book, ReadingProgress } from '../../types/app.js';
import { getBookCoverUrl } from '@/services/server-manager.js';

@customElement('completed-reading-page')
export class CompletedReadingPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @state()
  private completedBooks: (Book & { progress: ReadingProgress })[] = [];

  @state()
  private isLoading = false;

  @state()
  private viewMode: 'grid' | 'list' = 'grid';

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
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
      margin: 0.5rem 0 0 0;
      font-size: 1rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .view-toggle {
      background: none;
      border: 1px solid var(--border-color);
      padding: 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1.2rem;
      color: var(--text-color);
      transition: all 0.2s ease;
    }

    .view-toggle:hover {
      background: var(--hover-color);
    }

    .view-toggle.active {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    .books-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }

    .books-container.list {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .book-card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .book-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--primary-color);
    }

    .books-container.list .book-card {
      display: flex;
      align-items: center;
      padding: 1rem;
    }

    .book-cover {
      width: 100%;
      height: 250px;
      background: var(--background-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      color: var(--text-light);
      overflow: hidden;
    }

    .books-container.list .book-cover {
      width: 80px;
      height: 120px;
      margin-right: 1rem;
      flex-shrink: 0;
    }

    .book-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .book-info {
      padding: 1rem;
    }

    .books-container.list .book-info {
      padding: 0;
      flex: 1;
    }

    .book-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0 0 0.5rem 0;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .book-author {
      font-size: 0.875rem;
      color: var(--text-light);
      margin: 0 0 0.75rem 0;
    }

    .completion-info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .completion-date {
      font-size: 0.8rem;
      color: var(--success-color);
      font-weight: 500;
    }

    .completion-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: var(--success-color);
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      width: fit-content;
    }

    .reading-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-light);
      margin-top: 0.5rem;
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

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      color: var(--text-light);
    }

    .loading {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-radius: 50%;
      border-top-color: var(--primary-color);
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .books-container {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    await this.loadCompletedBooks();
  }

  private async loadCompletedBooks() {
    this.isLoading = true;
    try {
      const response = await apiService.getCompletedBooks();
      this.completedBooks = response.books;
    } catch (error) {
      console.error('Failed to load completed books:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private handleBookClick(book: Book) {
    this.dispatchEvent(new CustomEvent('book-select', {
      detail: { bookId: book.id },
      bubbles: true
    }));
  }

  private toggleViewMode() {
    this.viewMode = this.viewMode === "grid" ? "list" : "grid";
  }

  private formatCompletionDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private renderBookCard(bookWithProgress: Book & { progress: ReadingProgress }) {
    const { book, progress } = bookWithProgress as any;
    const actualBook = book || bookWithProgress;
    const actualProgress = progress || bookWithProgress.progress;

    return html`
      <div class="book-card" @click=${() => this.handleBookClick(actualBook)}>
        <div class="book-cover">
          ${(() => {
            const coverUrl = getBookCoverUrl(actualBook);
            return coverUrl
              ? html`<img src="${coverUrl}" alt="${actualBook.name}" />`
              : '📖';
          })()}
        </div>

        <div class="book-info">
          <h3 class="book-title">${actualBook.name}</h3>
          <p class="book-author">${actualBook.author?.name || 'Unknown Author'}</p>
          
          <div class="completion-info">
            <span class="completion-badge">
              ✅ Completed
            </span>
            
            ${actualProgress?.last_read_at ? html`
              <span class="completion-date">
                Finished ${this.formatCompletionDate(actualProgress.last_read_at)}
              </span>
            ` : ''}
            
            <div class="reading-stats">
              <span>${actualProgress?.total_pages || actualBook.page_count || 0} pages</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h2 class="empty-title">No completed books yet</h2>
        <p>Books you finish reading will appear here. Start reading to build your completed collection!</p>
      </div>
    `;
  }

  private renderLoadingState() {
    return html`
      <div class="loading-state">
        <div class="loading"></div>
        <p>Loading completed books...</p>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <div>
          <h1 class="page-title">Completed Books</h1>
          <p class="page-subtitle">${this.completedBooks.length} books completed</p>
        </div>

        <div class="header-actions">
          <button 
            class="view-toggle ${this.viewMode === 'grid' ? 'active' : ''}"
            @click=${this.toggleViewMode}
            title="Grid view"
          >
            ▦
          </button>
          <button 
            class="view-toggle ${this.viewMode === 'list' ? 'active' : ''}"
            @click=${this.toggleViewMode}
            title="List view"
          >
            ☰
          </button>
        </div>
      </div>

      ${this.isLoading
        ? this.renderLoadingState()
        : this.completedBooks.length === 0
        ? this.renderEmptyState()
        : html`
            <div class="books-container ${this.viewMode}">
              ${this.completedBooks.map(book => this.renderBookCard(book))}
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'completed-reading-page': CompletedReadingPage;
  }
}