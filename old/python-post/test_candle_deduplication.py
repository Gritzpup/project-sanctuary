#!/usr/bin/env python3
"""
Test candle deduplication and rendering fixes
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
from datetime import datetime, timezone, timedelta
import time

print("Testing candle deduplication fixes...")

# Create chart
chart = CPUOptimizedChart(symbol="BTC-USD", width=800, height=600)
print("✓ Chart created")

# Test 1: Add multiple candles at same minute (should not duplicate)
now = datetime.now(timezone.utc).replace(second=0, microsecond=0)

print("\nTest 1: Adding multiple candles at same minute")
candle1 = {
    'time': now,
    'open': 105000,
    'high': 105100,
    'low': 104900,
    'close': 105050,
    'volume': 100
}
chart.add_candle(candle1)
print(f"  Added candle 1: {len(chart.candles)} candles total")

# Try to add another candle at same minute (should replace)
candle2 = {
    'time': now,
    'open': 105000,
    'high': 105200,  # Different high
    'low': 104800,   # Different low  
    'close': 105150,  # Different close
    'volume': 150
}
chart.add_candle(candle2)
print(f"  Added candle 2: {len(chart.candles)} candles total")

if len(chart.candles) == 1:
    print("  ✓ Deduplication working - only 1 candle")
    print(f"  ✓ Candle updated: H={chart.candles[0]['high']}, L={chart.candles[0]['low']}")
else:
    print(f"  ✗ Deduplication failed - {len(chart.candles)} candles")

# Test 2: Update current candle multiple times
print("\nTest 2: Updating current candle")
for i in range(5):
    update_candle = {
        'time': now,
        'open': 105000,
        'high': 105100 + i*50,
        'low': 104900 - i*50,
        'close': 105050 + i*25,
        'volume': 100 + i*10
    }
    chart.update_current_candle(update_candle)
    print(f"  Update {i+1}: {len(chart.candles)} candles")

if len(chart.candles) == 1:
    print("  ✓ Current candle updates working - still 1 candle")
else:
    print(f"  ✗ Current candle updates created duplicates - {len(chart.candles)} candles")

# Test 3: Add candle for next minute
print("\nTest 3: Adding next minute candle")
next_minute = now + timedelta(minutes=1)
candle3 = {
    'time': next_minute,
    'open': 105150,
    'high': 105250,
    'low': 105100,
    'close': 105200,
    'volume': 200
}
chart.add_candle(candle3)
print(f"  Added next minute: {len(chart.candles)} candles total")

if len(chart.candles) == 2:
    print("  ✓ New minute created new candle correctly")
else:
    print(f"  ✗ Expected 2 candles, got {len(chart.candles)}")

# Test 4: Render multiple times (check for visual accumulation)
print("\nTest 4: Multiple renders")
for i in range(3):
    image_bytes = chart.render()
    print(f"  Render {i+1}: {len(image_bytes)} bytes")
    # Update price to trigger visual change
    chart.update_price(105000 + i*100)

print("\n✓ All tests complete!")