/**
 * Utility to get the full cover image URL for a book object
 * TODO: This should be handled by the server and not something the client is responsible for.
 */
export function getBookCoverUrl(book: { cover_image_path?: string; cover_image_url?: string }): string | null {
  const server = serverManager.getActiveServer();
  if (book.cover_image_path) {
    return server ? `${server.baseUrl.replace(/\/$/, '')}/${book.cover_image_path.replace(/^\//, '')}` : book.cover_image_path;
  } else if (book.cover_image_url) {
    return book.cover_image_url;
  }
  return null;
}
/**
 * Server Manager Service - Handles multiple server connections
 */

import type { 
  ServerConfig, 
  ServerAuth, 
  ServerWithAuth, 
  ServerConnectionResult,
  ServerDiscoveryResult,
  MultiServerState 
} from '../types/server.js';

const STORAGE_KEYS = {
  SERVERS: 'dust_servers',
  AUTH_TOKENS: 'dust_auth_tokens',
  ACTIVE_SERVER: 'dust_active_server'
};

export class ServerManager {
  private state: MultiServerState = {
    servers: [],
    activeServerId: null,
    isConnecting: false
  };

  private listeners: Array<(state: MultiServerState) => void> = [];

  constructor() {
    console.log('ServerManager: Initializing...');
    this.loadFromStorage();
    this.migrateLegacyAuth();
    console.log('ServerManager: Initialized with state:', this.state);
  }

  /**
   * Subscribe to server state changes
   */
  subscribe(callback: (state: MultiServerState) => void): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current server state
   */
  getState(): MultiServerState {
    return { ...this.state };
  }

  /**
   * Get active server
   */
  getActiveServer(): ServerWithAuth | null {
    if (!this.state.activeServerId) return null;
    return this.state.servers.find(s => s.id === this.state.activeServerId) || null;
  }

  /**
   * Get all servers
   */
  getServers(): ServerWithAuth[] {
    return [...this.state.servers];
  }

  /**
   * Add a new server
   */
  async addServer(config: Omit<ServerConfig, 'id' | 'createdAt'>): Promise<ServerConnectionResult> {
    this.updateState({ isConnecting: true, connectionError: undefined });

    try {
      // Test connection to server
      const testResult = await this.testServerConnection(config.baseUrl);
      if (!testResult.success) {
        this.updateState({ isConnecting: false, connectionError: testResult.error });
        return testResult;
      }

      // Generate unique ID for this server
      const serverId = this.generateServerId(config.baseUrl);
      
      const serverConfig: ServerConfig = {
        ...config,
        id: serverId,
        createdAt: new Date().toISOString(),
        isOnline: true,
        lastConnected: new Date().toISOString()
      };

      // Add server to state
      const existingIndex = this.state.servers.findIndex(s => s.id === serverId);
      if (existingIndex >= 0) {
        // Update existing server
        this.state.servers[existingIndex] = { ...this.state.servers[existingIndex], ...serverConfig };
      } else {
        // Add new server
        this.state.servers.push(serverConfig);
      }

      // Set as active if it's the first server
      if (!this.state.activeServerId) {
        this.state.activeServerId = serverId;
      }

      this.updateState({ isConnecting: false });
      this.saveToStorage();

      return {
        success: true,
        server: serverConfig
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateState({ 
        isConnecting: false, 
        connectionError: errorMessage 
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Remove a server
   */
  async removeServer(serverId: string): Promise<void> {
    // Remove server from state
    this.state.servers = this.state.servers.filter(s => s.id !== serverId);

    // Remove auth token
    this.removeAuthToken(serverId);

    // Switch to another server if this was active
    if (this.state.activeServerId === serverId) {
      this.state.activeServerId = this.state.servers.length > 0 ? this.state.servers[0].id : null;
    }

    this.updateState({});
    this.saveToStorage();
  }

  /**
   * Switch to a different server
   */
  async switchServer(serverId: string): Promise<void> {
    const server = this.state.servers.find(s => s.id === serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    this.state.activeServerId = serverId;
    this.updateState({});
    this.saveToStorage();
  }

  /**
   * Authenticate with a server
   */
  async authenticateWithServer(serverId: string, email: string, password: string): Promise<ServerConnectionResult> {
    const server = this.state.servers.find(s => s.id === serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    this.updateState({ isConnecting: true, connectionError: undefined });

    try {
      const response = await fetch(`${server.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        let errorMessage = 'Authentication failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If we can't parse JSON, try to get text response
          try {
            const textError = await response.text();
            if (textError) {
              errorMessage = textError;
            }
          } catch {
            // Fall back to HTTP status-based messages
            if (response.status === 401) {
              errorMessage = 'Invalid email or password';
            } else if (response.status === 403) {
              errorMessage = 'Access denied';
            } else if (response.status === 404) {
              errorMessage = 'Authentication service not found';
            } else if (response.status === 500) {
              errorMessage = 'Server error - please try again later';
            } else {
              errorMessage = `Authentication failed (${response.status})`;
            }
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      const auth: ServerAuth = {
        serverId,
        token: data.token,
        userId: data.user.id,
        username: data.user.email, // Using email as username for consistency
        expiresAt: data.expiresAt
      };

      // Store auth token
      this.setAuthToken(auth);

      // Update server with auth and user info
      const serverIndex = this.state.servers.findIndex(s => s.id === serverId);
      if (serverIndex >= 0) {
        this.state.servers[serverIndex] = {
          ...this.state.servers[serverIndex],
          auth,
          user: data.user,
          isOnline: true,
          lastConnected: new Date().toISOString()
        };
      }

      this.updateState({ isConnecting: false });
      this.saveToStorage();

      return {
        success: true,
        server: this.state.servers[serverIndex], // Return the updated server with user data
        auth,
        user: data.user // Include user data in the result
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.updateState({ 
        isConnecting: false, 
        connectionError: errorMessage 
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test connection to a server
   */
  private async testServerConnection(baseUrl: string): Promise<{ success: boolean; error?: string; version?: string }> {
    try {
      // Normalize URL
      const url = baseUrl.replace(/\/$/, '');
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return { 
          success: false, 
          error: `Server responded with ${response.status}: ${response.statusText}` 
        };
      }

      const data = await response.json();
      return { 
        success: true, 
        version: data.version 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Discover servers on local network
   */
  async discoverServers(): Promise<ServerDiscoveryResult> {
    // TODO: Implement mDNS/network discovery
    // For now, return empty list
    return { servers: [] };
  }

  /**
   * Get auth token for a server
   */
  getAuthToken(serverId: string): ServerAuth | null {
    const tokens = this.getStoredAuthTokens();
    return tokens[serverId] || null;
  }

  /**
   * Set auth token for a server
   */
  private setAuthToken(auth: ServerAuth): void {
    const tokens = this.getStoredAuthTokens();
    tokens[auth.serverId] = auth;
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(tokens));
  }

  /**
   * Remove auth token for a server
   */
  private removeAuthToken(serverId: string): void {
    const tokens = this.getStoredAuthTokens();
    delete tokens[serverId];
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(tokens));
  }
  /**
   * Clear auth for a server (localStorage + in-memory). 
   * Used on logout so refresh does not restore the auth session after a logout.
   */
  clearAuthForServer(serverId: string): void {
    this.removeAuthToken(serverId);
    const index = this.state.servers.findIndex(s => s.id === serverId);
    if (index >= 0) {
      this.state.servers[index] = { ...this.state.servers[index], auth: undefined, user: undefined };
      this.updateState({});
    }
  }
  /**
   * Get stored auth tokens
   */
  private getStoredAuthTokens(): Record<string, ServerAuth> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTH_TOKENS);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Generate unique server ID
   */
  private generateServerId(baseUrl: string): string {
    // Create ID from URL + timestamp
    const urlHash = btoa(baseUrl).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    const timestamp = Date.now().toString(36);
    return `server_${urlHash}_${timestamp}`;
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    try {
      console.log('ServerManager: Loading from storage...');
      
      // Load servers
      const serversData = localStorage.getItem(STORAGE_KEYS.SERVERS);
      console.log('ServerManager: Raw servers data:', serversData);
      if (serversData) {
        this.state.servers = JSON.parse(serversData);
        console.log('ServerManager: Loaded servers:', this.state.servers);
      }

      // Load active server
      const activeServerId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SERVER);
      console.log('ServerManager: Active server ID:', activeServerId);
      if (activeServerId) {
        this.state.activeServerId = activeServerId;
      }

      // Load and attach auth tokens
      const tokens = this.getStoredAuthTokens();
      console.log('ServerManager: Auth tokens:', Object.keys(tokens));
      this.state.servers.forEach(server => {
        const auth = tokens[server.id];
        if (auth) {
          server.auth = auth;
          console.log(`ServerManager: Attached auth to server ${server.name}`);
        }
      });

    } catch (error) {
      console.error('Failed to load server data from storage:', error);
    }
  }

  /**
   * Migrate legacy authentication to server-based system
   */
  private migrateLegacyAuth(): void {
    // If no servers are configured but we have a legacy token, create a default server
    if (this.state.servers.length === 0) {
      const legacyToken = localStorage.getItem('dust_token');
      console.log('ServerManager: Checking for legacy token:', !!legacyToken);
      
      if (legacyToken) {
        console.log('ServerManager: Found legacy token, creating default server...');
        
        // Create a default server entry for the current host
        const defaultServer: ServerConfig = {
          id: 'default_server',
          name: 'Local Server',
          baseUrl: window.location.origin,
          isOnline: true,
          lastConnected: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        // Create auth object from legacy token
        const defaultAuth: ServerAuth = {
          serverId: 'default_server',
          token: legacyToken,
          userId: 0, // We don't know the user ID from legacy token
          username: 'current_user', // Placeholder
          expiresAt: undefined
        };

        // Add to state with auth attached
        const serverWithAuth: ServerWithAuth = {
          ...defaultServer,
          auth: defaultAuth
        };
        
        this.state.servers.push(serverWithAuth);
        this.state.activeServerId = 'default_server';
        
        // Store auth token
        this.setAuthToken(defaultAuth);
        
        // Save to storage
        this.saveToStorage();
        
        console.log('ServerManager: Migrated legacy auth to default server');
        
        // Clean up legacy token
        localStorage.removeItem('dust_token');
      }
    }
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      // Save servers (without auth data)
      const serversToSave = this.state.servers.map(({ auth, user, ...server }) => server);
      localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(serversToSave));

      // Save active server
      if (this.state.activeServerId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SERVER, this.state.activeServerId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_SERVER);
      }

    } catch (error) {
      console.error('Failed to save server data to storage:', error);
    }
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<MultiServerState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Error in server state listener:', error);
      }
    });
  }

  /**
   * Check server health and update status
   */
  async checkServerHealth(serverId?: string): Promise<void> {
    const serversToCheck = serverId 
      ? this.state.servers.filter(s => s.id === serverId)
      : this.state.servers;

    await Promise.all(serversToCheck.map(async (server) => {
      try {
        const result = await this.testServerConnection(server.baseUrl);
        const serverIndex = this.state.servers.findIndex(s => s.id === server.id);
        
        if (serverIndex >= 0) {
          this.state.servers[serverIndex] = {
            ...this.state.servers[serverIndex],
            isOnline: result.success,
            version: result.version,
            lastConnected: result.success ? new Date().toISOString() : server.lastConnected
          };
        }
      } catch (error) {
        const serverIndex = this.state.servers.findIndex(s => s.id === server.id);
        if (serverIndex >= 0) {
          this.state.servers[serverIndex] = {
            ...this.state.servers[serverIndex],
            isOnline: false
          };
        }
      }
    }));

    this.updateState({});
    this.saveToStorage();
  }
}

// Global server manager instance
export const serverManager = new ServerManager();