/**
 * Reader Controls Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface ControlsState {
  isPlaying: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  currentPage: number;
  totalPages: number;
  percentage: number;
}

@customElement('reader-controls')
export class ReaderControls extends LitElement {
  @property({ type: Object })
  state: ControlsState = {
    isPlaying: false,
    canGoBack: true,
    canGoForward: true,
    currentPage: 1,
    totalPages: 100,
    percentage: 0
  };

  @property({ type: Boolean })
  visible = true;

  @state()
  private showPageInput = false;

  @state()
  private pageInputValue = '';

  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      transition: transform 0.3s ease;
      z-index: 100;
    }

    :host([hidden]) {
      transform: translateY(100%);
    }

    .controls-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .controls-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .control-button {
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      padding: 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      min-width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .control-button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
    }

    .control-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .progress-container {
      flex: 1;
      margin: 0 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .progress-bar {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      position: relative;
      cursor: pointer;
    }

    .progress-fill {
      height: 100%;
      background: white;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .progress-handle {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 16px;
      height: 16px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .progress-handle:hover {
      transform: translate(-50%, -50%) scale(1.2);
    }

    .page-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .page-input {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: white;
      padding: 0.25rem 0.5rem;
      font-size: 0.9rem;
      width: 60px;
      text-align: center;
    }

    .page-input:focus {
      outline: none;
      border-color: white;
      background: rgba(255, 255, 255, 0.2);
    }

    .percentage {
      font-size: 0.8rem;
      opacity: 0.8;
      min-width: 40px;
      text-align: right;
    }

    .auto-hide {
      animation: fadeOut 0.5s ease 3s forwards;
    }

    @keyframes fadeOut {
      to {
        opacity: 0;
        pointer-events: none;
      }
    }

    @media (max-width: 768px) {
      .controls-container {
        padding: 0.75rem;
      }

      .progress-container {
        margin: 0 1rem;
      }

      .control-button {
        font-size: 1.3rem;
        min-width: 44px;
        height: 44px;
      }

      .page-info {
        font-size: 0.8rem;
      }
    }

    @media (max-width: 480px) {
      .page-info .page-text {
        display: none;
      }
    }
  `;

  private handlePrevious() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { direction: 'previous' }
    }));
  }

  private handleNext() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { direction: 'next' }
    }));
  }

  private handleProgressClick(event: MouseEvent) {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    
    this.dispatchEvent(new CustomEvent('seek', {
      detail: { percentage: Math.max(0, Math.min(100, percentage)) }
    }));
  }

  private handlePageClick() {
    this.showPageInput = true;
    this.pageInputValue = this.state.currentPage.toString();
    
    // Focus the input after it's rendered
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector('.page-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  private handlePageInputKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.handlePageInputSubmit();
    } else if (event.key === 'Escape') {
      this.showPageInput = false;
    }
  }

  private handlePageInputBlur() {
    this.showPageInput = false;
  }

  private handlePageInputSubmit() {
    const page = parseInt(this.pageInputValue);
    if (!isNaN(page) && page >= 1 && page <= this.state.totalPages) {
      this.dispatchEvent(new CustomEvent('go-to-page', {
        detail: { page }
      }));
    }
    this.showPageInput = false;
  }

  private handlePageInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.pageInputValue = target.value;
  }

  render() {
    const progressWidth = Math.max(0, Math.min(100, this.state.percentage));
    const handlePosition = progressWidth;

    return html`
      <div class="controls-container">
        <div class="controls-group">
          <button 
            class="control-button"
            @click=${this.handlePrevious}
            ?disabled=${!this.state.canGoBack}
            title="Previous page"
          >
            ‹
          </button>
        </div>

        <div class="progress-container">
          <div class="page-info">
            ${this.showPageInput ? html`
              <input
                type="number"
                class="page-input"
                min="1"
                max="${this.state.totalPages}"
                .value=${this.pageInputValue}
                @input=${this.handlePageInputChange}
                @keydown=${this.handlePageInputKeyDown}
                @blur=${this.handlePageInputBlur}
              />
            ` : html`
              <span @click=${this.handlePageClick} style="cursor: pointer;">
                ${this.state.currentPage}
              </span>
            `}
            <span class="page-text">of ${this.state.totalPages}</span>
            <span class="percentage">${Math.round(progressWidth)}%</span>
          </div>

          <div class="progress-bar" @click=${this.handleProgressClick}>
            <div 
              class="progress-fill" 
              style="width: ${progressWidth}%"
            ></div>
            <div 
              class="progress-handle" 
              style="left: ${handlePosition}%"
            ></div>
          </div>
        </div>

        <div class="controls-group">
          <button 
            class="control-button"
            @click=${this.handleNext}
            ?disabled=${!this.state.canGoForward}
            title="Next page"
          >
            ›
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reader-controls': ReaderControls;
  }
}