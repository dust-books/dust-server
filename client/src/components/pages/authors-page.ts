/**
 * Authors Page Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';
import type { Book } from '../../types/app.js';

interface Author {
  id: number;
  name: string;
  bookCount: number;
}

@customElement('authors-page')
export class AuthorsPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @property({ type: Array })
  authors: Author[] = [];

  @state()
  private isLoading = false;

  @state()
  private hasLoaded = false;

  @state()
  private searchQuery = '';

  @state()
  private sortBy: 'name' | 'bookCount' = 'name';

  @state()
  private sortOrder: 'asc' | 'desc' = 'asc';

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

    .sort-select {
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--background-color);
      color: var(--text-color);
      font-size: 0.9rem;
    }

    .filters-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--surface-color);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .search-box {
      flex: 1;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--background-color);
      color: var(--text-color);
    }

    .authors-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .author-card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .author-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .author-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .author-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0 0 0.5rem;
      line-height: 1.3;
    }

    .author-stats {
      display: flex;
      align-items: center;
      gap: 1rem;
      color: var(--text-light);
      font-size: 0.9rem;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .stat-icon {
      font-size: 0.9rem;
    }

    .stat-value {
      font-weight: 600;
      color: var(--primary-color);
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
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
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

    @media (max-width: 768px) {
      .authors-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .filters-bar {
        flex-direction: column;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadAuthors();
  }

  private async loadAuthors() {
    if (this.isLoading || this.hasLoaded) {
      return;
    }

    this.isLoading = true;
    try {
      const authors = await this.appStateService.loadAuthors();
      this.authors = authors;
      this.hasLoaded = true;
    } catch (error) {
      console.error('Failed to load authors:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private handleAuthorClick(author: Author) {
    this.dispatchEvent(
      new CustomEvent('author-select', {
        detail: { authorId: author.id, authorName: author.name },
        bubbles: true,
      })
    );
  }

  private handleSearch(event: InputEvent) {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  private handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const [sortBy, sortOrder] = target.value.split('-') as ['name' | 'bookCount', 'asc' | 'desc'];
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
  }

  private getFilteredAndSortedAuthors(): Author[] {
    let filtered = [...this.authors];

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(author =>
        author.name.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (this.sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (this.sortBy === 'bookCount') {
        comparison = a.bookCount - b.bookCount;
      }
      
      return this.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }

  private getAuthorInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  private renderAuthorCard(author: Author) {
    return html`
      <div class="author-card" @click=${() => this.handleAuthorClick(author)}>
        <div class="author-avatar">
          ${this.getAuthorInitials(author.name)}
        </div>
        
        <h3 class="author-name">${author.name}</h3>
        
        <div class="author-stats">
          <div class="stat-item">
            <span class="stat-icon">📚</span>
            <span class="stat-value">${author.bookCount}</span>
            <span>${author.bookCount === 1 ? 'book' : 'books'}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">✍️</div>
        <h2 class="empty-title">No authors found</h2>
        <p>No authors match your current search criteria.</p>
      </div>
    `;
  }

  private renderLoadingState() {
    return html`
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading authors...</p>
      </div>
    `;
  }

  render() {
    const filteredAuthors = this.getFilteredAndSortedAuthors();

    return html`
      <div class="page-header">
        <div>
          <h1 class="page-title">Authors</h1>
          <p class="page-subtitle">${this.authors.length} authors in your library</p>
        </div>

        <div class="header-actions">
          <select class="sort-select" @change=${this.handleSortChange}>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="bookCount-desc">Most Books</option>
            <option value="bookCount-asc">Fewest Books</option>
          </select>
        </div>
      </div>

      <div class="filters-bar">
        <div class="search-box">
          <input
            type="text"
            class="search-input"
            placeholder="Search authors..."
            .value=${this.searchQuery}
            @input=${this.handleSearch}
          />
        </div>
      </div>

      ${this.isLoading
        ? this.renderLoadingState()
        : filteredAuthors.length === 0
        ? this.renderEmptyState()
        : html`
            <div class="authors-grid">
              ${filteredAuthors.map(author => this.renderAuthorCard(author))}
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'authors-page': AuthorsPage;
  }
}