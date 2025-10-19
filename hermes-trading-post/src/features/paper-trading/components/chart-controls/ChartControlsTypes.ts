export interface ChartControlsProps {
  selectedPeriod: string;
  chartSpeed: string;
  selectedTestDateString: string;
  isRunning: boolean;
  isPaused: boolean;
  tradingData: { totalReturn?: number } | null;
  selectedGranularity: string;
}

export interface PeriodChangeEvent {
  period: string;
}

export interface SpeedChangeEvent {
  speed: string;
}

export interface DateChangeEvent {
  date: string;
}

export const PERIODS = ['1H', '2H', '4H', '6H', '12H', '1D'] as const;
export const SPEEDS = ['0.25x', '0.5x', '1x', '2x', '4x', '8x', '16x', '32x'] as const;

export type Period = typeof PERIODS[number];
export type Speed = typeof SPEEDS[number];