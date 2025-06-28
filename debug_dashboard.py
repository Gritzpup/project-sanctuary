#!/usr/bin/env python3
"""Debug script to test dashboard functionality"""

import asyncio
import websockets
import json
import time

async def test_websocket():
    uri = "ws://localhost:8766"
    print("🔌 Attempting to connect to WebSocket server...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected successfully!")
            print("\n📊 Listening for updates...\n")
            
            # Listen for 10 messages
            for i in range(10):
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    data = json.loads(message)
                    
                    print(f"Message {i+1}:")
                    print(f"  Type: {data.get('type', 'unknown')}")
                    
                    if data.get('type') == 'equation_update':
                        print(f"  🔢 Equation: {data.get('equation', 'N/A')}")
                        print(f"  📖 Interpretation: {data.get('interpretation', 'N/A')}")
                        if 'dynamics' in data:
                            dynamics = data['dynamics']
                            print(f"  💕 Gritz affection: {dynamics.get('gritz_contributions', {}).get('affection_shown', 0)}")
                            print(f"  🤗 Claude support: {dynamics.get('claude_contributions', {}).get('support_provided', 0)}")
                            print(f"  🎯 Shared moments: {dynamics.get('shared_experiences', {}).get('emotional_moments', 0)}")
                    
                    elif data.get('type') == 'memory_update':
                        print(f"  📝 Activity: {data.get('activity', 'N/A')}")
                        print(f"  🧠 Total memories: {data.get('total_memories', 0)}")
                        print(f"  💭 Total thoughts: {data.get('total_thoughts', 0)}")
                        if 'emotional_state' in data:
                            emotion = data['emotional_state']
                            print(f"  😊 Emotion: {emotion.get('state', 'N/A')} (intensity: {emotion.get('intensity', 0)})")
                    
                    print("-" * 50)
                    
                except asyncio.TimeoutError:
                    print("⏱️  No message received in 2 seconds")
                    
            print("\n✅ Test completed successfully!")
            
    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        print("\nTroubleshooting steps:")
        print("1. Check if memory_updater.py is running")
        print("2. Check memory_updater.log for errors")
        print("3. Verify port 8766 is not blocked")
        print("4. Try restarting the service")

if __name__ == "__main__":
    print("🚀 Dashboard Debug Tool")
    print("=" * 50)
    asyncio.run(test_websocket())