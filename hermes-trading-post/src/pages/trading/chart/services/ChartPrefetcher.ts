/**
 * Chart Data Prefetcher
 *
 * Intelligently pre-fetches chart data that the user is likely to need next,
 * making granularity and pair switches feel instant.
 *
 * Strategies:
 * 1. Common granularity switches (1m → 5m, 15m | 1H → 4H, 1D)
 * 2. User behavior patterns (track most used pairs/granularities)
 * 3. Idle time pre-fetching (when browser is idle)
 * 4. Adjacent timeframes (if on 1H, pre-fetch 4H and 1D)
 */

import { chartIndexedDBCache } from './ChartIndexedDBCache';
import { chartCacheService } from '../../../../shared/services/chartCacheService';
import { ChartDebug } from '../utils/debug';
import { getGranularitySeconds } from '../utils/granularityHelpers';
import type { CandlestickData } from 'lightweight-charts';

interface UserPattern {
  mostUsedPairs: string[];
  mostUsedGranularities: string[];
  granularitySwitchPatterns: Record<string, string[]>; // e.g., {"1m": ["5m", "15m"]}
  lastUsed: Record<string, number>; // timestamp of last use
}

interface PrefetchTask {
  pair: string;
  granularity: string;
  priority: number; // 1-10 (10 = highest)
  reason: string; // for debugging
}

export class ChartPrefetcher {
  private userPatterns: UserPattern;
  private prefetchQueue: PrefetchTask[] = [];
  private isPreFetching = false;
  private idleTimeout: NodeJS.Timeout | null = null;
  private readonly STORAGE_KEY = 'hermes_chart_user_patterns';
  private readonly IDLE_DELAY_MS = 3000; // Wait 3 seconds of idle before pre-fetching

  // Common granularity switch patterns (based on typical user behavior)
  private readonly COMMON_SWITCHES: Record<string, string[]> = {
    '1m': ['5m', '15m', '30m'],
    '5m': ['1m', '15m', '30m'],
    '15m': ['5m', '30m', '1h'],
    '30m': ['15m', '1h', '4h'],
    '1h': ['30m', '4h', '1d'],
    '4h': ['1h', '1d', '1w'],
    '1d': ['4h', '1w', '1M'],
    '1w': ['1d', '1M'],
    '1M': ['1w', '3M']
  };

  constructor() {
    this.userPatterns = this.loadUserPatterns();
    this.initializeIdleDetection();
  }

  /**
   * Initialize the prefetcher
   */
  async initialize(): Promise<void> {
    await this.dataService.initialize();
    ChartDebug.log('📡 Chart Prefetcher initialized');
  }

  /**
   * Track user's current selection to learn patterns
   */
  trackUsage(pair: string, granularity: string): void {
    const patterns = this.userPatterns;

    // Track most used pairs
    if (!patterns.mostUsedPairs.includes(pair)) {
      patterns.mostUsedPairs.push(pair);
    }

    // Track most used granularities
    if (!patterns.mostUsedGranularities.includes(granularity)) {
      patterns.mostUsedGranularities.push(granularity);
    }

    // Update last used timestamp
    const key = `${pair}:${granularity}`;
    patterns.lastUsed[key] = Date.now();

    // Save patterns
    this.saveUserPatterns();

    // Schedule pre-fetching for likely next selections
    this.schedulePrefetch(pair, granularity);
  }

  /**
   * Schedule pre-fetch tasks based on current selection
   */
  private schedulePrefetch(currentPair: string, currentGranularity: string): void {
    // Clear existing queue
    this.prefetchQueue = [];

    // 1. Add common granularity switches (highest priority)
    const commonSwitches = this.COMMON_SWITCHES[currentGranularity] || [];
    commonSwitches.forEach((nextGranularity, index) => {
      this.prefetchQueue.push({
        pair: currentPair,
        granularity: nextGranularity,
        priority: 10 - index, // First is highest priority
        reason: `Common switch from ${currentGranularity}`
      });
    });

    // 2. Add user's frequently used granularities (medium priority)
    const frequentGranularities = this.userPatterns.mostUsedGranularities
      .filter(g => g !== currentGranularity && !commonSwitches.includes(g))
      .slice(0, 2); // Top 2

    frequentGranularities.forEach((granularity, index) => {
      this.prefetchQueue.push({
        pair: currentPair,
        granularity,
        priority: 7 - index,
        reason: 'User frequently uses this granularity'
      });
    });

    // 3. Add other common pairs with same granularity (lower priority)
    const otherPairs = this.userPatterns.mostUsedPairs
      .filter(p => p !== currentPair)
      .slice(0, 2); // Top 2 other pairs

    otherPairs.forEach((pair, index) => {
      this.prefetchQueue.push({
        pair,
        granularity: currentGranularity,
        priority: 5 - index,
        reason: 'User frequently uses this pair'
      });
    });

    // Sort by priority
    this.prefetchQueue.sort((a, b) => b.priority - a.priority);

    ChartDebug.log(`📋 Prefetch queue prepared: ${this.prefetchQueue.length} tasks`, {
      queue: this.prefetchQueue.map(t => `${t.pair}:${t.granularity} (${t.priority})`)
    });

    // Start idle detection for pre-fetching
    this.resetIdleTimer();
  }

  /**
   * Execute pre-fetch tasks when browser is idle
   */
  private async executePrefetch(): Promise<void> {
    if (this.isPreFetching || this.prefetchQueue.length === 0) {
      return;
    }

    this.isPreFetching = true;
    ChartDebug.log('🚀 Starting prefetch execution...');

    // Execute tasks in priority order
    for (const task of this.prefetchQueue) {
      try {
        // Check if already cached
        const cached = await chartIndexedDBCache.get(task.pair, task.granularity);

        if (cached) {
          const isFresh = await chartIndexedDBCache.isFresh(task.pair, task.granularity);

          if (isFresh) {
            ChartDebug.log(`⏭️ Skipping ${task.pair}:${task.granularity} - already cached and fresh`);
            continue;
          }
        }

        // Prefetch data
        ChartDebug.log(`📥 Prefetching ${task.pair}:${task.granularity} (priority ${task.priority}) - ${task.reason}`);

        const now = Math.floor(Date.now() / 1000);
        const granularitySeconds = getGranularitySeconds(task.granularity);
        const startTime = now - (1000 * granularitySeconds); // Last 1000 candles

        const data = await chartCacheService.fetchCandles({
          pair: task.pair,
          granularity: task.granularity,
          start: startTime,
          end: now,
          limit: 1000
        });

        if (data.length > 0) {
          // Convert to CandlestickData and cache
          const chartData: CandlestickData[] = data.map(c => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume
          }));

          await chartIndexedDBCache.set(task.pair, task.granularity, chartData);
          ChartDebug.log(`✅ Prefetched and cached ${data.length} candles for ${task.pair}:${task.granularity}`);
        }

        // Small delay between prefetches to avoid overwhelming the backend
        await this.delay(500);

      } catch (error) {
        ChartDebug.error(`Failed to prefetch ${task.pair}:${task.granularity}:`, error);
      }
    }

    ChartDebug.log('✅ Prefetch execution complete');
    this.isPreFetching = false;

    // Clear queue
    this.prefetchQueue = [];
  }

  /**
   * Initialize idle detection
   */
  private initializeIdleDetection(): void {
    // Reset idle timer on user activity
    const resetOnActivity = () => this.resetIdleTimer();

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', resetOnActivity, { passive: true });
      window.addEventListener('keydown', resetOnActivity, { passive: true });
      window.addEventListener('scroll', resetOnActivity, { passive: true });
      window.addEventListener('click', resetOnActivity, { passive: true });
    }
  }

  /**
   * Reset idle timer
   */
  private resetIdleTimer(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    this.idleTimeout = setTimeout(() => {
      this.executePrefetch();
    }, this.IDLE_DELAY_MS);
  }

  /**
   * Load user patterns from localStorage
   */
  private loadUserPatterns(): UserPattern {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      ChartDebug.error('Failed to load user patterns:', error);
    }

    // Default patterns
    return {
      mostUsedPairs: ['BTC-USD'], // Start with BTC
      mostUsedGranularities: ['1m', '5m', '15m'], // Common starting points
      granularitySwitchPatterns: {},
      lastUsed: {}
    };
  }

  /**
   * Save user patterns to localStorage
   */
  private saveUserPatterns(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.userPatterns));
    } catch (error) {
      ChartDebug.error('Failed to save user patterns:', error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual pre-fetch trigger (for testing or explicit user actions)
   */
  async prefetchNow(pair: string, granularity: string): Promise<void> {
    this.prefetchQueue = [{
      pair,
      granularity,
      priority: 10,
      reason: 'Manual prefetch'
    }];

    await this.executePrefetch();
  }

  /**
   * Get prefetch statistics
   */
  getStats(): {
    queueLength: number;
    isPreFetching: boolean;
    userPatterns: UserPattern;
  } {
    return {
      queueLength: this.prefetchQueue.length,
      isPreFetching: this.isPreFetching,
      userPatterns: this.userPatterns
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.prefetchQueue = [];
    this.isPreFetching = false;
  }
}

// Export singleton instance
export const chartPrefetcher = new ChartPrefetcher();
