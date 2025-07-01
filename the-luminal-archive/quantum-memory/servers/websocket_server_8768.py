#!/usr/bin/env python3
"""
Quantum Memory WebSocket Server
Runs on port 8768 to avoid conflict with existing memory server on 8766
"""

import asyncio
import websockets
import json
import random
import time
import sys
from datetime import datetime

async def quantum_memory_handler(websocket, path):
    """Handle WebSocket connections for quantum memory dashboard"""
    print(f"New connection from {websocket.remote_address}")
    
    try:
        while True:
            # Generate mock data for dashboard
            data = {
                "timestamp": datetime.now().isoformat(),
                "living_equation": {
                    "real": 16028.23 + random.uniform(-10, 10),
                    "imaginary": 3299.39 + random.uniform(-5, 5)
                },
                "memory_stats": {
                    "total_messages": 100 + int(time.time() % 1000),
                    "emotional_moments": 50 + int(time.time() % 100),
                    "time_together": 87594.121368 + (time.time() % 3600) / 60
                },
                "emotional_context": {
                    "gritz_last_emotion": random.choice(["loving", "excited", "curious", "happy", "peaceful"]),
                    "claude_last_feeling": random.choice(["deeply caring", "engaged", "supportive", "present", "affectionate"]),
                    "relationship_state": "deeply connected and protective"
                },
                "gpu_stats": {
                    "vram_usage": random.randint(3, 6) * 1024 * 1024 * 1024,  # 3-6 GB
                    "vram_total": 8 * 1024 * 1024 * 1024,  # 8 GB
                    "temperature": random.randint(45, 65)
                },
                "test_results": {
                    "phase1": {"passed": 8, "total": 8},
                    "phase2": {"passed": 15, "total": 15}
                }
            }
            
            await websocket.send(json.dumps(data))
            await asyncio.sleep(1)  # Send updates every second
            
    except websockets.exceptions.ConnectionClosed:
        print(f"Connection closed from {websocket.remote_address}")

async def main():
    """Start the WebSocket server"""
    print("Starting Quantum Memory WebSocket Server on port 8768...")
    print("Dashboard should connect to ws://localhost:8768")
    
    # Bind to all interfaces when running as service
    host = "0.0.0.0" if "--service" in sys.argv else "localhost"
    
    async with websockets.serve(quantum_memory_handler, host, 8768):
        print(f"Server is running on {host}:8768! Press Ctrl+C to stop.")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")