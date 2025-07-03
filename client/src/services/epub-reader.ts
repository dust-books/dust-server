/**
 * EPUB Reader Service using epub.js
 */

import ePub, { Book, Rendition, Location } from 'epubjs';

export interface EpubChapter {
  id: string;
  href: string;
  label: string;
  spinePos: number;
}

export interface EpubMetadata {
  title?: string;
  creator?: string;
  description?: string;
  language?: string;
  publisher?: string;
  rights?: string;
  identifier?: string;
}

export interface ReadingPosition {
  cfi: string;
  location: number;
  page: number;
  totalPages: number;
  percentage: number;
  chapter: number;
  totalChapters: number;
}

export class EpubReaderService {
  private book: Book | null = null;
  private rendition: Rendition | null = null;
  private container: HTMLElement | null = null;
  private currentLocation: Location | null = null;
  
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private resizeHandler?: () => void;
  private resizeTimeout?: number;
  public hasRestoredPosition = false;

  constructor() {
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  /**
   * Load an EPUB book from a URL or ArrayBuffer
   */
  async loadBook(source: string | ArrayBuffer, headers?: Record<string, string>): Promise<void> {
    try {
      let bookSource: string | ArrayBuffer;
      
      // If source is a URL and we have headers, fetch with authentication
      if (typeof source === 'string' && headers) {
        console.log('EPUB Reader: Fetching book with authentication');
        const response = await fetch(source, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch EPUB: ${response.status} ${response.statusText}`);
        }
        bookSource = await response.arrayBuffer();
        console.log('EPUB Reader: Book fetched successfully, size:', bookSource.byteLength);
      } else {
        bookSource = source;
      }
      
      console.log('EPUB Reader: Loading book into ePub.js');
      this.book = ePub(bookSource);
      await this.book.ready;
      console.log('EPUB Reader: Book loaded successfully');
      this.emit('book-loaded', this.book);
    } catch (error) {
      console.error('Failed to load EPUB:', error);
      throw new Error(`Failed to load EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render the book in a container element
   */
  async renderTo(container: HTMLElement, width?: number, height?: number): Promise<void> {
    if (!this.book) {
      throw new Error('No book loaded');
    }

    this.container = container;
    
    // Create rendition
    this.rendition = this.book.renderTo(container, {
      width: width || container.clientWidth,
      height: height || container.clientHeight,
      spread: 'none',
      manager: 'default'
    });

    // Set up event listeners
    this.setupEventListeners();
    
    // Set up responsive resize handling
    this.setupResizeHandling();

    // Start rendering
    await this.rendition.display();
    
    // Generate locations for proper page tracking
    console.log('📖 EPUB Reader: Generating locations for progress tracking...');
    await this.generateLocations();
    
    this.emit('book-rendered');
  }

  /**
   * Navigate to the next page/chapter
   */
  async nextPage(): Promise<void> {
    if (!this.rendition) return;
    
    try {
      await this.rendition.next();
      this.updateLocation();
    } catch (error) {
      console.log('Already at the end of the book');
    }
  }

  /**
   * Navigate to the previous page/chapter
   */
  async prevPage(): Promise<void> {
    if (!this.rendition) return;
    
    try {
      await this.rendition.prev();
      this.updateLocation();
    } catch (error) {
      console.log('Already at the beginning of the book');
    }
  }

  /**
   * Go to a specific location by CFI (Canonical Fragment Identifier)
   */
  async goTo(target: string | number): Promise<void> {
    if (!this.rendition) return;

    try {
      await this.rendition.display(target);
      this.updateLocation();
    } catch (error) {
      console.error('Failed to navigate to location:', error);
    }
  }

  /**
   * Go to a specific percentage of the book
   */
  async goToPercentage(percentage: number): Promise<void> {
    if (!this.book || !this.rendition) return;

    try {
      const location = await this.book.locations.percentageFromCfi(
        this.book.locations.start
      );
      const targetCfi = this.book.locations.cfiFromPercentage(percentage / 100);
      await this.goTo(targetCfi);
    } catch (error) {
      console.error('Failed to navigate to percentage:', error);
    }
  }

  /**
   * Get the table of contents
   */
  async getTableOfContents(): Promise<EpubChapter[]> {
    if (!this.book) return [];

    try {
      const navigation = await this.book.loaded.navigation;
      return navigation.toc.map((item, index) => ({
        id: item.id || `chapter-${index}`,
        href: item.href,
        label: item.label || `Chapter ${index + 1}`,
        spinePos: index
      }));
    } catch (error) {
      console.error('Failed to get table of contents:', error);
      return [];
    }
  }

  /**
   * Get book metadata
   */
  async getMetadata(): Promise<EpubMetadata> {
    if (!this.book) return {};

    try {
      const metadata = await this.book.loaded.metadata;
      return {
        title: metadata.title,
        creator: metadata.creator,
        description: metadata.description,
        language: metadata.language,
        publisher: metadata.publisher,
        rights: metadata.rights,
        identifier: metadata.identifier
      };
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return {};
    }
  }

  /**
   * Get current reading position
   */
  getCurrentPosition(): ReadingPosition | null {
    if (!this.currentLocation || !this.book) return null;

    // Try to get page number from locations if available
    let pageNumber = 0;
    let totalPages = 0;
    
    if (this.book.locations && this.book.locations.total > 0) {
      // Use generated locations for accurate page tracking
      pageNumber = this.book.locations.locationFromCfi(this.currentLocation.start.cfi) + 1; // 1-indexed
      totalPages = this.book.locations.total;
    } else {
      // Fallback to location property or chapter-based calculation
      pageNumber = this.currentLocation.start.location || (this.currentLocation.start.index + 1) || 1;
      totalPages = this.book.spine.length;
    }

    // Calculate percentage from page numbers if EPUB.js percentage is not available
    let percentage = this.currentLocation.start.percentage || 0;
    if (percentage === 0 && totalPages > 0) {
      percentage = (pageNumber / totalPages) * 100;
    }

    return {
      cfi: this.currentLocation.start.cfi,
      location: pageNumber,
      page: pageNumber, // Add explicit page field
      totalPages: totalPages,
      percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
      chapter: this.currentLocation.start.index || 0,
      totalChapters: this.book.spine.length
    };
  }

  /**
   * Search for text in the book
   */
  async search(query: string): Promise<Array<{
    cfi: string;
    excerpt: string;
    chapter: string;
  }>> {
    if (!this.book) return [];

    try {
      const results = await Promise.all(
        this.book.spine.spineItems.map(async (item) => {
          const results = await item.load(this.book!.load.bind(this.book))
            .then((doc: Document) => item.find(query))
            .finally(() => item.unload());
          
          return results.map((result: any) => ({
            cfi: result.cfi,
            excerpt: result.excerpt,
            chapter: item.href
          }));
        })
      );

      return results.flat();
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Add a bookmark
   */
  addBookmark(title?: string): string | null {
    const position = this.getCurrentPosition();
    if (!position) return null;

    const bookmark = {
      cfi: position.cfi,
      title: title || `Bookmark ${Date.now()}`,
      created: new Date().toISOString(),
      chapter: position.chapter
    };

    this.emit('bookmark-added', bookmark);
    return position.cfi;
  }

  /**
   * Update font size
   */
  setFontSize(size: number): void {
    if (!this.rendition) return;

    this.rendition.themes.fontSize(`${size}px`);
    this.emit('font-size-changed', size);
  }

  /**
   * Update font family
   */
  setFontFamily(family: string): void {
    if (!this.rendition) return;

    this.rendition.themes.font(family);
    this.emit('font-family-changed', family);
  }

  /**
   * Update line height
   */
  setLineHeight(height: number): void {
    if (!this.rendition) return;

    this.rendition.themes.register('custom', {
      'p': {
        'line-height': `${height}em`
      }
    });
    this.rendition.themes.select('custom');
    this.emit('line-height-changed', height);
  }

  /**
   * Set reading theme (light, dark, sepia)
   */
  setTheme(theme: 'light' | 'dark' | 'sepia'): void {
    if (!this.rendition) return;

    const themes = {
      light: {
        body: {
          color: '#000000',
          background: '#ffffff'
        }
      },
      dark: {
        body: {
          color: '#ffffff',
          background: '#1a1a1a'
        }
      },
      sepia: {
        body: {
          color: '#5c4b37',
          background: '#f4ecd8'
        }
      }
    };

    this.rendition.themes.register(theme, themes[theme]);
    this.rendition.themes.select(theme);
    this.emit('theme-changed', theme);
  }

  /**
   * Resize the reader (useful for window resize)
   */
  resize(): void {
    if (!this.rendition || !this.container) return;

    this.rendition.resize(this.container.clientWidth, this.container.clientHeight);
  }

  /**
   * Manually trigger a resize (alias for resize method)
   */
  refresh(): void {
    console.log('📖 EPUB Reader: Manual refresh triggered');
    this.resize();
  }

  /**
   * Set up responsive resize handling
   */
  private setupResizeHandling(): void {
    this.resizeHandler = () => {
      // Debounce resize events to avoid excessive re-rendering
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      this.resizeTimeout = window.setTimeout(() => {
        console.log('📖 EPUB Reader: Window resized, adjusting layout');
        this.resize();
      }, 300);
    };

    window.addEventListener('resize', this.resizeHandler);
    console.log('📖 EPUB Reader: Responsive resize handling enabled');
  }

  /**
   * Remove resize handling
   */
  private removeResizeHandling(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
      
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = undefined;
      }
      
      console.log('📖 EPUB Reader: Resize handling disabled');
    }
  }

  /**
   * Generate locations (for progress calculation)
   */
  async generateLocations(): Promise<void> {
    if (!this.book) return;

    try {
      await this.book.locations.generate(1024); // Generate every 1024 characters
      this.emit('locations-generated');
    } catch (error) {
      console.error('Failed to generate locations:', error);
    }
  }

  /**
   * Destroy the reader and clean up
   */
  destroy(): void {
    // Remove event handlers
    this.removeResizeHandling();
    
    if (this.rendition) {
      this.rendition.destroy();
      this.rendition = null;
    }

    if (this.book) {
      this.book.destroy();
      this.book = null;
    }

    this.container = null;
    this.currentLocation = null;
    this.listeners.clear();

    document.removeEventListener('keydown', this.handleKeyPress);
  }

  // Event handling
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(callback => callback(...args));
  }

  private setupEventListeners(): void {
    if (!this.rendition) return;

    // Location change
    this.rendition.on('relocated', (location: Location) => {
      this.currentLocation = location;
      
      // Only emit location change if we have valid position data
      const position = this.getCurrentPosition();
      if (position && position.page > 0) {
        this.emit('location-changed', position);
      } else {
        console.log('📖 EPUB Reader: Skipping invalid position data:', position);
      }
    });

    // Click navigation
    this.rendition.on('click', (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A') return; // Allow link navigation

      // Click zones for navigation
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (event as MouseEvent).clientX - rect.left;
      const centerX = rect.width / 2;

      if (x < centerX - 50) {
        this.prevPage();
      } else if (x > centerX + 50) {
        this.nextPage();
      }
    });

    // Selection handling
    this.rendition.on('selected', (cfiRange: string, contents: any) => {
      const selection = contents.window.getSelection();
      const text = selection.toString();
      this.emit('text-selected', { cfiRange, text });
    });

    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyPress);
  }

  private updateLocation(): void {
    const position = this.getCurrentPosition();
    if (position) {
      this.emit('location-changed', position);
    }
  }

  private handleKeyPress(event: KeyboardEvent): void {
    if (!this.rendition) return;

    // Only handle keys when no input is active
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
      case 'h': // Vim-style navigation
        event.preventDefault();
        this.prevPage();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ': // Spacebar
      case 'l': // Vim-style navigation
        event.preventDefault();
        this.nextPage();
        break;
      case 'Home':
      case 'g': // Go to beginning (Vim-style)
        event.preventDefault();
        this.goTo(0);
        break;
      case 'End':
      case 'G': // Go to end (Vim-style)
        if (this.book) {
          event.preventDefault();
          this.goTo(this.book.spine.length - 1);
        }
        break;
      case 'j': // Vim-style down/next
        event.preventDefault();
        this.nextPage();
        break;
      case 'k': // Vim-style up/previous
        event.preventDefault();
        this.prevPage();
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        // Number keys for quick percentage navigation
        event.preventDefault();
        const percentage = parseInt(event.key) * 10;
        this.goToPercentage(percentage);
        break;
      case '0':
        // 0 key goes to beginning
        event.preventDefault();
        this.goTo(0);
        break;
    }
  }
}