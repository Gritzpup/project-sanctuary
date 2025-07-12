# Zoom Test Instructions

## What I Fixed

The zoom behavior was broken - both scroll directions were zooming IN. Now it should work correctly:

- **Scroll DOWN** (away from you) → **Zooms OUT** (shows more historical data)
- **Scroll UP** (toward you) → **Zooms IN** (shows less data, more detail)

## How to Test

1. Make sure the dev server is running (`npm run dev`)
2. Open the trading dashboard 
3. Try scrolling on the chart with your mouse wheel
4. Check the browser console (F12) to see detailed logs

## What to Look For in Console

You should see logs like:
```
Zoom calculation: {
  scrollDirection: "DOWN",
  action: "ZOOM OUT", 
  expectedChange: "range should increase"
}
```

And:
```
Range verification: {
  requested: "24 hours",
  actual: "24 hours",
  matches: true
}
```

## If It's Still Not Working

Check the console for:
- `wasClampedMin: true` - means you hit the minimum zoom limit
- `wasClampedMax: true` - means you hit the maximum zoom limit
- Any range verification mismatches

## Keyboard Modifiers

- Hold **Shift** while scrolling to force right-edge anchoring
- Hold **Alt** while scrolling to disable right-edge anchoring