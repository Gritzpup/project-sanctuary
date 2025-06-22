#!/usr/bin/env python3
"""Test Dashboard Price Display"""
import time
import sys
sys.path.insert(0, '/home/ubuntumain/Documents/Github/project-sanctuary/hermes-trading-post')

# Import dashboard module to test
from pages import dashboard

print("🧪 Testing Dashboard Price Display")
print("=" * 50)

# Check initial values
print(f"Initial price: ${dashboard.current_price:,.2f}")
print(f"WebSocket connection: {dashboard.ws_connection}")

# Wait a bit for websocket to connect
print("\n⏳ Waiting for WebSocket to update price...")
for i in range(10):
    time.sleep(1)
    if dashboard.current_price > 0:
        print(f"✅ Price updated: ${dashboard.current_price:,.2f}")
        break
    print(f"   {i+1}s - Current price: ${dashboard.current_price:,.2f}")

print("\n📊 Final Status:")
print(f"   Current price: ${dashboard.current_price:,.2f}")
print(f"   Current candle: {dashboard.current_candle}")
print(f"   Candle data keys: {list(dashboard.candle_data.keys())}")

if dashboard.current_price > 0:
    print("\n✅ Dashboard WebSocket is working!")
else:
    print("\n❌ Dashboard WebSocket not receiving data")
    print("   Check console output when running the app")