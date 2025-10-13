<script lang="ts">
  export let currentPrice: number = 0;
  export let positions: any[] = [];
  export let recentHigh: number = 0;
  export let recentLow: number = 0;
  export let isRunning: boolean = false;
  
  // Calculate the gauge needle angle based on market conditions
  $: angle = calculateNeedleAngle();
  
  function calculateNeedleAngle(): number {
    if (!isRunning || currentPrice === 0) {
      return 90; // Center
    }
    
    if (positions.length === 0 && recentHigh > 0 && recentLow > 0) {
      // Use recent high/low for market position when no positions
      const range = recentHigh - recentLow;
      if (range > 0) {
        const position = (currentPrice - recentLow) / range;
        return 30 + position * 120; // Map 0-1 to 30-150 degrees
      }
      return 90; // Center if no range
    }
    
    if (positions.length === 0) {
      return 90; // No positions, center
    }
    
    // Calculate based on profit/loss
    const avgEntryPrice = positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / 
                         positions.reduce((sum, p) => sum + p.size, 0);
    const profitPercent = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
    
    // Map profit percent to angle (30 degrees left to 150 degrees right)
    if (profitPercent <= -2) {
      return 30; // Far left (big loss)
    } else if (profitPercent >= 2) {
      return 150; // Far right (good profit)
    } else {
      // Linear interpolation between 30 and 150 degrees
      return 30 + ((profitPercent + 2) / 4) * 120;
    }
  }
  
  // Calculate display values
  $: nextBuyPrice = positions.length > 0 
    ? positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / positions.reduce((sum, p) => sum + p.size, 0) * 0.99
    : currentPrice * 0.99;
    
  $: profitTargetPrice = positions.length > 0 
    ? positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / positions.reduce((sum, p) => sum + p.size, 0) * 1.02
    : currentPrice * 1.02;
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
        <span class="value red">${nextBuyPrice.toFixed(0)}</span>
      </div>
      <div class="price-item">
        <span class="label">Current</span>
        <span class="value purple">${currentPrice.toFixed(0)}</span>
      </div>
      <div class="price-item">
        <span class="label">Target</span>
        <span class="value green">${profitTargetPrice.toFixed(0)}</span>
      </div>
    </div>
    
    <!-- Gauge -->
    <div class="gauge-container">
      <svg viewBox="0 0 240 140" class="gauge-svg">
        <!-- Definitions for gradients and effects -->
        <defs>
          <!-- Gradient for buy zone -->
          <linearGradient id="buyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" class="svg-gradient-buy-start" stop-opacity="1"/>
            <stop offset="100%" class="svg-gradient-buy-end" stop-opacity="1"/>
          </linearGradient>
          
          <!-- Gradient for hold zone -->
          <linearGradient id="holdGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" class="svg-gradient-hold-start" stop-opacity="1"/>
            <stop offset="100%" class="svg-gradient-hold-end" stop-opacity="1"/>
          </linearGradient>
          
          <!-- Gradient for sell zone -->
          <linearGradient id="sellGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" class="svg-gradient-sell-start" stop-opacity="1"/>
            <stop offset="100%" class="svg-gradient-sell-end" stop-opacity="1"/>
          </linearGradient>
          
          <!-- Needle gradient -->
          <linearGradient id="needleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" class="svg-gradient-needle-start" stop-opacity="1"/>
            <stop offset="50%" class="svg-gradient-needle-mid" stop-opacity="1"/>
            <stop offset="100%" class="svg-gradient-needle-end" stop-opacity="1"/>
          </linearGradient>
          
          <!-- Drop shadow filter -->
          <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
          
          <!-- Glow filter -->
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Outer ring shadow -->
        <path d="M 30 110 A 90 90 0 0 1 210 110" 
              fill="none" 
              stroke="rgba(0,0,0,0.3)" 
              stroke-width="16"
              transform="translate(2,2)"/>
        
        <!-- Background arc with subtle gradient -->
        <path d="M 30 110 A 90 90 0 0 1 210 110" 
              fill="none" 
              stroke="rgba(255,255,255,0.08)" 
              stroke-width="16"
              filter="url(#dropshadow)"/>
        
        <!-- Buy zone with gradient and glow -->
        <path d="M 30 110 A 90 90 0 0 1 85 50" 
              fill="none" 
              stroke="url(#buyGradient)" 
              stroke-width="14"
              stroke-linecap="round"
              filter="url(#glow)"/>
        
        <!-- Hold zone with gradient and glow -->
        <path d="M 85 50 A 90 90 0 0 1 155 50" 
              fill="none" 
              stroke="url(#holdGradient)" 
              stroke-width="14"
              stroke-linecap="round"
              filter="url(#glow)"/>
        
        <!-- Sell zone with gradient and glow -->
        <path d="M 155 50 A 90 90 0 0 1 210 110" 
              fill="none" 
              stroke="url(#sellGradient)" 
              stroke-width="14"
              stroke-linecap="round"
              filter="url(#glow)"/>
        
        <!-- Tick marks -->
        <g stroke="rgba(255,255,255,0.4)" stroke-width="1">
          <line x1="35" y1="108" x2="40" y2="102" transform="rotate(-60 120 110)"/>
          <line x1="35" y1="108" x2="40" y2="102" transform="rotate(-30 120 110)"/>
          <line x1="35" y1="108" x2="40" y2="102" transform="rotate(0 120 110)"/>
          <line x1="35" y1="108" x2="40" y2="102" transform="rotate(30 120 110)"/>
          <line x1="35" y1="108" x2="40" y2="102" transform="rotate(60 120 110)"/>
        </g>
        
        <!-- Center hub shadow -->
        <circle cx="122" cy="112" r="12" fill="rgba(0,0,0,0.5)"/>
        
        <!-- Center hub - MADE DARKER -->
        <circle cx="120" cy="110" r="12" fill="rgba(15,23,42,0.95)" stroke="rgba(30,41,59,0.8)" stroke-width="2"/>
        <circle cx="120" cy="110" r="8" fill="rgba(30,41,59,0.9)"/>
        
        <!-- Needle shadow - MADE THICKER -->
        <g transform="rotate({angle - 90} 120 110)">
          <line x1="120" y1="110" x2="120" y2="40" 
                stroke="rgba(0,0,0,0.6)" 
                stroke-width="8"
                transform="translate(2,2)"/>
        </g>
        
        <!-- Main needle -->
        <g transform="rotate({angle - 90} 120 110)" class="needle">
          <!-- Needle body with gradient - MADE THICKER -->
          <line x1="120" y1="110" x2="120" y2="40" 
                stroke="url(#needleGradient)" 
                stroke-width="6"
                stroke-linecap="round"
                filter="url(#glow)"/>
          
          <!-- Needle tip - MADE WIDER -->
          <polygon points="120,40 112,52 128,52" 
                   fill="url(#needleGradient)" 
                   filter="url(#glow)"/>
          
          <!-- Center dot - MADE DARKER -->
          <circle cx="120" cy="110" r="5" fill="#1e293b" stroke="#334155" stroke-width="1" filter="url(#glow)"/>
        </g>
        
        <!-- Labels with enhanced styling -->
        <text x="60" y="125" text-anchor="middle" class="zone-text buy-text">BUY</text>
        <text x="120" y="35" text-anchor="middle" class="zone-text hold-text">HOLD</text>
        <text x="180" y="125" text-anchor="middle" class="zone-text sell-text">SELL</text>
      </svg>
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
    height: 300px;
  }

  .panel-header {
    background: var(--bg-primary-subtle);
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-primary);
    flex-shrink: 0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
  }

  .panel-content {
    padding: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
  }

  .price-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
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
    font-size: 16px;
    font-weight: 600;
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
  }

  .gauge-svg {
    width: 100%;
    max-width: 200px;
    height: auto;
  }

  .zone-text {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  /* Needle animation */
  g {
    transition: transform 0.5s ease;
  }
</style>