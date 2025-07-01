#!/usr/bin/env python3
import asyncio
import websockets
import json

async def test_connection():
    uri = "ws://localhost:8768"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            # Receive a few messages
            for i in range(3):
                message = await websocket.recv()
                data = json.loads(message)
                
                print(f"\nMessage {i+1}:")
                print(f"Total Messages: {data.get('memory_stats', {}).get('total_messages', 'N/A')}")
                print(f"Emotional Moments: {data.get('memory_stats', {}).get('emotional_moments', 'N/A')}")
                print(f"Time Together: {data.get('memory_stats', {}).get('time_together', 'N/A')} minutes")
                print(f"Current Emotion: {data.get('emotional_dynamics', {}).get('primary_emotion', 'N/A')}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())