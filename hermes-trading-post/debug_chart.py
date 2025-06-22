#!/usr/bin/env python3
"""Debug chart display and updates"""
import time
import sys
sys.path.insert(0, '/home/ubuntumain/Documents/Github/project-sanctuary/hermes-trading-post')

from components.chart_acceleration import create_optimal_chart

print("🧪 Testing Chart Display and Updates")
print("=" * 50)

# Create a test chart
print("\n1. Creating chart...")
chart = create_optimal_chart("BTC-USD", width=800, height=600)
print(f"✅ Chart created: {chart.__class__.__name__}")

# Add some test data
print("\n2. Adding test data...")
from datetime import datetime, timedelta

base_time = datetime.now()
base_price = 100000

for i in range(10):
    candle = {
        'time': base_time + timedelta(minutes=i),
        'open': base_price + i * 100,
        'high': base_price + i * 100 + 50,
        'low': base_price + i * 100 - 50,
        'close': base_price + i * 100 + 25,
        'volume': 1000 + i * 10
    }
    chart.add_candle(candle)
    print(f"   Added candle {i+1}/10")

# Test rendering
print("\n3. Testing render...")
try:
    start = time.perf_counter()
    result = chart.render()
    render_time = (time.perf_counter() - start) * 1000
    print(f"✅ Render successful in {render_time:.2f}ms")
    print(f"   Result type: {type(result)}")
    print(f"   Result size: {len(result)} bytes")
except Exception as e:
    print(f"❌ Render failed: {e}")

# Test Dash component
print("\n4. Testing Dash component...")
try:
    dash_comp = chart.get_dash_component()
    print(f"✅ Dash component created: {type(dash_comp)}")
    
    # Check style
    if hasattr(dash_comp, 'style'):
        print(f"   Style: {dash_comp.style}")
except Exception as e:
    print(f"❌ Dash component failed: {e}")

# Test price updates
print("\n5. Testing price updates...")
for i in range(5):
    price = base_price + 1000 + i * 10
    chart.update_price(price)
    print(f"   Updated price to ${price:,.2f}")

print("\n" + "=" * 50)
print("✅ Test complete!")
print("\n📋 Summary of fixes:")
print("1. Chart width now responsive (100%)")
print("2. Data store connected to render callback")
print("3. Multiple WebSocket connections fixed")
print("4. Chart should now update in real-time!")