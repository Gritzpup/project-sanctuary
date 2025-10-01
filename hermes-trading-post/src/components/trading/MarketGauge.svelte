<script lang="ts">
  export let currentPrice: number = 0;
  export let positions: any[] = [];
  export let recentHigh: number = 0;
  export let recentLow: number = 0;
  export let isRunning: boolean = false;
  
  // Calculate the gauge needle angle based on market conditions
  $: angle = calculateNeedleAngle();
  
  function calculateNeedleAngle(): number {
    // Default to center when not running
    if (!isRunning || currentPrice === 0) {
      return 90;
    }
    
    // Calculate drop from recent high
    const dropFromHigh = recentHigh > 0 ? ((recentHigh - currentPrice) / recentHigh) * 100 : 0;
    
    if (positions.length === 0) {
      // No positions - needle based on drop percentage
      if (dropFromHigh <= 0) {
        return 90; // At or above high - center
      } else if (dropFromHigh < 5) {
        // Small drop - slightly left of center
        return 90 - (dropFromHigh / 5) * 30;
      } else if (dropFromHigh < 15) {
        // Medium drop - moving into buy zone
        return 60 - ((dropFromHigh - 5) / 10) * 30;
      } else {
        // Large drop - deep in buy zone
        return Math.max(20, 30 - ((dropFromHigh - 15) / 10) * 10);
      }
    } else {
      // Has positions - needle based on profit potential
      const avgEntryPrice = positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / 
                           positions.reduce((sum, p) => sum + p.size, 0);
      const profitPercent = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
      
      if (profitPercent < -2) {
        // Loss - left side (buy zone)
        return Math.max(20, 60 - Math.abs(profitPercent) * 5);
      } else if (profitPercent < 2) {
        // Break even - center
        return 90 + profitPercent * 15;
      } else {
        // Profit - right side (sell zone)
        return Math.min(160, 120 + profitPercent * 5);
      }
    }
  }
  
  // Calculate zone prices for display
  $: buyZonePrice = recentHigh > 0 ? recentHigh * 0.95 : currentPrice * 0.95;
  $: sellZonePrice = positions.length > 0 
    ? positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0) / positions.reduce((sum, p) => sum + p.size, 0) * 1.02
    : recentHigh > 0 ? recentHigh : currentPrice * 1.02;
</script>

<div class="panel market-gauge">
  <div class="panel-header">
    <h2>Market Position</h2>
  </div>
  <div class="panel-content">
    <div class="gauge-content">
    <div class="zone-prices">
      <div class="zone-price buy">
        <span class="zone-label">Buy Zone</span>
        <span class="zone-value">${buyZonePrice.toFixed(2)}</span>
      </div>
      <div class="zone-price current">
        <span class="zone-label">Current</span>
        <span class="zone-value">${currentPrice.toFixed(2)}</span>
      </div>
      <div class="zone-price sell">
        <span class="zone-label">Profit Zone</span>
        <span class="zone-value">${sellZonePrice.toFixed(2)}</span>
      </div>
    </div>
    </div>
    
    <div class="gauge-chart">
    <svg viewBox="0 0 240 140" class="gauge-svg">
      <!-- Gauge background -->
      <defs>
        <linearGradient id="buyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#ef5350;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#ef5350;stop-opacity:0.15" />
        </linearGradient>
        <linearGradient id="holdGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#42a5f5;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#42a5f5;stop-opacity:0.15" />
        </linearGradient>
        <linearGradient id="sellGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#26a69a;stop-opacity:0.15" />
          <stop offset="100%" style="stop-color:#26a69a;stop-opacity:0.3" />
        </linearGradient>
      </defs>
      
      <!-- Gauge arc sections -->
      <!-- Buy zone: 0-60 degrees -->
      <path d="M 40 120 A 80 80 0 0 1 80 50.7" 
            fill="none" 
            stroke="url(#buyGradient)" 
            stroke-width="30" 
            class="gauge-section buy-section"/>
      
      <!-- Hold zone: 60-120 degrees -->
      <path d="M 80 50.7 A 80 80 0 0 1 160 50.7" 
            fill="none" 
            stroke="url(#holdGradient)" 
            stroke-width="30" 
            class="gauge-section hold-section"/>
      
      <!-- Sell zone: 120-180 degrees -->
      <path d="M 160 50.7 A 80 80 0 0 1 200 120" 
            fill="none" 
            stroke="url(#sellGradient)" 
            stroke-width="30" 
            class="gauge-section sell-section"/>
      
      <!-- Gauge outline -->
      <path d="M 40 120 A 80 80 0 0 1 200 120" 
            fill="none" 
            stroke="rgba(255,255,255,0.2)" 
            stroke-width="1" 
            class="gauge-outline"/>
      
      <!-- Zone labels -->
      <text x="50" y="130" text-anchor="middle" class="zone-label-text">BUY</text>
      <text x="120" y="40" text-anchor="middle" class="zone-label-text">HOLD</text>
      <text x="190" y="130" text-anchor="middle" class="zone-label-text">SELL</text>
      
      <!-- Needle -->
      <g transform="rotate({angle - 90} 120 120)" class="needle-group">
        <line x1="120" y1="120" x2="120" y2="45" 
              stroke="#a78bfa" 
              stroke-width="3" 
              class="needle"/>
        <circle cx="120" cy="120" r="6" fill="#a78bfa" class="needle-center"/>
        <circle cx="120" cy="45" r="4" fill="#a78bfa" class="needle-tip"/>
      </g>
      
      <!-- Current value indicator -->
      <text x="120" y="100" text-anchor="middle" class="current-value">
        ${currentPrice.toFixed(0)}
      </text>
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
    display: flex;
    justify-content: space-between;
    align-items: center;
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
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .gauge-content {
    margin-bottom: 15px;
  }
  
  .zone-prices {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .zone-price {
    flex: 1;
    text-align: center;
  }
  
  .zone-label {
    display: block;
    font-size: 11px;
    color: #758696;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  
  .zone-value {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }
  
  .zone-price.buy .zone-value {
    color: #ef5350;
  }
  
  .zone-price.current .zone-value {
    color: #a78bfa;
  }
  
  .zone-price.sell .zone-value {
    color: #26a69a;
  }
  
  .gauge-chart {
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }
  
  .gauge-svg {
    width: 100%;
    height: auto;
  }
  
  .zone-label-text {
    fill: #758696;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .needle-group {
    transition: transform 0.3s ease;
  }
  
  .needle {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  }
  
  .needle-center {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  }
  
  .needle-tip {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  }
  
  .current-value {
    fill: #d1d4dc;
    font-size: 20px;
    font-weight: 600;
  }
  
  .gauge-section {
    transition: stroke-opacity 0.3s ease;
  }
  
  .gauge-section:hover {
    stroke-opacity: 0.8;
  }
</style>