<script lang="ts">
  import Chart from '../../../Chart.svelte';
  import { createEventDispatcher } from 'svelte';
  import type { ChartDataFeed } from '../../../../services/chartDataFeed';

  // Props
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let selectedGranularity: string;
  export let selectedPeriod: string;
  export let trades: Array<{timestamp: number, type: string, price: number}> = [];
  export let isPaperTestRunning: boolean = false;
  export let isPaperTestMode: boolean = false;
  export let paperTestSimTime: Date | null = null;
  export let paperTestDate: Date | null = null;
  export let isRunning: boolean = false;
  export let autoGranularityActive: boolean = false;
  export let currentStrategy: any = null;
  
  // Chart references
  let chartInstance: any = null;
  let candleSeriesInstance: any = null;
  let chartDataFeed: ChartDataFeed | null = null;

  const dispatch = createEventDispatcher();

  // Reset chart zoom function
  function resetChartZoom() {
    if (chartInstance && candleSeriesInstance) {
      try {
        // Get the current visible range
        const visibleLogicalRange = chartInstance.timeScale().getVisibleLogicalRange();
        
        if (visibleLogicalRange !== null) {
          // Get all data points
          const data = candleSeriesInstance.data();
          
          if (data && data.length > 0) {
            // Calculate the range to show exactly 60 candles from the most recent
            const endIndex = data.length - 1;
            const startIndex = Math.max(0, endIndex - 59); // 60 candles total
            
            // Set the visible range using logical indices
            chartInstance.timeScale().setVisibleLogicalRange({
              from: startIndex,
              to: endIndex + 1 // Add 1 to include the last candle
            });
          } else {
            // If no data, just fit content
            chartInstance.timeScale().fitContent();
          }
        } else {
          // Fallback to fit content
          chartInstance.timeScale().fitContent();
        }
      } catch (error) {
        console.error('Error resetting chart zoom:', error);
        // Fallback to fit content
        chartInstance.timeScale().fitContent();
      }
    }
  }

  // Handle chart granularity change
  function handleChartGranularityChange(newGranularity: string) {
    // Prevent granularity changes during active trading
    if (isRunning) {
      console.warn('Cannot change timeframe while trading is active');
      return;
    }
    
    if (selectedGranularity !== newGranularity) {
      dispatch('granularityChange', { granularity: newGranularity });
    }
  }

  // Handle data feed ready
  function handleDataFeedReady(feed: ChartDataFeed) {
    console.log('TradingChart: Chart data feed ready');
    chartDataFeed = feed;
    dispatch('dataFeedReady', { feed });
  }

  // Handle chart ready
  function handleChartReady(chart: any, candleSeries: any) {
    chartInstance = chart;
    candleSeriesInstance = candleSeries;
    dispatch('chartReady', { chart, candleSeries });
  }

  // Expose chart zoom reset function
  export function resetZoom() {
    resetChartZoom();
  }

  // Expose chart references
  export function getChartInstance() {
    return chartInstance;
  }

  export function getCandleSeriesInstance() {
    return candleSeriesInstance;
  }

  export function getChartDataFeed() {
    return chartDataFeed;
  }
</script>

<div class="trading-chart">
  <!-- Chart Panel -->
  <div class="panel chart-panel">
    <div class="granularity-transition" class:active={autoGranularityActive}>
      Switching to {selectedGranularity}
    </div>
    <div class="panel-header">
      <h2>
        BTC/USD Chart
        {#if isPaperTestMode}
          <span class="paper-test-indicator">📄 Paper Test Mode</span>
        {/if}
      </h2>
      <div class="chart-controls">
        {#if isRunning}
          <span class="timeframe-lock-icon" title="Timeframe locked during trading ({selectedGranularity} / {selectedPeriod}){currentStrategy?.getRequiredGranularity?.() ? `\nStrategy requires: ${currentStrategy.getRequiredGranularity()} / ${currentStrategy.getRequiredPeriod() || 'any period'}` : ''}">
            🔒
          </span>
        {/if}
        <button 
          class="zoom-reset-btn" 
          title="Reset zoom to show 60 candles"
          on:click={resetChartZoom}
        >
          <span style="position: relative; display: inline-block;">
            🔍<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.6em; font-weight: bold;">✕</span>
          </span>
        </button>
        <slot name="granularity-controls" />
      </div>
    </div>
    <div class="panel-content">
      <Chart 
        bind:status={connectionStatus} 
        granularity={selectedGranularity} 
        period={selectedPeriod} 
        onGranularityChange={handleChartGranularityChange}
        onDataFeedReady={handleDataFeedReady}
        {trades}
        onChartReady={handleChartReady}
        {isPaperTestRunning}
        {isPaperTestMode}
        {paperTestSimTime}
        {paperTestDate}
        enableZoom={true}
        lockedTimeframe={isRunning}
      />
      <slot name="period-controls" />
    </div>
  </div>
</div>

<style>
  .trading-chart {
    position: relative;
  }

  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    min-height: 300px;
  }
  
  .chart-panel {
    position: relative;
    min-height: 500px;
    grid-column: span 2;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 1;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
  
  .paper-test-indicator {
    font-size: 14px;
    color: #fbbf24;
    margin-left: 10px;
    padding: 2px 8px;
    background: rgba(251, 191, 36, 0.1);
    border-radius: 4px;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }
  
  .panel-content {
    flex: 1;
    padding: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: visible;
  }
  
  .panel-content > :global(.chart-container) {
    flex: 1;
    min-height: 400px;
  }
  
  .granularity-transition {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(74, 0, 224, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 10;
  }
  
  .granularity-transition.active {
    opacity: 1;
  }
  
  .chart-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .zoom-reset-btn {
    padding: 3px 6px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .zoom-reset-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }

  .timeframe-lock-icon {
    font-size: 14px;
    opacity: 0.7;
  }
</style>