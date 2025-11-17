export class SubscriptionManager {
  private subscriptions: Map<string, { count: number; lastAccess: number }> = new Map();

  public async initialize(): Promise<void> {
  }

  public async subscribe(symbol: string, granularity: string): Promise<void> {
    const key = `${symbol}:${granularity}`;
    const existing = this.subscriptions.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastAccess = Date.now();
    } else {
      this.subscriptions.set(key, { count: 1, lastAccess: Date.now() });
    }
    
  }

  public async unsubscribe(symbol: string, granularity: string): Promise<void> {
    const key = `${symbol}:${granularity}`;
    const existing = this.subscriptions.get(key);
    
    if (existing) {
      existing.count--;
      if (existing.count <= 0) {
        this.subscriptions.delete(key);
      }
    }
    
  }

  public getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  public async cleanup(): Promise<void> {
    this.subscriptions.clear();
  }
}