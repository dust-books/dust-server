/**
 * Login Form Component
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";

import { appStateContext, AppStateService } from "../../services/app-state.js";
import { serverManager } from "../../services/server-manager.js";
import type { MultiServerState } from "../../types/server.js";
import "../server/server-selector.js";
import { apiService } from "../../services/api.js";

@customElement("login-form")
export class LoginForm extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @state()
  private isLogin = true;

  @state()
  private isLoading = false;

  @state()
  private formData = {
    email: "",
    password: "",
    username: "",
    display_name: "",
    invitation_token: "",
  };

  @state()
  private errors: Record<string, string> = {};

  @state()
  private generalError: string = "";

  @state()
  private serverState: MultiServerState = {
    servers: [],
    activeServerId: null,
    isConnecting: false,
  };

  @state()
  private authFlow: "signup" | "invitation" | null = null;

  private unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = serverManager.subscribe((state) => {
      this.serverState = state;
    });
    this.serverState = serverManager.getState();

    // Load auth flow for the active server so we can adapt the UI
    this.loadAuthSettings();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  private async loadAuthSettings() {
    try {
      const settings = await apiService.getAuthSettings();
      this.authFlow = settings.auth_flow;
    } catch (error) {
      console.warn("Failed to load auth settings in login form:", error);
      this.authFlow = null;
    }
  }

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
      box-sizing: border-box;
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

    .general-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--error-color);
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 1rem;
      color: var(--error-color);
      font-size: 0.9rem;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .general-error-icon {
      flex-shrink: 0;
      margin-top: 0.1rem;
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
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .form-footer {
      text-align: center;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      color: var(--text-light);
      font-size: 0.875rem;
    }

    .server-selector-container {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .server-selector-title {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-color);
      margin-bottom: 0.75rem;
      text-align: center;
    }

    .connect-server-link {
      display: block;
      text-align: center;
      margin-top: 0.5rem;
      color: var(--primary-color);
      text-decoration: none;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .connect-server-link:hover {
      text-decoration: underline;
    }
  `;

  private handleServerChange(_event: CustomEvent) {
    // Refresh app state when server changes
    this.appStateService.refreshAfterServerChange();
  }

  private handleConnectServer() {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { page: "connect-server" },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleTabSwitch(isLogin: boolean) {
    this.isLogin = isLogin;
    this.errors = {};
    this.generalError = "";
    this.formData = {
      email: "",
      password: "",
      username: "",
      display_name: "",
      invitation_token: "",
    };
  }

  private handleInputChange(field: string, value: string) {
    this.formData = { ...this.formData, [field]: value };
    // Clear error when user starts typing
    if (this.errors[field]) {
      this.errors = { ...this.errors, [field]: "" };
    }
    // Clear general error when user starts typing
    if (this.generalError) {
      this.generalError = "";
    }
  }

  private validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!this.formData.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
      errors.email = "Please enter a valid email";
    }

    if (!this.formData.password) {
      errors.password = "Password is required";
    } else if (!this.isLogin && this.formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!this.isLogin) {
      if (!this.formData.username) {
        errors.username = "Username is required";
      } else if (this.formData.username.length < 3) {
        errors.username = "Username must be at least 3 characters";
      }

      if (!this.formData.display_name) {
        errors.display_name = "Display name is required";
      }

      // When in invitation-only mode, require a token
      if (this.authFlow === "invitation" && !this.formData.invitation_token) {
        errors.invitation_token = "Invitation token is required";
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
    this.generalError = ""; // Clear any previous general errors

    try {
      if (this.isLogin) {
        await this.appStateService.login(
          this.formData.email,
          this.formData.password
        );
      } else {
        await this.appStateService.register({
          username: this.formData.username,
          email: this.formData.email,
          password: this.formData.password,
          display_name: this.formData.display_name,
          invitation_token: this.authFlow === "invitation" ? this.formData.invitation_token : undefined,
        });
        // Switch to login after successful registration
        this.handleTabSwitch(true);
      }
    } catch (error) {
      // Display error message in the form
      if (error instanceof Error) {
        this.generalError = error.message;
      } else {
        this.generalError = this.isLogin 
          ? "Login failed. Please check your credentials and try again."
          : "Registration failed. Please try again.";
      }
      console.error("Authentication error:", error);
    } finally {
      this.isLoading = false;
    }
  }

  render() {
    const hasMultipleServers = this.serverState.servers.length > 1;
    const currentServer = serverManager.getActiveServer();

    return html`
      <div class="form-container">
        <div class="server-selector-container">
          <div class="server-selector-title">Server Connection</div>
          ${hasMultipleServers || !currentServer ? html`
            <server-selector @server-changed=${this.handleServerChange}></server-selector>
          ` : html`
            <div style="text-align: center; color: var(--text-light); font-size: 0.9rem; margin-bottom: 0.5rem;">
              ${currentServer?.name || 'Unknown Server'}
            </div>
          `}
          <a 
            class="connect-server-link" 
            @click=${this.handleConnectServer}
          >
            ${hasMultipleServers || !currentServer ? '+ Add Another Server' : 'Change Server'}
          </a>
        </div>

        <div class="form-tabs">
          <button
            class="tab-button ${this.isLogin ? "active" : ""}"
            @click=${() => this.handleTabSwitch(true)}
          >
            Login
          </button>
          <button
            class="tab-button ${!this.isLogin ? "active" : ""}"
            @click=${() => this.handleTabSwitch(false)}
            title=${this.authFlow === "invitation" ? "Registration requires an invitation token" : ""}
          >
            ${this.authFlow === "invitation" ? "Register (with invitation)" : "Register"}
          </button>
        </div>

        ${this.generalError ? html`
          <div class="general-error">
            <span class="general-error-icon">⚠️</span>
            <span>${this.generalError}</span>
          </div>
        ` : ''}

        <form @submit=${this.handleSubmit}>
          ${!this.isLogin
            ? html`
                <div class="form-group">
                  <label class="form-label" for="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    class="form-input ${this.errors.username ? "error" : ""}"
                    .value=${this.formData.username}
                    @input=${(e: InputEvent) =>
                      this.handleInputChange(
                        "username",
                        (e.target as HTMLInputElement).value
                      )}
                    placeholder="Enter your username"
                    ?disabled=${this.isLoading}
                  />
                  ${this.errors.username
                    ? html`<div class="form-error">
                        ${this.errors.username}
                      </div>`
                    : ""}
                </div>

                ${this.authFlow === "invitation"
                  ? html`
                      <div class="form-group">
                        <label class="form-label" for="invitation_token">
                          Invitation Token
                        </label>
                        <input
                          type="text"
                          id="invitation_token"
                          class="form-input ${this.errors.invitation_token
                            ? "error"
                            : ""}"
                          .value=${this.formData.invitation_token}
                          @input=${(e: InputEvent) =>
                            this.handleInputChange(
                              "invitation_token",
                              (e.target as HTMLInputElement).value
                            )}
                          placeholder="Paste your invitation token"
                          ?disabled=${this.isLoading}
                        />
                        ${this.errors.invitation_token
                          ? html`<div class="form-error">
                              ${this.errors.invitation_token}
                            </div>`
                          : ""}
                      </div>
                    `
                  : ""}

                <div class="form-group">
                  <label class="form-label" for="display_name"
                    >Display Name</label
                  >
                  <input
                    type="text"
                    id="display_name"
                    class="form-input ${this.errors.display_name
                      ? "error"
                      : ""}"
                    .value=${this.formData.display_name}
                    @input=${(e: InputEvent) =>
                      this.handleInputChange(
                        "display_name",
                        (e.target as HTMLInputElement).value
                      )}
                    placeholder="Enter your display name"
                    ?disabled=${this.isLoading}
                  />
                  ${this.errors.display_name
                    ? html`<div class="form-error">
                        ${this.errors.display_name}
                      </div>`
                    : ""}
                </div>
              `
            : ""}

          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input
              type="email"
              id="email"
              class="form-input ${this.errors.email ? "error" : ""}"
              .value=${this.formData.email}
              @input=${(e: InputEvent) =>
                this.handleInputChange(
                  "email",
                  (e.target as HTMLInputElement).value
                )}
              placeholder="Enter your email"
              ?disabled=${this.isLoading}
            />
            ${this.errors.email
              ? html`<div class="form-error">${this.errors.email}</div>`
              : ""}
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input
              type="password"
              id="password"
              class="form-input ${this.errors.password ? "error" : ""}"
              .value=${this.formData.password}
              @input=${(e: InputEvent) =>
                this.handleInputChange(
                  "password",
                  (e.target as HTMLInputElement).value
                )}
              placeholder="Enter your password"
              ?disabled=${this.isLoading}
            />
            ${this.errors.password
              ? html`<div class="form-error">${this.errors.password}</div>`
              : ""}
          </div>

          <button
            type="submit"
            class="submit-button"
            ?disabled=${this.isLoading}
          >
            ${this.isLoading
              ? html`
                  <div class="loading-spinner"></div>
                  ${this.isLogin ? "Signing In..." : "Creating Account..."}
                `
              : html` ${this.isLogin ? "Sign In" : "Create Account"} `}
          </button>
        </form>

        <div class="form-footer">
          ${this.authFlow === "invitation"
            ? "This server currently requires an invitation token to create a new account."
            : "Welcome to Dust - Your personal digital library"}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "login-form": LoginForm;
  }
}
