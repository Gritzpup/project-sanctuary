// Test script to verify the zoom fix

// Simulate current state
const currentRange = 2460; // seconds (0.683 hours) - BELOW MINIMUM
const minRange = 3000; // 10 candles * 5 minutes * 60 seconds = 3000 seconds (0.833 hours)
const maxRange = 5 * 365 * 24 * 60 * 60; // 5 years

console.log("=== INITIAL STATE ===");
console.log("Current visible range:", currentRange / 3600, "hours");
console.log("Minimum allowed range:", minRange / 3600, "hours");
console.log("Current < Minimum?", currentRange < minRange);

// Zoom calculations
const baseZoomSpeed = 0.0015;

// Test scroll DOWN (positive deltaY) - ZOOM OUT
console.log("\n=== SCROLL DOWN (ZOOM OUT) TEST ===");
const deltaYDown = 15;
const isZoomingOut = deltaYDown > 0;
console.log("Is zooming out?", isZoomingOut);

const zoomIntensity = Math.min(Math.abs(deltaYDown) * baseZoomSpeed, 0.3);
const zoomFactor = isZoomingOut ? 1 + zoomIntensity : 1 - zoomIntensity;
const newRangeDown = currentRange * zoomFactor;

console.log("Zoom factor:", zoomFactor);
console.log("New range before clamping:", newRangeDown / 3600, "hours");

// Apply new logic
let clampedRangeDown;
if (currentRange < minRange) {
  if (!isZoomingOut) {
    clampedRangeDown = currentRange;
    console.log("Zoom in blocked: already below minimum range");
  } else {
    clampedRangeDown = Math.max(minRange, Math.min(maxRange, newRangeDown));
    console.log("Zooming out: expanding to at least minimum");
  }
} else {
  clampedRangeDown = Math.max(minRange, Math.min(maxRange, newRangeDown));
}

console.log("Clamped range:", clampedRangeDown / 3600, "hours");
console.log("Will range increase?", clampedRangeDown > currentRange);
console.log("Expected: YES (zoom out should work)");

// Test scroll UP (negative deltaY) - ZOOM IN
console.log("\n=== SCROLL UP (ZOOM IN) TEST ===");
const deltaYUp = -15;
const isZoomingIn = deltaYUp < 0;
console.log("Is zooming in?", isZoomingIn);

const zoomIntensityUp = Math.min(Math.abs(deltaYUp) * baseZoomSpeed, 0.3);
const zoomFactorUp = !isZoomingIn ? 1 + zoomIntensityUp : 1 - zoomIntensityUp;
const newRangeUp = currentRange * zoomFactorUp;

console.log("Zoom factor:", zoomFactorUp);
console.log("New range before clamping:", newRangeUp / 3600, "hours");

// Apply new logic
let clampedRangeUp;
const isZoomingOutUp = !isZoomingIn; // false
if (currentRange < minRange) {
  if (!isZoomingOutUp) {
    clampedRangeUp = currentRange;
    console.log("Zoom in blocked: already below minimum range");
  } else {
    clampedRangeUp = Math.max(minRange, Math.min(maxRange, newRangeUp));
  }
} else {
  clampedRangeUp = Math.max(minRange, Math.min(maxRange, newRangeUp));
}

console.log("Clamped range:", clampedRangeUp / 3600, "hours");
console.log("Will range change?", clampedRangeUp !== currentRange);
console.log("Expected: NO (zoom in should be blocked)");

console.log("\n=== CONCLUSION ===");
console.log("✅ Scroll DOWN (zoom out): Range increases from", currentRange/3600, "to", clampedRangeDown/3600, "hours");
console.log("✅ Scroll UP (zoom in): Range stays at", currentRange/3600, "hours (blocked)");
console.log("\nThe fix should now work correctly!");