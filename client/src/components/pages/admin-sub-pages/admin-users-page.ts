import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { apiService } from "../../../services/api.js";

@customElement("admin-users-page")
export class AdminUsersPage extends LitElement {
  @state()
  private error: string | null = null;

  @state()
  private authFlow: "signup" | "invitation" | null = null;

  @state()
  private invitationEmail: string = "";

  @state()
  private generatedToken: string | null = null;

  @state()
  private isGeneratingToken = false;

  @state()
  private hasCopiedToken = false;

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .page-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }

    .section {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
    }

    .section-description {
      color: var(--text-light);
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }

    .form-row {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .form-input {
      flex: 1;
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--background-color);
      color: var(--text-color);
      font-size: 0.95rem;
    }

    .action-button {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.9rem;
    }

    .action-button[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .action-button.secondary {
      background: var(--surface-color);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }

    .token-card {
      margin-top: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background: var(--background-color);
      border: 1px solid var(--border-color);
    }

    .token-label {
      font-size: 0.85rem;
      color: var(--text-light);
      margin-bottom: 0.25rem;
    }

    .token-value {
      font-family: var(--font-mono, monospace);
      word-break: break-all;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }

    .token-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .error-message {
      color: var(--error-color);
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
    }

    .info-badge {
      font-size: 0.8rem;
      color: var(--text-light);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadSettings();

    // Restore last generated token for convenience (browser-only persistence)
    const lastEmail = localStorage.getItem("dust_invite_last_email");
    if (lastEmail) {
      this.invitationEmail = lastEmail;
      const storedToken = localStorage.getItem(
        `dust_invite_token:${lastEmail}`
      );
      if (storedToken) {
        this.generatedToken = storedToken;
      }
    }
  }

  private async loadSettings() {
    this.error = null;
    try {
      const settings = await apiService.getAdminAuthSettings();
      this.authFlow = settings.auth_flow;
    } catch (error) {
      console.error("Failed to load auth settings for user management:", error);
      this.error =
        error instanceof Error
          ? error.message
          : "Failed to load authentication settings.";
      this.authFlow = null;
    }
  }

  private async handleGenerateInvitation(event: Event) {
    event.preventDefault();
    if (!this.invitationEmail) return;

    this.isGeneratingToken = true;
    this.generatedToken = null;
    this.hasCopiedToken = false;
    this.error = null;

    try {
      const result = await apiService.createInvitation(this.invitationEmail);
      this.generatedToken = result.token;
      try {
        localStorage.setItem("dust_invite_last_email", this.invitationEmail);
        localStorage.setItem(
          `dust_invite_token:${this.invitationEmail}`,
          this.generatedToken
        );
      } catch (e) {
        console.warn("Failed to persist invitation token to localStorage:", e);
      }
    } catch (error) {
      console.error("Failed to create invitation:", error);
      this.error =
        error instanceof Error
          ? error.message
          : "Failed to generate invitation token.";
    } finally {
      this.isGeneratingToken = false;
    }
  }

  private async copyTokenToClipboard() {
    if (!this.generatedToken) return;
    try {
      await navigator.clipboard.writeText(this.generatedToken);
      this.hasCopiedToken = true;
    } catch (error) {
      console.warn("Failed to copy token to clipboard:", error);
    }
  }

  private getMailtoLink(): string | null {
    if (!this.generatedToken || !this.invitationEmail) return null;

    const subject = "Your Dust invitation code";
    const body = `Use this invitation code to create your Dust account: ${this.generatedToken}`;

    return `mailto:${encodeURIComponent(
      this.invitationEmail
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  render() {
    return html`
      <div class="container">
        <div class="section-header">
          <h1 class="page-title">👥 User Management</h1>
          <button
            class="action-button secondary"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent("navigate", {
                  detail: { page: "admin" },
                  bubbles: true,
                  composed: true,
                })
              )}
          >
            ← Back to Admin Dashboard
          </button>
        </div>

        ${this.error
          ? html`<div class="error-message">${this.error}</div>`
          : ""}

        <div class="section">
          <div class="section-header">
            <div>
              <div class="section-title">Users</div>
              <div class="section-description">
                Manage user accounts, roles, and permissions.
              </div>
            </div>
            <span class="info-badge">User list coming soon</span>
          </div>
          <!-- Placeholder for future user list / actions -->
          <p style="color: var(--text-light); font-size: 0.9rem;">
            A detailed user list and role management UI will appear here.
          </p>
        </div>

        <div class="section">
          <div class="section-header">
            <div>
              <div class="section-title">Invitation Tokens</div>
              <div class="section-description">
                ${this.authFlow === "invitation"
                  ? "Generate runtime invitation tokens for new users. Tokens are not stored on the server – only this browser keeps a copy, and tokens may become invalid if the server is restarted with a different secret."
                  : "Invitation-based signups are currently disabled. Switch the auth flow to “Invitation only” in System Settings to enable this feature."}
              </div>
            </div>
          </div>

          <form @submit=${this.handleGenerateInvitation}>
            <div class="form-row">
              <input
                type="email"
                class="form-input"
                placeholder="User email"
                .value=${this.invitationEmail}
                @input=${(e: InputEvent) =>
                  (this.invitationEmail = (e.target as HTMLInputElement).value)}
                ?disabled=${this.isGeneratingToken ||
                this.authFlow !== "invitation"}
              />
              <button
                type="submit"
                class="action-button"
                ?disabled=${this.isGeneratingToken ||
                !this.invitationEmail ||
                this.authFlow !== "invitation"}
              >
                ${this.isGeneratingToken ? "Generating..." : "Generate Token"}
              </button>
            </div>
          </form>

          ${this.generatedToken
            ? html`
                <div class="token-card">
                  <div class="token-label">
                    Latest invitation token for
                    <strong>${this.invitationEmail}</strong>
                  </div>
                  <div class="token-value">${this.generatedToken}</div>
                  <div class="token-actions">
                    <button
                      type="button"
                      class="action-button secondary"
                      @click=${this.copyTokenToClipboard}
                    >
                      ${this.hasCopiedToken ? "Copied" : "Copy"}
                    </button>
                    ${this.getMailtoLink()
                      ? html`
                          <a
                            class="action-button secondary"
                            href=${this.getMailtoLink()!}
                          >
                            Send via Email
                          </a>
                        `
                      : ""}
                  </div>
                  <div class="info-badge" style="margin-top: 0.5rem;">
                    This token is validated server-side using a hashed value,
                    is valid for 24 hours from generation, and once used during
                    registration it cannot be used again.
                  </div>
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "admin-users-page": AdminUsersPage;
  }
}

