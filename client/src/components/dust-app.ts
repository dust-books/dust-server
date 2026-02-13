/**
 * Main Application Component
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";

import { appStateContext, AppStateService } from "../services/app-state.js";
import type { AppState } from "../types/app.js";
import { serverManager } from "../services/server-manager.js";

// Import child components
import "./auth/login-form.js";
import "./layout/app-header.js";
import "./layout/app-sidebar.js";
import "./layout/toast-container.js";
import "./pages/library-page.js";
import "./pages/reader-page.js";
import "./pages/profile-page.js";
import "./pages/admin-page.js";
import "./pages/admin-sub-pages/admin-users-page.js";
import "./pages/admin-sub-pages/admin-settings-page.js";
import "./pages/authors-page.js";
import "./pages/author-detail-page.js";
import "./pages/genres-page.js";
import "./pages/genre-detail-page.js";
import "./pages/currently-reading-page.js";
import "./pages/completed-reading-page.js";
import "./pages/series-page.js";
import "./pages/connect-server-page.js";

@customElement("dust-app")
export class DustApp extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  @property({ attribute: false })
  appStateService!: AppStateService;

  @state()
  private appState!: AppState;

  @state()
  private currentPage = "library";

  @state()
  private currentAuthorId: number | null = null;

  @state()
  private currentGenreId: number | null = null;

  private unsubscribe?: () => void;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background-color: var(--background-color);
      color: var(--text-color);
    }

    .app-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .main-content {
      flex: 1;
      padding: 1rem;
    }

    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(
        135deg,
        var(--primary-color),
        var(--primary-dark)
      );
    }

    .login-wrapper {
      background: var(--background-color);
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      max-width: 600px;
      width: 100%;
    }

    .logo {
      text-align: center;
    }

    .logo h1 {
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary-color);
      margin: 0;
    }

    .logo p {
      color: var(--text-light);
      margin: 0.5rem 0 0;
    }

    /* Reader fullscreen mode */
    :host([fullscreen]) {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
    }

    :host([fullscreen]) .app-container {
      height: 100vh;
    }

    :host([fullscreen]) app-header,
    :host([fullscreen]) app-sidebar {
      display: none;
    }

    @media (max-width: 768px) {
      .main-content {
        padding: 0.5rem;
      }
    }
  `;

  constructor() {
    super();
    this.handleNavigation = this.handleNavigation.bind(this);
    this.handleBookSelect = this.handleBookSelect.bind(this);
    this.handleAuthorSelect = this.handleAuthorSelect.bind(this);
    this.handleGenreSelect = this.handleGenreSelect.bind(this);
  }

  connectedCallback() {
    console.log("DustApp - connected callback");
    super.connectedCallback();
    
    // Initialize app state from service
    this.appState = this.appStateService.getState();
    
    // Subscribe to state changes
    this.unsubscribe = this.appStateService.subscribe(() => {
      this.appState = this.appStateService.getState();
      this.requestUpdate();
    });
    
    window.addEventListener("popstate", this.handleNavigation);
    window.addEventListener("hashchange", this.handleNavigation);
    this.handleNavigation();
    
    // Initialize server connection
    serverManager.getActiveServer();
  }

  disconnectedCallback() {
    console.log("DustApp - disconnected callback");
    super.disconnectedCallback();
    this.unsubscribe?.();
    window.removeEventListener("popstate", this.handleNavigation);
    window.removeEventListener("hashchange", this.handleNavigation);
  }

  private handleNavigation() {
    // Use hash for routing (GitHub Pages compatible)
    const hash = window.location.hash.slice(1); // Remove the '#'
    
    // If no hash, set default route
    if (!hash) {
      window.location.hash = "#library";
      return;
    }
    
    const segments = hash.split("/").filter((s) => s);
    const page = segments[0] || "library";

    this.currentPage = page;

    // Handle author detail routing
    if (page === "authors" && segments.length > 1) {
      const authorId = parseInt(segments[1], 10);
      if (!isNaN(authorId)) {
        this.currentPage = "author-detail";
        this.currentAuthorId = authorId;
      }
    } else {
      this.currentAuthorId = null;
    }

    // Handle genre detail routing
    if (page === "genres" && segments.length > 1) {
      const genreId = parseInt(segments[1], 10);
      if (!isNaN(genreId)) {
        this.currentPage = "genre-detail";
        this.currentGenreId = genreId;
      }
    } else {
      this.currentGenreId = null;
    }
  }

  private navigateTo(page: string) {
    this.currentPage = page;
    window.location.hash = `#${page}`;
  }

  private handleBookSelect(event: CustomEvent) {
    const bookId = event.detail.bookId;
    this.currentPage = "reader";
    this.appStateService.selectBook(bookId);
    window.location.hash = `#reader/${bookId}`;
  }

  private handleAuthorSelect(event: CustomEvent) {
    const { authorId } = event.detail;
    this.currentPage = "author-detail";
    this.currentAuthorId = authorId;
    window.location.hash = `#authors/${authorId}`;
  }

  private handleGenreSelect(event: CustomEvent) {
    const { genreId } = event.detail;
    this.currentPage = "genre-detail";
    this.currentGenreId = genreId;
    window.location.hash = `#genres/${genreId}`;
  }

  private handleServerChange(event: CustomEvent) {
    console.log('Server changed:', event.detail.server);
    
    // Server changed - trigger re-render via app state refresh
    
    // Refresh the app state to load data from the new server
    this.appStateService.refreshAfterServerChange();
    
    // Navigate to library page to show new server's content
    this.navigateTo('library');
  }

  private renderAuthenticatedApp() {
    return html`
      <app-header
        .currentPage=${this.currentPage}
        .user=${this.appState.user}
        @navigate=${(e: CustomEvent) => this.navigateTo(e.detail.page)}
      ></app-header>

      <div class="app-container">
        <app-sidebar
          .currentPage=${this.currentPage}
          .user=${this.appState.user}
          @navigate=${(e: CustomEvent) => this.navigateTo(e.detail.page)}
          @server-changed=${this.handleServerChange}
        ></app-sidebar>

        <main
          class="main-content"
          @book-select=${this.handleBookSelect}
          @author-select=${this.handleAuthorSelect}
          @genre-select=${this.handleGenreSelect}
          @navigate-back=${(_e: CustomEvent) => {
            // Navigate back based on current context
            if (this.currentPage === "author-detail") {
              this.navigateTo("authors");
            } else if (this.currentPage === "genre-detail") {
              this.navigateTo("genres");
            }
          }}
        >
          ${this.renderCurrentPage()}
        </main>
      </div>

      <toast-container></toast-container>
    `;
  }

  private renderCurrentPage() {
    switch (this.currentPage) {
      case "library":
        return html`
          <library-page
            @book-select=${this.handleBookSelect}
          ></library-page>
        `;

      case "reader":
        return html`
          <reader-page
            .book=${this.appState.currentBook}
            .progress=${this.appState.currentBook
              ? this.appStateService.getReadingProgress(
                  this.appState.currentBook.id
                )
              : null}
            @exit-reader=${() => this.navigateTo("library")}
          ></reader-page>
        `;

      case "profile":
        return html`
          <profile-page .user=${this.appState.user}></profile-page>
        `;

      case "admin":
        return this.appStateService.isAdmin()
          ? html` <admin-page @navigate=${(e: CustomEvent) => this.navigateTo(e.detail.page)}></admin-page> `
          : html`
              <div style="text-align: center; padding: 2rem;">
                <h2>Access Denied</h2>
                <p>You don't have permission to view this page.</p>
              </div>
            `;

      case "admin-users":
        return this.appStateService.isAdmin()
          ? html` <admin-users-page @navigate=${(e: CustomEvent) => this.navigateTo(e.detail.page)}></admin-users-page> `
          : html`
              <div style="text-align: center; padding: 2rem;">
                <h2>Access Denied</h2>
                <p>You don't have permission to view this page.</p>
              </div>
            `;

      case "admin-settings":
        return this.appStateService.isAdmin()
          ? html` <admin-settings-page @navigate=${(e: CustomEvent) => this.navigateTo(e.detail.page)}></admin-settings-page> `
          : html`
              <div style="text-align: center; padding: 2rem;">
                <h2>Access Denied</h2>
                <p>You don't have permission to view this page.</p>
              </div>
            `;

      case "authors":
        return html` <authors-page></authors-page> `;

      case "author-detail":
        return html`
          <author-detail-page
            .authorId=${this.currentAuthorId}
          ></author-detail-page>
        `;

      case "genres":
        return html` <genres-page></genres-page> `;

      case "genre-detail":
        return html`
          <genre-detail-page
            .genreId=${this.currentGenreId}
          ></genre-detail-page>
        `;

      case "reading":
        return html` <currently-reading-page></currently-reading-page> `;

      case "completed":
        return html` <completed-reading-page></completed-reading-page> `;

      case "series":
        return html` <series-page></series-page> `;

      case "connect-server":
        return html` <connect-server-page></connect-server-page> `;

      default:
        return html`
          <div style="text-align: center; padding: 2rem;">
            <h2>Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <button
              @click=${() => this.navigateTo("library")}
              style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Go to Library
            </button>
          </div>
        `;
    }
  }

  private renderLoginScreen() {
    return html`
      <div class="login-container">
        <div class="login-wrapper">
          <div class="logo">
            <h1>📚 Dust</h1>
            <p>Your Personal Library</p>
          </div>
          <login-form 
            @navigate=${(e: CustomEvent) => this.navigateTo(e.detail.page)}
          ></login-form>
        </div>
      </div>
    `;
  }

  private renderConnectServerScreen() {
    return html`
      <div class="login-container">
        <div class="login-wrapper">
          <div class="logo">
            <h1>📚 Dust</h1>
            <p>Your Personal Library</p>
          </div>
          <connect-server-page 
            @navigate=${(e: CustomEvent) => this.navigateTo(e.detail.page)}
          ></connect-server-page>
        </div>
      </div>
    `;
  }

  render() {
    if (this.appState.isLoading) {
      return html`
        <div
          style="display: flex; justify-content: center; align-items: center; height: 100vh;"
        >
          <div class="loading"></div>
          <span style="margin-left: 10px;">Loading...</span>
        </div>
      `;
    }

    // Check if we're on the connect-server page
    if (this.currentPage === 'connect-server') {
      return this.renderConnectServerScreen();
    }

    // Check if any servers are configured
    const servers = serverManager.getServers();
    if (servers.length === 0) {
      return this.renderConnectServerScreen();
    }

    // We have servers but user is not authenticated with any
    if (!this.appState.isAuthenticated) {
      return this.renderLoginScreen();
    }

    return this.renderAuthenticatedApp();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dust-app": DustApp;
  }
}
