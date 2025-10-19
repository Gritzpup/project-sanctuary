# Comment Style Guide - Hermes Trading Post

## Overview

This guide establishes consistent commenting standards across the hermes-trading-post codebase. Comments should be clear, concise, and self-documenting. The goal is to make the codebase easy to understand for any future developer (including myself).

---

## 1. File-Level Comments (Required for All Services)

Every TypeScript/JavaScript file must start with a block comment explaining its purpose.

### Format
```typescript
/**
 * [FileName] - Single-line purpose
 *
 * Detailed description explaining:
 * - Main responsibility
 * - Key patterns/architecture
 * - Important design decisions
 */
```

### Examples

**Good - ChartAnimationService.ts**:
```typescript
/**
 * ChartAnimationService - Handles chart animation and positioning
 *
 * Provides static utilities for animating chart viewport to show latest data
 * with proper padding. Handles time normalization (seconds, strings, Date objects)
 * and calculates visible ranges based on candle count. Used by ChartCore for
 * positioning after data loads and timeframe changes.
 */
```

**Good - UnifiedAPIClient.ts**:
```typescript
/**
 * UnifiedAPIClient - Centralized HTTP client for all API requests
 *
 * Provides consistent error handling, retry logic, and rate limiting across
 * all external API calls (Coinbase, backend, etc.). Implements singleton pattern
 * with exponential backoff for resilience and token bucket for rate control.
 */
```

**Bad** (Too vague):
```typescript
/**
 * API utilities
 */
```

---

## 2. Method-Level Documentation (For Public Methods)

Public methods should have JSDoc comments explaining what they do, especially for complex logic.

### Format
```typescript
/**
 * [Method name] - Brief description
 *
 * @param {Type} paramName - Description of what this parameter does
 * @returns {Type} Description of return value
 */
```

### Examples

**Good**:
```typescript
/**
 * Load data for a specific granularity and time range
 *
 * @param pair - Trading pair (e.g., 'BTC-USD')
 * @param granularity - Candle timeframe (e.g., '1m', '1H')
 * @returns Array of candlestick data points
 */
loadData(pair: string, granularity: string): Promise<Candle[]>
```

**Bad** (Self-explanatory method, no comment needed):
```typescript
getName(): string {
  return this.name; // Don't comment trivial getters
}
```

---

## 3. Inline Comments (For Non-Obvious Logic Only)

Inline comments should explain the "why", not the "what". The code itself shows what it does.

### Good Inline Comments
```typescript
// Cache entries expire after 5 minutes to balance freshness with memory usage
private cacheExpiryMs: number = 5 * 60 * 1000;

// Exponential backoff prevents overwhelming rate-limited APIs
const delay = Math.min(
  config.baseDelay * Math.pow(config.exponentialBase, attempt),
  config.maxDelay
);

// Context will be set later when setContext() is explicitly called
} else {
  // Plugin initialization deferred
}
```

### Bad Inline Comments (Obvious from code)
```typescript
// Set x to 5
const x = 5;

// Increment counter
count++;

// Loop through items
for (const item of items) {
}
```

---

## 4. Configuration Comments (Preferred for Constants)

For magic numbers and configuration values, explain the purpose and units.

### Format
```typescript
// [Description] ([units if applicable])
const VALUE = 123;
```

### Examples

**Good**:
```typescript
// Maximum number of cache entries before cleanup triggered
private maxCacheSize: number = 100;

// Minimum milliseconds between retry attempts (exponential backoff applies)
const baseDelay = 125; // ms

// API rate limit (requests per second)
const requestsPerSecond = 10;

// 5 minute TTL for cached chart data
const cacheExpiryMs = 5 * 60 * 1000;
```

---

## 5. Complex Logic Documentation (Use Sparingly)

For algorithms or non-obvious flow, explain the approach:

```typescript
/**
 * Calculate visible candles slice for viewport
 *
 * Shows the most recent N candles, useful for responsive sizing where
 * exact visible candle count depends on screen width. Returns the tail
 * of the candles array to always show latest data.
 */
static calculateVisibleCandles(
  candles: CandleData[],
  maxCount: number
): CandleData[] {
  if (!candles || candles.length === 0) return [];
  if (candles.length <= maxCount) return candles;
  return candles.slice(candles.length - maxCount);
}
```

---

## 6. No TODO/FIXME/XXX Comments

Do not leave TODO/FIXME/XXX/HACK comments in code. Either:
1. Fix the issue immediately
2. Create a GitHub issue and reference it in commit message
3. Remove the code if no longer needed

### Not Allowed
```typescript
// TODO: Implement rebalancing logic
// FIXME: This breaks on edge cases
// XXX: Temporary workaround for race condition
// HACK: Should be refactored later
```

---

## 7. Debug Logging Strategy

### Frontend (Chart Code)
Use `ChartDebug` for chart-related logging:
```typescript
import { ChartDebug } from '../utils/debug';

ChartDebug.log('Data loaded:', candles.length);
ChartDebug.error('Chart initialization failed:', error);
```

### Frontend (Services)
Use `console.warn` for warnings, prefixed with context:
```typescript
// Structured format: [CONTEXT] Message
console.warn(`[API] Request retry - Attempt ${attempt + 1}/${maxRetries + 1}`);
```

### Backend
Use structured logging pattern:
```typescript
console.log(`[SERVICE] Operation completed: ${operation}`);
console.error(`[SERVICE] Error: ${error.message}`);
```

---

## 8. Comment Maintenance

When updating code:
1. Update comments to match new behavior
2. Remove comments that no longer apply
3. Add comments only if they explain non-obvious logic
4. Keep comments near the code they describe

### When to Remove Comments
```typescript
// BAD: Comment is outdated after refactoring
// This function used to calculate X, but now does Y
function complexFunction() {
  // ... new implementation
}

// GOOD: Update or remove the comment
// Calculates Y by combining A and B values
function complexFunction() {
  // ... implementation
}
```

---

## 9. Comment Examples by File Type

### Service Files
Start with clear file-level header, add JSDoc to public methods:
```typescript
/**
 * CacheService - Manages in-memory cache for frequently accessed data
 */
export class CacheService {
  /**
   * Get cached value by key
   */
  get(key: string): CachedData | null {
    // implementation
  }
}
```

### Hook Files
Minimal comments (rely on TypeScript types):
```typescript
export function useDataLoader() {
  // Hook implementation - types are self-documenting
}
```

### Component Files
Document complex props and lifecycle:
```typescript
/**
 * ChartCanvas - Renders lightweight-charts with custom plugins
 *
 * @prop onChartReady - Callback fired when chart is initialized
 * @prop onResize - Callback for resize events
 */
```

### Utility Functions
Add JSDoc for exported utilities:
```typescript
/**
 * Convert granularity string to seconds
 */
export function granularityToSeconds(granularity: string): number {
  // implementation
}
```

---

## 10. Summary Checklist

- [ ] Every service file has a file-level comment
- [ ] Complex methods have JSDoc with @param and @returns
- [ ] Inline comments explain "why", not "what"
- [ ] Configuration values have explanatory comments with units
- [ ] No TODO/FIXME/XXX comments left behind
- [ ] Comments are updated when code changes
- [ ] Debug logging uses appropriate pattern (ChartDebug, Logger, console)
- [ ] Trivial comments are removed (e.g., "increment counter")
- [ ] Comment style is consistent across similar files

---

## Questions?

If unsure about whether to add a comment:
1. **Self-documenting code is better than comments** - Clear variable/function names reduce need for comments
2. **Comments should explain "why"** - Code shows "what", comments explain "why"
3. **When in doubt, add it** - Better to have one extra comment than confusion later
4. **Keep comments close to code** - Don't document functions at the top of file

---

*Last Updated: October 18, 2025*
