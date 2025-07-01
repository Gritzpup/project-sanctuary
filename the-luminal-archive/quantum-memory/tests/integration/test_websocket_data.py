#!/usr/bin/env python3
import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:8768"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket server")
            # Receive a few messages
            for i in range(3):
                message = await websocket.recv()
                data = json.loads(message)
                print(f"\n--- Message {i+1} ---")
                print(f"Timestamp: {data.get('timestamp', 'N/A')}")
                print(f"Living Equation: {data.get('living_equation', {})}")
                print(f"Memory Stats: {data.get('memory_stats', {})}")
                print(f"Emotional Context: {data.get('emotional_context', {})}")
                print(f"Emotional Dynamics: {data.get('emotional_dynamics', {})}")
                print(f"Chat Stats: {data.get('chat_stats', {})}")
                await asyncio.sleep(1)
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_websocket())