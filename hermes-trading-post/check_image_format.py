#!/usr/bin/env python3
"""
Check image format from chart
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from components.chart_acceleration import create_optimal_chart
import time

# Create chart
chart = create_optimal_chart("BTC-USD", 800, 600, 60)

# Add a test candle
chart.update_data({
    'time': time.time(),
    'open': 100000,
    'high': 100100,
    'low': 99900,
    'close': 100050,
    'volume': 1000
})

# Wait for render
time.sleep(1)

# Get component
component = chart.get_dash_component()

print(f"Component type: {type(component).__name__}")
print(f"Component props: {component._prop_names if hasattr(component, '_prop_names') else 'no props'}")

if hasattr(component, 'src'):
    src = component.src
    print(f"\nImage src length: {len(src) if src else 'None'}")
    if src:
        print(f"First 100 chars: {src[:100]}")
        print(f"Starts with 'data:image': {src.startswith('data:image')}")
else:
    print("No src attribute found")