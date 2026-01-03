<script lang="ts">
  /**
   * @file MetricsDisplay.svelte
   * @description Real-time metrics and monitoring dashboard
   * Part of Phase 21: Monitoring & Observability
   * 🚀 Displays performance, reliability, and usage metrics
   */

  import { onMount } from 'svelte';
  import { metricsCollector } from '../../services/monitoring/MetricsCollector';
  import { getAppStatus } from '../../services/initialization/AppInitializer';

  interface MetricsUpdate {
    fps: number;
    memory: number;
    apiResponseTime: number;
    chartRenderTime: number;
    websocketLatency: number;
    timestamp: number;
  }

  let metrics: MetricsUpdate = {
    fps: 0,
    memory: 0,
    apiResponseTime: 0,
    chartRenderTime: 0,
    websocketLatency: 0,
    timestamp: Date.now()
  };

  let appStatus = getAppStatus();
  let isVisible = false;
  let updateInterval: number;

  onMount(() => {
    // Update metrics every 1 second
    updateInterval = window.setInterval(() => {
      const current = metricsCollector.getCurrentMetrics();
      metrics = {
        fps: current.fps,
        memory: current.memory,
        apiResponseTime: current.apiResponseTime,
        chartRenderTime: current.chartRenderTime,
        websocketLatency: current.websocketLatency,
        timestamp: Date.now()
      };

      appStatus = getAppStatus();
    }, 1000);

    return () => clearInterval(updateInterval);
  });

  function toggleVisibility() {
    isVisible = !isVisible;
  }

  function getMetricColor(value: number, min: number, max: number): string {
    if (value <= min) return '#22c55e'; // Green (good)
    if (value <= (min + max) / 2) return '#eab308'; // Yellow (ok)
    return '#ef4444'; // Red (poor)
  }

  function getMemoryColor(mb: number): string {
    if (mb < 100) return '#22c55e'; // Good
    if (mb < 150) return '#eab308'; // Ok
    return '#ef4444'; // Poor
  }
</script>

<div class="metrics-display" class:visible={isVisible}>
  {#if isVisible}
    <div class="metrics-container">
      <!-- Header -->
      <div class="metrics-header">
        <h3>📊 Performance Metrics</h3>
        <button class="close-btn" on:click={toggleVisibility}>✕</button>
      </div>

      <!-- Main Metrics Grid -->
      <div class="metrics-grid">
        <!-- FPS -->
        <div class="metric-card">
          <div class="metric-label">FPS</div>
          <div class="metric-value" style="color: {getMetricColor(60 - metrics.fps, 0, 30)}">
            {Math.round(metrics.fps)}
          </div>
          <div class="metric-unit">frames/sec</div>
          <div class="metric-status">
            {#if metrics.fps >= 50}
              ✅ Smooth
            {:else if metrics.fps >= 30}
              ⚠️ Ok
            {:else}
              ❌ Poor
            {/if}
          </div>
        </div>

        <!-- Memory -->
        <div class="metric-card">
          <div class="metric-label">Memory</div>
          <div class="metric-value" style="color: {getMemoryColor(metrics.memory)}">
            {Math.round(metrics.memory)}
          </div>
          <div class="metric-unit">MB</div>
          <div class="metric-status">
            {#if metrics.memory < 100}
              ✅ Good
            {:else if metrics.memory < 150}
              ⚠️ Ok
            {:else}
              ❌ High
            {/if}
          </div>
        </div>

        <!-- API Response Time -->
        <div class="metric-card">
          <div class="metric-label">API Latency</div>
          <div class="metric-value" style="color: {getMetricColor(metrics.apiResponseTime, 0, 1000)}">
            {Math.round(metrics.apiResponseTime)}
          </div>
          <div class="metric-unit">ms</div>
          <div class="metric-status">
            {#if metrics.apiResponseTime < 200}
              ✅ Fast
            {:else if metrics.apiResponseTime < 500}
              ⚠️ Normal
            {:else}
              ❌ Slow
            {/if}
          </div>
        </div>

        <!-- Chart Render Time -->
        <div class="metric-card">
          <div class="metric-label">Chart Render</div>
          <div class="metric-value" style="color: {getMetricColor(metrics.chartRenderTime, 0, 100)}">
            {Math.round(metrics.chartRenderTime)}
          </div>
          <div class="metric-unit">ms</div>
          <div class="metric-status">
            {#if metrics.chartRenderTime < 16}
              ✅ Instant
            {:else if metrics.chartRenderTime < 50}
              ⚠️ Good
            {:else}
              ❌ Slow
            {/if}
          </div>
        </div>

        <!-- WebSocket Latency -->
        <div class="metric-card">
          <div class="metric-label">WebSocket</div>
          <div class="metric-value" style="color: {getMetricColor(metrics.websocketLatency, 0, 500)}">
            {Math.round(metrics.websocketLatency)}
          </div>
          <div class="metric-unit">ms</div>
          <div class="metric-status">
            {#if metrics.websocketLatency < 100}
              ✅ Excellent
            {:else if metrics.websocketLatency < 300}
              ⚠️ Good
            {:else}
              ❌ Slow
            {/if}
          </div>
        </div>

        <!-- Buffer Stats -->
        <div class="metric-card">
          <div class="metric-label">Buffer Usage</div>
          <div class="metric-value">
            {appStatus.metrics.size}/{appStatus.metrics.capacity}
          </div>
          <div class="metric-unit">metrics</div>
          <div class="metric-status">
            {#if appStatus.metrics.usage < 50}
              ✅ Good
            {:else if appStatus.metrics.usage < 80}
              ⚠️ Ok
            {:else}
              ❌ Full
            {/if}
          </div>
        </div>
      </div>

      <!-- System Status -->
      <div class="system-status">
        <h4>🔧 System Status</h4>
        <div class="status-items">
          <div class="status-item">
            <span class="status-label">Stores:</span>
            <span class="status-value">
              {appStatus.storeManager.initializedStores}/{appStatus.storeManager.totalStores}
            </span>
            {#if appStatus.storeManager.initializedStores === appStatus.storeManager.totalStores}
              <span class="status-badge">✅ Ready</span>
            {:else}
              <span class="status-badge">⏳ Loading</span>
            {/if}
          </div>

          <div class="status-item">
            <span class="status-label">Initialization:</span>
            <span class="status-value">
              {appStatus.initialized ? '✅ Complete' : '⏳ In Progress'}
            </span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="metrics-footer">
        <small>Last update: {new Date(metrics.timestamp).toLocaleTimeString()}</small>
      </div>
    </div>
  {:else}
    <button class="toggle-btn" on:click={toggleVisibility}>📊 Metrics</button>
  {/if}
</div>

<style>
  .metrics-display {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 12px;
  }

  .toggle-btn {
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    transition: transform 0.2s;
  }

  .toggle-btn:hover {
    transform: scale(1.05);
  }

  .metrics-container {
    background: rgba(20, 24, 32, 0.95);
    border: 1px solid rgba(102, 126, 234, 0.3);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    backdrop-filter: blur(10px);
  }

  .metrics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(102, 126, 234, 0.2);
  }

  .metrics-header h3 {
    margin: 0;
    color: #a78bfa;
    font-size: 14px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: #a78bfa;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: #e0aaff;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .metric-card {
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }

  .metric-label {
    color: #a78bfa;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    text-transform: uppercase;
  }

  .metric-value {
    font-size: 18px;
    font-weight: 700;
    margin: 4px 0;
    font-family: 'Monaco', monospace;
  }

  .metric-unit {
    color: #6b7280;
    font-size: 10px;
    margin-bottom: 4px;
  }

  .metric-status {
    color: #d1d5db;
    font-size: 11px;
    margin-top: 4px;
  }

  .system-status {
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .system-status h4 {
    margin: 0 0 8px 0;
    color: #a78bfa;
    font-size: 12px;
    font-weight: 600;
  }

  .status-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #d1d5db;
    font-size: 11px;
  }

  .status-label {
    color: #9ca3af;
    font-weight: 600;
  }

  .status-value {
    color: #a78bfa;
    font-family: monospace;
  }

  .status-badge {
    padding: 2px 6px;
    background: rgba(34, 197, 94, 0.2);
    border-radius: 4px;
    font-size: 10px;
    color: #86efac;
  }

  .metrics-footer {
    text-align: center;
    color: #6b7280;
    padding-top: 12px;
    border-top: 1px solid rgba(102, 126, 234, 0.2);
  }

  .metrics-footer small {
    font-size: 10px;
  }

  /* Scrollbar styling */
  .metrics-container::-webkit-scrollbar {
    width: 6px;
  }

  .metrics-container::-webkit-scrollbar-track {
    background: rgba(99, 102, 241, 0.1);
    border-radius: 3px;
  }

  .metrics-container::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.3);
    border-radius: 3px;
  }

  .metrics-container::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
  }

  /* Debug only in development */
  @media (prefers-color-scheme: dark) {
    .metrics-container {
      background: rgba(20, 24, 32, 0.98);
    }
  }
</style>
