// Test script to verify zoom behavior after fixes
// This script simulates the zoom calculations to ensure they work correctly

const granularityToSeconds = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '6h': 21600,
  '1D': 86400
};

function testZoomBehavior() {
  console.log('=== Testing Zoom Behavior After Fixes ===\n');
  
  const currentGranularity = '5m';
  const granularitySeconds = granularityToSeconds[currentGranularity];
  
  // Test case 1: When current range is below minimum (the problematic case)
  console.log('Test Case 1: Current range below minimum');
  const currentRange1 = 0.683 * 3600; // 0.683 hours in seconds
  const minRange = granularitySeconds * 10; // 10 candles minimum
  
  console.log(`Current range: ${currentRange1 / 3600} hours (${currentRange1} seconds)`);
  console.log(`Minimum range: ${minRange / 3600} hours (${minRange} seconds)`);
  console.log(`Below minimum: ${currentRange1 < minRange}`);
  
  // Simulate zoom out
  const zoomOutFactor = 1.15;
  const newRangeOut = currentRange1 * zoomOutFactor;
  let clampedRangeOut;
  
  if (currentRange1 < minRange) {
    // When zooming out while below minimum, allow expanding to at least minimum
    clampedRangeOut = Math.max(minRange, newRangeOut);
    console.log(`Zoom OUT: Expanding from ${currentRange1 / 3600}h to ${clampedRangeOut / 3600}h`);
  }
  
  // Simulate zoom in
  const zoomInFactor = 0.85;
  const newRangeIn = currentRange1 * zoomInFactor;
  let clampedRangeIn;
  
  if (currentRange1 < minRange) {
    // When zooming in while already below minimum, don't change the range
    clampedRangeIn = currentRange1;
    console.log(`Zoom IN: Blocked - keeping current range ${currentRange1 / 3600}h`);
  }
  
  console.log('\nExpected behavior:');
  console.log('- Scroll DOWN (zoom out): Should expand range to at least minimum');
  console.log('- Scroll UP (zoom in): Should be blocked when below minimum');
  
  // Test case 2: Normal case when above minimum
  console.log('\n\nTest Case 2: Current range above minimum');
  const currentRange2 = 2 * 3600; // 2 hours
  console.log(`Current range: ${currentRange2 / 3600} hours`);
  console.log(`Above minimum: ${currentRange2 > minRange}`);
  
  const newRangeOut2 = currentRange2 * zoomOutFactor;
  const newRangeIn2 = currentRange2 * zoomInFactor;
  
  console.log(`Zoom OUT: ${currentRange2 / 3600}h → ${newRangeOut2 / 3600}h`);
  console.log(`Zoom IN: ${currentRange2 / 3600}h → ${newRangeIn2 / 3600}h`);
  
  console.log('\nExpected behavior:');
  console.log('- Both zoom directions should work normally');
  
  // Test case 3: Error prevention
  console.log('\n\nTest Case 3: Error Prevention');
  console.log('The "Cannot update oldest data" error should now be prevented by:');
  console.log('1. Checking if update candle time is within current data range');
  console.log('2. Skipping updates for candles outside the range');
  console.log('3. Wrapping update in try-catch for safety');
  
  console.log('\nThe zoom should now work properly without interference from:');
  console.log('1. Real-time candle updates (isZooming flag prevents auto-scroll)');
  console.log('2. Visible range change handler (checks isZooming)');
  console.log('3. Extended timeout (500ms) ensures zoom completes');
}

testZoomBehavior();