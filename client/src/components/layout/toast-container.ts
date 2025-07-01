/**
 * Toast Notification Container Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';
import type { Toast } from '../../types/app.js';

@customElement('toast-container')
export class ToastContainer extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  appStateService!: AppStateService;

  @state()
  private toasts: Toast[] = [];

  static styles = css`
    :host {
      position: fixed;
      top: 80px;
      right: 1rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    }

    .toast {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      min-width: 300px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      pointer-events: auto;
      transform: translateX(100%);
      animation: slideIn 0.3s ease forwards;
    }

    .toast.success {
      border-left: 4px solid var(--success-color);
    }

    .toast.error {
      border-left: 4px solid var(--error-color);
    }

    .toast.warning {
      border-left: 4px solid var(--warning-color);
    }

    .toast.info {
      border-left: 4px solid var(--primary-color);
    }

    .toast-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .toast-icon {
      margin-right: 0.5rem;
      font-size: 1.2rem;
    }

    .toast-title {
      font-weight: 600;
      color: var(--text-color);
      flex: 1;
    }

    .toast-close {
      background: none;
      border: none;
      color: var(--text-light);
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .toast-close:hover {
      background: var(--border-color);
      color: var(--text-color);
    }

    .toast-message {
      color: var(--text-light);
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .toast-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .toast-action {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 0.375rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
    }

    .toast-action:hover {
      background: var(--primary-dark);
    }

    @keyframes slideIn {
      to {
        transform: translateX(0);
      }
    }

    .toast.removing {
      animation: slideOut 0.3s ease forwards;
    }

    @keyframes slideOut {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    @media (max-width: 768px) {
      :host {
        top: 70px;
        right: 0.5rem;
        left: 0.5rem;
      }

      .toast {
        min-width: auto;
        max-width: none;
      }
    }
  `;

  connectedCallback() {
    console.log("ToastContainer - connected callback");
    super.connectedCallback();
    this.updateToasts();
  }

  private updateToasts() {
    this.toasts = this.appStateService.getToasts();
  }

  private getToastIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📄';
    }
  }

  private handleClose(toastId: string) {
    // Add removing class for animation
    const toastElement = this.shadowRoot?.querySelector(`[data-toast-id="${toastId}"]`);
    if (toastElement) {
      toastElement.classList.add('removing');
      setTimeout(() => {
        this.appStateService.removeToast(toastId);
        this.updateToasts();
      }, 300);
    }
  }

  private handleAction(action: () => void, toastId: string) {
    action();
    this.handleClose(toastId);
  }

  render() {
    return html`
      ${this.toasts.map(toast => html`
        <div 
          class="toast ${toast.type}" 
          data-toast-id=${toast.id}
        >
          <div class="toast-header">
            <div style="display: flex; align-items: center;">
              <span class="toast-icon">${this.getToastIcon(toast.type)}</span>
              <div class="toast-title">${toast.title}</div>
            </div>
            <button 
              class="toast-close" 
              @click=${() => this.handleClose(toast.id)}
              title="Close"
            >
              ×
            </button>
          </div>
          
          ${toast.message ? html`
            <div class="toast-message">${toast.message}</div>
          ` : ''}

          ${toast.actions && toast.actions.length > 0 ? html`
            <div class="toast-actions">
              ${toast.actions.map(action => html`
                <button 
                  class="toast-action"
                  @click=${() => this.handleAction(action.action, toast.id)}
                >
                  ${action.label}
                </button>
              `)}
            </div>
          ` : ''}
        </div>
      `)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-container': ToastContainer;
  }
}