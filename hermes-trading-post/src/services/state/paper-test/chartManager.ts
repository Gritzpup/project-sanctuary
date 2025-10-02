/**
 * @file chartManager.ts
 * @description Manages chart display and visual updates during paper testing
 */

import type { CandleData } from '../../../types/coinbase';
import type { Time } from 'lightweight-charts';
import type { PaperTestOptions } from './types';
import type { PaperTestStateManager } from './stateManager';

export class ChartManager {
  private stateManager: PaperTestStateManager;
  private readonly WINDOW_SIZE = 60;

  constructor(stateManager: PaperTestStateManager) {
    this.stateManager = stateManager;
  }

  updateChartDisplay(options: PaperTestOptions, progress: number): void {
    const state = this.stateManager.getState();
    const chartState = this.stateManager.getChartState();

    try {
      // Update markers to show only those up to current time
      if (chartState.markers.length > 0) {
        const visibleMarkers = chartState.markers.filter(marker => 
          marker.time <= state.currentSimTime
        );
        options.candleSeries.setMarkers(visibleMarkers);
      }
      
      // Calculate sliding window based on progress
      const activeCandleIndex = Math.floor(progress * (state.candles.length - 1));
      
      if (state.candles.length > this.WINDOW_SIZE) {
        // For days with more than 60 candles, create a sliding window
        const maxStartIndex = state.candles.length - this.WINDOW_SIZE;
        const windowStart = Math.floor(progress * maxStartIndex);
        const windowEnd = windowStart + this.WINDOW_SIZE - 1;
        
        const visibleRange = {
          from: state.candles[windowStart].time as Time,
          to: state.candles[windowEnd].time as Time
        };
        
        options.chart.timeScale().setVisibleRange(visibleRange);
      } else {
        // For days with 60 or fewer candles, show all
        const visibleRange = {
          from: state.candles[0].time as Time,
          to: state.candles[state.candles.length - 1].time as Time
        };
        
        options.chart.timeScale().setVisibleRange(visibleRange);
      }
    } catch (e) {
      console.warn('Time scale update error:', e);
    }
  }

  updateMarkersForStep(options: PaperTestOptions): void {
    const state = this.stateManager.getState();
    const chartState = this.stateManager.getChartState();

    try {
      // Update markers to show only those up to current time
      if (chartState.markers.length > 0) {
        const visibleMarkers = chartState.markers.filter(marker => 
          marker.time <= state.currentSimTime
        );
        options.candleSeries.setMarkers(visibleMarkers);
      }
      
      const progress = this.stateManager.getCurrentProgress();
      
      if (state.candles.length > this.WINDOW_SIZE) {
        // For days with more than 60 candles, create a sliding window
        const maxStartIndex = state.candles.length - this.WINDOW_SIZE;
        const windowStart = Math.floor(progress * maxStartIndex);
        const windowEnd = windowStart + this.WINDOW_SIZE - 1;
        
        const visibleRange = {
          from: state.candles[windowStart].time as Time,
          to: state.candles[windowEnd].time as Time
        };
        
        options.chart.timeScale().setVisibleRange(visibleRange);
      }
    } catch (e) {
      console.warn('Time scale update error in stepForward:', e);
    }
  }

  displayInitialCandles(options: PaperTestOptions): void {
    const state = this.stateManager.getState();
    
    if (!state.candles || state.candles.length === 0) return;

    const initialDisplayCandles = options.initialDisplayCandles || Math.min(60, state.candles.length);
    const candlesToShow = state.candles.slice(0, initialDisplayCandles);
    
    // Set initial data on the chart
    options.candleSeries.setData(candlesToShow);
    
    // Set initial visible range
    if (candlesToShow.length > 0) {
      const visibleRange = {
        from: candlesToShow[0].time as Time,
        to: candlesToShow[candlesToShow.length - 1].time as Time
      };
      
      try {
        options.chart.timeScale().setVisibleRange(visibleRange);
      } catch (e) {
        console.warn('Initial time scale set error:', e);
      }
    }
  }

  setFinalChartState(options: PaperTestOptions): void {
    const state = this.stateManager.getState();
    const chartState = this.stateManager.getChartState();

    // Show all markers
    if (chartState.markers.length > 0) {
      options.candleSeries.setMarkers(chartState.markers);
    }
    
    // Show full range
    if (state.candles.length > 0) {
      const fullRange = {
        from: state.candles[0].time as Time,
        to: state.candles[state.candles.length - 1].time as Time
      };
      
      try {
        options.chart.timeScale().setVisibleRange(fullRange);
      } catch (e) {
        console.warn('Final time scale set error:', e);
      }
    }
  }
}