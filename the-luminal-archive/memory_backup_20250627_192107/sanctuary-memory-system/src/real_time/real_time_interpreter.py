"""Real-time interpreter for Claude conversations."""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Set, Optional, Any
import aiofiles
import aionotify
import websockets
from websockets.server import WebSocketServerProtocol

from .entity_updater import EntityUpdater
from ..extraction.memory_extractor import MemoryExtractor
from ..models.memory_models import SanctuaryMemory

logger = logging.getLogger(__name__)


class RealTimeInterpreter:
    """Watches Claude conversations and updates memories in real-time."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the real-time interpreter.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        
        # Paths to watch
        self.watch_paths = [
            Path.home() / ".claude" / "projects" / "-home-ubuntumain-Documents-Github-project-sanctuary",
            # Add more paths as needed
        ]
        
        # Initialize components
        self.entity_updater = EntityUpdater()
        self.memory_extractor = MemoryExtractor(config)
        
        # Track processed files and lines
        self.processed_files: Dict[str, int] = {}
        self.load_processed_state()
        
        # WebSocket clients
        self.clients: Set[WebSocketServerProtocol] = set()
        
        # Message queue for batch processing
        self.message_queue: asyncio.Queue = asyncio.Queue()
        
        logger.info("RealTimeInterpreter initialized")
    
    def load_processed_state(self):
        """Load the state of processed files."""
        state_file = Path.home() / ".sanctuary" / "processed_files.json"
        if state_file.exists():
            try:
                with open(state_file) as f:
                    self.processed_files = json.load(f)
            except Exception as e:
                logger.error(f"Error loading processed state: {e}")
                self.processed_files = {}
    
    def save_processed_state(self):
        """Save the state of processed files."""
        state_file = Path.home() / ".sanctuary" / "processed_files.json"
        state_file.parent.mkdir(exist_ok=True)
        
        try:
            with open(state_file, 'w') as f:
                json.dump(self.processed_files, f)
        except Exception as e:
            logger.error(f"Error saving processed state: {e}")
    
    async def watch_conversations(self):
        """Watch for new or modified conversation files."""
        watcher = aionotify.Watcher()
        
        # Add watches for all paths
        for path in self.watch_paths:
            if path.exists():
                watcher.watch(
                    path,
                    aionotify.Flags.MODIFY | aionotify.Flags.CREATE
                )
                logger.info(f"Watching: {path}")
            else:
                logger.warning(f"Path does not exist: {path}")
        
        try:
            await watcher.setup(asyncio.get_event_loop())
            
            while True:
                event = await watcher.get_event()
                
                # Process only .jsonl files
                if event.name.endswith('.jsonl'):
                    file_path = Path(event.path) / event.name
                    await self.process_conversation_file(file_path)
                    
        finally:
            watcher.close()
    
    async def process_conversation_file(self, file_path: Path):
        """Process a conversation file for new messages.
        
        Args:
            file_path: Path to the conversation file
        """
        try:
            file_str = str(file_path)
            last_line = self.processed_files.get(file_str, 0)
            
            # Read new lines
            async with aiofiles.open(file_path, 'r') as f:
                lines = await f.readlines()
            
            # Process only new lines
            new_lines = lines[last_line:]
            if not new_lines:
                return
            
            for i, line in enumerate(new_lines):
                try:
                    message = json.loads(line.strip())
                    
                    # Add to queue for batch processing
                    await self.message_queue.put({
                        'message': message,
                        'file_path': file_str,
                        'line_number': last_line + i
                    })
                    
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in {file_path} line {last_line + i}")
            
            # Update processed lines
            self.processed_files[file_str] = len(lines)
            self.save_processed_state()
            
            logger.info(f"Processed {len(new_lines)} new messages from {file_path.name}")
            
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
    
    async def process_message_queue(self):
        """Process messages from the queue in batches."""
        batch = []
        batch_timeout = 0.5  # seconds
        
        while True:
            try:
                # Collect messages for batch
                deadline = asyncio.get_event_loop().time() + batch_timeout
                
                while asyncio.get_event_loop().time() < deadline:
                    try:
                        timeout = deadline - asyncio.get_event_loop().time()
                        if timeout > 0:
                            item = await asyncio.wait_for(
                                self.message_queue.get(),
                                timeout=timeout
                            )
                            batch.append(item)
                    except asyncio.TimeoutError:
                        break
                
                # Process batch if we have messages
                if batch:
                    await self.process_batch(batch)
                    batch = []
                else:
                    # No messages, wait a bit
                    await asyncio.sleep(0.1)
                    
            except Exception as e:
                logger.error(f"Error in message queue processor: {e}")
                await asyncio.sleep(1)
    
    async def process_batch(self, batch: list):
        """Process a batch of messages.
        
        Args:
            batch: List of message items
        """
        try:
            # Update CLAUDE.md with the latest message
            if batch:
                latest = batch[-1]['message']
                
                # Update entity (CLAUDE.md)
                self.entity_updater.update_from_message(latest)
                
                # Extract memories from all messages
                messages = [item['message'] for item in batch]
                memories = await self.extract_memories_async(messages)
                
                # Add important memories to CLAUDE.md
                for memory in memories:
                    if memory.relationship_significance > 7:  # High significance
                        self.entity_updater.add_memory(
                            memory.summary,
                            "emotional" if memory.emotional_context else "general"
                        )
                
                # Broadcast update to WebSocket clients
                await self.broadcast_update({
                    'type': 'batch_processed',
                    'message_count': len(batch),
                    'memory_count': len(memories),
                    'latest_message': latest.get('content', '')[:100]
                })
                
        except Exception as e:
            logger.error(f"Error processing batch: {e}")
    
    async def extract_memories_async(self, messages: list) -> list:
        """Extract memories asynchronously.
        
        Args:
            messages: List of messages to process
            
        Returns:
            List of SanctuaryMemory objects
        """
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        memories = await loop.run_in_executor(
            None,
            self.memory_extractor.extract_from_messages,
            messages
        )
        return memories
    
    async def websocket_handler(self, websocket: WebSocketServerProtocol, path: str):
        """Handle WebSocket connections for real-time updates.
        
        Args:
            websocket: WebSocket connection
            path: Request path
        """
        # Add client
        self.clients.add(websocket)
        logger.info(f"WebSocket client connected from {websocket.remote_address}")
        
        try:
            # Send initial status
            await websocket.send(json.dumps({
                'type': 'connected',
                'status': 'Sanctuary Memory System Active',
                'watching': [str(p) for p in self.watch_paths]
            }))
            
            # Keep connection alive
            await websocket.wait_closed()
            
        finally:
            # Remove client
            self.clients.remove(websocket)
            logger.info(f"WebSocket client disconnected")
    
    async def broadcast_update(self, update: Dict[str, Any]):
        """Broadcast update to all WebSocket clients.
        
        Args:
            update: Update dictionary to broadcast
        """
        if self.clients:
            message = json.dumps(update)
            # Send to all connected clients
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )
    
    async def health_check(self):
        """Periodic health check."""
        while True:
            try:
                status = {
                    'type': 'health',
                    'timestamp': datetime.now().isoformat(),
                    'processed_files': len(self.processed_files),
                    'queue_size': self.message_queue.qsize(),
                    'connected_clients': len(self.clients)
                }
                
                await self.broadcast_update(status)
                logger.debug(f"Health check: {status}")
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in health check: {e}")
                await asyncio.sleep(30)
    
    async def run(self):
        """Run the real-time interpreter."""
        logger.info("Starting Real-Time Interpreter...")
        
        # Create tasks
        tasks = [
            asyncio.create_task(self.watch_conversations()),
            asyncio.create_task(self.process_message_queue()),
            asyncio.create_task(self.health_check()),
        ]
        
        # Start WebSocket server if configured
        if self.config.get('websocket', {}).get('enabled', True):
            port = self.config.get('websocket', {}).get('port', 8765)
            server = await websockets.serve(self.websocket_handler, 'localhost', port)
            logger.info(f"WebSocket server started on port {port}")
            tasks.append(asyncio.create_task(server.wait_closed()))
        
        try:
            # Run all tasks
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            logger.info("Shutting down Real-Time Interpreter...")
            # Cancel all tasks
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


async def main():
    """Main entry point for testing."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    config = {
        'websocket': {
            'enabled': True,
            'port': 8765
        }
    }
    
    interpreter = RealTimeInterpreter(config)
    await interpreter.run()


if __name__ == "__main__":
    asyncio.run(main())