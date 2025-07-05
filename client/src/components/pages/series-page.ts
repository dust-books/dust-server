/**
 * Series Page Component - Coming Soon placeholder
 */

import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('series-page')
export class SeriesPage extends LitElement {
  // Removed unused state variable

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-color);
      margin: 0 0 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .page-subtitle {
      color: var(--text-light);
      margin: 0;
      font-size: 1rem;
    }

    .coming-soon-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      background: var(--surface-color);
      border-radius: 12px;
      border: 2px dashed var(--border-color);
      text-align: center;
      padding: 3rem 2rem;
    }

    .coming-soon-icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      opacity: 0.7;
    }

    .coming-soon-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0 0 1rem 0;
    }

    .coming-soon-description {
      color: var(--text-light);
      font-size: 1rem;
      line-height: 1.5;
      max-width: 500px;
      margin: 0 0 2rem 0;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0 0 2rem 0;
      display: grid;
      gap: 0.75rem;
      max-width: 400px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: var(--text-light);
      padding: 0.5rem 0;
    }

    .feature-icon {
      font-size: 1.2rem;
      color: var(--primary-color);
      width: 20px;
      text-align: center;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 500;
      padding: 0.75rem 1.25rem;
      border: 1px solid var(--primary-color);
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .back-link:hover {
      background: var(--primary-color);
      color: white;
    }


    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }

      .coming-soon-container {
        padding: 2rem 1rem;
        min-height: 300px;
      }

      .coming-soon-icon {
        font-size: 3rem;
      }

      .coming-soon-title {
        font-size: 1.25rem;
      }

    }
  `;

  private handleBackToLibrary() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'library' }
    }));
  }


  render() {
    return html`
      <div class="page-header">
        <h1 class="page-title">
          <span>📔</span>
          Book Series
        </h1>
        <p class="page-subtitle">Discover and track your favorite book series</p>
      </div>

      <div class="coming-soon-container">
        <div class="coming-soon-icon">🚧</div>
        
        <h2 class="coming-soon-title">Coming Soon!</h2>
        
        <p class="coming-soon-description">
          We're working hard to bring you an amazing series tracking experience. 
          Soon you'll be able to discover, organize, and track your progress 
          through your favorite book series.
        </p>

        <ul class="feature-list">
          <li class="feature-item">
            <span class="feature-icon">📊</span>
            <span>Track reading progress across entire series</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">🔍</span>
            <span>Auto-detect series from book metadata</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">📅</span>
            <span>Get notified of new releases</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">⭐</span>
            <span>Rate and review entire series</span>
          </li>
          <li class="feature-item">
            <span class="feature-icon">📖</span>
            <span>Reading order recommendations</span>
          </li>
        </ul>

        <a href="#library" class="back-link" @click=${(e: Event) => {
          e.preventDefault();
          this.handleBackToLibrary();
        }}>
          <span>←</span>
          <span>Back to Library</span>
        </a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'series-page': SeriesPage;
  }
}