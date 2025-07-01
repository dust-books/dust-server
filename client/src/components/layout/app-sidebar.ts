/**
 * Application Sidebar Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { User } from '../../types/app.js';

@customElement('app-sidebar')
export class AppSidebar extends LitElement {
  @property({ type: String })
  currentPage = '';

  @property({ type: Object })
  user: User | null = null;

  static styles = css`
    :host {
      display: block;
      width: 250px;
      background: var(--surface-color);
      border-right: 1px solid var(--border-color);
      overflow-y: auto;
    }

    .sidebar {
      padding: 1rem 0;
    }

    .nav-section {
      margin-bottom: 2rem;
    }

    .nav-title {
      padding: 0 1rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-light);
      letter-spacing: 0.05em;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      color: var(--text-color);
      text-decoration: none;
      cursor: pointer;
      transition: background-color 0.2s ease;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      font-size: 0.9rem;
    }

    .nav-item:hover {
      background: var(--border-color);
    }

    .nav-item.active {
      background: var(--primary-color);
      color: white;
    }

    .nav-icon {
      font-size: 1.1rem;
      width: 20px;
      text-align: center;
    }

    .reading-stats {
      padding: 1rem;
      background: var(--background-color);
      margin: 0 1rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .stats-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.25rem 0;
      font-size: 0.8rem;
      color: var(--text-light);
    }

    .stat-value {
      font-weight: 500;
      color: var(--primary-color);
    }

    @media (max-width: 768px) {
      :host {
        position: fixed;
        left: -250px;
        top: 60px;
        height: calc(100vh - 60px);
        z-index: 90;
        transition: left 0.3s ease;
      }

      :host([open]) {
        left: 0;
      }
    }
  `;

  private handleNavigation(page: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { page }
    }));
  }

  private isUserAdmin(): boolean {
    return this.user?.permissions?.includes('admin.full') || 
           this.user?.roles?.includes('admin') || false;
  }

  render() {
    return html`
      <nav class="sidebar">
        <div class="nav-section">
          <div class="nav-title">Library</div>
          
          <button 
            class="nav-item ${this.currentPage === 'library' ? 'active' : ''}"
            @click=${() => this.handleNavigation('library')}
          >
            <span class="nav-icon">📚</span>
            <span>All Books</span>
          </button>

          <button 
            class="nav-item ${this.currentPage === 'reading' ? 'active' : ''}"
            @click=${() => this.handleNavigation('reading')}
          >
            <span class="nav-icon">📖</span>
            <span>Currently Reading</span>
          </button>

          <button 
            class="nav-item ${this.currentPage === 'completed' ? 'active' : ''}"
            @click=${() => this.handleNavigation('completed')}
          >
            <span class="nav-icon">✅</span>
            <span>Completed</span>
          </button>

          <button 
            class="nav-item ${this.currentPage === 'wishlist' ? 'active' : ''}"
            @click=${() => this.handleNavigation('wishlist')}
          >
            <span class="nav-icon">⭐</span>
            <span>Wishlist</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-title">Discover</div>
          
          <button 
            class="nav-item ${this.currentPage === 'genres' ? 'active' : ''}"
            @click=${() => this.handleNavigation('genres')}
          >
            <span class="nav-icon">🏷️</span>
            <span>Browse Genres</span>
          </button>

          <button 
            class="nav-item ${this.currentPage === 'authors' ? 'active' : ''}"
            @click=${() => this.handleNavigation('authors')}
          >
            <span class="nav-icon">✍️</span>
            <span>Authors</span>
          </button>

          <button 
            class="nav-item ${this.currentPage === 'series' ? 'active' : ''}"
            @click=${() => this.handleNavigation('series')}
          >
            <span class="nav-icon">📔</span>
            <span>Series</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-title">Account</div>
          
          <button 
            class="nav-item ${this.currentPage === 'profile' ? 'active' : ''}"
            @click=${() => this.handleNavigation('profile')}
          >
            <span class="nav-icon">👤</span>
            <span>Profile</span>
          </button>

          <button 
            class="nav-item ${this.currentPage === 'settings' ? 'active' : ''}"
            @click=${() => this.handleNavigation('settings')}
          >
            <span class="nav-icon">⚙️</span>
            <span>Settings</span>
          </button>

          ${this.isUserAdmin() ? html`
            <button 
              class="nav-item ${this.currentPage === 'admin' ? 'active' : ''}"
              @click=${() => this.handleNavigation('admin')}
            >
              <span class="nav-icon">🛠️</span>
              <span>Admin</span>
            </button>
          ` : ''}
        </div>

        <div class="reading-stats">
          <div class="stats-title">Your Reading</div>
          <div class="stat-item">
            <span>Books Read</span>
            <span class="stat-value">12</span>
          </div>
          <div class="stat-item">
            <span>Pages Read</span>
            <span class="stat-value">2,847</span>
          </div>
          <div class="stat-item">
            <span>Reading Streak</span>
            <span class="stat-value">5 days</span>
          </div>
          <div class="stat-item">
            <span>In Progress</span>
            <span class="stat-value">3</span>
          </div>
        </div>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-sidebar': AppSidebar;
  }
}