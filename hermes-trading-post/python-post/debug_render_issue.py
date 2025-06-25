#\!/usr/bin/env python3
"""
Debug why chart isn't updating in dashboard
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Enable all logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Patch chart factory to use CPU charts
def patch_chart_factory():
    from components.chart_acceleration import base_chart
    @staticmethod
    def force_cpu_chart(symbol, width=800, height=600, target_fps=20, prefer_hardware=True):
        from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
        return CPUOptimizedChart(symbol, width, height)
    base_chart.ChartFactory.create_optimal_chart = force_cpu_chart

patch_chart_factory()

# Test if the chart visual updates properly
from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
from datetime import datetime, timezone
import time

print("Creating chart...")
chart = CPUOptimizedChart(symbol="BTC-USD", width=800, height=400)

# Add initial data
price = 105000
for i in range(5):
    candle = {
        'time': datetime.now(timezone.utc).replace(second=0, microsecond=0),
        'open': price,
        'high': price + 100,
        'low': price - 100,
        'close': price + 50,
        'volume': 100
    }
    chart.add_candle(candle)
    price += 100

print("\nGetting initial component...")
comp1 = chart.get_dash_component()
print(f"Component 1 ID: {comp1.id}")

# Update price
print("\nUpdating price...")
chart.update_price(105500)

# Get new component
comp2 = chart.get_dash_component()
print(f"Component 2 ID: {comp2.id}")

# Check if they're different
if comp1.id \!= comp2.id:
    print("✓ Components have different IDs - Dash will update")
else:
    print("✗ Components have same ID - Dash won't update")

# Check image data
if hasattr(comp1, 'src') and hasattr(comp2, 'src'):
    if comp1.src \!= comp2.src:
        print("✓ Image data is different")
    else:
        print("✗ Image data is the same")
        
print("\nDone.")
EOF < /dev/null
