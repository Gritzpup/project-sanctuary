<script lang="ts">
  import type { Position } from '../../../strategies/base/StrategyTypes';
  import type { Strategy } from '../../../strategies/base/Strategy';

  export let position: Position;
  export let currentPrice: number = 0;
  export let currentStrategy: Strategy | null = null;

  // Helper function to determine traffic light color based on proximity to profit target
  function getTrafficLightClass(position: Position, currentPrice: number): string {
    const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    
    // Get profit target from current strategy config
    // Different strategies have different property names for profit target
    let profitTarget = 7; // Default for strategies without explicit target
    
    if (currentStrategy?.config) {
      const config = currentStrategy.config as any;
      // Check various property names used by different strategies
      profitTarget = config.profitTargetPercent || config.profitTarget || 
                    config.takeProfitPercent || 7;
    }
    
    // Calculate proximity to target (0-100%)
    const proximityToTarget = (pnlPercent / profitTarget) * 100;
    
    // Inverted logic: green when close to selling, red when far away
    if (proximityToTarget >= 90) return 'green';  // 90%+ of target (about to sell)
    if (proximityToTarget >= 70) return 'yellow'; // 70-90% of target (getting close)
    if (proximityToTarget >= 30) return 'orange'; // 30-70% of target (making progress)
    return 'red';                                  // Below 30% (far from target/just started)
  }

  $: pnlAmount = (currentPrice - position.entryPrice) * position.size;
  $: pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice * 100);
  $: profitTarget = currentStrategy?.config?.profitTargetPercent || currentStrategy?.config?.profitTarget || 7;
</script>

<div class="position-item">
  <div class="traffic-light-container">
    <div class="traffic-light {getTrafficLightClass(position, currentPrice)}"
         title="Progress to {profitTarget}% profit target">
      <div class="light"></div>
    </div>
  </div>
  <div class="position-content">
    <div class="position-header">
      <span>Entry: ${position.entryPrice.toFixed(2)}</span>
      <span>{position.size.toFixed(8)} BTC</span>
    </div>
    <div class="position-details">
      <span>Current: ${currentPrice.toFixed(2)}</span>
      <span class:profit={pnlAmount > 0} class:loss={pnlAmount < 0}>
        P&L: ${pnlAmount.toFixed(2)}
        ({pnlPercent.toFixed(2)}%)
      </span>
    </div>
  </div>
</div>

<style>
  .position-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    border: 1px solid rgba(74, 0, 224, 0.2);
  }

  .traffic-light-container {
    flex-shrink: 0;
  }

  .traffic-light {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .traffic-light .light {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  .traffic-light.green .light {
    background: #26a69a;
    box-shadow: 0 0 10px rgba(38, 166, 154, 0.5);
  }

  .traffic-light.orange .light {
    background: #ff9800;
    box-shadow: 0 0 10px rgba(255, 152, 0, 0.5);
  }

  .traffic-light.yellow .light {
    background: #ffeb3b;
    box-shadow: 0 0 10px rgba(255, 235, 59, 0.5);
  }

  .traffic-light.red .light {
    background: #ef5350;
    box-shadow: 0 0 15px rgba(239, 83, 80, 0.7);
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { 
      opacity: 1; 
      transform: scale(1);
    }
    50% { 
      opacity: 0.8; 
      transform: scale(0.95);
    }
  }

  .position-content {
    flex: 1;
  }

  .position-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .position-details {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #d1d4dc;
  }

  .position-details span.profit {
    color: #26a69a;
    font-weight: 600;
  }

  .position-details span.loss {
    color: #ef5350;
    font-weight: 600;
  }
</style>