<script lang="ts">
  export let currentPrice: number = 0;
  export let nextBuyPrice: number = 0;
  export let nextSellPrice: number = 0;
  export let positions: any[] = [];
  export let recentHigh: number = 0;
  export let isRunning: boolean = false;

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

  // Format display prices - use backend values if available, otherwise show 0
  $: displayNextBuyPrice = nextBuyPrice || 0;
  $: displayNextSellPrice = nextSellPrice || 0;
</script>

<div class="panel market-gauge">
  <div class="panel-header">
    <h2>Market Position</h2>
  </div>
  <div class="panel-content">
    <!-- Price display -->
    <div class="price-row">
      <div class="price-item">
        <span class="label">Next Buy</span>
        <span class="value red">${displayNextBuyPrice.toFixed(0)}</span>
      </div>
      <div class="price-item">
        <span class="label">Current</span>
        <span class="value purple">${currentPrice.toFixed(0)}</span>
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
</div>

<style>
  .panel {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .panel-header {
    background: transparent;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    flex-shrink: 0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 15px;
    color: #a78bfa;
    font-weight: 600;
  }

  .panel-content {
    padding: 15px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: transparent;
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
    color: #dc2626;
  }

  .value.purple {
    color: #7c3aed;
  }

  .value.green {
    color: #16a34a;
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
</style>