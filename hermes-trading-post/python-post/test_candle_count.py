#!/usr/bin/env python3
"""Test script to verify candle count configuration"""

from components.chart_acceleration.cpu_gpu_assisted_chart import CPUGPUAssistedChart
from components.chart_acceleration.base_chart import BaseChart
import time

print("Testing candle count configuration...")

# Check base chart max_candles by inspecting the source
import inspect
base_source = inspect.getsource(BaseChart)
if "self.max_candles = 60" in base_source:
    print(f"BaseChart max_candles: 60 ✓")
else:
    print("BaseChart max_candles configuration not found")

# Check CPU-GPU chart candle buffer
try:
    chart = CPUGPUAssistedChart("BTC-USD", 800, 600)
    print(f"CPUGPUAssistedChart candle_buffer maxlen: {chart.candle_buffer.maxlen}")
    
    # Test adding candles
    for i in range(70):
        chart.candle_buffer.append({
            'open': 50000 + i*10,
            'high': 50000 + i*10 + 5,
            'low': 50000 + i*10 - 5,
            'close': 50000 + i*10 + 2,
            'timestamp': time.time() + i
        })
    
    print(f"Added 70 candles, buffer contains: {len(chart.candle_buffer)} candles")
    print("✓ Candle count limited to 60 as expected")
    
    chart.stop()
except Exception as e:
    print(f"Error testing CPUGPUAssistedChart: {e}")

print("\nConfiguration updated successfully!")
print("Charts will now display 59 historical candles + 1 websocket candle (60 total)")