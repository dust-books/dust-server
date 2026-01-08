/**
 * Connect to Server Page - Allows users to add new Dust servers
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { serverManager } from "../../services/server-manager.js";
import type { ServerConnectionResult } from "../../types/server.js";

@customElement("connect-server-page")
export class ConnectServerPage extends LitElement {
  @state()
  private serverName = "";

  @state()
  private serverUrl = "";

  @state()
  private email = "";

  @state()
  private password = "";

  @state()
  private isConnecting = false;

  @state()
  private connectionError = "";

  @state()
  private connectionStep: "server" | "auth" = "server";

  @state()
  private authMode: "login" | "register" = "login";

  @state()
  private displayName = "";

  @state()
  private confirmPassword = "";

  @state()
  private connectionResult: ServerConnectionResult | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      max-width: 600px;
      margin: 0 auto;
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

    .connection-form {
      background: var(--surface-color);
      border-radius: 12px;
      padding: 2rem;
      border: 1px solid var(--border-color);
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-weight: 500;
      color: var(--text-color);
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--background-color);
      color: var(--text-color);
      font-size: 1rem;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .help-text {
      font-size: 0.8rem;
      color: var(--text-light);
      margin-top: 0.25rem;
      line-height: 1.4;
    }

    .privacy-notice {
      background: var(--surface-hover-color);
      border-left: 3px solid var(--primary-color);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      font-size: 0.85rem;
      color: var(--text-light);
      line-height: 1.5;
    }

    .privacy-notice-title {
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .error-message {
      background: var(--error-color-light);
      color: var(--error-color);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }

    .success-message {
      background: var(--success-color-light);
      color: var(--success-color);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--surface-hover-color);
    }

    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .step-indicator {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--surface-color);
      border-radius: 8px;
      justify-content: center;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-light);
    }

    .step.active {
      color: var(--primary-color);
      font-weight: 500;
    }

    .step.completed {
      color: var(--success-color);
    }

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--border-color);
      color: var(--text-light);
      font-size: 0.8rem;
      font-weight: 500;
    }

    .step.active .step-number {
      background: var(--primary-color);
      color: white;
    }

    .step.completed .step-number {
      background: var(--success-color);
      color: white;
    }

    .step-arrow {
      color: var(--border-color);
    }

    .auth-tabs {
      display: flex;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid var(--border-color);
    }

    .auth-tab {
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

    .auth-tab.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }

    .auth-tab:hover {
      color: var(--text-color);
    }

    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }

      .button-group {
        flex-direction: column;
      }

      .step-indicator {
        flex-direction: column;
        gap: 0.5rem;
      }

      .step-arrow {
        display: none;
      }
    }
  `;

  private async handleServerConnect() {
    if (!this.serverName.trim() || !this.serverUrl.trim()) {
      this.connectionError = "Please fill in all server details";
      return;
    }

    this.isConnecting = true;
    this.connectionError = "";

    try {
      const result = await serverManager.addServer({
        name: this.serverName.trim(),
        baseUrl: this.serverUrl.trim(),
      });

      if (result.success && result.server) {
        this.connectionResult = result;
        this.connectionStep = "auth";
      } else {
        this.connectionError = result.error || "Failed to connect to server";
      }
    } catch (error) {
      this.connectionError =
        error instanceof Error ? error.message : "Unknown error occurred";
    } finally {
      this.isConnecting = false;
    }
  }

  private async handleAuthenticate() {
    if (this.authMode === "login") {
      return this.handleLogin();
    } else {
      return this.handleRegister();
    }
  }

  private async handleLogin() {
    if (!this.email.trim() || !this.password.trim()) {
      this.connectionError = "Please enter your email and password";
      return;
    }

    if (!this.connectionResult?.server) {
      this.connectionError = "No server connected";
      return;
    }

    this.isConnecting = true;
    this.connectionError = "";

    try {
      const result = await serverManager.authenticateWithServer(
        this.connectionResult.server.id,
        this.email.trim(),
        this.password.trim()
      );

      if (result.success) {
        // Successfully connected and authenticated
        this.dispatchEvent(
          new CustomEvent("navigate", {
            detail: { page: "library" },
            bubbles: true,
          })
        );
      } else {
        // Show specific error message from server
        this.connectionError = result.error || "Authentication failed";
      }
    } catch (error) {
      // Enhanced error handling to show more specific messages
      let errorMessage = "Authentication failed";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Parse specific error scenarios
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          errorMessage = "Invalid email or password";
        } else if (error.message.includes("403") || error.message.includes("Forbidden")) {
          errorMessage = "Access denied - account may be disabled";
        } else if (error.message.includes("404")) {
          errorMessage = "Authentication endpoint not found";
        } else if (error.message.includes("500")) {
          errorMessage = "Server error - please try again later";
        } else if (error.message.includes("Network error") || error.message.includes("fetch")) {
          errorMessage = "Unable to connect to server - check your network connection";
        }
      }
      
      this.connectionError = errorMessage;
      console.error("Login error:", error);
    } finally {
      this.isConnecting = false;
    }
  }

  private async handleRegister() {
    // Validate registration form
    if (!this.email.trim() || !this.password.trim() || !this.displayName.trim()) {
      this.connectionError = "Please fill in all required fields";
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.connectionError = "Passwords do not match";
      return;
    }

    if (this.password.length < 6) {
      this.connectionError = "Password must be at least 6 characters";
      return;
    }

    if (!this.connectionResult?.server) {
      this.connectionError = "No server connected";
      return;
    }

    this.isConnecting = true;
    this.connectionError = "";

    try {
      // Register user on the server
      const response = await fetch(`${this.connectionResult.server.baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: this.email.trim(),
          password: this.password.trim(),
          display_name: this.displayName.trim(),
          username: this.email.trim() // Use email as username
        })
      });

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Parse HTTP status codes for better error messages
          if (response.status === 400) {
            errorMessage = 'Invalid registration data - please check your inputs';
          } else if (response.status === 409) {
            errorMessage = 'An account with this email already exists';
          } else if (response.status === 422) {
            errorMessage = 'Invalid email format or password too weak';
          } else if (response.status === 500) {
            errorMessage = 'Server error - please try again later';
          } else {
            errorMessage = `Registration failed (${response.status})`;
          }
        }
        
        throw new Error(errorMessage);
      }

      // Registration successful, now authenticate
      const result = await serverManager.authenticateWithServer(
        this.connectionResult.server.id,
        this.email.trim(),
        this.password.trim()
      );

      if (result.success) {
        // Successfully registered and authenticated
        this.dispatchEvent(
          new CustomEvent("navigate", {
            detail: { page: "library" },
            bubbles: true,
          })
        );
      } else {
        this.connectionError = result.error || "Authentication failed after registration";
      }
    } catch (error) {
      // Enhanced error handling for registration
      let errorMessage = "Registration failed";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle network errors
        if (error.message.includes("Network error") || error.message.includes("fetch")) {
          errorMessage = "Unable to connect to server - check your network connection";
        }
      }
      
      this.connectionError = errorMessage;
      console.error("Registration error:", error);
    } finally {
      this.isConnecting = false;
    }
  }

  private handleBack() {
    if (this.connectionStep === "auth") {
      this.connectionStep = "server";
      this.connectionError = "";
    } else {
      this.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { page: "library" },
          bubbles: true,
        })
      );
    }
  }

  private handleAuthModeChange(mode: "login" | "register") {
    this.authMode = mode;
    this.connectionError = "";
    // Clear form fields when switching modes
    this.email = "";
    this.password = "";
    this.confirmPassword = "";
    this.displayName = "";
  }

  private renderStepIndicator() {
    return html`
      <div class="step-indicator">
        <div
          class="step ${this.connectionStep === "server"
            ? "active"
            : this.connectionResult
            ? "completed"
            : ""}"
        >
          <span class="step-number">${this.connectionResult ? "✓" : "1"}</span>
          <span>Connect to Server</span>
        </div>
        <span class="step-arrow">→</span>
        <div class="step ${this.connectionStep === "auth" ? "active" : ""}">
          <span class="step-number">2</span>
          <span>Sign In</span>
        </div>
      </div>
    `;
  }

  private renderServerForm() {
    return html`
      <div class="form-group">
        <label for="server-name">Server Name</label>
        <input
          id="server-name"
          type="text"
          .value=${this.serverName}
          @input=${(e: Event) =>
            (this.serverName = (e.target as HTMLInputElement).value)}
          placeholder="My Home Server"
          ?disabled=${this.isConnecting}
        />
        <div class="help-text">A friendly name to identify this server</div>
      </div>

      <div class="form-group">
        <label for="server-url">Server URL</label>
        <input
          id="server-url"
          type="url"
          .value=${this.serverUrl}
          @input=${(e: Event) =>
            (this.serverUrl = (e.target as HTMLInputElement).value)}
          placeholder="http://192.168.1.100:4001"
          ?disabled=${this.isConnecting}
        />
        <div class="help-text">
          The full URL where your Dust server is running. If connecting to a non-remote server, this will be localhost. This client can be used to connect to local and remote servers.
        </div>
      </div>

      <div class="button-group">
        <button
          class="btn btn-secondary"
          @click=${this.handleBack}
          ?disabled=${this.isConnecting}
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click=${this.handleServerConnect}
          ?disabled=${this.isConnecting}
        >
          ${this.isConnecting
            ? html`
                <span class="loading-spinner"></span>
                Connecting...
              `
            : "Connect to Server"}
        </button>
      </div>
    `;
  }

  private renderAuthForm() {
    return html`
      <div class="success-message">
        Successfully connected to ${this.connectionResult?.server?.name}! 
        ${this.authMode === "login" ? "Sign in with your account" : "Create a new account"}.
      </div>

      ${this.authMode === "register" ? html`
        <div class="privacy-notice">
          <div class="privacy-notice-title">
            🔒 Your Data Privacy
          </div>
          <div>
            Your account information (email and password) is stored <strong>only on the Dust server you're connecting to</strong>. 
            No information is sent to any remote server or centralized service. 
            There is no centralized user portal—Dust is completely self-hosted and private. 
            We don't want your data, and we'll never have access to it.
          </div>
        </div>
      ` : ''}

      <div class="auth-tabs">
        <button 
          class="auth-tab ${this.authMode === "login" ? "active" : ""}"
          @click=${() => this.handleAuthModeChange("login")}
          ?disabled=${this.isConnecting}
        >
          Sign In
        </button>
        <button 
          class="auth-tab ${this.authMode === "register" ? "active" : ""}"
          @click=${() => this.handleAuthModeChange("register")}
          ?disabled=${this.isConnecting}
        >
          Register
        </button>
      </div>

      ${this.authMode === "register" ? html`
        <div class="form-group">
          <label for="display-name">Display Name</label>
          <input
            id="display-name"
            type="text"
            .value=${this.displayName}
            @input=${(e: Event) => {
              this.displayName = (e.target as HTMLInputElement).value;
              // Clear error when user starts typing
              if (this.connectionError) {
                this.connectionError = "";
              }
            }}
            placeholder="Enter your display name"
            ?disabled=${this.isConnecting}
          />
        </div>
      ` : ''}

      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          .value=${this.email}
          @input=${(e: Event) => {
            this.email = (e.target as HTMLInputElement).value;
            // Clear error when user starts typing
            if (this.connectionError) {
              this.connectionError = "";
            }
          }}
          placeholder="Enter your email"
          ?disabled=${this.isConnecting}
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          .value=${this.password}
          @input=${(e: Event) => {
            this.password = (e.target as HTMLInputElement).value;
            // Clear error when user starts typing
            if (this.connectionError) {
              this.connectionError = "";
            }
          }}
          placeholder="Enter your password"
          ?disabled=${this.isConnecting}
        />
        ${this.authMode === "register" ? html`
          <div class="help-text">Password must be at least 6 characters</div>
        ` : ''}
      </div>

      ${this.authMode === "register" ? html`
        <div class="form-group">
          <label for="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            .value=${this.confirmPassword}
            @input=${(e: Event) => {
              this.confirmPassword = (e.target as HTMLInputElement).value;
              // Clear error when user starts typing
              if (this.connectionError) {
                this.connectionError = "";
              }
            }}
            placeholder="Confirm your password"
            ?disabled=${this.isConnecting}
          />
        </div>
      ` : ''}

      <div class="button-group">
        <button
          class="btn btn-secondary"
          @click=${this.handleBack}
          ?disabled=${this.isConnecting}
        >
          Back
        </button>
        <button
          class="btn btn-primary"
          @click=${this.handleAuthenticate}
          ?disabled=${this.isConnecting}
        >
          ${this.isConnecting
            ? html`
                <span class="loading-spinner"></span>
                ${this.authMode === "login" ? "Signing In..." : "Creating Account..."}
              `
            : this.authMode === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <h1 class="page-title">
          Connect to Server
        </h1>
        <p class="page-subtitle">Add a new Dust server to your library</p>
      </div>

      ${this.renderStepIndicator()}

      <div class="connection-form">
        ${this.connectionError
          ? html` <div class="error-message">${this.connectionError}</div> `
          : ""}
        ${this.connectionStep === "server"
          ? this.renderServerForm()
          : this.renderAuthForm()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "connect-server-page": ConnectServerPage;
  }
}
