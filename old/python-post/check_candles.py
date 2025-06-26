#!/usr/bin/env python3
"""Check if candles are being added to the chart"""
import time
from datetime import datetime, timezone
from pages.dashboard import get_bitcoin_chart, candle_data

# Wait for data to load
print("Waiting for candle data to load...")
time.sleep(5)

# Get the chart instance
chart = get_bitcoin_chart()
print(f"Chart type: {chart.__class__.__name__}")

# Check global candle data
print(f"\nGlobal candle_data: {len(candle_data.get(60, []))} candles")
if candle_data.get(60):
    print(f"First candle: time={candle_data[60][0]['time']}, close={candle_data[60][0]['close']}")
    print(f"Last candle: time={candle_data[60][-1]['time']}, close={candle_data[60][-1]['close']}")

# Check if chart has candles
if hasattr(chart, 'chart'):
    inner_chart = chart.chart
    print(f"\nInner chart type: {inner_chart.__class__.__name__}")
    
    # Try to check candles in the GPU thread's chart instance
    if hasattr(inner_chart, 'chart_instance') and inner_chart.chart_instance:
        gpu_chart = inner_chart.chart_instance
        print(f"GPU chart type: {gpu_chart.__class__.__name__}")
        if hasattr(gpu_chart, 'candles'):
            print(f"GPU chart has {len(gpu_chart.candles)} candles")
    else:
        print("GPU chart instance not accessible from main thread")

# Manually add a test candle
print("\nManually adding test candle...")
test_candle = {
    'time': datetime.now(timezone.utc),
    'open': 100000,
    'high': 101000,
    'low': 99000,
    'close': 100500,
    'volume': 100
}
chart.add_candle(test_candle)
print("Test candle added")

# Wait and check again
time.sleep(2)
print("\nFinal check...")
if hasattr(chart, 'chart') and hasattr(chart.chart, 'render_sync'):
    # Force a synchronous render
    print("Forcing synchronous render...")
    result = chart.chart.render_sync()
    if result:
        print(f"Render returned {len(result)} bytes")
    else:
        print("Render returned None")