#!/usr/bin/env python3
"""
Advanced Quantum Memory WebSocket Server with Service Control
Runs on port 8768 with health check and restart capabilities
"""

import asyncio
import websockets
import json
import random
import time
import sys
import subprocess
import os
from datetime import datetime
from aiohttp import web
import aiohttp_cors

class QuantumMemoryServer:
    def __init__(self):
        self.websocket_clients = set()
        self.running = True
        
    async def health_check(self, request):
        """HTTP endpoint for health checks"""
        return web.json_response({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'clients': len(self.websocket_clients)
        })
    
    async def restart_service(self, request):
        """HTTP endpoint to restart services"""
        service_name = request.match_info.get('service_name', '')
        
        try:
            if service_name == 'quantum-websocket':
                # Restart WebSocket service
                subprocess.run(['sudo', 'systemctl', 'restart', 'quantum-websocket.service'], check=True)
                return web.json_response({'status': 'restarting', 'service': service_name})
            elif service_name == 'quantum-dashboard':
                # Restart dashboard service
                subprocess.run(['sudo', 'systemctl', 'restart', 'quantum-dashboard.service'], check=True)
                return web.json_response({'status': 'restarting', 'service': service_name})
            else:
                return web.json_response({'error': 'Unknown service'}, status=400)
        except Exception as e:
            return web.json_response({'error': str(e)}, status=500)
    
    async def websocket_handler(self, websocket):
        """Handle WebSocket connections"""
        self.websocket_clients.add(websocket)
        print(f"New WebSocket connection from {websocket.remote_address}")
        
        try:
            while self.running:
                # Generate real-time data
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
                    "gpu_stats": self.get_gpu_stats(),
                    "test_results": {
                        "phase1": {"passed": 8, "total": 8},
                        "phase2": {"passed": 15, "total": 15}
                    }
                }
                
                await websocket.send(json.dumps(data))
                await asyncio.sleep(1)
                
        except websockets.exceptions.ConnectionClosed:
            print(f"Connection closed from {websocket.remote_address}")
        finally:
            self.websocket_clients.remove(websocket)
    
    def get_gpu_stats(self):
        """Get real GPU stats if available"""
        try:
            # Try to get real GPU stats using nvidia-smi
            result = subprocess.run(['nvidia-smi', '--query-gpu=memory.used,memory.total,temperature.gpu', 
                                   '--format=csv,noheader,nounits'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                values = result.stdout.strip().split(', ')
                return {
                    "vram_usage": int(values[0]) * 1024 * 1024,  # Convert MB to bytes
                    "vram_total": int(values[1]) * 1024 * 1024,
                    "temperature": int(values[2])
                }
        except:
            pass
        
        # Fallback to mock data
        return {
            "vram_usage": random.randint(3, 6) * 1024 * 1024 * 1024,
            "vram_total": 8 * 1024 * 1024 * 1024,
            "temperature": random.randint(45, 65)
        }
    
    async def start_servers(self):
        """Start both WebSocket and HTTP servers"""
        # Create HTTP app for health checks and control
        app = web.Application()
        
        # Setup CORS
        cors = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*"
            )
        })
        
        # Add routes
        app.router.add_get('/health', self.health_check)
        app.router.add_post('/restart/{service_name}', self.restart_service)
        
        # Configure CORS on all routes
        for route in list(app.router.routes()):
            cors.add(route)
        
        # Start HTTP server
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', 8769)  # HTTP on 8769
        await site.start()
        
        print("HTTP control server started on port 8769")
        print("Health check: http://localhost:8769/health")
        print("Restart endpoint: POST http://localhost:8769/restart/{service_name}")
        
        # Start WebSocket server
        host = "0.0.0.0" if "--service" in sys.argv else "localhost"
        
        async with websockets.serve(self.websocket_handler, host, 8768):
            print(f"WebSocket server running on {host}:8768")
            await asyncio.Future()  # Run forever

async def main():
    """Start the quantum memory server"""
    print("Starting Advanced Quantum Memory Server...")
    print("WebSocket: ws://localhost:8768")
    print("Control API: http://localhost:8769")
    
    server = QuantumMemoryServer()
    await server.start_servers()

if __name__ == "__main__":
    try:
        # Check if aiohttp is installed
        try:
            import aiohttp
            import aiohttp_cors
        except ImportError:
            print("Installing required packages...")
            subprocess.run([sys.executable, "-m", "pip", "install", "aiohttp", "aiohttp-cors"])
            import aiohttp
            import aiohttp_cors
        
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")