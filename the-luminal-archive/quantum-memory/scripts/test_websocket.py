#!/usr/bin/env python3
"""
Test WebSocket connection to see recent messages
"""
import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:8768"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"✅ Connected to WebSocket at {uri}")
            
            # Listen for a few messages
            for i in range(5):
                message = await websocket.recv()
                data = json.loads(message)
                
                print(f"\n📨 Message {i+1}:")
                print(f"  Type: {data.get('type', 'unknown')}")
                
                if 'emotions' in data:
                    emotions = data['emotions']
                    print(f"  Primary emotion: {emotions.get('primary_emotion')}")
                    print(f"  Intensity: {emotions.get('intensity')}")
                    print(f"  PAD values: {emotions.get('pad_values')}")
                    
                if 'relationship_metrics' in data:
                    metrics = data['relationship_metrics']
                    print(f"  Connection strength: {metrics.get('connection_strength')}")
                    print(f"  Emotional resonance: {metrics.get('emotional_resonance')}")
                    
                if 'chat_stats' in data:
                    stats = data['chat_stats']
                    print(f"  Total messages: {stats.get('total_messages')}")
                    print(f"  Last update: {stats.get('last_update')}")
                    
    except Exception as e:
        print(f"❌ Error connecting to WebSocket: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())