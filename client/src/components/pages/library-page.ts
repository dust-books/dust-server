/**
 * Library Page Component
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";

import { appStateContext, AppStateService } from "../../services/app-state.js";
import { getBookCoverUrl, serverManager } from "../../services/server-manager.js";
// Unused import removed
import type { Book } from "../../types/app.js";

@customElement("library-page")
export class LibraryPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @state()
  private books: Book[] = [];

  @state()
  private isLoading = false;

  @state()
  private hasLoaded = false;

  @state()
  private viewMode: "grid" | "list" = "grid";

  @state()
  private searchQuery = "";

  @state()
  private selectedGenres: string[] = [];

  @state()
  private readingStatusFilter:
    | "all"
    | "not-started"
    | "in-progress"
    | "completed" = "all";

  private searchTimeout: number | null = null;

  @state()
  private currentServerId: string | null = null;

  private serverUnsubscribe?: () => void;

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
      flex-direction: column;
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
      box-sizing: border-box;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .filter-select {
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--background-color);
      color: var(--text-color);
      cursor: pointer;
      margin-top: 0.5rem;
      display: block;
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--primary-color);
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
      background: linear-gradient(
        135deg,
        var(--primary-color),
        var(--primary-dark)
      );
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
      background: var(--primary-color);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.75rem;
      color: var(--text-light);
      margin-top: 0.25rem;
    }

    .book-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.5rem;
    }

    .book-tag {
      background: var(--primary-color);
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 10px;
      font-size: 0.625rem;
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
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
    }

    .loading-state {
      text-align: center;
      padding: 4rem;
    }

    @media (max-width: 768px) {
      .books-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
      }

      .filters-bar {
        flex-direction: column;
        gap: 0.75rem;
      }

      .filter-group {
        width: 100%;
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
    console.log("LibraryPage - connected callback");
    super.connectedCallback();
    
    // Subscribe to server changes - this is the primary trigger
    this.serverUnsubscribe = serverManager.subscribe((state) => {
      const activeServerId = state.activeServerId;
      if (this.currentServerId !== activeServerId && activeServerId !== null) {
        console.log(`📚 SERVER CHANGE: from ${this.currentServerId} to ${activeServerId}`);
        console.log(`📚 SERVER CHANGE: current books before reset: ${this.books.length}`);
        
        const oldServerId = this.currentServerId;
        this.currentServerId = activeServerId;
        
        // Only reset if we actually had books or if we're switching between different servers
        if (oldServerId && oldServerId !== activeServerId) {
          console.log("📚 SERVER CHANGE: Different server detected, resetting state");
          this.resetLibraryState();
          
          // Load books with a delay to ensure everything is ready
          setTimeout(() => {
            console.log("📚 SERVER CHANGE: Attempting to load books for new server");
            this.loadBooksIfReady();
          }, 300);
        } else if (!oldServerId) {
          console.log("📚 SERVER CHANGE: Initial server setup, loading books");
          this.loadBooksIfReady();
        }
      }
    });
    
    // Set initial server ID
    const serverState = serverManager.getState();
    this.currentServerId = serverState.activeServerId;
    
    // Initial load
    this.loadBooksIfReady();
  }

  private loadBooksIfReady() {
    const appState = this.appStateService.getState();
    const activeServer = serverManager.getActiveServer();
    
    console.log(`📚 LOAD CHECK: isAuthenticated=${appState.isAuthenticated}, hasServer=${!!activeServer}, hasAuth=${!!activeServer?.auth}, hasLoaded=${this.hasLoaded}`);
    
    if (appState.isAuthenticated && activeServer?.auth && !this.hasLoaded) {
      console.log("📚 LOAD CHECK: Conditions met, loading books");
      this.loadBooks();
    } else {
      console.log("📚 LOAD CHECK: Conditions not met, skipping load");
    }
  }

  disconnectedCallback() {
    console.log("LibraryPage - disconnected callback");

    // Clear search timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Unsubscribe from server changes
    this.serverUnsubscribe?.();

    super.disconnectedCallback();
  }

  private resetLibraryState() {
    console.log(`📚 RESET: Resetting library state for server change. Current books: ${this.books.length}`);
    this.books = [];
    this.hasLoaded = false;
    this.isLoading = false;
    this.searchQuery = "";
    this.selectedGenres = [];
    this.readingStatusFilter = "all";
    console.log("📚 RESET: Library state reset complete");
  }

  public forceReloadBooks() {
    console.log("📚 Force reloading books");
    this.resetLibraryState();
    this.loadBooks();
  }

  private async loadBooks() {
    console.log(
      `📚 loadBooks called - isLoading: ${this.isLoading}, hasLoaded: ${this.hasLoaded}`
    );

    if (this.isLoading || this.hasLoaded) {
      console.log("📚 loadBooks skipped - already loading or loaded");
      return; // Prevent multiple requests
    }

    // Check if we have an authenticated server before attempting to load
    const activeServer = serverManager.getActiveServer();
    if (!activeServer) {
      console.log("📚 No active server, skipping book load");
      return;
    }

    if (!activeServer.auth) {
      console.log("📚 Server not authenticated, skipping book load");
      return;
    }

    this.isLoading = true;
    try {
      console.log("📚 Making API request via AppStateService...");
      const books = await this.appStateService.loadBooks();
      console.log(`📚 LOAD: Setting books from ${this.books.length} to ${books.length}`);
      this.books = books;
      this.hasLoaded = true;
      console.log("📚 Books loaded successfully:", books.length);

      // Debug: log structure of first book to see what's available
      if (books.length > 0) {
        console.log("📚 Sample book structure:", books[0]);
        console.log("📚 Sample book author:", books[0].author);
      }
    } catch (error) {
      console.error("📚 Failed to load books:", error);
      // Don't set hasLoaded=true on error so user can retry
      
      // If it's an authentication error, don't keep trying
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('No active server'))) {
        console.log("📚 Authentication error detected, stopping retries");
        this.hasLoaded = true; // Prevent endless retries
        this.books = []; // Clear any stale data
      }
    } finally {
      this.isLoading = false;
      console.log("📚 loadBooks finished, isLoading set to false");
    }
  }

  private handleBookClick(book: Book) {
    this.dispatchEvent(
      new CustomEvent("book-select", {
        detail: { bookId: book.id },
        bubbles: true,
      })
    );
  }

  private handleSearch(event: InputEvent) {
    const value = (event.target as HTMLInputElement).value;

    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Debounce search to avoid excessive filtering
    this.searchTimeout = window.setTimeout(() => {
      this.searchQuery = value;
      console.log("📚 Search query:", this.searchQuery);
    }, 300);
  }

  private toggleViewMode() {
    this.viewMode = this.viewMode === "grid" ? "list" : "grid";
  }

  private handleReadingStatusFilter(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.readingStatusFilter = target.value as
      | "all"
      | "not-started"
      | "in-progress"
      | "completed";
    console.log("📚 Reading status filter:", this.readingStatusFilter);
  }

  private getBookReadingStatus(
    bookId: number
  ): "not-started" | "in-progress" | "completed" {
    const progress = this.appStateService.getReadingProgress(bookId);

    if (!progress || progress.percentage_complete === 0) {
      return "not-started";
    } else if (progress.percentage_complete >= 100) {
      return "completed";
    } else {
      return "in-progress";
    }
  }

  private getFilteredBooks(): Book[] {
    let filtered = [...this.books];

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      const beforeCount = filtered.length;

      filtered = filtered.filter((book) => {
        const matchesTitle = book.name?.toLowerCase().includes(query) || false;
        const matchesAuthor =
          book.author?.name?.toLowerCase().includes(query) || false;
        const matchesGenre =
          book.genre?.some((g) => g.toLowerCase().includes(query)) || false;
        const matchesDescription =
          book.description?.toLowerCase().includes(query) || false;
        const matchesPublisher =
          book.publisher?.toLowerCase().includes(query) || false;
        const matchesIsbn = book.isbn?.toLowerCase().includes(query) || false;
        const matchesTags =
          book.tags?.some((tag) => tag.name.toLowerCase().includes(query)) ||
          false;

        return (
          matchesTitle ||
          matchesAuthor ||
          matchesGenre ||
          matchesDescription ||
          matchesPublisher ||
          matchesIsbn ||
          matchesTags
        );
      });

      console.log(
        `📚 Search "${query}": ${beforeCount} -> ${filtered.length} books`
      );
    }

    // Apply reading status filter
    if (this.readingStatusFilter !== "all") {
      const beforeStatusFilter = filtered.length;
      filtered = filtered.filter((book) => {
        const bookStatus = this.getBookReadingStatus(book.id);
        return bookStatus === this.readingStatusFilter;
      });
      console.log(
        `📚 Status filter "${this.readingStatusFilter}": ${beforeStatusFilter} -> ${filtered.length} books`
      );
    }

    // Apply genre filters
    if (this.selectedGenres.length > 0) {
      filtered = filtered.filter((book) =>
        book.genre?.some((g) => this.selectedGenres.includes(g))
      );
    }

    return filtered;
  }

  private getReadingProgress(bookId: number): number {
    const progress = this.appStateService.getReadingProgress(bookId);
    return progress?.percentage_complete || 0;
  }

  private renderBookCard(book: Book) {
    const progress = this.getReadingProgress(book.id);
    const coverUrl = getBookCoverUrl(book);
    return html`
      <div class="book-card" @click=${() => this.handleBookClick(book)}>
        <div class="book-cover">
          ${coverUrl
            ? html`<img src="${coverUrl}" alt="${book.name}" />`
            : "📖"}
        </div>

        <div class="book-info">
          <h3 class="book-title">${book.name}</h3>
          <p class="book-author">${book.author?.name || "Unknown Author"}</p>

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
            : ""}
          ${book.genre && book.genre.length > 0
            ? html`
                <div class="book-tags">
                  ${book.genre
                    .slice(0, 3)
                    .map(
                      (genre) => html` <span class="book-tag">${genre}</span> `
                    )}
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    let message =
      "Your library is empty or no books match your current filters.";
    let title = "No books found";

    if (this.readingStatusFilter === "completed") {
      title = "No completed books";
      message =
        "You haven't finished reading any books yet. Keep reading to see them here!";
    } else if (this.readingStatusFilter === "in-progress") {
      title = "No books in progress";
      message =
        "You don't have any books currently being read. Start a book to see it here!";
    } else if (this.readingStatusFilter === "not-started") {
      title = "No unread books";
      message = "All books in your library have been started or completed!";
    } else if (this.searchQuery) {
      title = "No matching books";
      message = `No books match your search for "${this.searchQuery}". Try a different search term.`;
    }

    return html`
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h2 class="empty-title">${title}</h2>
        <p>${message}</p>
      </div>
    `;
  }

  private renderLoadingState() {
    return html`
      <div class="loading-state">
        <div class="loading"></div>
        <p>Loading your library...</p>
      </div>
    `;
  }

  render() {
    const filteredBooks = this.getFilteredBooks();
    console.log(`📚 RENDER: books.length=${this.books.length}, filteredBooks.length=${filteredBooks.length}, isLoading=${this.isLoading}, hasLoaded=${this.hasLoaded}, currentServerId=${this.currentServerId}`);

    return html`
      <div class="page-header">
        <div>
          <h1 class="page-title">Your Library</h1>
          <p class="page-subtitle">
            ${filteredBooks.length} of ${this.books.length} books
            ${this.readingStatusFilter !== "all" || this.searchQuery
              ? html` <span style="color: var(--primary-color);"
                  >(filtered)</span
                >`
              : ""}
          </p>
        </div>

        <div class="header-actions">
          <div class="view-toggle">
            <button
              class="view-button ${this.viewMode === "grid" ? "active" : ""}"
              @click=${this.toggleViewMode}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              class="view-button ${this.viewMode === "list" ? "active" : ""}"
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
            placeholder="Search books, authors, genres..."
            .value=${this.searchQuery}
            @input=${this.handleSearch}
          />
        </div>

        <div class="filter-group">
          <label class="filter-label" for="readingStatusFilter"
            >Reading Status:
            <select
              class="filter-select"
              id="readingStatusFilter"
              .value=${this.readingStatusFilter}
              @change=${this.handleReadingStatusFilter}
            >
              <option value="all">All Books</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select></label
          >
        </div>

        <!-- TODO: Add genre filters, sort options, etc. -->
      </div>

      ${this.isLoading
        ? this.renderLoadingState()
        : filteredBooks.length === 0
        ? this.renderEmptyState()
        : html`
            <div
              class="${this.viewMode === "grid" ? "books-grid" : "books-list"}"
            >
              ${filteredBooks.map((book) => this.renderBookCard(book))}
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "library-page": LibraryPage;
  }
}
