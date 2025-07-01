/**
 * Book Reader Page Component
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { consume } from "@lit/context";

import type { Book, ReadingProgress } from "../../types/app.js";
import { appStateContext, AppStateService } from "../../services/app-state.js";
import { EpubReaderService } from "../../services/epub-reader.js";

type ReaderType = "epub" | "pdf";
type Theme = "light" | "dark" | "sepia";

@customElement("reader-page")
export class ReaderPage extends LitElement {
  @consume({ context: appStateContext })
  appStateService!: AppStateService;

  @property({ type: Object })
  book: Book | null = null;

  @property({ type: Object })
  progress: ReadingProgress | null = null;

  @state()
  private isLoading = true;

  @state()
  private error: string | null = null;

  @state()
  private readerType: ReaderType = "epub";

  @state()
  private showControls = true;

  @state()
  private showSettings = false;

  @state()
  private isFullscreen = false;

  @state()
  private showBookInfo = true;

  @state()
  private theme: Theme = "light";

  @state()
  private fontSize = 16;

  @state()
  private fontFamily = "Georgia, serif";

  @state()
  private lineHeight = 1.6;

  @state()
  private currentPosition: any = null;

  @query("#reader-container")
  private readerContainer!: HTMLElement;

  private epubReader: EpubReaderService | null = null;
  private pdfReader: any = null; // Will be dynamically imported
  private hideControlsTimeout: number | null = null;

  static styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--background-color);
      overflow: hidden;
    }

    .reader-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .reader-main {
      display: flex;
      flex: 1;
      height: calc(100% - 80px); /* Account for header */
    }

    .book-info-panel {
      width: 25%; /* 1:3 split - left panel is 25% */
      background: var(--surface-color);
      border-right: 1px solid var(--border-color);
      overflow-y: auto;
      padding: 1.5rem;
      transition: width 0.3s ease, transform 0.3s ease;
    }

    .book-info-panel.hidden {
      width: 0;
      padding: 0;
      border-right: none;
      transform: translateX(-100%);
    }

    .reader-panel {
      width: 75%; /* 1:3 split - right panel is 75% */
      position: relative;
      overflow: hidden;
      transition: width 0.3s ease;
    }

    .reader-panel.expanded {
      width: 100%; /* Full width when book info is hidden */
    }

    .book-cover-large {
      width: 100%;
      max-width: 200px;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 1.5rem;
    }

    .book-cover-placeholder {
      width: 100%;
      max-width: 200px;
      height: 280px;
      background: linear-gradient(
        135deg,
        var(--primary-color),
        var(--primary-dark)
      );
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      color: white;
      margin-bottom: 1.5rem;
    }

    .book-title-large {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-color);
      margin: 0 0 0.5rem 0;
      line-height: 1.2;
    }

    .book-author-large {
      font-size: 1.1rem;
      color: var(--text-light);
      margin: 0 0 1.5rem 0;
    }

    .book-metadata {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .metadata-section {
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .metadata-section:last-child {
      border-bottom: none;
    }

    .metadata-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metadata-content {
      color: var(--text-light);
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .progress-section {
      background: var(--background-color);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .progress-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.75rem;
    }

    .progress-bar-large {
      width: 100%;
      height: 8px;
      background: var(--border-color);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill-large {
      height: 100%;
      background: var(--primary-color);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-text-large {
      font-size: 0.8rem;
      color: var(--text-light);
      text-align: center;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .action-button {
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--background-color);
      color: var(--text-color);
      cursor: pointer;
      font-size: 0.875rem;
      text-decoration: none;
      text-align: center;
      transition: all 0.2s ease;
    }

    .action-button:hover {
      background: var(--hover-color);
      border-color: var(--primary-color);
    }

    .action-button.primary {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    .action-button.primary:hover {
      background: var(--primary-dark);
    }

    .reader-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: var(--surface-color);
      border-bottom: 1px solid var(--border-color);
      transition: transform 0.3s ease;
      z-index: 10;
    }

    .reader-header.hidden {
      transform: translateY(-100%);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-center {
      flex: 1;
      text-align: center;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .book-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }

    .book-author {
      font-size: 0.9rem;
      color: var(--text-light);
      margin: 0;
    }

    .icon-button {
      background: none;
      border: none;
      padding: 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1.2rem;
      color: var(--text-color);
      transition: background-color 0.2s ease;
    }

    .icon-button:hover {
      background: var(--hover-color);
    }

    .icon-button.active {
      background: var(--primary-color);
      color: white;
    }

    .reader-content {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    #reader-container {
      width: 100%;
      height: 100%;
      background: white;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--background-color);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 1rem;
      z-index: 5;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-radius: 50%;
      border-top-color: var(--primary-color);
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .error-message {
      background: var(--error-color);
      color: white;
      padding: 1rem;
      margin: 1rem;
      border-radius: 6px;
      text-align: center;
    }

    .settings-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100%;
      background: var(--surface-color);
      border-left: 1px solid var(--border-color);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 20;
      overflow-y: auto;
    }

    .settings-panel.open {
      transform: translateX(0);
    }

    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .settings-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }

    .settings-content {
      padding: 1rem;
    }

    .setting-group {
      margin-bottom: 1.5rem;
    }

    .setting-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .setting-control {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--background-color);
      color: var(--text-color);
    }

    .theme-buttons {
      display: flex;
      gap: 0.5rem;
    }

    .theme-button {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--background-color);
      color: var(--text-color);
      cursor: pointer;
      text-align: center;
      font-size: 0.9rem;
    }

    .theme-button.active {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    .progress-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--border-color);
      z-index: 15;
    }

    .progress-fill {
      height: 100%;
      background: var(--primary-color);
      transition: width 0.3s ease;
    }

    .progress-text {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      z-index: 15;
    }

    :host(.fullscreen) {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 1000;
    }

    :host(.fullscreen) .reader-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }

    /* Mobile responsive design */
    @media (max-width: 768px) {
      .reader-main {
        flex-direction: column;
      }

      .book-info-panel {
        width: 100%;
        max-height: 40vh;
        padding: 1rem;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }

      .book-info-panel.hidden {
        max-height: 0;
        padding: 0;
        border-bottom: none;
        transform: translateY(-100%);
      }

      .reader-panel {
        width: 100%;
        height: 60vh;
      }

      .reader-panel.expanded {
        width: 100%;
        height: 100vh;
      }

      .book-cover-large,
      .book-cover-placeholder {
        max-width: 120px;
        height: auto;
      }

      .book-title-large {
        font-size: 1.2rem;
      }

      .book-author-large {
        font-size: 1rem;
      }

      .metadata-section {
        padding-bottom: 0.75rem;
      }

      .action-buttons {
        flex-direction: row;
        gap: 0.5rem;
      }

      .action-button {
        padding: 0.5rem 0.75rem;
        font-size: 0.8rem;
      }
    }

    @media (max-width: 480px) {
      .book-info-panel {
        padding: 0.75rem;
      }

      .reader-header {
        padding: 0.75rem;
      }

      .book-cover-large,
      .book-cover-placeholder {
        max-width: 100px;
      }

      .book-title-large {
        font-size: 1.1rem;
      }

      .metadata-title {
        font-size: 0.8rem;
      }

      .metadata-content {
        font-size: 0.85rem;
      }
    }
  `;

  async connectedCallback() {
    console.log("ReaderPage - connected callback");
    console.log("📖 ReaderPage: Current book:", this.book);
    console.log("📖 ReaderPage: Current URL:", window.location.href);
    super.connectedCallback();

    if (this.book) {
      console.log(
        "📖 ReaderPage: Book available, loading progress and initializing reader"
      );
      // Load reading progress for this book
      this.progress = await this.appStateService.loadReadingProgress(
        this.book.id
      );
      console.log("📖 ReaderPage: Progress loaded:", this.progress);
      await this.initializeReader();
    } else {
      console.log("📖 ReaderPage: No book available, need to load from route");
      await this.loadBookFromRoute();
    }

    // Auto-hide controls after inactivity
    this.addEventListener("mousemove", this.handleMouseMove);
    this.addEventListener("click", this.handleMouseMove);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanup();

    this.removeEventListener("mousemove", this.handleMouseMove);
    this.removeEventListener("click", this.handleMouseMove);

    if (this.hideControlsTimeout) {
      clearTimeout(this.hideControlsTimeout);
    }
  }

  private async loadBookFromRoute() {
    console.log("📖 ReaderPage: Loading book from route");

    // Extract book ID from URL path like /reader/1
    const pathParts = window.location.pathname.split("/");
    const bookIdStr = pathParts[pathParts.length - 1];
    const bookId = parseInt(bookIdStr, 10);

    if (isNaN(bookId)) {
      console.error("📖 ReaderPage: Invalid book ID in URL:", bookIdStr);
      this.error = "Invalid book ID in URL";
      this.isLoading = false;
      return;
    }

    console.log("📖 ReaderPage: Loading book with ID:", bookId);

    try {
      // Load book data from API
      this.book = await this.appStateService.selectBook(bookId);
      console.log("📖 ReaderPage: Book loaded:", this.book);

      // Load reading progress for this book
      this.progress = await this.appStateService.loadReadingProgress(bookId);
      console.log("📖 ReaderPage: Progress loaded:", this.progress);

      // Now initialize the reader
      await this.initializeReader();
    } catch (error) {
      console.error("📖 ReaderPage: Failed to load book:", error);
      this.error = `Failed to load book: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      this.isLoading = false;
    }
  }

  private async initializeReader() {
    if (!this.book) return;

    // Determine file type from filepath or file_format field
    let fileExtension: string | undefined;

    if (this.book.file_format) {
      // Use the file_format field if available
      fileExtension = this.book.file_format.toLowerCase();
    } else if (this.book.filepath) {
      // Extract extension from filepath as fallback
      fileExtension = this.book.filepath.toLowerCase().split(".").pop();
    } else {
      // Final fallback to book name
      fileExtension = this.book.name.toLowerCase().split(".").pop();
    }

    this.readerType = fileExtension === "pdf" ? "pdf" : "epub";
    console.log(
      `📖 Reader: Detected file type "${this.readerType}" from extension "${fileExtension}"`
    );

    this.isLoading = true;
    this.error = null;

    try {
      console.log(
        `📖 Reader: Starting ${this.readerType} reader initialization`
      );

      // Wait for container to be available
      await this.updateComplete;

      // Give the DOM a moment to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(`📖 Reader: Container ready, checking reader container...`);
      if (!this.readerContainer) {
        console.error(
          "📖 Reader: Reader container still not available after updateComplete"
        );
        throw new Error("Reader container not available");
      }
      console.log(
        `📖 Reader: Container confirmed ready, proceeding with ${this.readerType} initialization`
      );

      if (this.readerType === "epub") {
        console.log(`📖 Reader: Calling initializeEpubReader()`);
        await this.initializeEpubReader();
      } else {
        console.log(`📖 Reader: Calling initializePdfReader()`);
        await this.initializePdfReader();
      }

      console.log(
        `📖 Reader: ${this.readerType} reader initialization completed`
      );

      this.isLoading = false;
    } catch (error) {
      console.error("Failed to initialize reader:", error);
      this.error = "Failed to load book. Please try again.";
      this.isLoading = false;
    }
  }

  private async initializeEpubReader() {
    if (!this.book) return;

    this.epubReader = new EpubReaderService();
    (this.epubReader as any).hasRestoredPosition = false;

    // Set up event listeners
    this.epubReader.on("book-loaded", () => {
      console.log("EPUB loaded successfully");
    });

    this.epubReader.on("location-changed", (position) => {
      console.log("📖 EPUB Position Update:", {
        page: position.page,
        totalPages: position.totalPages,
        percentage: position.percentage,
      });
      this.currentPosition = position;
      this.updateReadingProgress(position);
    });

    // Load the book file via URL with authentication handled by headers
    const bookUrl = `/api/books/${this.book.id}/stream`;
    await this.epubReader.loadBook(bookUrl, this.getAuthHeaders());

    // Render to container
    await this.epubReader.renderTo(this.readerContainer);

    // Apply current settings
    this.applyReaderSettings();

    // Wait for locations to be generated before attempting restoration
    this.epubReader.on("locations-generated", () => {
      console.log(
        "📖 EPUB Reader: Locations generated, attempting position restoration..."
      );
      this.restoreEpubPosition();
    });

    // Also try to restore position after a short delay as fallback
    setTimeout(() => {
      this.restoreEpubPosition();
    }, 2000);
  }

  private async restoreEpubPosition() {
    if (!this.epubReader || !this.progress) return;

    // Check if we've already restored position (to avoid double restoration)
    if (this.epubReader.hasRestoredPosition) {
      console.log("📖 EPUB Reader: Position already restored, skipping...");
      return;
    }

    console.log("📖 EPUB Reader: Attempting to restore position...", {
      current_location: this.progress.current_location,
      current_page: this.progress.current_page,
    });

    try {
      // First priority: restore by CFI location if available
      if (
        this.progress.current_location &&
        this.progress.current_location.trim()
      ) {
        console.log(
          `📖 EPUB Reader: Restoring to CFI location: ${this.progress.current_location}`
        );
        await this.epubReader.goTo(this.progress.current_location);
        this.epubReader.hasRestoredPosition = true;
        return;
      }

      // Second priority: restore by page number using locations if available
      if (this.progress.current_page && this.progress.current_page > 1) {
        const epubBook = (this.epubReader as any).book;
        if (epubBook?.locations?.total > 0) {
          const targetLocation = Math.min(
            this.progress.current_page - 1,
            epubBook.locations.total - 1
          );
          const cfi = epubBook.locations.cfiFromLocation(targetLocation);
          console.log(
            `📖 EPUB Reader: Restoring to page ${this.progress.current_page} via CFI: ${cfi}`
          );
          await this.epubReader.goTo(cfi);
          this.epubReader.hasRestoredPosition = true;
          return;
        }

        // Fallback: try page-based navigation (0-indexed)
        console.log(
          `📖 EPUB Reader: Fallback page restoration to page ${this.progress.current_page}`
        );
        await this.epubReader.goTo(this.progress.current_page - 1);
        this.epubReader.hasRestoredPosition = true;
      }
    } catch (error) {
      console.warn("📖 EPUB Reader: Failed to restore position:", error);
      // Don't mark as restored if it failed, so we can try again
    }
  }

  private async initializePdfReader() {
    if (!this.book) {
      console.error("📖 PDF Reader: No book available");
      return;
    }

    console.log(
      `📖 PDF Reader: Creating simple PDF reader for book ${this.book.id}`
    );

    // Import the new PdfReader class
    const { PdfReader } = await import("../../services/pdf-reader.js");
    this.pdfReader = new PdfReader({
      scale: 1.0,
      onPageChange: (pageInfo) => this.handlePdfPageChange(pageInfo),
    });

    // Check container
    console.log("📖 PDF Reader: Checking reader container...");
    if (!this.readerContainer) {
      console.error("📖 PDF Reader: Reader container not found");
      throw new Error("Reader container not found");
    }

    // Load and render the PDF
    const bookUrl = `/api/books/${this.book.id}/stream`;
    console.log(`📖 PDF Reader: Loading PDF from ${bookUrl}`);

    try {
      const authHeaders = this.getAuthHeaders();
      console.log("📖 PDF Reader: Loading PDF with authentication");
      await this.pdfReader.loadFromUrl(bookUrl, authHeaders);

      console.log("📖 PDF Reader: Rendering PDF to container");
      await this.pdfReader.renderTo(this.readerContainer);
      console.log("📖 PDF Reader: PDF rendered successfully");

      // Restore reading position if available
      if (this.progress?.current_page && this.progress.current_page > 1) {
        console.log(
          `📖 PDF Reader: Restoring to page ${this.progress.current_page}`
        );
        this.pdfReader.goToPage(this.progress.current_page);
      }
    } catch (error) {
      console.error("📖 PDF Reader: Failed to load/render PDF:", error);
      throw error;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("dust_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private applyReaderSettings() {
    if (this.epubReader) {
      this.epubReader.setTheme(this.theme);
      this.epubReader.setFontSize(this.fontSize);
      this.epubReader.setFontFamily(this.fontFamily);
      this.epubReader.setLineHeight(this.lineHeight);
    }
  }

  private async updateReadingProgress(position: any) {
    if (!this.book || !position) return;

    try {
      const progressData = {
        book_id: this.book.id,
        current_page: Math.max(0, position.page || position.location || 0),
        total_pages: Math.max(
          0,
          position.totalPages || position.totalChapters || 0
        ),
        percentage_complete: Math.max(0, position.percentage || 0),
        current_location: position.cfi || position.scrollTop?.toString() || "",
        session_duration: 0, // Will be calculated on server
      };

      console.log("📖 Saving progress:", {
        page: progressData.current_page,
        percentage: progressData.percentage_complete,
        cfi: progressData.current_location?.substring(0, 50) + "...", // Truncate CFI for readability
      });

      await this.appStateService.updateReadingProgress(progressData);
    } catch (error) {
      console.error("Failed to update reading progress:", error);
    }
  }

  private handlePdfPageChange(pageInfo: {
    currentPage: number;
    totalPages: number;
    percentage: number;
  }) {
    console.log("📖 PDF Progress:", pageInfo);

    // Update current position for UI display
    this.currentPosition = {
      page: pageInfo.currentPage,
      totalPages: pageInfo.totalPages,
      percentage: pageInfo.percentage,
    };

    // Update reading progress in backend
    this.updateReadingProgress({
      page: pageInfo.currentPage,
      totalPages: pageInfo.totalPages,
      percentage: pageInfo.percentage,
    });
  }

  private cleanup() {
    if (this.epubReader) {
      this.epubReader.destroy();
      this.epubReader = null;
    }

    if (this.pdfReader) {
      this.pdfReader.destroy();
      this.pdfReader = null;
    }
  }

  private handleBack() {
    this.dispatchEvent(new CustomEvent("exit-reader"));
  }

  private async markAsCompleted() {
    if (!this.book) return;

    try {
      await this.appStateService.markBookCompleted(this.book.id);

      // Update local progress state
      this.currentPosition = {
        ...this.currentPosition,
        percentage: 100,
      };

      this.requestUpdate();
    } catch (error) {
      console.error("Failed to mark book as completed:", error);
    }
  }

  private async resetProgress() {
    if (!this.book) return;

    try {
      await this.appStateService.resetProgress(this.book.id);

      // Reset local progress state
      this.currentPosition = null;
      this.progress = null;

      // Navigate to beginning of book
      if (this.epubReader) {
        await this.epubReader.goTo(0);
      } else if (this.pdfReader) {
        this.pdfReader.goToPage(1);
      }

      this.requestUpdate();
    } catch (error) {
      console.error("Failed to reset progress:", error);
    }
  }

  private handleMouseMove = () => {
    this.showControls = true;

    if (this.hideControlsTimeout) {
      clearTimeout(this.hideControlsTimeout);
    }

    this.hideControlsTimeout = window.setTimeout(() => {
      if (this.isFullscreen) {
        this.showControls = false;
      }
    }, 3000);
  };

  private toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      this.classList.add("fullscreen");
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else {
      this.classList.remove("fullscreen");
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  private toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  private toggleBookInfo() {
    this.showBookInfo = !this.showBookInfo;

    // Trigger a resize of the reader to fill the available space
    setTimeout(() => {
      if (this.epubReader) {
        this.epubReader.resize();
      } else if (this.pdfReader) {
        this.pdfReader.refresh();
      }
    }, 350); // Wait for CSS transition to complete
  }

  private handleThemeChange(theme: Theme) {
    this.theme = theme;
    this.applyReaderSettings();
  }

  private handleFontSizeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.fontSize = parseInt(target.value);
    this.applyReaderSettings();
  }

  private handleFontFamilyChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.fontFamily = target.value;
    this.applyReaderSettings();
  }

  private handleLineHeightChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.lineHeight = parseFloat(target.value);
    this.applyReaderSettings();
  }

  private renderBookInfo() {
    if (!this.book) {
      return html`<div>Loading book information...</div>`;
    }

    const progress = this.currentPosition
      ? Math.round(this.currentPosition.percentage || 0)
      : this.progress
      ? Math.round(this.progress.percentage_complete || 0)
      : 0;

    return html`
      <!-- Book Cover -->
      ${this.book.cover_image_url || this.book.cover_image_path
        ? html`
            <img
              src="${this.book.cover_image_url || this.book.cover_image_path}"
              alt="${this.book.name}"
              class="book-cover-large"
            />
          `
        : html` <div class="book-cover-placeholder">📖</div> `}

      <!-- Book Title and Author -->
      <h1 class="book-title-large">${this.book.name}</h1>
      <p class="book-author-large">
        by ${this.book.author?.name || "Unknown Author"}
      </p>

      <!-- Reading Progress -->
      <div class="progress-section">
        <div class="progress-title">Reading Progress</div>
        <div class="progress-bar-large">
          <div class="progress-fill-large" style="width: ${progress}%"></div>
        </div>
        <div class="progress-text-large">${progress}% complete</div>
      </div>

      <!-- Book Metadata -->
      <div class="book-metadata">
        ${this.book.description
          ? html`
              <div class="metadata-section">
                <div class="metadata-title">Description</div>
                <div class="metadata-content">${this.book.description}</div>
              </div>
            `
          : ""}
        ${this.book.publisher || this.book.publication_date
          ? html`
              <div class="metadata-section">
                <div class="metadata-title">Publication</div>
                <div class="metadata-content">
                  ${this.book.publisher
                    ? html`${this.book.publisher}<br />`
                    : ""}
                  ${this.book.publication_date
                    ? html`Published: ${this.book.publication_date}`
                    : ""}
                </div>
              </div>
            `
          : ""}
        ${this.book.isbn
          ? html`
              <div class="metadata-section">
                <div class="metadata-title">ISBN</div>
                <div class="metadata-content">${this.book.isbn}</div>
              </div>
            `
          : ""}
        ${this.book.genre && this.book.genre.length > 0
          ? html`
              <div class="metadata-section">
                <div class="metadata-title">Genres</div>
                <div class="metadata-content">
                  ${this.book.genre.join(", ")}
                </div>
              </div>
            `
          : ""}
        ${this.book.file_format
          ? html`
              <div class="metadata-section">
                <div class="metadata-title">Format</div>
                <div class="metadata-content">
                  ${this.book.file_format.toUpperCase()}
                </div>
              </div>
            `
          : ""}
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="action-button primary" @click=${this.handleBack}>
          ← Back to Library
        </button>

        ${progress > 0 && progress < 100
          ? html`
              <button
                class="action-button"
                @click=${() => this.markAsCompleted()}
              >
                Mark as Completed
              </button>
            `
          : ""}
        ${progress > 0
          ? html`
              <button
                class="action-button"
                @click=${() => this.resetProgress()}
              >
                Reset Progress
              </button>
            `
          : ""}

        <!-- Future: Goodreads link will go here -->
        <button class="action-button" disabled title="Coming soon">
          View on Goodreads
        </button>
      </div>
    `;
  }

  private async handleNavigation(direction: "prev" | "next") {
    if (this.epubReader) {
      if (direction === "next") {
        await this.epubReader.nextPage();
      } else {
        await this.epubReader.prevPage();
      }
    } else if (this.pdfReader) {
      if (direction === "next") {
        await this.pdfReader.nextPage();
      } else {
        await this.pdfReader.prevPage();
      }
    }
  }

  render() {
    if (this.error) {
      return html`
        <div class="error-message">
          ${this.error}
          <button
            class="back-button"
            @click=${this.handleBack}
            style="margin-left: 1rem;"
          >
            ← Back to Library
          </button>
        </div>
      `;
    }

    return html`
      <div class="reader-wrapper">
        <header class="reader-header ${this.showControls ? "" : "hidden"}">
          <div class="header-left">
            <button
              class="icon-button"
              @click=${this.handleBack}
              title="Back to Library"
            >
              ←
            </button>
            <button
              class="icon-button ${this.showBookInfo ? "" : "active"}"
              @click=${this.toggleBookInfo}
              title="Toggle Book Information Panel"
            >
              ${this.showBookInfo ? "◨" : "◧"}
            </button>
            ${this.readerType === "pdf"
              ? html`
                  <button
                    class="icon-button"
                    @click=${() => this.handleNavigation("prev")}
                    title="Previous Page"
                  >
                    ‹
                  </button>
                  <button
                    class="icon-button"
                    @click=${() => this.handleNavigation("next")}
                    title="Next Page"
                  >
                    ›
                  </button>
                `
              : html`
                  <button
                    class="icon-button"
                    @click=${() => this.handleNavigation("prev")}
                    title="Previous Chapter"
                  >
                    ‹
                  </button>
                  <button
                    class="icon-button"
                    @click=${() => this.handleNavigation("next")}
                    title="Next Chapter"
                  >
                    ›
                  </button>
                `}
          </div>

          <div class="header-center">
            ${this.book
              ? html`
                  <h1 class="book-title">${this.book.name}</h1>
                  <p class="book-author">by ${this.book.author.name}</p>
                `
              : ""}
          </div>

          <div class="header-right">
            <button
              class="icon-button ${this.showSettings ? "active" : ""}"
              @click=${this.toggleSettings}
              title="Reading Settings"
            >
              ⚙
            </button>
            <button
              class="icon-button ${this.isFullscreen ? "active" : ""}"
              @click=${this.toggleFullscreen}
              title="Toggle Fullscreen"
            >
              ${this.isFullscreen ? "⊡" : "⊞"}
            </button>
          </div>
        </header>

        <div class="reader-main">
          ${this.showBookInfo
            ? html`
                <div class="book-info-panel">${this.renderBookInfo()}</div>
              `
            : ""}

          <div class="reader-panel ${this.showBookInfo ? "" : "expanded"}">
            <div id="reader-container"></div>

            ${this.isLoading
              ? html`
                  <div class="loading-overlay">
                    <div class="spinner"></div>
                    <p>Loading ${this.readerType.toUpperCase()}...</p>
                  </div>
                `
              : ""}
          </div>
        </div>

        ${this.currentPosition
          ? html`
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style="width: ${this.currentPosition.percentage || 0}%"
                ></div>
              </div>
              <div class="progress-text">
                ${Math.round(this.currentPosition.percentage || 0)}%
              </div>
            `
          : ""}
      </div>

      <div class="settings-panel ${this.showSettings ? "open" : ""}">
        <div class="settings-header">
          <h3 class="settings-title">Reading Settings</h3>
          <button class="icon-button" @click=${this.toggleSettings}>×</button>
        </div>

        <div class="settings-content">
          <div class="setting-group">
            <label class="setting-label">Theme</label>
            <div class="theme-buttons">
              <button
                class="theme-button ${this.theme === "light" ? "active" : ""}"
                @click=${() => this.handleThemeChange("light")}
              >
                Light
              </button>
              <button
                class="theme-button ${this.theme === "dark" ? "active" : ""}"
                @click=${() => this.handleThemeChange("dark")}
              >
                Dark
              </button>
              <button
                class="theme-button ${this.theme === "sepia" ? "active" : ""}"
                @click=${() => this.handleThemeChange("sepia")}
              >
                Sepia
              </button>
            </div>
          </div>

          ${this.readerType === "epub"
            ? html`
                <div class="setting-group">
                  <label class="setting-label"
                    >Font Size: ${this.fontSize}px</label
                  >
                  <input
                    type="range"
                    class="setting-control"
                    min="12"
                    max="24"
                    step="1"
                    .value=${this.fontSize.toString()}
                    @input=${this.handleFontSizeChange}
                  />
                </div>

                <div class="setting-group">
                  <label class="setting-label">Font Family</label>
                  <select
                    class="setting-control"
                    .value=${this.fontFamily}
                    @change=${this.handleFontFamilyChange}
                  >
                    <option value="Georgia, serif">Georgia</option>
                    <option value="Times, serif">Times</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Helvetica, sans-serif">Helvetica</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                  </select>
                </div>

                <div class="setting-group">
                  <label class="setting-label"
                    >Line Height: ${this.lineHeight}</label
                  >
                  <input
                    type="range"
                    class="setting-control"
                    min="1.2"
                    max="2.0"
                    step="0.1"
                    .value=${this.lineHeight.toString()}
                    @input=${this.handleLineHeightChange}
                  />
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
    "reader-page": ReaderPage;
  }
}
