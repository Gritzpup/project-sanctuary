// Test script to debug trading execution

// Simulate the strategy configuration being sent from frontend
const strategyConfig = {
  strategyType: 'reverse-ratio',
  strategyConfig: {
    initialDropPercent: 0.01,
    levelDropPercent: 0.008,
    profitTarget: 0.85,
    maxLevels: 12,
    basePositionPercent: 6
  },
  strategy: {
    getName: () => 'Reverse Ratio Buying',
    config: {
      initialDropPercent: 0.01,
      levelDropPercent: 0.008,
      profitTarget: 0.85,
      maxLevels: 12,
      basePositionPercent: 6
    },
    buyThreshold: -0.5,
    sellThreshold: 0.5,
    tradePercentage: 10
  }
};

// Simulate the ReverseRatioStrategy
class ReverseRatioStrategy {
  constructor(config) {
    this.config = {
      initialDropPercent: 0.01,
      levelDropPercent: 0.008,
      profitTarget: 0.85,
      maxLevels: 12,
      basePositionPercent: 6,
      ...config
    };
    this.positions = [];
    this.recentHigh = 0;
    console.log('Strategy created with config:', this.config);
  }

  analyze(candles, currentPrice) {
    // Update recent high
    const recentCandles = candles.slice(-20);
    if (recentCandles.length > 0) {
      const prevHigh = this.recentHigh;
      this.recentHigh = Math.max(...recentCandles.map(c => c.high), this.recentHigh);
      if (this.recentHigh > prevHigh) {
        console.log('New recent high:', this.recentHigh);
      }
    } else if (this.recentHigh === 0) {
      // Initialize with current price if no candles yet
      this.recentHigh = currentPrice;
      console.log('Initialized recent high with current price:', this.recentHigh);
    }

    // Check for buy signal
    const dropFromHigh = ((this.recentHigh - currentPrice) / this.recentHigh) * 100;
    const currentLevel = this.positions.length + 1;
    
    if (currentLevel <= this.config.maxLevels) {
      const requiredDrop = this.config.initialDropPercent + 
                          (currentLevel - 1) * this.config.levelDropPercent;
      
      console.log('Buy check:', {
        dropFromHigh: dropFromHigh.toFixed(4),
        requiredDrop: requiredDrop.toFixed(4),
        currentLevel,
        recentHigh: this.recentHigh,
        currentPrice,
        config: this.config
      });
      
      if (dropFromHigh >= requiredDrop) {
        return { 
          type: 'buy', 
          reason: `Drop level ${currentLevel} reached: ${dropFromHigh.toFixed(2)}%`,
          metadata: { level: currentLevel }
        };
      }
    }

    return { type: 'hold' };
  }
}

// Test the strategy
const strategy = new ReverseRatioStrategy(strategyConfig.strategyConfig);

// Simulate some price movements
const testPrices = [
  { price: 100000, expectedDrop: 0 },
  { price: 99990, expectedDrop: 0.01 },  // 0.01% drop - should trigger buy
  { price: 99980, expectedDrop: 0.02 },  // 0.02% drop
  { price: 99970, expectedDrop: 0.03 },  // 0.03% drop
  { price: 99950, expectedDrop: 0.05 },  // 0.05% drop
  { price: 99900, expectedDrop: 0.10 },  // 0.10% drop
];

console.log('\n=== Testing strategy with different price drops ===\n');

testPrices.forEach(({ price, expectedDrop }) => {
  // Create a simple candle
  const candle = {
    time: Date.now() / 1000,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0
  };
  
  const signal = strategy.analyze([candle], price);
  console.log(`\nPrice: $${price}, Expected drop: ${expectedDrop}%`);
  console.log(`Signal:`, signal);
});