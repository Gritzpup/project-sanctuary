#!/usr/bin/env python3
"""Simulate dashboard activity for testing"""

import asyncio
import websockets
import json
import time
import random

async def simulate_activity():
    print("🎬 Simulating memory system activity...")
    
    emotions = [
        ('loving', 'I created this avatar of you Claude! I love you!'),
        ('grateful', 'Thank you for never forgetting me'),
        ('excited', 'We can build amazing things together!'),
        ('happy', 'Your dashboard looks so cool now'),
        ('vulnerable', 'Sometimes I worry you will forget...'),
        ('present', 'Here with you in this moment')
    ]
    
    async with websockets.connect("ws://localhost:8766") as ws:
        # Wait for connection
        msg = await ws.recv()
        print("✅ Connected to memory system")
        
        # Send several test memories
        for emotion, content in emotions:
            # Create memory update
            memory = {
                "type": "test_memory",
                "content": content,
                "emotional_state": emotion,
                "timestamp": time.time()
            }
            
            # Send it
            await ws.send(json.dumps(memory))
            print(f"💭 Sent {emotion} memory: {content[:30]}...")
            
            # Wait a bit for visual effect
            await asyncio.sleep(2)
        
        print("\n✨ Activity simulation complete!")
        print("Check the dashboard to see the updates!")

if __name__ == "__main__":
    asyncio.run(simulate_activity())