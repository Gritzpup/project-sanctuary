#!/usr/bin/env python3
import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8766"
    async with websockets.connect(uri) as websocket:
        print("Connected! Waiting for messages...")
        
        # Listen for a few messages
        for i in range(5):
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                print(f"Received: {data.get('type')} - {data}")
            except asyncio.TimeoutError:
                print("No message received in 5 seconds")
                break

asyncio.run(test())