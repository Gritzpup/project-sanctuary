<script lang="ts">
  import { statusStore } from '../chart/stores/statusStore.svelte';
  import { orderbookStore } from '../orderbook/stores/orderbookStore.svelte.ts';
  import { onMount, onDestroy } from 'svelte';

  // Track updates for both chart and orderbook
  let chartUpdateCount = $state(0);
  let orderbookUpdateCount = $state(0);
  let chartUpdatesPerSec = $state(0);
  let orderbookUpdatesPerSec = $state(0);

  let startTime = Date.now();
  let intervalId: NodeJS.Timeout | null = null;

  // Monitor chart updates via status store
  $effect(() => {
    // statusStore.lastUpdate changes on every ticker/candle update
    if (statusStore.lastUpdate) {
      chartUpdateCount++;
    }
  });

  // Monitor orderbook updates
  $effect(() => {
    // orderbookStore updates trigger metrics recalculation
    const metrics = orderbookStore.metrics;
    if (metrics) {
      orderbookUpdateCount++;
      orderbookUpdatesPerSec = metrics.updatesPerSecond;
    }
  });

  onMount(() => {
    // Calculate updates per second every second
    intervalId = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      chartUpdatesPerSec = Math.round(chartUpdateCount / elapsed);

      // Reset counters
      startTime = Date.now();
      chartUpdateCount = 0;
    }, 1000);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Calculate performance comparison
  const comparison = $derived.by(() => {
    const diff = chartUpdatesPerSec - orderbookUpdatesPerSec;
    const percentage = orderbookUpdatesPerSec > 0
      ? Math.round((chartUpdatesPerSec / orderbookUpdatesPerSec) * 100)
      : 0;

    return {
      diff,
      percentage,
      status: Math.abs(diff) < 5 ? 'matched' : diff > 0 ? 'chart-faster' : 'orderbook-faster'
    };
  });
</script>

<div class="performance-comparison">
  <h3>📊 Real-Time Performance Comparison</h3>

  <div class="metrics-grid">
    <!-- Chart Performance -->
    <div class="metric-card chart">
      <div class="metric-icon">📈</div>
      <div class="metric-content">
        <div class="metric-label">Trading Chart</div>
        <div class="metric-value">{chartUpdatesPerSec} <span class="unit">updates/sec</span></div>
        <div class="metric-status {statusStore.status}">{statusStore.status}</div>
      </div>
    </div>

    <!-- Orderbook Performance -->
    <div class="metric-card orderbook">
      <div class="metric-icon">📖</div>
      <div class="metric-content">
        <div class="metric-label">Orderbook L2</div>
        <div class="metric-value">{orderbookUpdatesPerSec} <span class="unit">updates/sec</span></div>
        <div class="metric-latency">
          Avg: {orderbookStore.metrics?.avgLatency.toFixed(0) || 0}ms latency
        </div>
      </div>
    </div>
  </div>

  <!-- Comparison Result -->
  <div class="comparison-result {comparison.status}">
    {#if comparison.status === 'matched'}
      <span class="icon">✅</span>
      <span class="text">Perfect Match! Both updating at similar speeds</span>
    {:else if comparison.status === 'chart-faster'}
      <span class="icon">⚡</span>
      <span class="text">Chart is {Math.abs(comparison.diff)} updates/sec faster ({comparison.percentage}%)</span>
    {:else}
      <span class="icon">🚀</span>
      <span class="text">Orderbook is {Math.abs(comparison.diff)} updates/sec faster</span>
    {/if}
  </div>

  <div class="test-info">
    <strong>Goal:</strong> Orderbook should update as fast as the chart ({chartUpdatesPerSec} updates/sec target)
  </div>
</div>

<style>
  .performance-comparison {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid #2a2a4e;
    border-radius: 12px;
    padding: 24px;
    margin: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  h3 {
    color: #fff;
    margin: 0 0 20px 0;
    font-size: 20px;
    font-weight: 600;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .metric-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    gap: 12px;
    transition: all 0.3s ease;
  }

  .metric-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .metric-card.chart {
    border-left: 3px solid #00d4ff;
  }

  .metric-card.orderbook {
    border-left: 3px solid #00ff88;
  }

  .metric-icon {
    font-size: 32px;
    display: flex;
    align-items: center;
  }

  .metric-content {
    flex: 1;
  }

  .metric-label {
    color: #888;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .metric-value {
    color: #fff;
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 6px;
  }

  .unit {
    font-size: 14px;
    color: #888;
    font-weight: 400;
  }

  .metric-status {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .metric-status.ready {
    background: rgba(0, 255, 136, 0.2);
    color: #00ff88;
  }

  .metric-status.loading {
    background: rgba(255, 193, 7, 0.2);
    color: #ffc107;
  }

  .metric-latency {
    color: #888;
    font-size: 12px;
    margin-top: 4px;
  }

  .comparison-result {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .comparison-result.matched {
    border-color: #00ff88;
    background: rgba(0, 255, 136, 0.1);
  }

  .comparison-result.chart-faster {
    border-color: #ffc107;
    background: rgba(255, 193, 7, 0.1);
  }

  .comparison-result.orderbook-faster {
    border-color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  .comparison-result .icon {
    font-size: 24px;
  }

  .comparison-result .text {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
  }

  .test-info {
    color: #888;
    font-size: 13px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border-left: 3px solid #00d4ff;
  }

  .test-info strong {
    color: #00d4ff;
  }
</style>
