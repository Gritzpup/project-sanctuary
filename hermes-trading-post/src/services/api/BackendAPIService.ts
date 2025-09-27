import { UnifiedAPIClient } from './UnifiedAPIClient';

export interface BotStatus {
  isRunning: boolean;
  isPaused: boolean;
  balance: {
    usd: number;
    btc: number;
  };
  currentPrice: number;
  positions: any[];
  trades: any[];
  strategyType?: string;
  positionCount: number;
  totalValue: number;
}

export interface BotConfig {
  strategyType: string;
  strategyConfig: Record<string, any>;
}

export interface ManagerState {
  strategies: Record<string, any>;
  activeBot: any;
  selectedStrategy: string;
}

export class BackendAPIService {
  private static instance: BackendAPIService;
  private apiClient: UnifiedAPIClient;
  private baseURL = 'http://localhost:4827';

  private constructor() {
    this.apiClient = UnifiedAPIClient.getInstance();
    
    // Configure for backend API (no rate limiting needed for local)
    this.apiClient.configureRateLimit({
      requestsPerSecond: 50,
      burstSize: 100
    });
  }

  public static getInstance(): BackendAPIService {
    if (!BackendAPIService.instance) {
      BackendAPIService.instance = new BackendAPIService();
    }
    return BackendAPIService.instance;
  }

  // Bot Management
  public async createBot(strategyType: string, botName: string, config: any): Promise<{ botId: string }> {
    return this.apiClient.retryRequest(
      () => this.apiClient.post(`${this.baseURL}/api/trading/bots`, {
        strategyType,
        botName,
        config
      }),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async deleteBot(botId: string): Promise<void> {
    return this.apiClient.retryRequest(
      () => this.apiClient.delete(`${this.baseURL}/api/trading/bots/${botId}`),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async selectBot(botId: string): Promise<void> {
    return this.apiClient.retryRequest(
      () => this.apiClient.post(`${this.baseURL}/api/trading/bots/${botId}/select`),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  // Trading Operations
  public async startTrading(config: BotConfig): Promise<void> {
    return this.apiClient.retryRequest(
      () => this.apiClient.post(`${this.baseURL}/api/trading/start`, config),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async stopTrading(botId?: string): Promise<void> {
    const payload = botId ? { botId } : {};
    return this.apiClient.retryRequest(
      () => this.apiClient.post(`${this.baseURL}/api/trading/stop`, payload),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async pauseTrading(botId?: string): Promise<void> {
    const payload = botId ? { botId } : {};
    return this.apiClient.retryRequest(
      () => this.apiClient.post(`${this.baseURL}/api/trading/pause`, payload),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async resumeTrading(botId?: string): Promise<void> {
    const payload = botId ? { botId } : {};
    return this.apiClient.retryRequest(
      () => this.apiClient.post(`${this.baseURL}/api/trading/resume`, payload),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async resetBot(botId?: string): Promise<void> {
    const payload = botId ? { botId } : {};
    return this.apiClient.retryRequest(
      () => this.apiClient.post(`${this.baseURL}/api/trading/reset`, payload),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  // Status and State
  public async getBotStatus(): Promise<BotStatus> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get<BotStatus>(`${this.baseURL}/api/trading/status`),
      { maxRetries: 3, baseDelay: 200 }
    );
  }

  public async getManagerState(): Promise<ManagerState> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get<ManagerState>(`${this.baseURL}/api/trading/manager/state`),
      { maxRetries: 3, baseDelay: 200 }
    );
  }

  // Strategy Management
  public async updateStrategy(strategy: any): Promise<void> {
    return this.apiClient.retryRequest(
      () => this.apiClient.put(`${this.baseURL}/api/trading/strategy`, strategy),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async getAvailableStrategies(): Promise<string[]> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get<string[]>(`${this.baseURL}/api/trading/strategies`),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  // Price Updates
  public async updateRealtimePrice(price: number, productId: string): Promise<void> {
    return this.apiClient.post(`${this.baseURL}/api/trading/price`, {
      price,
      product_id: productId,
      timestamp: Date.now()
    });
  }

  // Health Check
  public async isHealthy(): Promise<boolean> {
    try {
      const response = await this.apiClient.get(`${this.baseURL}/health`);
      return response.status === 'healthy';
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }

  // Get detailed health info
  public async getHealthInfo(): Promise<any> {
    return this.apiClient.retryRequest(
      () => this.apiClient.get(`${this.baseURL}/health`),
      { maxRetries: 1, baseDelay: 1000 }
    );
  }

  // Historical Data
  public async getTradeHistory(botId?: string): Promise<any[]> {
    const url = botId 
      ? `${this.baseURL}/api/trading/bots/${botId}/trades`
      : `${this.baseURL}/api/trading/trades`;
    
    return this.apiClient.retryRequest(
      () => this.apiClient.get<any[]>(url),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  public async getPositionHistory(botId?: string): Promise<any[]> {
    const url = botId 
      ? `${this.baseURL}/api/trading/bots/${botId}/positions`
      : `${this.baseURL}/api/trading/positions`;
    
    return this.apiClient.retryRequest(
      () => this.apiClient.get<any[]>(url),
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  // Performance Metrics
  public async getPerformanceMetrics(botId?: string): Promise<any> {
    const url = botId 
      ? `${this.baseURL}/api/trading/bots/${botId}/performance`
      : `${this.baseURL}/api/trading/performance`;
    
    return this.apiClient.retryRequest(
      () => this.apiClient.get(url),
      { maxRetries: 2, baseDelay: 500 }
    );
  }
}