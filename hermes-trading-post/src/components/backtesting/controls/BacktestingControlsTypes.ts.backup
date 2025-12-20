export interface BacktestingControlsProps {
  selectedStrategyType: string;
  strategies: Array<any>;
  strategyParams: Record<string, any>;
  startBalance: number;
  makerFeePercent: number;
  takerFeePercent: number;
  feeRebatePercent: number;
  isSynced: boolean;
  paperTradingActive: boolean;
  isRunning: boolean;
  currentPrice: number;
  customPresets: Array<any>;
  selectedPresetIndex: number;
  showSaveSuccess: boolean;
  showSyncSuccess: boolean;
}

export interface StrategyConfig {
  strategyType: string;
  params: Record<string, any>;
  balance: number;
  fees: {
    maker: number;
    taker: number;
    rebate: number;
  };
}

export interface BackupData {
  key: string;
  name: string;
  description: string;
  timestamp: string;
  config: StrategyConfig;
}

export interface StrategyCode {
  name: string;
  label: string;
  description: string;
  code: string;
}

export type TabType = 'config' | 'code' | 'backups';

export interface CustomPreset {
  name: string;
  config: StrategyConfig;
}

export const DEFAULT_FEES = {
  maker: 0.005,
  taker: 0.005,
  rebate: 0.0
};