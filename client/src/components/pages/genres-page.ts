/**
 * Genres Page Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';

interface Genre {
  id: number;
  name: string;
  description?: string;
  color?: string;
  bookCount: number;
}

@customElement('genres-page')
export class GenresPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @property({ type: Array })
  genres: Genre[] = [];

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

  @state()
  private viewMode: 'grid' | 'list' = 'grid';

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

    .genres-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .genres-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .genre-card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .genre-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .genre-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--genre-color, var(--primary-color));
    }

    .genre-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .genre-icon {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: var(--genre-color, var(--primary-color));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .genre-info {
      flex: 1;
    }

    .genre-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0 0 0.25rem;
      line-height: 1.3;
    }

    .genre-description {
      color: var(--text-light);
      font-size: 0.9rem;
      line-height: 1.4;
      margin: 0;
    }

    .genre-stats {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
    }

    .book-count {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-light);
      font-size: 0.9rem;
    }

    .book-count-value {
      font-weight: 600;
      color: var(--genre-color, var(--primary-color));
      font-size: 1.1rem;
    }

    .genre-tag {
      background: var(--genre-color, var(--primary-color));
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      opacity: 0.8;
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

    /* List view specific styles */
    .genres-list .genre-card {
      display: flex;
      align-items: center;
      padding: 1rem 1.5rem;
    }

    .genres-list .genre-card::before {
      width: 4px;
      height: 100%;
      right: auto;
      bottom: 0;
    }

    .genres-list .genre-header {
      margin-bottom: 0;
      flex: 1;
    }

    .genres-list .genre-stats {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .genres-grid {
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

      .header-actions {
        width: 100%;
        justify-content: space-between;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadGenres();
  }

  private async loadGenres() {
    if (this.isLoading || this.hasLoaded) {
      return;
    }

    this.isLoading = true;
    try {
      const genres = await this.appStateService.loadGenres();
      this.genres = genres;
      this.hasLoaded = true;
    } catch (error) {
      console.error('Failed to load genres:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private handleGenreClick(genre: Genre) {
    this.dispatchEvent(
      new CustomEvent('genre-select', {
        detail: { genreId: genre.id, genreName: genre.name },
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

  private toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  private getFilteredAndSortedGenres(): Genre[] {
    let filtered = [...this.genres];

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(genre =>
        genre.name.toLowerCase().includes(query) ||
        genre.description?.toLowerCase().includes(query)
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

  private renderGenreCard(genre: Genre) {
    const genreColor = genre.color || '#4169E1';
    
    return html`
      <div 
        class="genre-card" 
        style="--genre-color: ${genreColor}"
        @click=${() => this.handleGenreClick(genre)}
      >
        <div class="genre-header">
          <div class="genre-icon">
            ${this.getGenreIcon(genre.name)}
          </div>
          
          <div class="genre-info">
            <h3 class="genre-name">${genre.name}</h3>
            ${genre.description ? html`
              <p class="genre-description">${genre.description}</p>
            ` : ''}
          </div>
        </div>
        
        <div class="genre-stats">
          <div class="book-count">
            <span>📚</span>
            <span class="book-count-value">${genre.bookCount}</span>
            <span>${genre.bookCount === 1 ? 'book' : 'books'}</span>
          </div>
          
          <div class="genre-tag">Genre</div>
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">🏷️</div>
        <h2 class="empty-title">No genres found</h2>
        <p>No genres match your current search criteria.</p>
      </div>
    `;
  }

  private renderLoadingState() {
    return html`
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading genres...</p>
      </div>
    `;
  }

  render() {
    const filteredGenres = this.getFilteredAndSortedGenres();

    return html`
      <div class="page-header">
        <div>
          <h1 class="page-title">Browse Genres</h1>
          <p class="page-subtitle">${this.genres.length} genres in your library</p>
        </div>

        <div class="header-actions">
          <select class="sort-select" @change=${this.handleSortChange}>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="bookCount-desc">Most Books</option>
            <option value="bookCount-asc">Fewest Books</option>
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

      <div class="filters-bar">
        <div class="search-box">
          <input
            type="text"
            class="search-input"
            placeholder="Search genres..."
            .value=${this.searchQuery}
            @input=${this.handleSearch}
          />
        </div>
      </div>

      ${this.isLoading
        ? this.renderLoadingState()
        : filteredGenres.length === 0
        ? this.renderEmptyState()
        : html`
            <div class="${this.viewMode === 'grid' ? 'genres-grid' : 'genres-list'}">
              ${filteredGenres.map(genre => this.renderGenreCard(genre))}
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'genres-page': GenresPage;
  }
}