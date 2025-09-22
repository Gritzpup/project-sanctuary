/**
 * Chart Theme Configurations
 * Centralized theme definitions for all charts
 */

import type { DeepPartial, ChartOptions } from 'lightweight-charts';

export interface ChartTheme {
  name: string;
  background: string;
  textColor: string;
  gridColor: string;
  borderColor: string;
  upColor: string;
  downColor: string;
  lineColor: string;
  areaTopColor: string;
  areaBottomColor: string;
}

export const CHART_THEMES: Record<string, ChartTheme> = {
  dark: {
    name: 'Dark',
    background: 'transparent',
    textColor: '#9ca3af',
    gridColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    upColor: '#26a69a',
    downColor: '#ef5350',
    lineColor: '#4CAF50',
    areaTopColor: 'rgba(76, 175, 80, 0.4)',
    areaBottomColor: 'rgba(76, 175, 80, 0.0)'
  },
  
  light: {
    name: 'Light',
    background: '#ffffff',
    textColor: '#374151',
    gridColor: 'rgba(0, 0, 0, 0.1)',
    borderColor: 'rgba(0, 0, 0, 0.2)',
    upColor: '#26a69a',
    downColor: '#ef5350',
    lineColor: '#2563eb',
    areaTopColor: 'rgba(37, 99, 235, 0.4)',
    areaBottomColor: 'rgba(37, 99, 235, 0.0)'
  },
  
  purple: {
    name: 'Purple',
    background: 'transparent',
    textColor: '#a78bfa',
    gridColor: 'rgba(167, 139, 250, 0.1)',
    borderColor: 'rgba(167, 139, 250, 0.2)',
    upColor: '#10b981',
    downColor: '#f59e0b',
    lineColor: '#8b5cf6',
    areaTopColor: 'rgba(139, 92, 246, 0.4)',
    areaBottomColor: 'rgba(139, 92, 246, 0.0)'
  }
};

export function getChartOptions(themeName: keyof typeof CHART_THEMES): DeepPartial<ChartOptions> {
  const theme = CHART_THEMES[themeName] || CHART_THEMES.dark;
  
  return {
    layout: {
      background: { color: theme.background },
      textColor: theme.textColor
    },
    grid: {
      vertLines: { color: theme.gridColor },
      horzLines: { color: theme.gridColor }
    },
    rightPriceScale: {
      borderColor: theme.borderColor
    },
    timeScale: {
      borderColor: theme.borderColor,
      timeVisible: true,
      secondsVisible: false
    },
    crosshair: {
      mode: 1
    },
    handleScroll: true,
    handleScale: true
  };
}

export function getCandlestickSeriesOptions(themeName: keyof typeof CHART_THEMES) {
  const theme = CHART_THEMES[themeName] || CHART_THEMES.dark;
  
  return {
    upColor: theme.upColor,
    downColor: theme.downColor,
    borderVisible: false,
    wickUpColor: theme.upColor,
    wickDownColor: theme.downColor
  };
}

export function getLineSeriesOptions(themeName: keyof typeof CHART_THEMES) {
  const theme = CHART_THEMES[themeName] || CHART_THEMES.dark;
  
  return {
    color: theme.lineColor,
    lineWidth: 2
  };
}

export function getAreaSeriesOptions(themeName: keyof typeof CHART_THEMES) {
  const theme = CHART_THEMES[themeName] || CHART_THEMES.dark;
  
  return {
    lineColor: theme.lineColor,
    topColor: theme.areaTopColor,
    bottomColor: theme.areaBottomColor
  };
}