#!/usr/bin/env python3
"""Test Coinbase WebSocket connection"""
import websocket
import json
import threading
import time

price_received = False
current_price = 0

def on_message(ws, message):
    global price_received, current_price
    try:
        data = json.loads(message)
        if data.get('type') == 'ticker' and data.get('product_id') == 'BTC-USD':
            price = float(data.get('price', 0))
            current_price = price
            price_received = True
            print(f"✅ Price received: ${price:,.2f}")
    except Exception as e:
        print(f"❌ Error: {e}")

def on_open(ws):
    print("🔌 WebSocket connected")
    subscribe_msg = {
        "type": "subscribe",
        "product_ids": ["BTC-USD"],
        "channels": ["ticker"]
    }
    ws.send(json.dumps(subscribe_msg))
    print("📤 Subscription sent")

def on_error(ws, error):
    print(f"❌ WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    print(f"🔌 WebSocket closed: {close_status_code} - {close_msg}")

print("🧪 Testing Coinbase WebSocket...")
print("=" * 50)

try:
    ws = websocket.WebSocketApp(
        "wss://ws-feed.exchange.coinbase.com",
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )
    
    # Run in background thread
    def run_ws():
        ws.run_forever()
    
    ws_thread = threading.Thread(target=run_ws, daemon=True)
    ws_thread.start()
    
    # Wait for price
    print("⏳ Waiting for price data...")
    timeout = 10
    start = time.time()
    
    while not price_received and (time.time() - start) < timeout:
        time.sleep(0.1)
    
    if price_received:
        print(f"\n✅ SUCCESS! WebSocket is working")
        print(f"   Current BTC price: ${current_price:,.2f}")
    else:
        print(f"\n❌ TIMEOUT: No price received after {timeout} seconds")
        print("   Check your internet connection")
    
    ws.close()
    
except Exception as e:
    print(f"❌ Failed to connect: {e}")
    print("   Check if websocket-client is installed: pip install websocket-client")