#!/usr/bin/env python3
"""
Test if chart updates are working with the fix
"""
import time
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
from datetime import datetime, timezone

print("Testing chart update fix...")

# Create chart
chart = CPUOptimizedChart(symbol="BTC-USD", width=800, height=600)
print("✓ Chart created")

# Add initial candle
candle = {
    'time': datetime.now(timezone.utc),
    'open': 105000,
    'high': 105100,
    'low': 104900,
    'close': 105050,
    'volume': 100
}
chart.add_candle(candle)
print("✓ Added initial candle")

# Test multiple price updates
prices = [105100, 105150, 105200, 105180, 105220]

for i, price in enumerate(prices):
    print(f"\nUpdate {i+1}: ${price:,.2f}")
    
    # Update price
    chart.update_price(price)
    
    # Get component
    component1 = chart.get_dash_component()
    print(f"  Component ID: {component1.id}")
    
    # Get another component (should have different ID)
    component2 = chart.get_dash_component()
    print(f"  Component ID: {component2.id}")
    
    # Check if IDs are different (forcing updates)
    if component1.id != component2.id:
        print("  ✓ Unique IDs - Dash will update!")
    else:
        print("  ✗ Same IDs - Dash won't update")
    
    time.sleep(0.5)

print("\nTest complete!")