# Zoom Fix Plan for Trading Dashboard

## Problem Discovered
Both scroll up and scroll down directions were making the chart zoom in (increase visible range).

## Root Cause Analysis
Through testing and console logs, discovered:
- The chart's visible range (0.683 hours = 2460 seconds) was smaller than the minimum allowed range (0.833 hours = 3000 seconds for 10 candles at 5-minute granularity)
- The clamping logic `Math.max(minRange, newRange)` was forcing both zoom directions to expand to at least the minimum
- This created the appearance that both scroll directions zoom in

## Solution Implemented
Added special handling for when the current range is below the minimum allowed range:

```javascript
// Special handling when current range is below minimum
let clampedRange;
if (currentRange < minRange) {
  if (!isZoomingOut) {
    // When zooming in while already below minimum, don't change the range
    clampedRange = currentRange;
    console.log('Zoom in blocked: already below minimum range');
  } else {
    // When zooming out while below minimum, allow expanding to at least minimum
    clampedRange = Math.max(minRange, Math.min(maxRange, newRange));
  }
} else {
  // Normal clamping when above minimum
  clampedRange = Math.max(minRange, Math.min(maxRange, newRange));
}
```

## Result
✅ **Fixed behavior:**
- Scroll DOWN (zoom out) → Properly expands the view when below minimum
- Scroll UP (zoom in) → Blocked when already below minimum range
- Both directions work normally when range is above minimum

## Test Verification
Created test script that confirms:
- When below minimum (0.683 hours < 0.833 hours):
  - Scroll down increases range from 0.683 to 0.833 hours ✓
  - Scroll up keeps range at 0.683 hours (blocked) ✓

## Location of Fix
- File: `/src/lib/Chart.svelte`
- Lines: ~258-272 (in the handleZoom function)