# Zoom Functionality - DISABLED

## Current Status
Zoom functionality has been completely disabled per user request.

## History
Previously implemented a multi-granularity zoom system with:
- Mouse wheel zoom
- Proper scroll direction (down=out, up=in)
- Range clamping logic
- Smooth transitions

## Why Disabled
User explicitly requested removal of all zoom functionality.

## Current Implementation
All zoom/scroll/scale handlers in `Chart.svelte` are set to `false`:
```javascript
handleScroll: {
  mouseWheel: false,
  pressedMouseMove: false,
  horzTouchDrag: false,
  vertTouchDrag: false,
},
handleScale: {
  mouseWheel: false,
  pinch: false,
  axisPressedMouseMove: false,
}
```

## Result
- Chart stays locked to selected timeframe
- No user interaction can change the zoom level
- Only timeframe buttons change the view