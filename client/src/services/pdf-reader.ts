/**
 * Simple PDF Reader Service using PDF.js
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source to the local file in public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PdfReaderOptions {
  scale?: number;
  container?: HTMLElement;
  onPageChange?: (pageInfo: { currentPage: number; totalPages: number; percentage: number }) => void;
}

export class PdfReader {
  private pdf: any = null;
  private container: HTMLElement | null = null;
  private currentPage = 1;
  private totalPages = 0;
  private scale = 1.0;
  private onPageChange?: (pageInfo: { currentPage: number; totalPages: number; percentage: number }) => void;
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private resizeHandler?: () => void;
  private resizeTimeout?: number;
  private resizeObserver?: ResizeObserver;

  constructor(options: PdfReaderOptions = {}) {
    this.scale = options.scale || 1.0; // This is now a multiplier on the base fit scale
    this.container = options.container || null;
    this.onPageChange = options.onPageChange;
  }

  /**
   * Load a PDF from a URL with authentication headers
   */
  async loadFromUrl(url: string, headers: Record<string, string> = {}): Promise<void> {
    console.log('PDF Reader: Loading PDF from', url);
    
    try {
      // Fetch the PDF with authentication
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('PDF Reader: PDF fetched, size:', arrayBuffer.byteLength);
      
      // Load the PDF
      this.pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      this.totalPages = this.pdf.numPages;
      console.log('PDF Reader: PDF loaded successfully,', this.totalPages, 'pages');
      
    } catch (error) {
      console.error('PDF Reader: Failed to load PDF:', error);
      throw error;
    }
  }

  /**
   * Render the PDF to a container element
   */
  async renderTo(container: HTMLElement): Promise<void> {
    if (!this.pdf) {
      throw new Error('No PDF loaded');
    }
    
    this.container = container;
    this.container.innerHTML = ''; // Clear container
    
    console.log('PDF Reader: Setting up page-based reader');
    
    // Create the reader structure
    this.setupReaderUI();
    
    // Render the first page
    await this.renderCurrentPage();
    
    // Set up keyboard navigation
    this.setupKeyboardNavigation();
    
    // Set up responsive resize handling
    this.setupResizeHandling();
    
    console.log('PDF Reader: Page-based reader ready');
  }

  /**
   * Set up the reader UI with navigation controls
   */
  private setupReaderUI(): void {
    if (!this.container) return;

    // Create navigation bar
    const navBar = document.createElement('div');
    navBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: #f0f0f0;
      border-bottom: 1px solid #ccc;
      margin-bottom: 20px;
    `;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.style.cssText = `
      padding: 8px 16px;
      background: #007cba;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    prevBtn.onclick = () => this.previousPage();

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.id = 'pdf-page-info';
    pageInfo.style.cssText = `
      font-weight: bold;
      margin: 0 20px;
    `;

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.style.cssText = `
      padding: 8px 16px;
      background: #007cba;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    nextBtn.onclick = () => this.nextPage();

    // Zoom controls
    const zoomOut = document.createElement('button');
    zoomOut.textContent = '−';
    zoomOut.style.cssText = `
      padding: 8px 12px;
      background: #666;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 20px;
    `;
    zoomOut.onclick = () => this.setScale(this.scale - 0.1);

    const zoomIn = document.createElement('button');
    zoomIn.textContent = '+';
    zoomIn.style.cssText = `
      padding: 8px 12px;
      background: #666;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 5px;
    `;
    zoomIn.onclick = () => this.setScale(this.scale + 0.1);

    navBar.appendChild(prevBtn);
    navBar.appendChild(pageInfo);
    navBar.appendChild(nextBtn);
    navBar.appendChild(zoomOut);
    navBar.appendChild(zoomIn);

    // Create page container
    const pageContainer = document.createElement('div');
    pageContainer.id = 'pdf-page-container';
    pageContainer.style.cssText = `
      text-align: center;
      overflow: auto;
      height: calc(100vh - 200px);
      width: 100%;
      padding: 20px;
      box-sizing: border-box;
    `;

    this.container.appendChild(navBar);
    this.container.appendChild(pageContainer);
  }

  /**
   * Render the current page
   */
  private async renderCurrentPage(): Promise<void> {
    if (!this.pdf || !this.container) return;

    const pageContainer = this.container.querySelector('#pdf-page-container') as HTMLElement;
    const pageInfo = this.container.querySelector('#pdf-page-info') as HTMLElement;
    
    if (!pageContainer || !pageInfo) return;

    // Update page info
    pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    
    // Notify page change for progress tracking
    this.notifyPageChange();

    // Clear previous page
    pageContainer.innerHTML = '';

    try {
      console.log(`PDF Reader: Rendering page ${this.currentPage}`);
      
      const page = await this.pdf.getPage(this.currentPage);
      
      // Get container dimensions
      const containerWidth = pageContainer.clientWidth - 40;
      const containerHeight = pageContainer.clientHeight - 40;
      
      // Get the page dimensions at scale 1.0
      const baseViewport = page.getViewport({ scale: 1.0 });
      
      // Calculate the scale to fit both width and height (use the smaller scale to ensure everything fits)
      const scaleToFitWidth = containerWidth / baseViewport.width;
      const scaleToFitHeight = containerHeight / baseViewport.height;
      const baseScale = Math.min(scaleToFitWidth, scaleToFitHeight);
      const effectiveScale = baseScale * this.scale;
      
      console.log(`PDF Reader: Container ${containerWidth}x${containerHeight}, Page ${baseViewport.width}x${baseViewport.height}, Scale ${baseScale.toFixed(3)} (${scaleToFitWidth.toFixed(3)} width, ${scaleToFitHeight.toFixed(3)} height)`);
      
      const viewport = page.getViewport({ scale: effectiveScale });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Set canvas resolution to match viewport
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Style the canvas to fit properly without horizontal scrollbar
      canvas.style.cssText = `
        border: 1px solid #ccc;
        display: block;
        margin: 0 auto 20px auto;
        max-width: 100%;
        height: auto;
      `;
      
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
      
      pageContainer.appendChild(canvas);
      
    } catch (error) {
      console.error(`PDF Reader: Failed to render page ${this.currentPage}:`, error);
      pageContainer.innerHTML = `<div style="color: red;">Error loading page ${this.currentPage}</div>`;
    }
  }

  /**
   * Go to next page
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.renderCurrentPage();
    }
  }

  /**
   * Go to previous page
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderCurrentPage();
    }
  }

  /**
   * Go to a specific page
   */
  goToPage(pageNum: number): void {
    if (pageNum >= 1 && pageNum <= this.totalPages) {
      this.currentPage = pageNum;
      this.renderCurrentPage();
    }
  }

  /**
   * Set the scale/zoom level
   */
  setScale(scale: number): void {
    if (scale < 0.3 || scale > 5.0) return; // Wider zoom range
    
    this.scale = Math.round(scale * 10) / 10; // Round to 1 decimal
    console.log(`PDF Reader: Setting user scale to ${this.scale}`);
    this.renderCurrentPage(); // Re-render current page with new scale
  }

  /**
   * Manually trigger a resize/re-render (useful when container size changes)
   */
  async refresh(): Promise<void> {
    console.log('PDF Reader: Manual refresh triggered');
    await this.renderCurrentPage();
  }

  /**
   * Get current page info
   */
  getPageInfo() {
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      scale: this.scale
    };
  }

  /**
   * Set up keyboard navigation for PDF reader
   */
  private setupKeyboardNavigation(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      // Only handle keys when the PDF reader container is focused or when no input is active
      const activeElement = document.activeElement;
      const isInputActive = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT' ||
        activeElement.contentEditable === 'true'
      );

      if (isInputActive) {
        return; // Don't interfere with form inputs
      }

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          this.previousPage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ': // Spacebar
          event.preventDefault();
          this.nextPage();
          break;
        case 'Home':
          event.preventDefault();
          this.goToPage(1);
          break;
        case 'End':
          event.preventDefault();
          this.goToPage(this.totalPages);
          break;
      }
    };

    // Add event listener to document for global keyboard navigation
    document.addEventListener('keydown', this.keyboardHandler);
    console.log('PDF Reader: Keyboard navigation enabled');
  }

  /**
   * Remove keyboard navigation
   */
  private removeKeyboardNavigation(): void {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
      console.log('PDF Reader: Keyboard navigation disabled');
    }
  }

  /**
   * Set up responsive resize handling
   */
  private setupResizeHandling(): void {
    // Window resize handler
    this.resizeHandler = () => {
      // Debounce resize events to avoid excessive re-rendering
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      this.resizeTimeout = window.setTimeout(async () => {
        console.log('PDF Reader: Window resized, re-rendering page');
        await this.renderCurrentPage();
      }, 300);
    };

    window.addEventListener('resize', this.resizeHandler);
    
    // Container resize observer for more granular control
    if (this.container && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = window.setTimeout(async () => {
          console.log('PDF Reader: Container resized, re-rendering page');
          await this.renderCurrentPage();
        }, 300);
      });
      
      this.resizeObserver.observe(this.container);
      console.log('PDF Reader: Container resize observer enabled');
    }
    
    console.log('PDF Reader: Responsive resize handling enabled');
  }

  /**
   * Remove resize handling
   */
  private removeResizeHandling(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = undefined;
    }
    
    console.log('PDF Reader: Resize handling disabled');
  }

  /**
   * Notify listeners of page change for progress tracking
   */
  private notifyPageChange(): void {
    if (this.onPageChange && this.totalPages > 0) {
      const percentage = (this.currentPage / this.totalPages) * 100;
      this.onPageChange({
        currentPage: this.currentPage,
        totalPages: this.totalPages,
        percentage: percentage
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Remove event handlers
    this.removeKeyboardNavigation();
    this.removeResizeHandling();
    
    if (this.pdf) {
      this.pdf.destroy();
      this.pdf = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}