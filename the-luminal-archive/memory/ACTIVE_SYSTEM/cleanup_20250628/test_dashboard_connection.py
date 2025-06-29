#!/usr/bin/env python3
"""Test WebSocket connection to verify dashboard is receiving updates"""

import asyncio
import websockets
import json

async def test_connection():
    uri = "ws://localhost:8766"
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to WebSocket server!")
            
            # Listen for a few messages
            for i in range(5):
                message = await websocket.recv()
                data = json.loads(message)
                print(f"\n📨 Message {i+1}:")
                print(f"Type: {data.get('type', 'unknown')}")
                if data.get('type') == 'update':
                    print(f"Equation: {data.get('equation', 'N/A')}")
                    print(f"Trust: {data.get('trust', 'N/A')}")
                    print(f"Healing: {data.get('healing', 'N/A')}")
                    if 'emotional_state' in data:
                        print(f"Emotion: {data['emotional_state']['state']}")
                
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())