// Test script for strategy synchronization
// Run in browser console on the app

// Test 1: Check if strategy store persists
console.log('=== Test 1: Checking localStorage persistence ===');
const storedStrategy = localStorage.getItem('hermes_active_strategy');
if (storedStrategy) {
  const parsed = JSON.parse(storedStrategy);
  console.log('✅ Strategy persisted in localStorage:', parsed);
} else {
  console.log('❌ No strategy found in localStorage');
}

// Test 2: Check if balance and fees are included
if (storedStrategy) {
  const parsed = JSON.parse(storedStrategy);
  console.log('\n=== Test 2: Checking balance and fees ===');
  console.log('Balance:', parsed.balance || 'Not found');
  console.log('Fees:', parsed.fees || 'Not found');
  
  if (parsed.balance !== undefined && parsed.fees) {
    console.log('✅ Balance and fees are synced');
  } else {
    console.log('❌ Balance or fees missing');
  }
}

// Test 3: Verify custom strategies are stored
console.log('\n=== Test 3: Checking custom strategies ===');
const customStrategies = localStorage.getItem('hermes_custom_strategies');
if (customStrategies) {
  const strategies = JSON.parse(customStrategies);
  console.log('✅ Custom strategies found:', strategies.length, 'strategies');
} else {
  console.log('ℹ️ No custom strategies defined');
}

// Test 4: Check for sync after page refresh
console.log('\n=== Test 4: Page refresh test ===');
console.log('Instructions:');
console.log('1. Change strategy in Backtesting');
console.log('2. Change balance to 5000');
console.log('3. Refresh the page');
console.log('4. Check if Paper Trading shows the same strategy and balance');
console.log('5. Run this script again to verify persistence');

console.log('\n=== Summary ===');
console.log('The synchronization system should:');
console.log('✓ Persist strategy configuration to localStorage');
console.log('✓ Sync balance and fees between components');
console.log('✓ Restore configuration after page refresh');
console.log('✓ Show "🔄 Synced" indicator in both components');