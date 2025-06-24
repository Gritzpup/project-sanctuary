#!/usr/bin/env python3
"""
Debug render issue with price updates (like WebSocket would do)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
from datetime import datetime, timezone, timedelta
import time

print("Debugging render with updates (simulating WebSocket)...")

# Create chart
chart = CPUOptimizedChart(symbol="BTC-USD", width=800, height=600)

# Add initial candles
base_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
for i in range(5):
    candle = {
        'time': base_time - timedelta(minutes=4-i),
        'open': 105000 + i*10,
        'high': 105050 + i*10,
        'low': 104950 + i*10,
        'close': 105025 + i*10,
        'volume': 100
    }
    chart.add_candle(candle)

print(f"Initial candles: {len(chart.candles)}")

# Simulate WebSocket updates
current_candle = {
    'time': base_time,
    'open': 105100,
    'high': 105100,
    'low': 105100,
    'close': 105100,
    'volume': 0
}

for i in range(5):
    print(f"\nUpdate {i+1}:")
    
    # Update price (like WebSocket ticker)
    new_price = 105100 + i * 10
    chart.update_price(new_price)
    print(f"  Updated price to ${new_price:,.2f}")
    
    # Update current candle (like WebSocket would)
    current_candle['high'] = max(current_candle['high'], new_price)
    current_candle['low'] = min(current_candle['low'], new_price)
    current_candle['close'] = new_price
    chart.update_current_candle(current_candle)
    print(f"  Updated current candle")
    
    # Check state
    print(f"  Total candles: {len(chart.candles)}")
    print(f"  Price history: {len(chart.price_history)}")
    
    # Render
    image_bytes = chart.render()
    print(f"  Image size: {len(image_bytes)} bytes")
    
    # Save for inspection
    with open(f"/tmp/debug_ws_{i+1}.webp", "wb") as f:
        f.write(image_bytes)

print("\nCheck /tmp/debug_ws_*.webp files")