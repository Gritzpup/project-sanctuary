/**
 * @file rateLimiter.ts
 * @description Prevents API rate limit violations
 */

export class RateLimiter {
  private queue: Array<() => void> = [];
  private inProgress = 0;
  private readonly maxConcurrent: number;
  private readonly minDelay: number;
  private lastRequestTime = 0;
  private retryDelays = new Map<string, number>();
  
  constructor(requestsPerSecond: number = 10, maxConcurrent: number = 3) {
    this.minDelay = 1000 / requestsPerSecond; // milliseconds between requests
    this.maxConcurrent = maxConcurrent;
  }
  
  async execute<T>(key: string, fn: () => Promise<T>, retryCount: number = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        this.inProgress++;
        
        try {
          // Wait for minimum delay between requests
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minDelay) {
            await this.delay(this.minDelay - timeSinceLastRequest);
          }
          
          this.lastRequestTime = Date.now();
          const result = await fn();
          
          // Clear retry delay on success
          this.retryDelays.delete(key);
          
          resolve(result);
        } catch (error: any) {
          if (error?.response?.status === 429 && retryCount < 3) {
            // Rate limited - use exponential backoff with max retries
            const baseDelay = 1000;
            const currentDelay = baseDelay * Math.pow(2, retryCount); // 1s, 2s, 4s
            const jitteredDelay = currentDelay + Math.random() * 500; // Add jitter
            
            console.warn(`Rate limited for ${key}, retry ${retryCount + 1}/3 after ${Math.round(jitteredDelay)}ms`);
            
            this.inProgress--;
            
            // Schedule retry with incremented count
            setTimeout(() => {
              this.execute(key, fn, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, jitteredDelay);
          } else {
            // Either not a rate limit error or max retries reached
            if (retryCount >= 3) {
              console.error(`Max retries reached for ${key}`);
            }
            reject(error);
          }
        } finally {
          this.inProgress--;
          this.processQueue();
        }
      };
      
      this.queue.push(executeRequest);
      this.processQueue();
    });
  }
  
  private processQueue() {
    while (this.queue.length > 0 && this.inProgress < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Get current queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      inProgress: this.inProgress,
      hasRetryDelays: this.retryDelays.size > 0
    };
  }
  
  // Clear the queue (useful for cleanup)
  clearQueue() {
    this.queue = [];
    this.retryDelays.clear();
  }
}