/**
 * @file useDataStoreSubscriptions.svelte.ts
 * @description Svelte hook for managing dataStore subscriptions with auto-cleanup
 */

import { onDestroy } from 'svelte';
import type { CandlestickData } from 'lightweight-charts';
import { dataStoreSubscriptions } from '../services/DataStoreSubscriptions';

/**
 * Hook for subscribing to realtime data with automatic cleanup
 *
 * Usage:
 * ```svelte
 * <script lang="ts">
 *   import { useDataStoreSubscriptions } from './hooks/useDataStoreSubscriptions.svelte';
 *
 *   useDataStoreSubscriptions('BTC-USD', '1m', (candle) => {
 *   });
 * </script>
 * ```
 *
 * @param pair Trading pair
 * @param granularity Candle granularity
 * @param onCandleUpdate Callback for candle/price updates
 * @param onReconnect Optional callback for reconnection events
 */
export function useDataStoreSubscriptions(
  pair: string,
  granularity: string,
  onCandleUpdate?: (candle: CandlestickData) => void,
  onReconnect?: () => void
): void {
  // Subscribe on mount
  const unsubscribe = dataStoreSubscriptions.subscribeToRealtime(
    pair,
    granularity,
    onCandleUpdate,
    onReconnect
  );

  // Auto-cleanup on destroy
  onDestroy(() => {
    unsubscribe();
  });
}

/**
 * Hook to check if subscriptions are active
 * @returns True if subscriptions are active
 */
export function useDataStoreSubscriptionStatus(): boolean {
  return dataStoreSubscriptions.isSubscribed();
}

/**
 * Hook to manually unsubscribe from all realtime updates
 */
export function useDataStoreUnsubscribe(): void {
  dataStoreSubscriptions.unsubscribeFromRealtime();
}

/**
 * Hook to reset subscription state
 */
export function useDataStoreSubscriptionReset(): void {
  dataStoreSubscriptions.reset();
}
