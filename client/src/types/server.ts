/**
 * Server management types for multi-server support
 */

export interface ServerConfig {
  id: string; // Unique identifier for this server connection
  name: string; // User-friendly name (e.g., "Home Server", "John's Library")
  baseUrl: string; // Server URL (e.g., "http://192.168.1.100:4001")
  version?: string; // Server version
  isOnline?: boolean; // Connection status
  lastConnected?: string; // ISO timestamp of last successful connection
  createdAt: string; // When this server was added
}

export interface ServerAuth {
  serverId: string;
  token: string;
  userId: number;
  username: string;
  expiresAt?: string;
}

export interface ServerWithAuth extends ServerConfig {
  auth?: ServerAuth;
  user?: any; // User object from this server
}

export interface MultiServerState {
  servers: ServerWithAuth[];
  activeServerId: string | null;
  isConnecting: boolean;
  connectionError?: string;
}

export interface ServerConnectionResult {
  success: boolean;
  server?: ServerConfig;
  auth?: ServerAuth;
  user?: any; // User object from server response
  error?: string;
}

export interface ServerDiscoveryResult {
  servers: ServerConfig[];
  error?: string;
}

// Events for server management
export interface ServerEvent {
  type: 'server-added' | 'server-removed' | 'server-switched' | 'server-offline' | 'server-online';
  serverId: string;
  server?: ServerWithAuth;
}