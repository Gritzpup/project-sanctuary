<script lang="ts">
  export let currentPrice: number = 0;
  export let nextBuyPrice: number = 0;
  export let nextSellPrice: number = 0;
  export let recentHigh: number = 0;
  export let isRunning: boolean = false;
  export let trades: any[] = [];

  // Get starting price from the first trade, or use current price if no trades
  $: startingPrice = trades && trades.length > 0 ? trades[0].price : currentPrice;

  // Calculate recentHigh from trades if not provided by backend
  $: calculatedRecentHigh = (() => {
    if (recentHigh && recentHigh > 0) return recentHigh;
    if (trades && trades.length > 0) {
      const prices = trades.map((t: any) => t.price).filter((p: number) => p > 0);
      if (prices.length > 0) return Math.max(...prices);
    }
    return currentPrice;
  })();

  // Use backend's calculated next buy/sell prices - they already have the correct strategy logic
  $: actualNextBuyPrice = nextBuyPrice || 0;
  $: actualNextSellPrice = nextSellPrice || 0;

  // Calculate the gauge needle angle based on market position relative to next buy/sell orders
  $: angle = calculateNeedleAngle();

  function calculateNeedleAngle(): number {
    if (!isRunning || currentPrice === 0) {
      return 90; // Center when not running
    }

    // If we don't have next buy/sell prices from backend, center the needle
    if (!nextBuyPrice || !nextSellPrice) {
      return 90;
    }

    // Calculate the range between next buy and next sell
    const range = nextSellPrice - nextBuyPrice;

    if (range <= 0) {
      return 90; // Invalid range, center the needle
    }

    // Map current price position to needle angle
    // Left (30°) = price at or below next buy trigger
    // Center (90°) = price between buy/sell triggers
    // Right (150°) = price at or above next sell trigger

    if (currentPrice <= nextBuyPrice) {
      return 30; // Far left - at/below buy trigger
    } else if (currentPrice >= nextSellPrice) {
      return 150; // Far right - at/above sell trigger
    } else {
      // Linear interpolation between buy and sell triggers
      const position = (currentPrice - nextBuyPrice) / range;
      return 30 + position * 120; // Map 0-1 to 30-150 degrees
    }
  }

  // Format display prices - use ACTUAL calculated values from strategy
  $: {
    const buy = actualNextBuyPrice || 0;
    const sell = actualNextSellPrice || 0;
    displayNextBuyPrice = buy;
    displayNextSellPrice = sell;
  }

  // 🔍 DEBUG: Log the prices being received and calculated
  $: {
  }

  let displayNextBuyPrice = 0;
  let displayNextSellPrice = 0;
</script>

<div class="panel market-gauge">
  <div class="panel-header">
    <h2>Market Position</h2>
  </div>
  <div class="panel-content">
    <!-- Inner box with background and border -->
    <div class="gauge-box">
      <!-- Price display -->
      <div class="price-row">
        <div class="price-item">
          <span class="label">Next Buy</span>
          <span class="value red">${displayNextBuyPrice.toFixed(0)}</span>
        </div>
        <div class="price-item">
          <span class="label">Start</span>
          <span class="value purple">${startingPrice.toFixed(0)}</span>
        </div>
        <div class="price-item">
          <span class="label">Next Sell</span>
          <span class="value green">${displayNextSellPrice.toFixed(0)}</span>
        </div>
      </div>

      <!-- Gauge -->
      <div class="gauge-container">
        <svg viewBox="0 0 200 120" class="gauge-svg">
        <defs>
          <!-- Dimmed gradients for arcs -->
          <linearGradient id="buyGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#4a1515" stop-opacity="0.8"/>
            <stop offset="50%" stop-color="#7a2020" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#2a0808" stop-opacity="0.8"/>
          </linearGradient>

          <linearGradient id="holdGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1e2a4a" stop-opacity="0.8"/>
            <stop offset="50%" stop-color="#2a3a6a" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#1e2a4a" stop-opacity="0.8"/>
          </linearGradient>

          <linearGradient id="sellGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0a2a1a" stop-opacity="0.8"/>
            <stop offset="50%" stop-color="#154a2a" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#051510" stop-opacity="0.8"/>
          </linearGradient>
        </defs>

        <!-- Dark background track -->
        <path d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1a1a2e"
              stroke-width="20"/>

        <!-- Buy zone (left) - from 210° to 270° (60° arc) -->
        <path d="M 20 100 A 80 80 0 0 1 60 31.3"
              fill="none"
              stroke="url(#buyGradient)"
              stroke-width="18"/>

        <!-- Hold zone (center) - from 270° to 270° (60° arc) -->
        <path d="M 60 31.3 A 80 80 0 0 1 140 31.3"
              fill="none"
              stroke="url(#holdGradient)"
              stroke-width="18"/>

        <!-- Sell zone (right) - from 270° to 330° (60° arc) -->
        <path d="M 140 31.3 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#sellGradient)"
              stroke-width="18"/>

        <!-- Center arc line running through middle of the gauge -->
        <path d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="rgba(155, 155, 255, 0.2)"
              stroke-width="1"/>

        <!-- Text labels - positioned under each section -->
        <text x="20" y="105" text-anchor="middle" class="zone-label" fill="#dc2626">BUY</text>
        <text x="100" y="25" text-anchor="middle" class="zone-label" fill="#6b7bb8">HOLD</text>
        <text x="180" y="105" text-anchor="middle" class="zone-label" fill="#10b981">SELL</text>

        <!-- Needle - thin and extends into arc -->
        <g transform="rotate({angle - 90} 100 100)" class="needle">
          <!-- Needle line - thinner -->
          <line x1="100" y1="100" x2="100" y2="30"
                stroke="#9b9bff"
                stroke-width="2"
                stroke-linecap="round"/>

          <!-- Needle tip circle - smaller -->
          <circle cx="100" cy="30" r="3" fill="#9b9bff"/>

          <!-- Center dot - smaller -->
          <circle cx="100" cy="100" r="4" fill="#1a1a2e" stroke="#9b9bff" stroke-width="2"/>
        </g>
      </svg>
    </div>
    </div>

    <!-- Compact stats below gauge -->
    <div class="compact-stats">
        <div class="compact-stat">
          <div class="stat-icon buy-icon">📊</div>
          <div class="stat-info">
            <span class="stat-text">LAST BUY</span>
            <span class="stat-number">${displayNextBuyPrice.toFixed(0)}</span>
          </div>
        </div>
        <div class="compact-stat">
          <div class="stat-icon profit-icon">💰</div>
          <div class="stat-info">
            <span class="stat-text">PROFIT ZONE</span>
            <span class="stat-number green">$736.32 (0.6%)</span>
          </div>
        </div>
        <div class="compact-stat">
          <div class="stat-icon drop-icon">🎯</div>
          <div class="stat-info">
            <span class="stat-text">DROP TARGET</span>
            <span class="stat-number red">5%</span>
          </div>
        </div>
      </div>
  </div>
</div>

<style>
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .panel-header {
    background: var(--bg-primary-subtle);
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-primary);
    min-height: 50px;
    flex-shrink: 0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
  }

  .panel-content {
    padding: 15px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
  }

  .gauge-box {
    background: rgba(26, 26, 26, 0.5);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 15px 15px 0px 15px;
  }

  .price-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    gap: 8px;
  }

  .price-item {
    text-align: center;
    flex: 1;
  }

  .label {
    display: block;
    font-size: 12px;
    color: #888;
    margin-bottom: 4px;
    text-transform: uppercase;
    font-weight: 500;
  }

  .value {
    display: block;
    font-size: 18px;
    font-weight: 700;
    font-family: 'Courier New', monospace;
  }

  .value.red {
    color: var(--color-error);
  }

  .value.purple {
    color: #7c3aed;
  }

  .value.green {
    color: var(--color-success);
  }

  .gauge-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    min-height: 0;
  }

  .gauge-svg {
    width: 100%;
    height: 100%;
    max-height: 200px;
  }

  .zone-label {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Needle animation - smooth and professional */
  .needle {
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .compact-stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 16px 12px 16px;
    margin-top: 12px;
  }

  .compact-stat {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  .buy-icon {
    background: rgba(74, 0, 224, 0.2);
  }

  .profit-icon {
    background: rgba(16, 163, 74, 0.2);
  }

  .drop-icon {
    background: rgba(220, 38, 38, 0.2);
  }

  .stat-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .stat-text {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .stat-number {
    font-size: 18px;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    color: #fff;
  }

  .stat-number.green {
    color: var(--color-success);
  }

  .stat-number.red {
    color: var(--color-error);
  }
</style>