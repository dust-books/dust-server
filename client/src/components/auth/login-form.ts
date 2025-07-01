/**
 * Login Form Component
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { appStateContext, AppStateService } from '../../services/app-state.js';

@customElement('login-form')
export class LoginForm extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @state()
  private isLogin = true;

  @state()
  private isLoading = false;

  @state()
  private formData = {
    email: '',
    password: '',
    username: '',
    display_name: ''
  };

  @state()
  private errors: Record<string, string> = {};

  static styles = css`
    :host {
      display: block;
    }

    .form-container {
      width: 100%;
    }

    .form-tabs {
      display: flex;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid var(--border-color);
    }

    .tab-button {
      flex: 1;
      padding: 0.75rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-size: 1rem;
      color: var(--text-light);
      transition: all 0.2s ease;
    }

    .tab-button.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }

    .tab-button:hover {
      color: var(--text-color);
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .form-input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid var(--border-color);
      border-radius: 6px;
      font-size: 1rem;
      background: var(--background-color);
      color: var(--text-color);
      transition: border-color 0.2s ease;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    .form-input.error {
      border-color: var(--error-color);
    }

    .form-error {
      color: var(--error-color);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .submit-button {
      width: 100%;
      padding: 0.75rem;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .submit-button:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .submit-button:disabled {
      background: var(--text-light);
      cursor: not-allowed;
    }

    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .form-footer {
      text-align: center;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      color: var(--text-light);
      font-size: 0.875rem;
    }
  `;

  private handleTabSwitch(isLogin: boolean) {
    this.isLogin = isLogin;
    this.errors = {};
    this.formData = {
      email: '',
      password: '',
      username: '',
      display_name: ''
    };
  }

  private handleInputChange(field: string, value: string) {
    this.formData = { ...this.formData, [field]: value };
    // Clear error when user starts typing
    if (this.errors[field]) {
      this.errors = { ...this.errors, [field]: '' };
    }
  }

  private validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!this.formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!this.formData.password) {
      errors.password = 'Password is required';
    } else if (!this.isLogin && this.formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!this.isLogin) {
      if (!this.formData.username) {
        errors.username = 'Username is required';
      } else if (this.formData.username.length < 3) {
        errors.username = 'Username must be at least 3 characters';
      }

      if (!this.formData.display_name) {
        errors.display_name = 'Display name is required';
      }
    }

    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  private async handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;

    try {
      if (this.isLogin) {
        await this.appStateService.login(this.formData.email, this.formData.password);
      } else {
        await this.appStateService.register({
          username: this.formData.username,
          email: this.formData.email,
          password: this.formData.password,
          display_name: this.formData.display_name
        });
        // Switch to login after successful registration
        this.handleTabSwitch(true);
      }
    } catch (error) {
      // Error handling is done in the app state service
      console.error('Authentication error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  render() {
    return html`
      <div class="form-container">
        <div class="form-tabs">
          <button 
            class="tab-button ${this.isLogin ? 'active' : ''}"
            @click=${() => this.handleTabSwitch(true)}
          >
            Login
          </button>
          <button 
            class="tab-button ${!this.isLogin ? 'active' : ''}"
            @click=${() => this.handleTabSwitch(false)}
          >
            Register
          </button>
        </div>

        <form @submit=${this.handleSubmit}>
          ${!this.isLogin ? html`
            <div class="form-group">
              <label class="form-label" for="username">Username</label>
              <input
                type="text"
                id="username"
                class="form-input ${this.errors.username ? 'error' : ''}"
                .value=${this.formData.username}
                @input=${(e: InputEvent) => this.handleInputChange('username', (e.target as HTMLInputElement).value)}
                placeholder="Enter your username"
                ?disabled=${this.isLoading}
              />
              ${this.errors.username ? html`<div class="form-error">${this.errors.username}</div>` : ''}
            </div>

            <div class="form-group">
              <label class="form-label" for="display_name">Display Name</label>
              <input
                type="text"
                id="display_name"
                class="form-input ${this.errors.display_name ? 'error' : ''}"
                .value=${this.formData.display_name}
                @input=${(e: InputEvent) => this.handleInputChange('display_name', (e.target as HTMLInputElement).value)}
                placeholder="Enter your display name"
                ?disabled=${this.isLoading}
              />
              ${this.errors.display_name ? html`<div class="form-error">${this.errors.display_name}</div>` : ''}
            </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input
              type="email"
              id="email"
              class="form-input ${this.errors.email ? 'error' : ''}"
              .value=${this.formData.email}
              @input=${(e: InputEvent) => this.handleInputChange('email', (e.target as HTMLInputElement).value)}
              placeholder="Enter your email"
              ?disabled=${this.isLoading}
            />
            ${this.errors.email ? html`<div class="form-error">${this.errors.email}</div>` : ''}
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input
              type="password"
              id="password"
              class="form-input ${this.errors.password ? 'error' : ''}"
              .value=${this.formData.password}
              @input=${(e: InputEvent) => this.handleInputChange('password', (e.target as HTMLInputElement).value)}
              placeholder="Enter your password"
              ?disabled=${this.isLoading}
            />
            ${this.errors.password ? html`<div class="form-error">${this.errors.password}</div>` : ''}
          </div>

          <button 
            type="submit" 
            class="submit-button"
            ?disabled=${this.isLoading}
          >
            ${this.isLoading ? html`
              <div class="loading-spinner"></div>
              ${this.isLogin ? 'Signing In...' : 'Creating Account...'}
            ` : html`
              ${this.isLogin ? 'Sign In' : 'Create Account'}
            `}
          </button>
        </form>

        <div class="form-footer">
          Welcome to Dust - Your personal digital library
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'login-form': LoginForm;
  }
}