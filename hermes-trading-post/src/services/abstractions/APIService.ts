import { ServiceBase } from '../core/ServiceBase';

/**
 * Configuration for API requests
 */
export interface APIRequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  cache?: boolean;
  cacheTTL?: number;
}

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  requestId: string;
}

/**
 * API error with additional context
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Abstract base class for API services
 * Provides common patterns for HTTP requests, error handling, and response processing
 */
export abstract class APIService extends ServiceBase {
  protected baseURL: string = '';
  protected defaultHeaders: Record<string, string> = {};
  protected defaultTimeout: number = 30000;
  protected defaultRetries: number = 3;
  protected defaultRetryDelay: number = 1000;
  protected requestCounter: number = 0;
  protected activeRequests: Map<string, AbortController> = new Map();
  protected rateLimiter: Map<string, number> = new Map();

  /**
   * Make a GET request
   */
  protected async get<T = any>(
    endpoint: string, 
    config?: APIRequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, config);
  }

  /**
   * Make a POST request
   */
  protected async post<T = any>(
    endpoint: string, 
    data?: any, 
    config?: APIRequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('POST', endpoint, data, config);
  }

  /**
   * Make a PUT request
   */
  protected async put<T = any>(
    endpoint: string, 
    data?: any, 
    config?: APIRequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('PUT', endpoint, data, config);
  }

  /**
   * Make a DELETE request
   */
  protected async delete<T = any>(
    endpoint: string, 
    config?: APIRequestConfig
  ): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, config);
  }

  /**
   * Make a generic HTTP request with full control
   */
  protected async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    config?: APIRequestConfig
  ): Promise<APIResponse<T>> {
    this.assertInitialized();
    this.assertNotDisposed();

    const requestId = this.generateRequestId();
    const fullConfig = this.mergeConfig(config);
    const url = this.buildURL(endpoint);

    // Check rate limiting
    await this.checkRateLimit(endpoint);

    // Create abort controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      // Emit request start event
      this.emit('request:start', { 
        requestId, 
        method, 
        url, 
        data: this.sanitizeForLogging(data) 
      });

      const response = await this.executeRequestWithRetry(
        method,
        url,
        data,
        fullConfig,
        abortController.signal,
        requestId
      );

      // Emit success event
      this.emit('request:success', { 
        requestId, 
        method, 
        url, 
        status: response.status,
        duration: Date.now() 
      });

      return response;

    } catch (error) {
      // Emit error event
      this.emit('request:error', { 
        requestId, 
        method, 
        url, 
        error: error.message 
      });
      
      throw error;
    } finally {
      // Clean up
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Cancel all active requests
   */
  public cancelAllRequests(): void {
    for (const [requestId, controller] of this.activeRequests) {
      controller.abort();
      this.emit('request:cancelled', { requestId });
    }
    this.activeRequests.clear();
  }

  /**
   * Cancel specific request
   */
  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      this.emit('request:cancelled', { requestId });
      return true;
    }
    return false;
  }

  /**
   * Get API health status
   */
  public async isHealthy(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  protected async onInitialize(): Promise<void> {
    // Perform initial health check
    try {
      await this.healthCheck();
      this.emit('api:healthy', {});
    } catch (error) {
      this.emit('api:unhealthy', { error });
      console.warn(`API service ${this.constructor.name} failed health check:`, error);
    }
  }

  protected async onDispose(): Promise<void> {
    // Cancel all active requests
    this.cancelAllRequests();
    
    // Clear rate limiter
    this.rateLimiter.clear();
  }

  /**
   * Abstract methods for subclasses
   */
  protected abstract healthCheck(): Promise<void>;
  protected abstract authenticate(): Promise<void>;

  /**
   * Build full URL from endpoint
   */
  private buildURL(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    return `${this.baseURL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  }

  /**
   * Merge default config with request config
   */
  private mergeConfig(config?: APIRequestConfig): Required<APIRequestConfig> {
    return {
      timeout: config?.timeout || this.defaultTimeout,
      retries: config?.retries || this.defaultRetries,
      retryDelay: config?.retryDelay || this.defaultRetryDelay,
      headers: { ...this.defaultHeaders, ...config?.headers },
      cache: config?.cache || false,
      cacheTTL: config?.cacheTTL || 5 * 60 * 1000
    };
  }

  /**
   * Execute request with retry logic
   */
  private async executeRequestWithRetry<T>(
    method: string,
    url: string,
    data: any,
    config: Required<APIRequestConfig>,
    signal: AbortSignal,
    requestId: string
  ): Promise<APIResponse<T>> {
    let lastError: Error;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        return await this.executeRequest<T>(method, url, data, config, signal, requestId);
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error instanceof APIError) {
          if (error.status >= 400 && error.status < 500 && error.status !== 429) {
            // Client errors (except rate limiting) shouldn't be retried
            throw error;
          }
        }

        if (signal.aborted) {
          throw new Error('Request was cancelled');
        }

        if (attempt === config.retries) {
          break; // Don't wait after last attempt
        }

        // Wait before retry with exponential backoff
        const delay = config.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.emit('request:retry', { 
          requestId,
          attempt: attempt + 1, 
          maxRetries: config.retries, 
          error: error.message
        });
      }
    }

    throw lastError;
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    data: any,
    config: Required<APIRequestConfig>,
    signal: AbortSignal,
    requestId: string
  ): Promise<APIResponse<T>> {
    const fetchOptions: RequestInit = {
      method,
      headers: config.headers,
      signal,
      ...(data && method !== 'GET' && { body: JSON.stringify(data) })
    };

    // Add Content-Type for requests with body
    if (data && method !== 'GET') {
      fetchOptions.headers = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      };
    }

    const response = await fetch(url, fetchOptions);

    // Parse response
    let responseData: T;
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text() as unknown as T;
    }

    // Check if response is successful
    if (!response.ok) {
      throw new APIError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        responseData,
        requestId
      );
    }

    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      requestId
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.constructor.name}-${Date.now()}-${++this.requestCounter}`;
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(endpoint: string): Promise<void> {
    const now = Date.now();
    const lastRequest = this.rateLimiter.get(endpoint);
    
    if (lastRequest && now - lastRequest < 100) { // 100ms minimum between requests
      const delay = 100 - (now - lastRequest);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.rateLimiter.set(endpoint, Date.now());
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  private sanitizeForLogging(data: any): any {
    if (!data) return data;
    
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}