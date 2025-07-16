# Zoom is DISABLED

## Current Status

Zoom functionality has been completely disabled per user request.

## What's Disabled:
- Mouse wheel zoom
- Pinch zoom on touch devices
- Drag to pan
- Axis scaling

## How the Chart Works Now:
- Chart view is locked to the selected timeframe
- Use the timeframe buttons (1H, 4H, 1D, 1W, 1M, 3M, 1Y, 5Y) to change the view
- No scrolling or zooming interactions with the chart itself

## Configuration:
In `Chart.svelte`, all zoom/scroll handlers are set to `false`:
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