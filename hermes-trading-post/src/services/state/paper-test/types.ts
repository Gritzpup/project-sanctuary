/**
 * @file types.ts
 * @description Type definitions for paper test service
 */

// Note: ChartDataFeed module not yet implemented - using 'any' as placeholder
import type { Strategy } from '../../../strategies/base/Strategy';
import type { CandleData } from '../../../types/coinbase';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

type ChartDataFeed = any;

export interface PaperTestOptions {
  date: Date;
  strategy: Strategy;
  initialBalance: number;
  chart: IChartApi;
  candleSeries: ISeriesApi<'Candlestick'>;
  dataFeed: ChartDataFeed;
  granularity: string;
  initialDisplayCandles?: number;
  onProgress?: (progress: number, simTime: number) => void;
  onTrade?: (trade: any) => void;
  onComplete?: (results: PaperTestResults) => void;
  onCandle?: (candle: CandleData) => void;
  onPositionUpdate?: (positions: any[], balance: number, btcBalance: number) => void;
  debug?: boolean;
}

export interface PaperTestResults {
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  finalBalance: number;
  trades: any[];
  maxDrawdown: number;
}

export interface PaperTestState {
  isRunning: boolean;
  animationFrameId: number | null;
  startTime: number;
  currentSimTime: number;
  endTime: number;
  candles: CandleData[];
  currentCandleIndex: number;
  trades: any[];
  balance: number;
  btcBalance: number;
  positions: any[];
  dataFeed: ChartDataFeed | null;
  processedCandles: CandleData[];
  currentOptions: PaperTestOptions | null;
  lastLoggedProgress: number;
}

export interface PlaybackState {
  playbackSpeed: number;
  isPaused: boolean;
  pausedAtProgress: number;
  animationStartTime: number;
  totalElapsedBeforePause: number;
}

export interface ChartState {
  markers: any[];
}

export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  timestamp: number;
  time: string;
}

export interface Position {
  entryPrice: number;
  entryTime: number;
  size: number;
  type: 'long';
  metadata: any;
}

export interface ChartMarker {
  time: Time;
  position: 'belowBar' | 'aboveBar';
  shape: 'arrowUp' | 'arrowDown';
  color: string;
  text: string;
}