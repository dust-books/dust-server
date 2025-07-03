/**
 * Server Selector Component - Displays current server and allows switching
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { serverManager } from "../../services/server-manager.js";
import type { MultiServerState, ServerWithAuth } from "../../types/server.js";

@customElement("server-selector")
export class ServerSelector extends LitElement {
  @state()
  private serverState: MultiServerState = {
    servers: [],
    activeServerId: null,
    isConnecting: false,
  };

  @state()
  private showServerList = false;

  private unsubscribe?: () => void;

  static styles = css`
    :host {
      display: block;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
      margin-bottom: 1rem;
      min-height: 80px;
    }

    .server-selector {
      position: relative;
    }

    .current-server {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      padding: 0.75rem;
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-direction: column;
      gap: 0.5rem;
      min-height: 60px;
    }

    .current-server:hover {
      background: var(--surface-hover-color);
      border-color: var(--primary-color);
    }

    .server-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      min-width: 0;
      width: 100%;
    }

    .server-icon {
      font-size: 1.2rem;
      color: var(--primary-color);
    }

    .server-details {
      flex: 1;
      min-width: 0;
    }

    .server-name {
      font-weight: 500;
      color: var(--text-color);
      margin: 0;
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .server-url {
      color: var(--text-light);
      margin: 0;
      font-size: 0.75rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .server-status {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--text-light);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success-color);
    }

    .status-dot.offline {
      background: var(--error-color);
    }

    .dropdown-icon {
      font-size: 0.8rem;
      color: var(--text-light);
      transition: transform 0.2s ease;
      padding: 0.25rem;
      text-align: center;
      border-top: 1px solid var(--border-color);
      margin-top: 0.5rem;
      width: 100%;
    }

    .dropdown-icon.open {
      transform: rotate(180deg);
    }

    .server-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 100;
      max-height: 300px;
      overflow-y: auto;
      margin-top: 0.25rem;
    }

    .server-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      cursor: pointer;
      transition: background-color 0.2s ease;
      border-bottom: 1px solid var(--border-color);
    }

    .server-item:last-child {
      border-bottom: none;
    }

    .server-item:hover {
      background: var(--surface-hover-color);
    }

    .server-item.active {
      background: var(--primary-color-light);
      color: var(--primary-color);
    }

    .add-server-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      cursor: pointer;
      transition: background-color 0.2s ease;
      border-top: 1px solid var(--border-color);
      color: var(--primary-color);
      font-weight: 500;
    }

    .add-server-item:hover {
      background: var(--surface-hover-color);
    }

    .no-servers {
      padding: 1rem;
      text-align: center;
      color: var(--text-light);
      font-size: 0.9rem;
    }

    .connecting {
      opacity: 0.6;
      pointer-events: none;
    }

    @media (max-width: 768px) {
      .server-name,
      .server-url {
        font-size: 0.8rem;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    console.log("ServerSelector: Connected, initializing...");

    this.unsubscribe = serverManager.subscribe((state) => {
      console.log("ServerSelector: State update received:", state);
      this.serverState = state;
    });

    this.serverState = serverManager.getState();
    console.log("ServerSelector: Initial state:", this.serverState);

    // Close dropdown when clicking outside
    document.addEventListener("click", this.handleDocumentClick.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    document.removeEventListener("click", this.handleDocumentClick.bind(this));
  }

  private handleDocumentClick(event: Event) {
    const inComposed = event.composedPath().includes(this);
    if (!inComposed) {
      this.showServerList = false;
    }
  }

  private toggleServerList() {
    console.log("ServerSelector: Toggling server list visibility");
    this.showServerList = !this.showServerList;
  }

  private async handleServerSelect(server: ServerWithAuth) {
    if (server.id === this.serverState.activeServerId) {
      this.showServerList = false;
      return;
    }

    try {
      await serverManager.switchServer(server.id);
      this.showServerList = false;

      // Emit server change event
      this.dispatchEvent(
        new CustomEvent("server-changed", {
          detail: { server },
          bubbles: true,
        })
      );
    } catch (error) {
      console.error("Failed to switch server:", error);
    }
  }

  private handleAddServer() {
    this.showServerList = false;
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { page: "connect-server" },
        bubbles: true,
        composed: true,
      })
    );
  }

  private getCurrentServer(): ServerWithAuth | null {
    return serverManager.getActiveServer();
  }

  render() {
    const currentServer = this.getCurrentServer();
    const { servers, isConnecting } = this.serverState;

    console.log("ServerSelector: Rendering with currentServer:", currentServer);
    console.log("ServerSelector: Servers count:", servers.length);

    return html`
      <div class="server-selector ${isConnecting ? "connecting" : ""}">
        <div class="current-server" @click=${this.toggleServerList}>
          ${currentServer
            ? html`
                <div class="server-info">
                  <span class="server-icon">🖥️</span>
                  <div class="server-details">
                    <p class="server-name">${currentServer.name}</p>
                    <p class="server-url">${currentServer.baseUrl}</p>
                  </div>
                  <div class="server-status">
                    <span
                      class="status-dot ${currentServer.isOnline
                        ? ""
                        : "offline"}"
                    ></span>
                    <span
                      >${currentServer.isOnline ? "Online" : "Offline"}</span
                    >
                  </div>
                </div>
              `
            : html`
                <div class="server-info">
                  <span class="server-icon">⚠️</span>
                  <div class="server-details">
                    <p class="server-name">No Server Connected</p>
                    <p class="server-url">Click to add a server</p>
                  </div>
                </div>
              `}
          <div class="dropdown-icon">
            Change Server
            <span class="${this.showServerList ? "open" : ""}">▼</span>
          </div>
        </div>

        ${this.showServerList
          ? html`
              <div class="server-list">
                ${servers.length > 0
                  ? html`
                      ${servers.map(
                        (server) => html`
                          <div
                            class="server-item ${server.id ===
                            this.serverState.activeServerId
                              ? "active"
                              : ""}"
                            @click=${() => this.handleServerSelect(server)}
                          >
                            <span class="server-icon">🖥️</span>
                            <div class="server-details">
                              <p class="server-name">${server.name}</p>
                              <p class="server-url">${server.baseUrl}</p>
                            </div>
                            <div class="server-status">
                              <span
                                class="status-dot ${server.isOnline
                                  ? ""
                                  : "offline"}"
                              ></span>
                            </div>
                          </div>
                        `
                      )}
                    `
                  : html` <div class="no-servers">No servers configured</div> `}

                <div class="add-server-item" @click=${this.handleAddServer}>
                  <span class="server-icon">➕</span>
                  <span>Connect to Server</span>
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "server-selector": ServerSelector;
  }
}
