import type { CandleData, Position, Signal, StrategyConfig, StrategyState, Trade } from './StrategyTypes';

export abstract class Strategy {
  protected name: string;
  protected description: string;
  protected config: StrategyConfig;
  protected state: StrategyState;

  constructor(name: string, description: string, config: StrategyConfig) {
    this.name = name;
    this.description = description;
    this.config = config;
    this.state = {
      positions: [],
      balance: {
        usd: 0,
        btcVault: 0,
        btcPositions: 0,
        vault: 0
      }
    };
  }

  // Core strategy methods that must be implemented
  abstract analyze(candles: CandleData[], currentPrice: number): Signal;
  abstract calculatePositionSize(balance: number, signal: Signal, currentPrice: number): number;
  abstract shouldTakeProfit(position: Position, currentPrice: number): boolean;
  abstract shouldStopLoss(position: Position, currentPrice: number): boolean;
  abstract getRequiredHistoricalData(): number; // Number of candles needed
  
  // Optional: Strategy can specify required timeframe
  getRequiredGranularity(): string | null {
    return null; // null means any granularity is acceptable
  }
  
  getRequiredPeriod(): string | null {
    return null; // null means any period is acceptable
  }

  // Common methods with default implementations
  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getConfig(): StrategyConfig {
    return this.config;
  }

  updateConfig(config: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): StrategyState {
    return this.state;
  }

  setState(state: StrategyState): void {
    this.state = state;
  }

  // Position management
  addPosition(position: Position): void {
    this.state.positions.push(position);
  }

  removePosition(position: Position): void {
    this.state.positions = this.state.positions.filter(p => p !== position);
  }

  getPositions(): Position[] {
    return this.state.positions;
  }

  getTotalPositionSize(): number {
    return this.state.positions.reduce((sum, p) => sum + p.size, 0);
  }

  // Profit allocation according to strategy config
  allocateProfits(profit: number): { vault: number; btc: number; retained: number } {
    const vaultAmount = (profit * this.config.vaultAllocation) / 100;
    const btcGrowthAmount = (profit * this.config.btcGrowthAllocation) / 100;
    const retainedAmount = profit - vaultAmount - btcGrowthAmount;

    return {
      vault: vaultAmount,
      btc: btcGrowthAmount,
      retained: retainedAmount
    };
  }

  // Risk management
  checkMaxDrawdown(currentValue: number, peakValue: number): boolean {
    if (!this.config.maxDrawdown) return false;
    const drawdown = ((peakValue - currentValue) / peakValue) * 100;
    return drawdown >= this.config.maxDrawdown;
  }

  // Validation
  validateSignal(signal: Signal, balance: number, currentPrice: number): boolean {
    if (signal.type === 'buy') {
      const requiredBalance = signal.size ? signal.size * currentPrice : 0;
      return balance >= requiredBalance;
    }
    if (signal.type === 'sell') {
      const btcBalance = this.getTotalPositionSize();
      return signal.size ? btcBalance >= signal.size : btcBalance > 0;
    }
    return true;
  }

  // Reset strategy state - override in derived classes if needed
  reset(): void {
    this.state.positions = [];
  }

  // For compatibility with paper trading service
  private lastSignal: Signal | null = null;

  update(candles: CandleData[], currentPrice: number): void {
    this.lastSignal = this.analyze(candles, currentPrice);
  }

  getSignal(): Signal | null {
    return this.lastSignal;
  }
}