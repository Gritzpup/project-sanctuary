/**
 * Backend configuration utilities for network-aware connection
 * Automatically uses the correct host based on where the app is accessed from
 */

/**
 * Get the backend host for API and WebSocket connections
 * - Uses environment variable if set
 * - Falls back to window.location.hostname for network access
 * - Defaults to 'localhost' for local development
 */
export function getBackendHost(): string {
  const envHost = import.meta.env.VITE_BACKEND_HOST;
  if (envHost) return envHost;

  // Use window.location.hostname to connect to backend on same host
  // This allows the app to work when accessed from any network machine
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }

  return 'localhost';
}

/**
 * Get the backend HTTP URL
 */
export function getBackendHttpUrl(): string {
  return `http://${getBackendHost()}:4828`;
}

/**
 * Get the backend WebSocket URL
 */
export function getBackendWsUrl(): string {
  return `ws://${getBackendHost()}:4828`;
}

/**
 * Get the backend API URL for a specific path
 */
export function getBackendApiUrl(path: string): string {
  const baseUrl = getBackendHttpUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}