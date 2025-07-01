/**
 * Profile Page Component - Placeholder
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { User } from '../../types/app.js';

@customElement('profile-page')
export class ProfilePage extends LitElement {
  @property({ type: Object })
  user: User | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
    }

    .profile-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-color);
      margin-bottom: 2rem;
    }

    .profile-card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
    }

    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--primary-color);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 600;
      margin: 0 auto 1rem;
    }

    .user-name {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.5rem;
    }

    .user-email {
      color: var(--text-light);
      margin-bottom: 1rem;
    }

    .user-roles {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-bottom: 2rem;
    }

    .role-badge {
      background: var(--primary-color);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .coming-soon {
      margin-top: 2rem;
      padding: 2rem;
      background: var(--background-color);
      border-radius: 8px;
      text-align: center;
    }

    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    h3 {
      color: var(--text-color);
      margin-bottom: 1rem;
    }

    p {
      color: var(--text-light);
      line-height: 1.6;
    }

    ul {
      text-align: left;
      margin: 1rem 0;
      color: var(--text-light);
    }
  `;

  private getUserInitials(): string {
    if (!this.user) return '?';
    const names = this.user.displayName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return this.user.displayName.substring(0, 2).toUpperCase();
  }

  render() {
    if (!this.user) {
      return html`
        <div class="profile-container">
          <h1 class="page-title">Profile</h1>
          <div class="profile-card">
            <p>Loading profile...</p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="profile-container">
        <h1 class="page-title">Profile</h1>
        
        <div class="profile-card">
          <div class="avatar">${this.getUserInitials()}</div>
          <h2 class="user-name">${this.user.displayName}</h2>
          <p class="user-email">${this.user.email}</p>
          
          <div class="user-roles">
            ${this.user.roles.map(role => html`
              <span class="role-badge">${role}</span>
            `)}
          </div>
        </div>

        <div class="coming-soon">
          <div class="icon">⚙️</div>
          <h3>Profile Management Coming Soon</h3>
          <p>
            Profile editing and user preferences will be available in a future update. 
            This will include:
          </p>
          <ul>
            <li>Edit display name and email</li>
            <li>Change password</li>
            <li>Reading preferences and filters</li>
            <li>Theme and display settings</li>
            <li>Privacy and notification settings</li>
            <li>Reading statistics and achievements</li>
          </ul>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'profile-page': ProfilePage;
  }
}