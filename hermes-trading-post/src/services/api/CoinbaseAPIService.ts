import { UnifiedAPIClient } from './UnifiedAPIClient';

export interface CoinbaseTicker {
  ask: string;
  bid: string;
  volume: string;
  trade_id: number;
  price: string;
  size: string;
  time: string;
}

export interface CoinbaseCandle {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

export interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  base_min_size: string;
  base_max_size: string;
  quote_increment: string;
  base_increment: string;
  display_name: string;
  min_market_funds: string;
  max_market_funds: string;
  margin_enabled: boolean;
  post_only: boolean;
  limit_only: boolean;
  cancel_only: boolean;
  trading_disabled: boolean;
  status: string;
  status_message: string;
}

export class CoinbaseAPIService {
  private static instance: CoinbaseAPIService;
  private apiClient: UnifiedAPIClient;
  private baseURL = 'https://api.exchange.coinbase.com';

  private constructor() {
    this.apiClient = UnifiedAPIClient.getInstance();
    this.apiClient.setBaseURL(this.baseURL);
    
    // Configure rate limiting for Coinbase API (10 requests per second)
    this.apiClient.configureRateLimit({
      requestsPerSecond: 8, // Be conservative
      burstSize: 15
    });
  }

  public static getInstance(): CoinbaseAPIService {
    if (!CoinbaseAPIService.instance) {
      CoinbaseAPIService.instance = new CoinbaseAPIService();
    }
    return CoinbaseAPIService.instance;
  }

  // Get current ticker for a product
  public async getTicker(productId: string): Promise<CoinbaseTicker> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get<CoinbaseTicker>(`/products/${productId}/ticker`),
      { maxRetries: 3, baseDelay: 500 }
    );
  }

  // Get historical candles
  public async getCandles(
    productId: string,
    start: string,
    end: string,
    granularity: number
  ): Promise<CoinbaseCandle[]> {
    const params = new URLSearchParams({
      start,
      end,
      granularity: granularity.toString()
    });

    const response = await this.apiClient.retryRequest(
      () => this.apiClient.get<number[][]>(`/products/${productId}/candles?${params}`),
      { maxRetries: 3, baseDelay: 1000 }
    );

    // Convert array format to object format
    return response.map(candle => ({
      time: candle[0],
      low: candle[1],
      high: candle[2],
      open: candle[3],
      close: candle[4],
      volume: candle[5]
    }));
  }

  // Get 24hr stats
  public async get24HrStats(productId: string): Promise<any> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get(`/products/${productId}/stats`),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  // Get all products
  public async getProducts(): Promise<CoinbaseProduct[]> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get<CoinbaseProduct[]>('/products'),
      { maxRetries: 2, baseDelay: 1000 }
    );
  }

  // Get product order book
  public async getOrderBook(productId: string, level: 1 | 2 | 3 = 1): Promise<any> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get(`/products/${productId}/book?level=${level}`),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  // Get recent trades
  public async getTrades(productId: string, limit = 100): Promise<any[]> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get(`/products/${productId}/trades?limit=${limit}`),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  // Get historical rates (simplified interface)
  public async getHistoricalRates(
    productId: string,
    start: Date,
    end: Date,
    granularity: '1m' | '5m' | '15m' | '1h' | '6h' | '1d'
  ): Promise<CoinbaseCandle[]> {
    const granularityMap = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400
    };

    return this.getCandles(
      productId,
      start.toISOString(),
      end.toISOString(),
      granularityMap[granularity]
    );
  }

  // Health check
  public async isHealthy(): Promise<boolean> {
    try {
      await this.apiClient.get('/time');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get current price (simple helper)
  public async getCurrentPrice(productId: string): Promise<number> {
    const ticker = await this.getTicker(productId);
    return parseFloat(ticker.price);
  }
}