import { ServiceBase } from '../core/ServiceBase';

/**
 * Abstract base class for data services
 * Provides common patterns for data fetching, caching, and synchronization
 */
export abstract class DataService<TData = any, TParams = any> extends ServiceBase {
  protected cache: Map<string, { data: TData; timestamp: number; ttl: number }> = new Map();
  protected loading: Map<string, Promise<TData>> = new Map();
  protected defaultTTL: number = 5 * 60 * 1000; // 5 minutes
  protected maxRetries: number = 3;
  protected retryDelay: number = 1000;

  /**
   * Get data with automatic caching and deduplication
   */
  public async getData(params: TParams, options?: {
    ttl?: number;
    forceRefresh?: boolean;
    retries?: number;
  }): Promise<TData> {
    this.assertInitialized();
    this.assertNotDisposed();

    const cacheKey = this.getCacheKey(params);
    const ttl = options?.ttl || this.defaultTTL;
    const forceRefresh = options?.forceRefresh || false;
    const maxRetries = options?.retries || this.maxRetries;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Check if already loading this data
    const existingRequest = this.loading.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    // Start new request with retry logic
    const request = this.fetchWithRetry(params, maxRetries);
    this.loading.set(cacheKey, request);

    try {
      const data = await request;
      
      // Cache the result
      this.setCache(cacheKey, data, ttl);
      
      // Emit data loaded event
      this.emit('data:loaded', { key: cacheKey, data, params });
      
      return data;
    } catch (error) {
      // Emit error event
      this.emit('data:error', { key: cacheKey, error, params });
      throw error;
    } finally {
      // Clean up loading state
      this.loading.delete(cacheKey);
    }
  }

  /**
   * Invalidate cache for specific parameters
   */
  public invalidateCache(params?: TParams): void {
    if (params) {
      const cacheKey = this.getCacheKey(params);
      this.cache.delete(cacheKey);
      this.emit('cache:invalidated', { key: cacheKey, params });
    } else {
      // Clear all cache
      this.cache.clear();
      this.emit('cache:cleared', {});
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    hitRate: number;
    keys: string[];
  } {
    const keys = Array.from(this.cache.keys());
    return {
      size: this.cache.size,
      hitRate: this.calculateHitRate(),
      keys
    };
  }

  /**
   * Preload data (fire and forget)
   */
  public async preload(params: TParams, options?: { ttl?: number }): Promise<void> {
    try {
      await this.getData(params, options);
    } catch (error) {
      // Preload failures are not critical
    }
  }

  protected async onInitialize(): Promise<void> {
    // Start background cache cleanup
    this.startCacheCleanup();
  }

  protected async onDispose(): Promise<void> {
    // Clear all caches and pending requests
    this.cache.clear();
    this.loading.clear();
  }

  /**
   * Abstract method for fetching data
   */
  protected abstract fetchData(params: TParams): Promise<TData>;

  /**
   * Generate cache key from parameters
   */
  protected abstract getCacheKey(params: TParams): string;

  /**
   * Fetch data with retry logic
   */
  private async fetchWithRetry(params: TParams, maxRetries: number): Promise<TData> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetchData(params);
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break; // Don't wait after last attempt
        }

        // Wait before retry with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.emit('data:retry', { 
          attempt: attempt + 1, 
          maxRetries, 
          error, 
          params 
        });
      }
    }

    throw lastError;
  }

  private getFromCache(key: string): TData | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: TData, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private calculateHitRate(): number {
    // This would need hit/miss tracking to be implemented
    return 0; // Placeholder
  }

  private startCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    const cleanup = () => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(key);
        }
      }
    };

    // Run cleanup every 5 minutes
    setInterval(cleanup, 5 * 60 * 1000);
  }
}