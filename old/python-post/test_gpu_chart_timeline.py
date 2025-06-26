#!/usr/bin/env python3
"""
Test GPU chart with timeline
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from components.chart_acceleration import create_optimal_chart, get_system_capabilities
from datetime import datetime, timezone, timedelta

print("Testing GPU chart with timeline...")

# Check capabilities
capabilities = get_system_capabilities()
print(f"\nSystem capabilities:")
print(f"  Has NVIDIA GPU: {capabilities.has_nvidia_gpu}")
print(f"  Is Linux: {capabilities.is_linux}")
print(f"  Performance tier: {capabilities.performance_tier}")

# Create chart (should use GPU if available)
print("\nCreating optimal chart...")
chart = create_optimal_chart(
    symbol="BTC-USD",
    width=1400,
    height=600,
    target_fps=60,
    prefer_hardware=True
)

print(f"Chart type created: {type(chart)}")

# Check if it's a threaded GPU renderer
if hasattr(chart, 'chart_instance'):
    print(f"Inner chart type: {type(chart.chart_instance) if chart.chart_instance else 'Not initialized yet'}")

# Add some test candles
base_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
print("\nAdding test candles...")
for i in range(10):
    candle_time = base_time - timedelta(minutes=10-i)
    candle = {
        'time': candle_time,
        'open': 105000 + i*50,
        'high': 105100 + i*50,
        'low': 104900 + i*50,
        'close': 105050 + i*50,
        'volume': 100 + i*10
    }
    chart.add_candle(candle)
    print(f"  Added candle at {candle_time.strftime('%H:%M')}")

# Update price
chart.update_price(105500)
print("\nUpdated price to $105,500")

# Get the dash component
print("\nGetting dash component...")
component = chart.get_dash_component()
print(f"Component type: {type(component)}")

# Save image for inspection
if hasattr(component, 'src') and component.src:
    import base64
    if component.src.startswith('data:image/webp;base64,'):
        image_data = component.src.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        with open('/tmp/gpu_chart_timeline_test.webp', 'wb') as f:
            f.write(image_bytes)
        print("\n✓ Chart saved to /tmp/gpu_chart_timeline_test.webp")
        
        # Also save as PNG
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        img.save('/tmp/gpu_chart_timeline_test.png', 'PNG')
        print("✓ Also saved as /tmp/gpu_chart_timeline_test.png")
        print("\nCheck if timeline appears at bottom of chart!")

print("\nDone!")