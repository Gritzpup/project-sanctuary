/**
 * WebSocket URL utilities for network-aware connections
 */

export function getWebSocketURL(port: number, path: string = ''): string {
  // Use the current hostname to ensure network machines can connect
  const hostname = window.location.hostname;
  const wsPath = path.startsWith('/') ? path : `/${path}`;
  return `ws://${hostname}:${port}${wsPath}`;
}

export function getBackendWebSocketURL(path: string = ''): string {
  return getWebSocketURL(4828, path);
}

export function getChartWebSocketURL(path: string = ''): string {
  return getWebSocketURL(8080, path);
}