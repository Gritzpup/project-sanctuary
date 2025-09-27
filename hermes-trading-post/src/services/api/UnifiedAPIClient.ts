import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface APIError {
  message: string;
  status?: number;
  code?: string;
  originalError?: any;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize: number;
}

export class UnifiedAPIClient {
  private static instance: UnifiedAPIClient;
  private axiosInstance: AxiosInstance;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private rateLimitConfig: RateLimitConfig;
  private lastRequestTime = 0;
  private requestCount = 0;
  private burstTokens: number;

  private constructor() {
    // Default rate limiting: 10 requests per second with burst of 20
    this.rateLimitConfig = {
      requestsPerSecond: 10,
      burstSize: 20
    };
    this.burstTokens = this.rateLimitConfig.burstSize;

    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HermesTradingPost/1.0'
      }
    });

    this.setupInterceptors();
    this.startTokenRefill();
  }

  public static getInstance(): UnifiedAPIClient {
    if (!UnifiedAPIClient.instance) {
      UnifiedAPIClient.instance = new UnifiedAPIClient();
    }
    return UnifiedAPIClient.instance;
  }

  private setupInterceptors() {
    // Request interceptor for rate limiting
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        await this.waitForRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        const apiError: APIError = {
          message: error.message || 'API request failed',
          status: error.response?.status,
          code: error.code,
          originalError: error
        };
        return Promise.reject(apiError);
      }
    );
  }

  private async waitForRateLimit(): Promise<void> {
    return new Promise((resolve) => {
      const checkTokens = () => {
        if (this.burstTokens > 0) {
          this.burstTokens--;
          resolve();
        } else {
          // Wait for next token
          setTimeout(checkTokens, 1000 / this.rateLimitConfig.requestsPerSecond);
        }
      };
      checkTokens();
    });
  }

  private startTokenRefill() {
    setInterval(() => {
      if (this.burstTokens < this.rateLimitConfig.burstSize) {
        this.burstTokens = Math.min(
          this.burstTokens + this.rateLimitConfig.requestsPerSecond,
          this.rateLimitConfig.burstSize
        );
      }
    }, 1000);
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.get(url, config);
    return response.data;
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.post(url, data, config);
    return response.data;
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.put(url, data, config);
    return response.data;
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.delete(url, config);
    return response.data;
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.patch(url, data, config);
    return response.data;
  }

  // Retry wrapper for failed requests
  public async retryRequest<T = any>(
    requestFn: () => Promise<T>,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
      ...retryConfig
    };

    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        if (attempt === config.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.exponentialBase, attempt),
          config.maxDelay
        );

        console.warn(`API request failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${delay}ms:`, error);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configure rate limiting
  public configureRateLimit(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
    this.burstTokens = this.rateLimitConfig.burstSize;
  }

  // Set base URL for all requests
  public setBaseURL(baseURL: string): void {
    this.axiosInstance.defaults.baseURL = baseURL;
  }

  // Set default headers
  public setDefaultHeaders(headers: Record<string, string>): void {
    Object.assign(this.axiosInstance.defaults.headers, headers);
  }

  // Add authorization header
  public setAuthToken(token: string, type: 'Bearer' | 'Basic' | 'API-Key' = 'Bearer'): void {
    this.axiosInstance.defaults.headers.Authorization = `${type} ${token}`;
  }

  // Remove authorization header
  public clearAuth(): void {
    delete this.axiosInstance.defaults.headers.Authorization;
  }

  // Get current rate limit status
  public getRateLimitStatus(): { tokens: number; maxTokens: number } {
    return {
      tokens: this.burstTokens,
      maxTokens: this.rateLimitConfig.burstSize
    };
  }

  // Health check method
  public async healthCheck(url: string): Promise<boolean> {
    try {
      await this.get(url);
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}