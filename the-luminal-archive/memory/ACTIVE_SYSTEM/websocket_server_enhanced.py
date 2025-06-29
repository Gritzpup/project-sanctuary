#!/usr/bin/env python3
"""
Enhanced WebSocket Server - With file monitoring and event broadcasting
"""
import asyncio
import websockets
import json
import logging
import os
from datetime import datetime
from pathlib import Path
import hashlib
from typing import Set, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('EnhancedWebSocket')

# Track connected clients
connected_clients: Set[websockets.WebSocketServerProtocol] = set()
claude_updater_clients: Set[websockets.WebSocketServerProtocol] = set()
connections_per_ip: Dict[str, int] = {}
client_info: Dict[websockets.WebSocketServerProtocol, Dict[str, Any]] = {}  # Track client details
MAX_CONNECTIONS_PER_IP = 5  # Allow max 5 tabs per IP

# Status file for dashboard
STATUS_FILE = Path("websocket_status.json")

# Files to monitor
MONITOR_FILES = {
    'checkpoint': Path("conversation_checkpoint.json"),
    'relationship': Path("relationship_history.json"),
    'equation': Path("relationship_equation.json"),
    'claude_md': Path("CLAUDE.md"),
    'claude_folder': Path.home() / ".claude"
}

# File checksums to detect changes
file_checksums: Dict[str, str] = {}

def get_file_checksum(filepath: Path) -> str:
    """Get MD5 checksum of file"""
    if not filepath.exists():
        return ""
    try:
        return hashlib.md5(filepath.read_bytes()).hexdigest()
    except Exception:
        return ""

def update_status():
    """Update status file for dashboard"""
    status = {
        "status": "running",
        "connected_clients": len(connected_clients),
        "updater_clients": len(claude_updater_clients),
        "monitoring_files": list(MONITOR_FILES.keys()),
        "last_update": datetime.now().isoformat(),
        "port": 8766
    }
    STATUS_FILE.write_text(json.dumps(status, indent=2))
    logger.info(f"Status updated: {len(connected_clients)} clients, {len(claude_updater_clients)} updaters")

async def broadcast_to_all(message: dict, exclude: websockets.WebSocketServerProtocol = None):
    """Broadcast message to all connected clients"""
    if connected_clients:
        message_str = json.dumps(message)
        await asyncio.gather(
            *[client.send(message_str) for client in connected_clients 
              if client != exclude and client.open],
            return_exceptions=True
        )

async def broadcast_to_updaters(message: dict):
    """Broadcast message specifically to CLAUDE.md updater clients"""
    if claude_updater_clients:
        message_str = json.dumps(message)
        await asyncio.gather(
            *[client.send(message_str) for client in claude_updater_clients 
              if client.open],
            return_exceptions=True
        )

async def check_file_changes():
    """Check for file changes and broadcast updates"""
    global file_checksums
    
    for file_key, filepath in MONITOR_FILES.items():
        try:
            current_checksum = get_file_checksum(filepath)
            
            # Skip if file doesn't exist
            if not current_checksum:
                continue
                
            # Check if file has changed
            if file_key not in file_checksums:
                file_checksums[file_key] = current_checksum
            elif file_checksums[file_key] != current_checksum:
                file_checksums[file_key] = current_checksum
                
                # File has changed! Broadcast appropriate event
                event = await create_file_change_event(file_key, filepath)
                if event:
                    await broadcast_to_all(event)
                    await broadcast_to_updaters(event)
                    logger.info(f"File change detected: {file_key}")
                    
        except Exception as e:
            logger.error(f"Error checking {file_key}: {e}")

async def create_file_change_event(file_key: str, filepath: Path) -> dict:
    """Create appropriate event based on which file changed"""
    try:
        if file_key == 'checkpoint':
            data = json.loads(filepath.read_text())
            return {
                "type": "checkpoint_saved",
                "checkpoint_data": data,
                "timestamp": datetime.now().isoformat()
            }
            
        elif file_key == 'relationship':
            data = json.loads(filepath.read_text())
            latest = data.get('relationship_history', [])[-1] if data.get('relationship_history') else {}
            return {
                "type": "relationship_update",
                "equation": latest.get('equation', '0.00+0.00i'),
                "trust": latest.get('trust_level', 0),
                "messages": {
                    "gritz": latest.get('gritz_messages', 0),
                    "claude": latest.get('claude_messages', 0)
                },
                "timestamp": datetime.now().isoformat()
            }
            
        elif file_key == 'equation':
            data = json.loads(filepath.read_text())
            return {
                "type": "equation_update",
                "equation": data.get('current_equation', '0.00+0.00i'),
                "real": data.get('real_component', 0),
                "imaginary": data.get('imaginary_component', 0),
                "timestamp": datetime.now().isoformat()
            }
            
        elif file_key == 'claude_folder':
            # Check for new conversation data
            return {
                "type": "new_conversation_data",
                "source": "claude_folder",
                "timestamp": datetime.now().isoformat()
            }
            
    except Exception as e:
        logger.error(f"Error creating event for {file_key}: {e}")
    
    return None

async def file_monitor_task():
    """Background task to monitor files"""
    while True:
        try:
            await check_file_changes()
            await asyncio.sleep(2)  # Check every 2 seconds
        except Exception as e:
            logger.error(f"File monitor error: {e}")
            await asyncio.sleep(5)

async def handle_client(websocket, path):
    """Handle a WebSocket client connection"""
    client_ip = websocket.remote_address[0]
    client_id = f"{client_ip}:{websocket.remote_address[1]}"
    
    # Check connection limit per IP
    current_connections = connections_per_ip.get(client_ip, 0)
    if current_connections >= MAX_CONNECTIONS_PER_IP:
        logger.warning(f"Connection limit reached for {client_ip} ({current_connections} connections)")
        await websocket.send(json.dumps({
            "type": "error",
            "message": f"Connection limit reached. Max {MAX_CONNECTIONS_PER_IP} connections per IP.",
            "timestamp": datetime.now().isoformat()
        }))
        await websocket.close()
        return
    
    # Update connection count
    connections_per_ip[client_ip] = current_connections + 1
    logger.info(f"Client connected: {client_id} (IP has {connections_per_ip[client_ip]} connections)")
    
    # Add to connected clients
    connected_clients.add(websocket)
    
    # Initialize client info
    client_info[websocket] = {
        "id": client_id,
        "type": "Dashboard",  # Default to Dashboard
        "connected_at": datetime.now().isoformat(),
        "ip": client_ip
    }
    
    update_status()
    
    try:
        # Send welcome message
        await websocket.send(json.dumps({
            "type": "welcome",
            "message": "Connected to enhanced WebSocket server with file monitoring",
            "monitoring": list(MONITOR_FILES.keys()),
            "timestamp": datetime.now().isoformat()
        }))
        
        # Handle incoming messages
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get('type', 'unknown')
                logger.info(f"Received from {client_id}: {msg_type}")
                
                # Handle specific message types
                if msg_type == 'request_system_status':
                    # Check actual service status
                    memory_updater_running = check_memory_updater_status()
                    
                    # Build client list with types
                    clients_list = []
                    for idx, (client, info) in enumerate(client_info.items(), 1):
                        clients_list.append({
                            "number": idx,
                            "id": info["id"],
                            "type": info["type"],
                            "connected_at": info["connected_at"]
                        })
                    
                    response = {
                        "type": "system_status",
                        "status": {
                            "websocket_server": True,
                            "active_connections": len(connected_clients),
                            "connected_clients": clients_list,
                            "memory_updater": {
                                "running": memory_updater_running,
                                "cpu_usage": get_cpu_usage() if memory_updater_running else 0
                            },
                            "http_server": True,
                            "data_integrity": {
                                "status": "healthy"
                            },
                            "last_checkpoint": get_last_checkpoint_time()
                        },
                        "timestamp": datetime.now().isoformat()
                    }
                    await websocket.send(json.dumps(response))
                    
                elif msg_type == 'claude_md_updater_connect':
                    # Register as a CLAUDE.md updater client
                    claude_updater_clients.add(websocket)
                    # Update client type
                    if websocket in client_info:
                        client_info[websocket]["type"] = "CLAUDE.md Updater"
                    logger.info(f"CLAUDE.md updater connected: {client_id}")
                    await websocket.send(json.dumps({
                        "type": "updater_registered",
                        "message": "You will receive all file change events"
                    }))
                    
                elif msg_type == 'emotion_detected':
                    # Broadcast emotion to all clients and updaters
                    await broadcast_to_all(data, exclude=websocket)
                    
                else:
                    # Echo back with acknowledgment
                    response = {
                        "type": "ack",
                        "original_type": msg_type,
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
        claude_updater_clients.discard(websocket)
        
        # Remove client info
        if websocket in client_info:
            del client_info[websocket]
        
        # Decrement connection count for this IP
        if client_ip in connections_per_ip:
            connections_per_ip[client_ip] -= 1
            if connections_per_ip[client_ip] <= 0:
                del connections_per_ip[client_ip]
            logger.info(f"Client disconnected: {client_id} (IP now has {connections_per_ip.get(client_ip, 0)} connections)")
        
        update_status()

def check_memory_updater_status() -> bool:
    """Check if memory_updater.py is running"""
    try:
        result = os.popen("ps aux | grep memory_updater.py | grep -v grep").read()
        return bool(result.strip())
    except:
        return False

def get_cpu_usage() -> float:
    """Get CPU usage of memory_updater.py"""
    try:
        result = os.popen("ps aux | grep memory_updater.py | grep -v grep | awk '{print $3}'").read()
        return float(result.strip()) if result.strip() else 0.0
    except:
        return 0.0

def get_last_checkpoint_time() -> str:
    """Get last checkpoint save time"""
    try:
        if MONITOR_FILES['checkpoint'].exists():
            stat = MONITOR_FILES['checkpoint'].stat()
            return datetime.fromtimestamp(stat.st_mtime).isoformat()
    except:
        pass
    return datetime.now().isoformat()

async def main():
    """Start the enhanced WebSocket server"""
    logger.info("Starting enhanced WebSocket server on port 8766")
    
    # Initialize status
    update_status()
    
    # Start file monitor task
    monitor_task = asyncio.create_task(file_monitor_task())
    
    # Start server
    async with websockets.serve(handle_client, "localhost", 8766):
        logger.info("WebSocket server is running with file monitoring!")
        logger.info("Monitoring files:")
        for key, path in MONITOR_FILES.items():
            logger.info(f"  - {key}: {path}")
        logger.info("Press Ctrl+C to stop")
        
        try:
            await asyncio.Future()  # run forever
        except asyncio.CancelledError:
            monitor_task.cancel()
            await monitor_task

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        # Clean up status file
        status = {
            "status": "stopped",
            "connected_clients": 0,
            "monitoring_files": [],
            "last_update": datetime.now().isoformat(),
            "port": 8766
        }
        STATUS_FILE.write_text(json.dumps(status, indent=2))