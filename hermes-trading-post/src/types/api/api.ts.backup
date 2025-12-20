/**
 * @file api.ts
 * @description API and external service type definitions
 */

// ============================
// HTTP API Types
// ============================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================
// External API Types
// ============================

/**
 * Coinbase Pro API configuration
 */
export interface CoinbaseConfig {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  baseUrl: string;
  sandbox?: boolean;
}

/**
 * Market data API endpoints
 */
export interface MarketDataEndpoints {
  candles: string;
  ticker: string;
  trades: string;
  orderBook: string;
  stats: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
}

/**
 * API request configuration
 */
export interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: { [key: string]: string };
  params?: { [key: string]: any };
  data?: any;
  timeout?: number;
  retries?: number;
}

/**
 * WebSocket connection configuration
 */
export interface WebSocketConfig {
  url: string;
  channels: string[];
  productIds: string[];
  heartbeat?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Cache configuration for API responses
 */
export interface ApiCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size
  keyPrefix?: string;
}

// ============================
// Service Integration Types
// ============================

/**
 * External service status
 */
export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: number;
  responseTime?: number;
  error?: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  services: ServiceStatus[];
  uptime: number;
  version: string;
}

/**
 * Monitoring metrics
 */
export interface MetricsData {
  timestamp: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: string;
  timestamp: number;
  data: any;
  signature?: string;
}

/**
 * Authentication token
 */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: 'Bearer' | 'API-Key';
}

/**
 * User session data
 */
export interface SessionData {
  userId: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  permissions: string[];
  metadata?: { [key: string]: any };
}