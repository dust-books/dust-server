/**
 * Dust Client - Main Entry Point
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { provide } from "@lit/context";

import { appState, appStateContext } from "./services/app-state.js";

// Import components
import "./components/dust-app.js";

@customElement("dust-main")
export class DustMain extends LitElement {
  @provide({ context: appStateContext })
  appStateService = appState;

  // App state is managed by the dust-app component directly

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        sans-serif;
    }
  `;

  connectedCallback() {
    console.log("DustMain - connected callback");
    super.connectedCallback();
  }

  render() {
    return html` <dust-app></dust-app> `;
  }
}

// Initialize the app
const app = document.getElementById("app");
if (app) {
  app.innerHTML = "<dust-main></dust-main>";
}

declare global {
  interface HTMLElementTagNameMap {
    "dust-main": DustMain;
  }
}
