<script lang="ts" context="module">
  import { chartPreferencesStore } from '../../../stores/chartPreferencesStore';

  // Define valid granularities for each period - ONLY Coinbase supported values
  export const validGranularities: Record<string, string[]> = {
    '1H': ['1m', '5m', '15m'],
    '4H': ['5m', '15m', '1h'],    // Removed 1m - too many candles (240)
    '5D': ['15m', '1h'],           // Removed 1m and 5m - too many candles  
    '1M': ['1h', '6h'],            // Removed 5m and 15m - too many candles
    '3M': ['1h', '6h', '1D'],      // Removed 15m - too many candles
    '6M': ['6h', '1D'],            // Removed 1h - too many candles
    '1Y': ['6h', '1D'],
    '5Y': ['1D']                   // Only daily for 5 years
  };

  export function isGranularityValid(granularity: string, period: string): boolean {
    return validGranularities[period]?.includes(granularity) || false;
  }

  export function autoSelectGranularity(period: string, currentGranularity: string): string {
    if (isGranularityValid(currentGranularity, period)) {
      return currentGranularity;
    }
    
    const validOptions = validGranularities[period];
    if (validOptions && validOptions.length > 0) {
      // Select the middle option as default (usually the best balance)
      const middleIndex = Math.floor(validOptions.length / 2);
      return validOptions[middleIndex];
    }
    
    return currentGranularity;
  }

  export function loadDashboardPreferences() {
    return chartPreferencesStore.getPreferences('dashboard');
  }

  export function saveDashboardPreferences(granularity: string, period: string) {
    chartPreferencesStore.setPreferences('dashboard', granularity, period);
  }
</script>

<script lang="ts">
  // This component only exports utility functions
  // No UI rendering
</script>