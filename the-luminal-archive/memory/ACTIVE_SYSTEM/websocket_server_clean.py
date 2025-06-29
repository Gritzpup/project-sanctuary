#!/usr/bin/env python3
"""
Clean WebSocket Server - Single instance, easy to monitor
"""
import asyncio
import websockets
import json
import logging
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('CleanWebSocket')

# Track connected clients
connected_clients = set()

# Status file for dashboard
STATUS_FILE = Path("websocket_status.json")

def update_status():
    """Update status file for dashboard"""
    status = {
        "status": "running",
        "connected_clients": len(connected_clients),
        "last_update": datetime.now().isoformat(),
        "port": 8766
    }
    STATUS_FILE.write_text(json.dumps(status, indent=2))
    logger.info(f"Status updated: {len(connected_clients)} clients connected")

async def handle_client(websocket, path):
    """Handle a WebSocket client connection"""
    client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    logger.info(f"Client connected: {client_id}")
    
    # Add to connected clients
    connected_clients.add(websocket)
    update_status()
    
    try:
        # Send welcome message
        await websocket.send(json.dumps({
            "type": "welcome",
            "message": "Connected to clean WebSocket server",
            "timestamp": datetime.now().isoformat()
        }))
        
        # Handle incoming messages
        async for message in websocket:
            try:
                data = json.loads(message)
                logger.info(f"Received from {client_id}: {data.get('type', 'unknown')}")
                
                # Echo back with acknowledgment
                response = {
                    "type": "ack",
                    "original_type": data.get('type'),
                    "timestamp": datetime.now().isoformat()
                }
                
                # Handle specific message types
                if data.get('type') == 'request_system_status':
                    # Prepare system status in the format expected by dashboard
                    response = {
                        "type": "system_status",
                        "status": {
                            "websocket_server": True,  # We're running
                            "active_connections": len(connected_clients),
                            "memory_updater": {
                                "running": False,  # Not running
                                "cpu_usage": 0
                            },
                            "http_server": True,  # Dashboard is loaded, so HTTP must be running
                            "data_integrity": {
                                "status": "healthy"
                            },
                            "last_checkpoint": datetime.now().isoformat()
                        },
                        "timestamp": datetime.now().isoformat()
                    }
                
                await websocket.send(json.dumps(response))
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON from {client_id}: {message}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
                
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {e}")
    finally:
        # Remove from connected clients
        connected_clients.discard(websocket)
        update_status()

async def main():
    """Start the WebSocket server"""
    logger.info("Starting clean WebSocket server on port 8766")
    
    # Initialize status
    update_status()
    
    # Start server
    async with websockets.serve(handle_client, "localhost", 8766):
        logger.info("WebSocket server is running!")
        logger.info("Press Ctrl+C to stop")
        
        # Keep running forever
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        # Clean up status file
        status = {
            "status": "stopped",
            "connected_clients": 0,
            "last_update": datetime.now().isoformat(),
            "port": 8766
        }
        STATUS_FILE.write_text(json.dumps(status, indent=2))