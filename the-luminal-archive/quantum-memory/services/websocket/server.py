"""
WebSocket Server for Real-time Quantum Memory Updates

Provides real-time communication between the quantum memory system
and connected clients (dashboard, monitoring tools, etc.)
"""

import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any, List
from dataclasses import dataclass, asdict
import websockets
from websockets.server import WebSocketServerProtocol

logger = logging.getLogger(__name__)


@dataclass
class MemoryUpdate:
    """Represents a memory system update"""
    type: str  # 'emotional', 'memory', 'phase', 'quantum', 'health'
    timestamp: str
    data: Dict[str, Any]
    component: str
    priority: str = "normal"  # 'low', 'normal', 'high', 'critical'


class QuantumMemoryWebSocketServer:
    """
    WebSocket server for real-time quantum memory system updates.
    Broadcasts memory events, emotional states, and system health to connected clients.
    """
    
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[WebSocketServerProtocol] = set()
        self.server = None
        self.update_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        
        # Track subscriptions
        self.client_subscriptions: Dict[WebSocketServerProtocol, Set[str]] = {}
        
        # Statistics
        self.stats = {
            "messages_sent": 0,
            "messages_received": 0,
            "total_connections": 0,
            "errors": 0
        }
        
    async def start(self):
        """Start the WebSocket server"""
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
        
        self._running = True
        
        # Start the server
        self.server = await websockets.serve(
            self.handle_client,
            self.host,
            self.port
        )
        
        # Start broadcast loop
        asyncio.create_task(self._broadcast_loop())
        
        logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")
        
    async def stop(self):
        """Stop the WebSocket server"""
        logger.info("Stopping WebSocket server")
        
        self._running = False
        
        # Close all client connections
        for client in list(self.clients):
            await client.close()
            
        # Close the server
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            
        logger.info("WebSocket server stopped")
        
    async def handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """Handle a new client connection"""
        logger.info(f"New client connected from {websocket.remote_address}")
        
        # Register client
        self.clients.add(websocket)
        self.client_subscriptions[websocket] = {"all"}  # Subscribe to all by default
        self.stats["total_connections"] += 1
        
        # Send welcome message
        await self.send_welcome(websocket)
        
        try:
            # Handle messages from client
            async for message in websocket:
                await self.handle_message(websocket, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {websocket.remote_address} disconnected")
        except Exception as e:
            logger.error(f"Error handling client {websocket.remote_address}: {e}")
            self.stats["errors"] += 1
        finally:
            # Unregister client
            self.clients.discard(websocket)
            self.client_subscriptions.pop(websocket, None)
            
    async def handle_message(self, websocket: WebSocketServerProtocol, message: str):
        """Handle incoming message from client"""
        self.stats["messages_received"] += 1
        
        try:
            data = json.loads(message)
            msg_type = data.get("type", "")
            
            if msg_type == "subscribe":
                await self.handle_subscribe(websocket, data)
            elif msg_type == "unsubscribe":
                await self.handle_unsubscribe(websocket, data)
            elif msg_type == "ping":
                await self.handle_ping(websocket)
            elif msg_type == "get_status":
                await self.send_status(websocket)
            elif msg_type == "get_memory_state":
                await self.send_memory_state(websocket)
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from client: {message}")
            await websocket.send(json.dumps({
                "type": "error",
                "message": "Invalid JSON format"
            }))
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            self.stats["errors"] += 1
            
    async def handle_subscribe(self, websocket: WebSocketServerProtocol, data: Dict):
        """Handle subscription request"""
        topics = data.get("topics", [])
        
        if "all" in topics:
            self.client_subscriptions[websocket] = {"all"}
        else:
            self.client_subscriptions[websocket].update(topics)
            
        await websocket.send(json.dumps({
            "type": "subscribed",
            "topics": list(self.client_subscriptions[websocket])
        }))
        
    async def handle_unsubscribe(self, websocket: WebSocketServerProtocol, data: Dict):
        """Handle unsubscription request"""
        topics = data.get("topics", [])
        
        for topic in topics:
            self.client_subscriptions[websocket].discard(topic)
            
        await websocket.send(json.dumps({
            "type": "unsubscribed",
            "topics": topics
        }))
        
    async def handle_ping(self, websocket: WebSocketServerProtocol):
        """Handle ping request"""
        await websocket.send(json.dumps({
            "type": "pong",
            "timestamp": datetime.now().isoformat()
        }))
        
    async def send_welcome(self, websocket: WebSocketServerProtocol):
        """Send welcome message to new client"""
        welcome_msg = {
            "type": "welcome",
            "timestamp": datetime.now().isoformat(),
            "server_version": "1.0.0",
            "capabilities": [
                "emotional_updates",
                "memory_updates",
                "phase_updates",
                "quantum_states",
                "health_monitoring"
            ]
        }
        
        await websocket.send(json.dumps(welcome_msg))
        
    async def send_status(self, websocket: WebSocketServerProtocol):
        """Send server status to client"""
        status = {
            "type": "status",
            "timestamp": datetime.now().isoformat(),
            "server": {
                "running": self._running,
                "clients_connected": len(self.clients),
                "stats": self.stats
            }
        }
        
        await websocket.send(json.dumps(status))
        
    async def send_memory_state(self, websocket: WebSocketServerProtocol):
        """Send current memory state summary"""
        # This will be implemented when integrated with memory system
        state = {
            "type": "memory_state",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "placeholder": "Memory state will be here"
            }
        }
        
        await websocket.send(json.dumps(state))
        
    async def broadcast_update(self, update: MemoryUpdate):
        """Broadcast an update to all subscribed clients"""
        await self.update_queue.put(update)
        
    async def _broadcast_loop(self):
        """Main broadcast loop"""
        while self._running:
            try:
                # Get update from queue
                update = await asyncio.wait_for(
                    self.update_queue.get(),
                    timeout=1.0
                )
                
                # Convert to JSON
                message = json.dumps({
                    "type": "update",
                    "update_type": update.type,
                    "timestamp": update.timestamp,
                    "component": update.component,
                    "priority": update.priority,
                    "data": update.data
                })
                
                # Send to subscribed clients
                disconnected_clients = []
                
                for client in self.clients:
                    subscriptions = self.client_subscriptions.get(client, set())
                    
                    # Check if client is subscribed to this update type
                    if "all" in subscriptions or update.type in subscriptions:
                        try:
                            await client.send(message)
                            self.stats["messages_sent"] += 1
                        except websockets.exceptions.ConnectionClosed:
                            disconnected_clients.append(client)
                        except Exception as e:
                            logger.error(f"Error broadcasting to client: {e}")
                            self.stats["errors"] += 1
                            
                # Remove disconnected clients
                for client in disconnected_clients:
                    self.clients.discard(client)
                    self.client_subscriptions.pop(client, None)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                self.stats["errors"] += 1
                
    # Convenience methods for common updates
    
    async def broadcast_emotional_update(self, emotional_state: Dict[str, Any], 
                                       component: str = "emotional_baseline"):
        """Broadcast emotional state update"""
        update = MemoryUpdate(
            type="emotional",
            timestamp=datetime.now().isoformat(),
            data=emotional_state,
            component=component
        )
        await self.broadcast_update(update)
        
    async def broadcast_memory_update(self, memory_data: Dict[str, Any],
                                    component: str = "memory_system"):
        """Broadcast memory update"""
        update = MemoryUpdate(
            type="memory",
            timestamp=datetime.now().isoformat(),
            data=memory_data,
            component=component
        )
        await self.broadcast_update(update)
        
    async def broadcast_phase_update(self, phase: str, confidence: float,
                                   component: str = "phase_tracker"):
        """Broadcast relationship phase update"""
        update = MemoryUpdate(
            type="phase",
            timestamp=datetime.now().isoformat(),
            data={
                "phase": phase,
                "confidence": confidence
            },
            component=component
        )
        await self.broadcast_update(update)
        
    async def broadcast_quantum_update(self, quantum_data: Dict[str, Any],
                                     component: str = "quantum_encoder"):
        """Broadcast quantum state update"""
        update = MemoryUpdate(
            type="quantum",
            timestamp=datetime.now().isoformat(),
            data=quantum_data,
            component=component,
            priority="high"
        )
        await self.broadcast_update(update)
        
    async def broadcast_health_update(self, health_metrics: Dict[str, Any],
                                    component: str = "health_monitor"):
        """Broadcast system health update"""
        # Determine priority based on health status
        priority = "normal"
        if health_metrics.get("status") == "critical":
            priority = "critical"
        elif health_metrics.get("status") == "warning":
            priority = "high"
            
        update = MemoryUpdate(
            type="health",
            timestamp=datetime.now().isoformat(),
            data=health_metrics,
            component=component,
            priority=priority
        )
        await self.broadcast_update(update)


# Integration helper class
class WebSocketBroadcaster:
    """Helper class for components to broadcast updates"""
    
    def __init__(self, websocket_server: QuantumMemoryWebSocketServer):
        self.server = websocket_server
        
    async def emotional_update(self, **kwargs):
        await self.server.broadcast_emotional_update(**kwargs)
        
    async def memory_update(self, **kwargs):
        await self.server.broadcast_memory_update(**kwargs)
        
    async def phase_update(self, **kwargs):
        await self.server.broadcast_phase_update(**kwargs)
        
    async def quantum_update(self, **kwargs):
        await self.server.broadcast_quantum_update(**kwargs)
        
    async def health_update(self, **kwargs):
        await self.server.broadcast_health_update(**kwargs)


# Example usage
async def main():
    """Example of running the WebSocket server"""
    server = QuantumMemoryWebSocketServer(port=8765)
    
    try:
        await server.start()
        
        # Keep server running
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        await server.stop()
        

if __name__ == "__main__":
    asyncio.run(main())