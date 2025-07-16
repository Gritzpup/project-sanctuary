import { createClient, RedisClientType } from 'redis';

export interface TickerData {
  product_id: string;
  price: number;
  time: number;
  best_bid: string;
  best_ask: string;
  side: string;
  last_size: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

class RedisService {
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private isConnected = false;
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  private connectionPromise: Promise<void> | null = null;

  async connect() {
    if (this.isConnected) {
      console.log('Redis already connected');
      return;
    }

    if (this.connectionPromise) {
      console.log('Redis connection already in progress');
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect() {
    try {
      console.log('Connecting to Redis...');
      
      // Create main client for read/write
      this.client = createClient({
        url: 'redis://localhost:6379'
      });

      // Create separate client for subscriptions (Redis requires this)
      this.subscriber = createClient({
        url: 'redis://localhost:6379'
      });

      this.client.on('error', (err) => console.error('Redis Client Error:', err));
      this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));

      await this.client.connect();
      await this.subscriber.connect();

      // Set up message handler for all channels
      await this.subscriber.pSubscribe('*', (message, channel) => {
        console.log(`Redis received on channel ${channel}:`, message);
        const callbacks = this.subscriptions.get(channel);
        if (callbacks) {
          try {
            const data = JSON.parse(message);
            callbacks.forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error('Error in Redis subscription callback:', error);
              }
            });
          } catch (error) {
            console.error('Error parsing Redis message:', error);
          }
        }
      });

      this.isConnected = true;
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.isConnected = false;
    this.connectionPromise = null;
  }

  // Publish ticker data
  async publishTicker(ticker: TickerData) {
    if (!this.client) {
      console.error('Redis not connected, cannot publish ticker');
      return;
    }

    const channel = `ticker:${ticker.product_id}`;
    const data = {
      ...ticker,
      timestamp: Date.now()
    };

    console.log(`Publishing to Redis channel ${channel}:`, data);

    // Publish to channel
    await this.client.publish(channel, JSON.stringify(data));

    // Store latest price
    await this.client.hSet(`price:${ticker.product_id}`, {
      price: ticker.price.toString(),
      time: ticker.time.toString(),
      timestamp: Date.now().toString()
    });

    // Add to price stream for history
    await this.client.xAdd(
      `price:stream:${ticker.product_id}`,
      '*',
      {
        price: ticker.price.toString(),
        time: ticker.time.toString()
      }
    );

    // Trim stream to last 1000 entries
    await this.client.xTrim(`price:stream:${ticker.product_id}`, {
      strategy: 'MAXLEN',
      strategyModifier: '~',
      threshold: 1000
    });
  }

  // Subscribe to ticker updates
  async subscribeTicker(symbol: string, callback: (data: TickerData) => void) {
    await this.connect(); // Ensure connected
    
    const channel = `ticker:${symbol}`;
    console.log(`Subscribing to Redis channel: ${channel}`);
    
    // Add callback to local map
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  // Update current candle
  async updateCurrentCandle(symbol: string, granularity: string, candle: CandleData) {
    if (!this.client) {
      console.error('Redis not connected, cannot update candle');
      return;
    }

    const key = `candle:${symbol}:${granularity}:current`;
    
    await this.client.hSet(key, {
      time: candle.time.toString(),
      open: candle.open.toString(),
      high: candle.high.toString(),
      low: candle.low.toString(),
      close: candle.close.toString(),
      volume: (candle.volume || 0).toString()
    });

    // Publish candle update
    await this.client.publish(
      `candle:${symbol}:${granularity}`,
      JSON.stringify(candle)
    );

    // Set expiry to 5 minutes
    await this.client.expire(key, 300);
  }

  // Subscribe to candle updates
  async subscribeCandles(symbol: string, granularity: string, callback: (data: CandleData) => void) {
    await this.connect(); // Ensure connected
    
    const channel = `candle:${symbol}:${granularity}`;
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  // Get current candle
  async getCurrentCandle(symbol: string, granularity: string): Promise<CandleData | null> {
    if (!this.client) {
      console.error('Redis not connected');
      return null;
    }

    const key = `candle:${symbol}:${granularity}:current`;
    const data = await this.client.hGetAll(key);

    if (!data || !data.time) return null;

    return {
      time: parseInt(data.time),
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      close: parseFloat(data.close),
      volume: data.volume ? parseFloat(data.volume) : 0
    };
  }

  // Get latest price
  async getLatestPrice(symbol: string): Promise<{ price: number; time: number } | null> {
    if (!this.client) {
      console.error('Redis not connected');
      return null;
    }

    const data = await this.client.hGetAll(`price:${symbol}`);
    
    if (!data || !data.price) return null;

    return {
      price: parseFloat(data.price),
      time: parseInt(data.time)
    };
  }

  // Mark WebSocket as connected
  async setWebSocketConnected(connected: boolean) {
    if (!this.client) {
      console.error('Redis not connected');
      return;
    }

    if (connected) {
      await this.client.set('websocket:connected', 'true', { EX: 30 });
    } else {
      await this.client.del('websocket:connected');
    }
  }

  // Check if WebSocket is connected
  async isWebSocketConnected(): Promise<boolean> {
    if (!this.client) return false;

    const result = await this.client.get('websocket:connected');
    return result === 'true';
  }

  // Add subscribed symbol
  async addSubscription(symbol: string) {
    if (!this.client) {
      console.error('Redis not connected');
      return;
    }

    await this.client.sAdd('websocket:subscriptions', symbol);
  }

  // Remove subscribed symbol
  async removeSubscription(symbol: string) {
    if (!this.client) {
      console.error('Redis not connected');
      return;
    }

    await this.client.sRem('websocket:subscriptions', symbol);
  }

  // Get all subscriptions
  async getSubscriptions(): Promise<string[]> {
    if (!this.client) {
      console.error('Redis not connected');
      return [];
    }

    return await this.client.sMembers('websocket:subscriptions');
  }
}

// Export singleton instance
export const redisService = new RedisService();