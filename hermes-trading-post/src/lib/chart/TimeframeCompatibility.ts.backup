// Timeframe compatibility matrix for chart controls
// Defines which combinations of granularity (candle size) and period (time range) work well together

export interface TimeframeConfig {
  granularity: string;
  period: string;
  candleCount: number;
  isOptimal: boolean;
  description: string;
}

export interface CompatibilityMatrix {
  [granularity: string]: {
    [period: string]: {
      compatible: boolean;
      candleCount: number;
      isOptimal: boolean;
      description: string;
    };
  };
}

// Define optimal candle counts for different chart views
const OPTIMAL_CANDLE_RANGES = {
  minimum: 4,     // Minimum for meaningful analysis (reduced for 1H+15m = 4 candles)
  ideal: 60,      // Ideal for most trading views
  maximum: 200,   // Maximum before chart becomes cluttered
  extended: 500,  // Extended for long-term analysis
  longTerm: 2000  // Long-term views (5Y = 1825 candles)
};

// Calculate how many candles fit in a time period
function calculateCandleCount(granularity: string, period: string): number {
  const granularityMinutes: { [key: string]: number } = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '1d': 1440
  };

  const periodMinutes: { [key: string]: number } = {
    '1H': 60,
    '4H': 240,
    '1D': 1440,
    '5D': 7200,    // 5 days
    '1M': 43200,   // ~30 days
    '3M': 129600,  // ~90 days
    '6M': 259200,  // ~180 days
    '1Y': 525600,  // ~365 days
    '5Y': 2628000  // ~1825 days (5 years)
  };

  const granMin = granularityMinutes[granularity];
  const periodMin = periodMinutes[period];

  if (!granMin || !periodMin) return 0;

  return Math.floor(periodMin / granMin);
}

// Determine compatibility based on candle count
function getCompatibility(candleCount: number): { compatible: boolean; isOptimal: boolean; description: string } {
  if (candleCount < OPTIMAL_CANDLE_RANGES.minimum) {
    return {
      compatible: false,
      isOptimal: false,
      description: `Too few candles (${candleCount}). Increase time range or decrease granularity.`
    };
  }

  if (candleCount <= OPTIMAL_CANDLE_RANGES.ideal) {
    return {
      compatible: true,
      isOptimal: true,
      description: `Optimal view (${candleCount} candles). Good balance for analysis.`
    };
  }

  if (candleCount <= OPTIMAL_CANDLE_RANGES.maximum) {
    return {
      compatible: true,
      isOptimal: false,
      description: `Good view (${candleCount} candles). Slightly crowded but usable.`
    };
  }

  if (candleCount <= OPTIMAL_CANDLE_RANGES.extended) {
    return {
      compatible: true,
      isOptimal: false,
      description: `Extended view (${candleCount} candles). Crowded but useful for long-term analysis.`
    };
  }

  if (candleCount <= OPTIMAL_CANDLE_RANGES.longTerm) {
    return {
      compatible: true,
      isOptimal: false,
      description: `Long-term view (${candleCount} candles). Very crowded but acceptable for multi-year analysis.`
    };
  }

  return {
    compatible: false,
    isOptimal: false,
    description: `Too many candles (${candleCount}). Decrease time range or increase granularity.`
  };
}

// Build the complete compatibility matrix
function buildCompatibilityMatrix(): CompatibilityMatrix {
  // ✅ Only use API-validated granularities
  const granularities = ['1m', '5m', '15m', '1h', '6h', '1d'];
  const periods = ['1H', '4H', '1D', '5D', '1M', '3M', '6M', '1Y', '5Y'];

  const matrix: CompatibilityMatrix = {};
  
  for (const granularity of granularities) {
    matrix[granularity] = {};
    
    for (const period of periods) {
      const candleCount = calculateCandleCount(granularity, period);
      const compatibility = getCompatibility(candleCount);
      
      matrix[granularity][period] = {
        compatible: compatibility.compatible,
        candleCount,
        isOptimal: compatibility.isOptimal,
        description: compatibility.description
      };
    }
  }
  
  return matrix;
}

// Export the compatibility matrix
export const TIMEFRAME_COMPATIBILITY = buildCompatibilityMatrix();

// Helper functions for UI components
export function isCompatible(granularity: string, period: string): boolean {
  return TIMEFRAME_COMPATIBILITY[granularity]?.[period]?.compatible ?? false;
}

export function isOptimal(granularity: string, period: string): boolean {
  return TIMEFRAME_COMPATIBILITY[granularity]?.[period]?.isOptimal ?? false;
}

export function getCandleCount(granularity: string, period: string): number {
  return TIMEFRAME_COMPATIBILITY[granularity]?.[period]?.candleCount ?? 0;
}

export function getDescription(granularity: string, period: string): string {
  return TIMEFRAME_COMPATIBILITY[granularity]?.[period]?.description ?? 'Unknown combination';
}

// Get recommended periods for a given granularity
export function getRecommendedPeriods(granularity: string): string[] {
  const matrix = TIMEFRAME_COMPATIBILITY[granularity];
  if (!matrix) return [];
  
  return Object.keys(matrix)
    .filter(period => matrix[period].isOptimal)
    .sort((a, b) => {
      const periodOrder = ['1H', '2H', '4H', '6H', '12H', '1D', '2D', '3D', '1W', '2W', '1M'];
      return periodOrder.indexOf(a) - periodOrder.indexOf(b);
    });
}

// Get recommended granularities for a given period
export function getRecommendedGranularities(period: string): string[] {
  const granularities: string[] = [];
  
  for (const granularity of Object.keys(TIMEFRAME_COMPATIBILITY)) {
    if (TIMEFRAME_COMPATIBILITY[granularity][period]?.isOptimal) {
      granularities.push(granularity);
    }
  }
  
  const granularityOrder = ['1m', '5m', '15m', '1h', '6h', '1d'];
  return granularities.sort((a, b) => granularityOrder.indexOf(a) - granularityOrder.indexOf(b));
}

// Get the best period for a given granularity
export function getBestPeriodForGranularity(granularity: string): string {
  const recommended = getRecommendedPeriods(granularity);
  return recommended[0] || '1D'; // Default to 1D if no optimal match
}

// Get the best granularity for a given period
export function getBestGranularityForPeriod(period: string): string {
  // First try to find optimal granularities
  const recommended = getRecommendedGranularities(period);
  if (recommended.length > 0) {
    return recommended[0];
  }

  // If no optimal match, find ANY compatible granularity (prefer larger granularities for longer periods)
  const granularityOrder = ['1d', '6h', '1h', '15m', '5m', '1m'];
  for (const granularity of granularityOrder) {
    if (TIMEFRAME_COMPATIBILITY[granularity]?.[period]?.compatible) {
      return granularity;
    }
  }

  // Last resort fallback
  return '1h';
}

// Auto-suggest compatible combination when user changes one control
export function getAutoSuggestion(
  changedControl: 'granularity' | 'period', 
  newValue: string, 
  currentGranularity: string, 
  currentPeriod: string
): { granularity: string; period: string; reason: string } {
  
  if (changedControl === 'granularity') {
    // User changed granularity, suggest best period
    const newGranularity = newValue;
    const recommendedPeriods = getRecommendedPeriods(newGranularity);
    
    // Try to keep current period if compatible, otherwise suggest best
    const newPeriod = recommendedPeriods.includes(currentPeriod) 
      ? currentPeriod 
      : getBestPeriodForGranularity(newGranularity);
      
    return {
      granularity: newGranularity,
      period: newPeriod,
      reason: recommendedPeriods.includes(currentPeriod) 
        ? 'Kept current period (compatible)'
        : `Suggested ${newPeriod} for optimal viewing with ${newGranularity} candles`
    };
  } else {
    // User changed period, suggest best granularity
    const newPeriod = newValue;
    const recommendedGranularities = getRecommendedGranularities(newPeriod);
    
    // Try to keep current granularity if compatible, otherwise suggest best
    const newGranularity = recommendedGranularities.includes(currentGranularity)
      ? currentGranularity
      : getBestGranularityForPeriod(newPeriod);
      
    return {
      granularity: newGranularity,
      period: newPeriod,
      reason: recommendedGranularities.includes(currentGranularity)
        ? 'Kept current granularity (compatible)'
        : `Suggested ${newGranularity} for optimal viewing with ${newPeriod} timeframe`
    };
  }
}

// Extended periods for the period control (footer) - optimized for maximum compatibility
export const EXTENDED_PERIODS = ['1H', '4H', '1D', '5D', '1M', '3M', '6M', '1Y', '5Y'] as const;
export type ExtendedPeriod = typeof EXTENDED_PERIODS[number];

// ✅ Enhanced granularity options (API-validated only)
export const ENHANCED_GRANULARITIES = ['1m', '5m', '15m', '1h', '6h', '1d'] as const;
export type EnhancedGranularity = typeof ENHANCED_GRANULARITIES[number];