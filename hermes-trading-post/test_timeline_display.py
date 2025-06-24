#!/usr/bin/env python3
"""
Test timeline display at bottom of chart
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
from datetime import datetime, timezone, timedelta
import base64

print("Testing timeline display...")

# Create chart
chart = CPUOptimizedChart(symbol="BTC-USD", width=800, height=400)
print(f"Chart dimensions: {chart.width}x{chart.height}")
print(f"Chart area: {chart.chart_width}x{chart.chart_height}")
print(f"Time axis height: {chart.time_axis_height}")
print(f"Time labels y position will be: {chart.chart_height + 8} (chart_height + 8)")

# Add some candles with different times
base_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
for i in range(20):
    candle_time = base_time - timedelta(minutes=20-i)
    candle = {
        'time': candle_time,
        'open': 105000 + i*50,
        'high': 105100 + i*50,
        'low': 104900 + i*50,
        'close': 105050 + i*50,
        'volume': 100 + i*10
    }
    chart.add_candle(candle)

print(f"\nAdded {len(chart.candles)} candles")

# Update price
chart.update_price(105500)

# Render and get component
component = chart.get_dash_component()
if hasattr(component, 'id'):
    print(f"\nComponent ID: {component.id}")
elif hasattr(component, 'props') and 'id' in component.props:
    print(f"\nComponent ID: {component.props['id']}")
else:
    print("\nComponent has no ID")

# Check if image was generated
if hasattr(component, 'src') and component.src:
    # Extract image data
    if component.src.startswith('data:image/webp;base64,'):
        image_data = component.src.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        # Save to file for visual inspection
        with open('/tmp/test_timeline_chart.webp', 'wb') as f:
            f.write(image_bytes)
        print("✓ Chart saved to /tmp/test_timeline_chart.webp")
        print("  Check if timeline appears at bottom with time labels")
        
        # Also save as PNG for easier viewing
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        img.save('/tmp/test_timeline_chart.png', 'PNG')
        print("✓ Also saved as /tmp/test_timeline_chart.png for easier viewing")
else:
    print("✗ No image data generated")

print("\nDone!")