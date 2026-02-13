import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { apiService } from "../../../services/api.js";

@customElement("admin-settings-page")
export class AdminSettingsPage extends LitElement {
  @state()
  private authFlow: "signup" | "invitation" | null = null;

  @state()
  private isSavingSettings = false;

  @state()
  private settingsError: string | null = null;


  static styles = css`
    :host {
      display: block;
      padding: 2rem;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .page-title {
      font-size: 1.75rem;
      font-weight: 700;
    }

    .section {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .section-description {
      color: var(--text-light);
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }

    .radio-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
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

    .action-button.secondary {
      background: var(--surface-color);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }

    .action-button[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
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
    this.loadAdminSettings();
  }

  private async loadAdminSettings() {
    try {
      const settings = await apiService.getAdminAuthSettings();
      this.authFlow = settings.auth_flow;
    } catch (error) {
      console.warn("Failed to load admin auth settings:", error);
      this.authFlow = null;
      this.settingsError =
        error instanceof Error ? error.message : "Failed to load settings.";
    }
  }

  private async handleSaveSettings(event: Event) {
    event.preventDefault();
    if (!this.authFlow) return;

    this.isSavingSettings = true;
    this.settingsError = null;

    try {
      const updated = await apiService.updateAdminAuthSettings(this.authFlow);
      this.authFlow = updated.auth_flow;
    } catch (error) {
      console.error("Failed to update auth settings:", error);
      this.settingsError =
        error instanceof Error ? error.message : "Failed to save settings.";
    } finally {
      this.isSavingSettings = false;
    }
  }

  render() {
    return html`
      <div class="container">
        <div class="page-header">
          <h1 class="page-title">⚙️ System Settings</h1>
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

        ${this.settingsError
          ? html`<div class="error-message">${this.settingsError}</div>`
          : ""}

        <div class="section">
          <div class="section-title">Authentication Flow</div>
          <div class="section-description">
            Choose how new users can create accounts.
          </div>

          ${this.authFlow === null
            ? html`<p class="info-badge">Loading settings...</p>`
            : html`
                <form @submit=${this.handleSaveSettings}>
                  <div class="radio-row">
                    <label>
                      <input
                        type="radio"
                        name="authFlow"
                        value="signup"
                        .checked=${this.authFlow === "signup"}
                        @change=${() => (this.authFlow = "signup")}
                      />
                      <span style="margin-left: 0.5rem;">Open signup</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="authFlow"
                        value="invitation"
                        .checked=${this.authFlow === "invitation"}
                        @change=${() => (this.authFlow = "invitation")}
                      />
                      <span style="margin-left: 0.5rem;">Invitation only</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    class="action-button"
                    ?disabled=${this.isSavingSettings}
                  >
                    ${this.isSavingSettings ? "Saving..." : "Save Settings"}
                  </button>
                </form>
              `}
        </div>

      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "admin-settings-page": AdminSettingsPage;
  }
}

