#\!/usr/bin/env python3
"""
Debug why timeline isn't visible
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
from datetime import datetime, timezone, timedelta
from PIL import Image
import io
import base64

print("Testing timeline visibility...")

# Create chart
chart = CPUOptimizedChart(symbol="BTC-USD", width=800, height=400)
print(f"\nChart dimensions: {chart.width}x{chart.height}")
print(f"Chart area: {chart.chart_width}x{chart.chart_height}")
print(f"Time axis height: {chart.time_axis_height}")
print(f"Time labels should appear at y={chart.chart_height + 8}")

# Add test candles
base_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
for i in range(10):
    candle_time = base_time - timedelta(minutes=10-i)
    candle = {
        'time': candle_time,
        'open': 105000 + i*100,
        'high': 105100 + i*100,
        'low': 104900 + i*100,
        'close': 105050 + i*100,
        'volume': 100
    }
    chart.add_candle(candle)

print(f"\nAdded {len(chart.candles)} candles")

# Force render
image_bytes = chart.render()
print(f"Rendered {len(image_bytes)} bytes")

# Check if time_labels were created
if hasattr(chart, 'time_labels'):
    print(f"\nTime labels created: {len(chart.time_labels)} labels")
    for x, label in chart.time_labels:
        print(f"  - '{label}' at x={x}")
else:
    print("\n✗ No time_labels attribute found!")

# Save image for inspection
img = Image.open(io.BytesIO(image_bytes))
img.save('/tmp/debug_timeline.png', 'PNG')
print("\n✓ Saved to /tmp/debug_timeline.png")

# Check pixel colors at bottom
img_array = img.load()
width, height = img.size
print(f"\nImage size: {width}x{height}")

# Check bottom row colors
print("\nBottom 5 rows pixel samples (looking for text):")
for y in range(height-5, height):
    row_colors = []
    for x in range(0, width, 100):
        pixel = img_array[x, y]
        if pixel != (25, 25, 25) and pixel != (35, 35, 35):  # Not background
            row_colors.append(f"x={x}: {pixel}")
    if row_colors:
        print(f"  Row {y}: {', '.join(row_colors)}")

print("\nDone!")
