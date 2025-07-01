/**
 * Admin Page Component - Placeholder
 */

import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('admin-page')
export class AdminPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
    }

    .admin-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-color);
      margin-bottom: 2rem;
    }

    .admin-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }

    .admin-card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
    }

    .card-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 1rem;
    }

    .card-description {
      color: var(--text-light);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .coming-soon-badge {
      background: var(--warning-color);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .features-section {
      background: var(--background-color);
      border-radius: 8px;
      padding: 2rem;
    }

    .features-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 1rem;
      text-align: center;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface-color);
      border-radius: 8px;
    }

    .feature-icon {
      font-size: 1.5rem;
      margin-top: 0.25rem;
    }

    .feature-content h4 {
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.5rem;
    }

    .feature-content p {
      color: var(--text-light);
      font-size: 0.9rem;
      line-height: 1.4;
    }
  `;

  render() {
    return html`
      <div class="admin-container">
        <h1 class="page-title">🛠️ Admin Dashboard</h1>
        
        <div class="admin-grid">
          <div class="admin-card">
            <div class="card-icon">👥</div>
            <h2 class="card-title">User Management</h2>
            <p class="card-description">
              Manage user accounts, roles, and permissions for your Dust server.
            </p>
            <span class="coming-soon-badge">Coming Soon</span>
          </div>

          <div class="admin-card">
            <div class="card-icon">📚</div>
            <h2 class="card-title">Library Management</h2>
            <p class="card-description">
              Manage your book collection, scan for new books, and organize your library.
            </p>
            <span class="coming-soon-badge">Coming Soon</span>
          </div>

          <div class="admin-card">
            <div class="card-icon">📊</div>
            <h2 class="card-title">Analytics</h2>
            <p class="card-description">
              View reading statistics, user activity, and system performance metrics.
            </p>
            <span class="coming-soon-badge">Coming Soon</span>
          </div>

          <div class="admin-card">
            <div class="card-icon">⚙️</div>
            <h2 class="card-title">System Settings</h2>
            <p class="card-description">
              Configure server settings, authentication, and system preferences.
            </p>
            <span class="coming-soon-badge">Coming Soon</span>
          </div>
        </div>

        <div class="features-section">
          <h2 class="features-title">Planned Admin Features</h2>
          
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">👤</div>
              <div class="feature-content">
                <h4>User Administration</h4>
                <p>Create, edit, and manage user accounts with role-based permissions</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">🔐</div>
              <div class="feature-content">
                <h4>Role Management</h4>
                <p>Configure custom roles and permissions for fine-grained access control</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">📁</div>
              <div class="feature-content">
                <h4>Library Scanning</h4>
                <p>Trigger manual library scans and manage book metadata</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">🏷️</div>
              <div class="feature-content">
                <h4>Tag Management</h4>
                <p>Create and manage tags for content organization and filtering</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">📈</div>
              <div class="feature-content">
                <h4>Usage Analytics</h4>
                <p>Monitor reading activity, popular books, and user engagement</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">🔧</div>
              <div class="feature-content">
                <h4>System Health</h4>
                <p>Monitor server performance, storage usage, and system logs</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">🔄</div>
              <div class="feature-content">
                <h4>Backup & Sync</h4>
                <p>Configure automated backups and synchronization settings</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">📧</div>
              <div class="feature-content">
                <h4>Notifications</h4>
                <p>Manage email notifications and system alerts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-page': AdminPage;
  }
}