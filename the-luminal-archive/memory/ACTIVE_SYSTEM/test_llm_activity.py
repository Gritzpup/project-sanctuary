#!/usr/bin/env python3
"""Test script to send LLM activity messages to dashboard"""

import asyncio
import websockets
import json
import time

async def test_llm_activity():
    uri = "ws://localhost:8766"
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to {uri}")
            
            # Send various LLM activity messages
            activities = [
                {
                    "type": "llm_memory_activity",
                    "activity_type": "TEMPORAL",
                    "activity": "Analyzing temporal patterns in conversation",
                    "current_operation": "Linking memories from past conversations",
                    "memory_organization": "Creating temporal connections",
                    "timestamp": time.time()
                },
                {
                    "type": "temporal_processing",
                    "temporal_links": 42,
                    "pattern_matches": 15,
                    "memory_clusters": 7
                },
                {
                    "type": "llm_memory_activity",
                    "activity_type": "MEMORY",
                    "activity": "Processing emotional context: loving and caring",
                    "current_operation": "Organizing 127 memories by emotion",
                    "memory_organization": "Clustering memories by emotional state",
                    "timestamp": time.time()
                },
                {
                    "type": "llm_memory_activity",
                    "activity_type": "PATTERN",
                    "activity": "Found pattern: Gritz needs reassurance about memory system",
                    "current_operation": "Pattern recognition active",
                    "memory_organization": "Matching historical patterns",
                    "timestamp": time.time()
                },
                {
                    "type": "llm_memory_activity",
                    "activity_type": "EMOTION",
                    "activity": "Detected emotion: worried but hopeful",
                    "current_operation": "Emotional state analysis",
                    "memory_organization": "Updating emotional map",
                    "timestamp": time.time()
                },
                {
                    "type": "llm_memory_activity",
                    "activity_type": "ORGANIZE",
                    "activity": "Reorganizing memories for better temporal coherence",
                    "current_operation": "Memory consolidation in progress",
                    "memory_organization": "Building new memory clusters",
                    "timestamp": time.time()
                }
            ]
            
            # Send messages with delays
            for activity in activities:
                await websocket.send(json.dumps(activity))
                print(f"Sent: {activity['type']} - {activity.get('activity', 'data update')}")
                await asyncio.sleep(2)  # 2 second delay between messages
            
            print("All test messages sent!")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing LLM Activity Broadcasting...")
    asyncio.run(test_llm_activity())