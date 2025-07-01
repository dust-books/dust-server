/**
 * Application Header Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';
import type { User } from '../../types/app.js';

@customElement('app-header')
export class AppHeader extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @property({ type: String })
  currentPage = '';

  @property({ type: Object })
  user: User | null = null;

  static styles = css`
    :host {
      display: block;
      background: var(--surface-color);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      height: 60px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--primary-color);
      text-decoration: none;
      cursor: pointer;
    }

    .search-container {
      flex: 1;
      max-width: 500px;
      margin: 0 2rem;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: var(--background-color);
      color: var(--text-color);
      font-size: 0.9rem;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .theme-toggle {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 6px;
      color: var(--text-color);
      font-size: 1.2rem;
    }

    .theme-toggle:hover {
      background: var(--border-color);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--primary-color);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      cursor: pointer;
    }

    .logout-button {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-color);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .logout-button:hover {
      background: var(--border-color);
    }

    @media (max-width: 768px) {
      .search-container {
        display: none;
      }
      
      .header {
        padding: 0 0.5rem;
      }
    }
  `;

  private handleLogoClick() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'library' }
    }));
  }

  private handleProfileClick() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'profile' }
    }));
  }

  private async handleLogout() {
    await this.appStateService.logout();
  }

  private toggleTheme() {
    const currentTheme = this.appStateService.getState().theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.appStateService.setTheme(newTheme);
  }

  private getThemeIcon() {
    const theme = this.appStateService.getState().theme;
    return theme === 'light' ? '🌙' : '☀️';
  }

  private getUserInitials(): string {
    if (!this.user) return '?';
    const names = this.user.displayName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return this.user.displayName.substring(0, 2).toUpperCase();
  }

  render() {
    return html`
      <header class="header">
        <div class="logo" @click=${this.handleLogoClick}>
          <span>📚</span>
          <span>Dust</span>
        </div>

        <div class="search-container">
          <input
            type="text"
            class="search-input"
            placeholder="Search books, authors, genres..."
            @input=${(e: InputEvent) => {
              // TODO: Implement search
              console.log('Search:', (e.target as HTMLInputElement).value);
            }}
          />
        </div>

        <div class="user-menu">
          <button class="theme-toggle" @click=${this.toggleTheme} title="Toggle theme">
            ${this.getThemeIcon()}
          </button>

          <div class="user-avatar" @click=${this.handleProfileClick} title=${this.user?.display_name || 'Profile'}>
            ${this.getUserInitials()}
          </div>

          <button class="logout-button" @click=${this.handleLogout}>
            Logout
          </button>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-header': AppHeader;
  }
}