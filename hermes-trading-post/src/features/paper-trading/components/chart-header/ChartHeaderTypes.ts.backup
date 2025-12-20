export interface ChartHeaderProps {
  selectedPair: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  botTabs: any[];
  activeBotInstance: any;
  selectedGranularity: string;
}

export interface PairOption {
  value: string;
  label: string;
}

export interface GranularityOption {
  value: string;
  label: string;
}

export const PAIR_OPTIONS: PairOption[] = [
  { value: 'BTC-USD', label: 'BTC/USD Chart' },
  { value: 'ETH-USD', label: 'ETH/USD Chart' },
  { value: 'PAXG-USD', label: 'PAXG/USD Chart' }
];

// ✅ Only API-validated granularities
export const GRANULARITY_OPTIONS: GranularityOption[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '1d', label: '1D' }
];

export interface BotTab {
  id: string;
  name: string;
  status: string;
}