/**
 * Service Abstractions
 * 
 * This module provides abstract base classes for common service patterns.
 * These abstractions build on top of the core ServiceBase class to provide
 * specialized functionality for different types of services.
 */

export { DataService } from './DataService';
export { StateService } from './StateService';
export { APIService, APIError, type APIRequestConfig, type APIResponse } from './APIService';
export { 
  WebSocketService, 
  WebSocketState, 
  type WebSocketMessage, 
  type WebSocketConfig 
} from './WebSocketService';

/**
 * Usage Examples:
 * 
 * 1. Data Service:
 * ```typescript
 * class UserDataService extends DataService<User[], { role?: string }> {
 *   protected async fetchData(params: { role?: string }): Promise<User[]> {
 *     return await this.api.getUsers(params);
 *   }
 *   
 *   protected getCacheKey(params: { role?: string }): string {
 *     return `users-${params.role || 'all'}`;
 *   }
 * }
 * ```
 * 
 * 2. State Service:
 * ```typescript
 * interface AppState {
 *   user: User | null;
 *   theme: 'light' | 'dark';
 * }
 * 
 * class AppStateService extends StateService<AppState> {
 *   protected getInitialState(): AppState {
 *     return { user: null, theme: 'light' };
 *   }
 *   
 *   protected validateState(state: AppState): { valid: boolean; errors: string[] } {
 *     return { valid: true, errors: [] };
 *   }
 *   
 *   public setUser(user: User): void {
 *     this.setState({ user });
 *   }
 * }
 * ```
 * 
 * 3. API Service:
 * ```typescript
 * class TradingAPIService extends APIService {
 *   constructor() {
 *     super();
 *     this.baseURL = 'https://api.trading.com';
 *     this.defaultHeaders = { 'X-API-Key': process.env.API_KEY };
 *   }
 *   
 *   protected async healthCheck(): Promise<void> {
 *     await this.get('/health');
 *   }
 *   
 *   protected async authenticate(): Promise<void> {
 *     // Authentication logic
 *   }
 *   
 *   public async getTrades(): Promise<Trade[]> {
 *     const response = await this.get<Trade[]>('/trades');
 *     return response.data;
 *   }
 * }
 * ```
 * 
 * 4. WebSocket Service:
 * ```typescript
 * class TradingWebSocketService extends WebSocketService {
 *   constructor() {
 *     super({
 *       url: 'wss://api.trading.com/ws',
 *       heartbeatInterval: 30000,
 *       autoReconnect: true
 *     });
 *   }
 *   
 *   protected onConnected(): void {
 *     this.subscribe(['trades', 'prices']);
 *   }
 *   
 *   protected onMessage(message: WebSocketMessage): void {
 *     if (message.type === 'trade') {
 *       this.emit('trade:received', message.data);
 *     }
 *   }
 *   
 *   public subscribe(channels: string[]): void {
 *     this.send({ type: 'subscribe', data: { channels } });
 *   }
 * }
 * ```
 * 
 * 5. Service Registration:
 * ```typescript
 * // Register services in ServiceInitializer
 * ServiceInitializer.registerService('userData', () => new UserDataService());
 * ServiceInitializer.registerService('appState', () => new AppStateService());
 * ServiceInitializer.registerService('tradingAPI', () => new TradingAPIService());
 * ServiceInitializer.registerService('tradingWS', () => new TradingWebSocketService());
 * 
 * // Use services
 * const userData = ServiceInitializer.getService<UserDataService>('userData');
 * const users = await userData.getData({ role: 'admin' });
 * ```
 */