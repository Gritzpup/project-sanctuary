// Test script to understand the zoom issue

// Current state from console logs:
const currentRange = 2460; // seconds (0.683 hours)
const minRange = 3000; // 10 candles * 5 minutes * 60 seconds = 3000 seconds (0.833 hours)

console.log("Current visible range:", currentRange / 3600, "hours");
console.log("Minimum allowed range:", minRange / 3600, "hours");
console.log("Current < Minimum?", currentRange < minRange);

// Zoom calculations
const baseZoomSpeed = 0.0015;

// Test scroll DOWN (positive deltaY)
console.log("\n=== SCROLL DOWN TEST ===");
const deltaYDown = 15;
const isZoomingOut = deltaYDown > 0;
console.log("Is zooming out?", isZoomingOut);

const zoomIntensity = Math.min(Math.abs(deltaYDown) * baseZoomSpeed, 0.3);
const zoomFactor = isZoomingOut ? 1 + zoomIntensity : 1 - zoomIntensity;
const newRangeDown = currentRange * zoomFactor;

console.log("Zoom factor:", zoomFactor);
console.log("New range:", newRangeDown / 3600, "hours");
console.log("Clamped range:", Math.max(minRange, newRangeDown) / 3600, "hours");
console.log("Would increase range?", Math.max(minRange, newRangeDown) > currentRange);

// Test scroll UP (negative deltaY)
console.log("\n=== SCROLL UP TEST ===");
const deltaYUp = -15;
const isZoomingIn = deltaYUp < 0;
console.log("Is zooming in?", isZoomingIn);

const zoomIntensityUp = Math.min(Math.abs(deltaYUp) * baseZoomSpeed, 0.3);
const zoomFactorUp = !isZoomingIn ? 1 + zoomIntensityUp : 1 - zoomIntensityUp;
const newRangeUp = currentRange * zoomFactorUp;

console.log("Zoom factor:", zoomFactorUp);
console.log("New range:", newRangeUp / 3600, "hours");
console.log("Clamped range:", Math.max(minRange, newRangeUp) / 3600, "hours");
console.log("Would increase range?", Math.max(minRange, newRangeUp) > currentRange);

console.log("\n=== CONCLUSION ===");
console.log("Both directions increase range because current range is below minimum!");
console.log("The chart is stuck at a range smaller than the minimum allowed.");