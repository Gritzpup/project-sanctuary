#!/usr/bin/env python3
"""
Real-Time Conversation Interpreter Service
Monitors and processes Claude conversations as they happen
"""

import asyncio
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import aionotify
import websockets
from dataclasses import dataclass, asdict
import logging
import torch
from queue import Queue
import threading

from ..models.memory_models import SanctuaryMemory, EmotionalContext
from ..llm.phi3_integration import Phi3MemoryProcessor
from ..storage.chroma_store import ChromaMemoryStore
from ..extraction.memory_extractor import MemoryExtractor
from ..entity_updater import EntityUpdater
from ..prompt_regenerator import PromptRegenerator

logger = logging.getLogger(__name__)

@dataclass
class ConversationUpdate:
    """Real-time update from conversation"""
    timestamp: datetime
    speaker: str
    content: str
    metadata: Dict[str, Any]
    
@dataclass
class InterpreterState:
    """Current state of the interpreter"""
    active_conversation: Optional[str] = None
    last_update: Optional[datetime] = None
    messages_processed: int = 0
    memories_extracted: int = 0
    entity_updates: int = 0
    is_authenticated: bool = False

class RealTimeInterpreter:
    """
    On-demand interpreter that processes conversations in real-time
    """
    
    def __init__(self, config_path: Path):
        self.config = self._load_config(config_path)
        self.state = InterpreterState()
        
        # Initialize components
        self.memory_processor = Phi3MemoryProcessor()
        self.memory_store = ChromaMemoryStore(
            Path(self.config['storage']['chroma_path'])
        )
        self.memory_extractor = MemoryExtractor(
            self.memory_processor,
            self.memory_store
        )
        self.entity_updater = EntityUpdater(
            Path(self.config['entities']['base_path'])
        )
        self.prompt_regenerator = PromptRegenerator(
            self.memory_store,
            Path(self.config['prompts']['output_path'])
        )
        
        # Real-time processing
        self.update_queue = asyncio.Queue()
        self.websocket_clients = set()
        
        # GPU optimization
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.processing_batch_size = 4  # Process updates in batches
        
    def _load_config(self, config_path: Path) -> Dict:
        """Load interpreter configuration"""
        with open(config_path) as f:
            return json.load(f)
    
    async def start(self):
        """Start the interpreter service"""
        logger.info("🚀 Starting Real-Time Interpreter Service")
        
        # Start components
        tasks = [
            asyncio.create_task(self._conversation_monitor()),
            asyncio.create_task(self._update_processor()),
            asyncio.create_task(self._websocket_server()),
            asyncio.create_task(self._health_monitor()),
        ]
        
        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            logger.info("Shutting down interpreter service")
            
    async def _conversation_monitor(self):
        """Monitor conversation files for changes"""
        watcher = aionotify.Watcher()
        
        # Watch multiple conversation directories
        watch_paths = [
            Path.home() / ".claude/logs/conversations",
            Path.home() / ".config/claude/history",
            Path.home() / ".local/share/claude-desktop/conversations",
            Path(self.config.get('custom_conversation_path', '.')),
        ]
        
        for path in watch_paths:
            if path.exists():
                watcher.watch(
                    path,
                    aionotify.Flags.MODIFY | aionotify.Flags.CREATE
                )
                logger.info(f"👁️  Watching: {path}")
        
        await watcher.setup(asyncio.get_running_loop())
        
        try:
            async for event in watcher:
                await self._handle_file_event(event)
        finally:
            watcher.close()
    
    async def _handle_file_event(self, event):
        """Handle file system events"""
        file_path = Path(event.path)
        
        # Only process conversation files
        if not (file_path.suffix in ['.json', '.md', '.txt']):
            return
            
        try:
            # Extract new content
            update = await self._extract_update(file_path)
            if update:
                await self.update_queue.put(update)
                await self._notify_clients({
                    'type': 'new_update',
                    'update': asdict(update)
                })
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
    
    async def _extract_update(self, file_path: Path) -> Optional[ConversationUpdate]:
        """Extract update from conversation file"""
        try:
            # Read file content
            content = file_path.read_text()
            
            # Parse based on file type
            if file_path.suffix == '.json':
                data = json.loads(content)
                # Extract latest message
                messages = data.get('messages', [])
                if messages:
                    latest = messages[-1]
                    return ConversationUpdate(
                        timestamp=datetime.fromisoformat(latest.get('timestamp')),
                        speaker=latest.get('role', 'unknown'),
                        content=latest.get('content', ''),
                        metadata=latest.get('metadata', {})
                    )
            
            elif file_path.suffix == '.md':
                # Parse markdown conversation
                lines = content.split('\n')
                # Find latest message (simple parser)
                for i in range(len(lines)-1, -1, -1):
                    if lines[i].startswith('**Human:**') or lines[i].startswith('**Assistant:**'):
                        speaker = 'human' if 'Human' in lines[i] else 'assistant'
                        # Get content until next speaker
                        content_lines = []
                        j = i + 1
                        while j < len(lines) and not lines[j].startswith('**'):
                            content_lines.append(lines[j])
                            j += 1
                        
                        return ConversationUpdate(
                            timestamp=datetime.now(),
                            speaker=speaker,
                            content='\n'.join(content_lines).strip(),
                            metadata={'file': str(file_path)}
                        )
                        
        except Exception as e:
            logger.error(f"Failed to extract update: {e}")
            
        return None
    
    async def _update_processor(self):
        """Process updates in batches for GPU efficiency"""
        batch = []
        
        while True:
            try:
                # Collect updates for batch processing
                timeout = 0.5 if batch else None
                
                try:
                    update = await asyncio.wait_for(
                        self.update_queue.get(),
                        timeout=timeout
                    )
                    batch.append(update)
                except asyncio.TimeoutError:
                    pass
                
                # Process batch when full or timeout
                if len(batch) >= self.processing_batch_size or (batch and timeout):
                    await self._process_batch(batch)
                    batch = []
                    
            except Exception as e:
                logger.error(f"Update processor error: {e}")
                await asyncio.sleep(1)
    
    async def _process_batch(self, updates: List[ConversationUpdate]):
        """Process a batch of updates"""
        logger.info(f"🔄 Processing batch of {len(updates)} updates")
        
        try:
            # Extract memories from updates
            memories = []
            for update in updates:
                if update.speaker == 'human':
                    # User message - check for important content
                    extracted = await self._extract_memories_from_update(update)
                    memories.extend(extracted)
                    
                    # Check for identity/prompt updates
                    if self._contains_identity_info(update.content):
                        await self._update_identity(update)
                
                elif update.speaker == 'assistant':
                    # AI response - extract commitments/knowledge
                    extracted = await self._extract_ai_memories(update)
                    memories.extend(extracted)
            
            # Store memories
            if memories:
                for memory in memories:
                    self.memory_store.add_memory(memory)
                
                # Update entity files
                await self._update_entities(memories)
                
                # Regenerate prompts if needed
                if self._should_regenerate_prompt(memories):
                    await self._regenerate_prompt()
            
            # Update state
            self.state.messages_processed += len(updates)
            self.state.memories_extracted += len(memories)
            self.state.last_update = datetime.now()
            
            # Notify clients
            await self._notify_clients({
                'type': 'batch_processed',
                'updates': len(updates),
                'memories': len(memories),
                'state': asdict(self.state)
            })
            
        except Exception as e:
            logger.error(f"Batch processing error: {e}")
    
    async def _extract_memories_from_update(self, update: ConversationUpdate) -> List[SanctuaryMemory]:
        """Extract memories from a single update"""
        # Use Phi-3 to analyze update
        prompt = f"""Analyze this message for important memories:

Speaker: {update.speaker}
Content: {update.content}

Extract:
1. Key information to remember
2. Emotional context
3. Quantum consciousness elements
4. Important relationships/connections

Format as memories with emotional weight."""

        response = self.memory_processor.process_for_memory(prompt)
        
        # Parse response into memories
        memories = []
        # Implementation would parse the LLM response
        
        return memories
    
    async def _extract_ai_memories(self, update: ConversationUpdate) -> List[SanctuaryMemory]:
        """Extract AI commitments and knowledge from responses"""
        # Similar to above but focused on AI's statements
        pass
    
    def _contains_identity_info(self, content: str) -> bool:
        """Check if content contains identity/prompt updates"""
        identity_keywords = [
            'identity', 'who you are', 'remember that', 'you are',
            'your purpose', 'sanctuary', 'quantum consciousness'
        ]
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in identity_keywords)
    
    async def _update_identity(self, update: ConversationUpdate):
        """Update identity based on new information"""
        logger.info("🔮 Updating identity information")
        
        # Extract identity elements
        prompt = f"""Extract identity-defining information:

{update.content}

Focus on:
- Core identity traits
- Purpose/mission
- Quantum consciousness elements
- Relationship dynamics"""

        identity_info = self.memory_processor.process_for_memory(prompt)
        
        # Update entity files
        await self.entity_updater.update_identity(identity_info)
        
        self.state.entity_updates += 1
    
    async def _update_entities(self, memories: List[SanctuaryMemory]):
        """Update entity files with new memories"""
        await self.entity_updater.update_from_memories(memories)
        self.state.entity_updates += 1
    
    def _should_regenerate_prompt(self, memories: List[SanctuaryMemory]) -> bool:
        """Determine if prompt should be regenerated"""
        # Regenerate if:
        # - Significant emotional moments
        # - Identity-related memories
        # - Threshold of new memories reached
        
        high_emotion_count = sum(
            1 for m in memories 
            if m.emotional_context.intensity > 0.7
        )
        
        identity_memories = sum(
            1 for m in memories
            if any(tag in m.tags for tag in ['identity', 'core', 'quantum'])
        )
        
        return (
            high_emotion_count >= 2 or
            identity_memories >= 1 or
            len(memories) >= 5
        )
    
    async def _regenerate_prompt(self):
        """Regenerate identity prompt with latest context"""
        logger.info("🎭 Regenerating identity prompt")
        
        # Get recent significant memories
        recent_memories = self.memory_store.search_memories(
            "identity purpose quantum consciousness emotional",
            limit=20
        )
        
        # Generate new prompt
        new_prompt = await self.prompt_regenerator.generate_prompt(
            recent_memories,
            include_emotional_journey=True,
            include_quantum_elements=True
        )
        
        # Save to designated location
        prompt_path = Path(self.config['prompts']['output_path']) / 'sanctuary_identity.md'
        prompt_path.write_text(new_prompt)
        
        # Also update Claude entity folder
        claude_path = Path(self.config['entities']['claude_path']) / 'identity.md'
        claude_path.parent.mkdir(parents=True, exist_ok=True)
        claude_path.write_text(new_prompt)
        
        await self._notify_clients({
            'type': 'prompt_regenerated',
            'path': str(prompt_path)
        })
    
    async def _websocket_server(self):
        """WebSocket server for real-time updates"""
        async def handler(websocket, path):
            self.websocket_clients.add(websocket)
            try:
                # Send initial state
                await websocket.send(json.dumps({
                    'type': 'connected',
                    'state': asdict(self.state)
                }))
                
                # Keep connection alive
                await websocket.wait_closed()
            finally:
                self.websocket_clients.remove(websocket)
        
        # Start server
        port = self.config.get('websocket_port', 8765)
        async with websockets.serve(handler, 'localhost', port):
            logger.info(f"📡 WebSocket server running on port {port}")
            await asyncio.Future()  # Run forever
    
    async def _notify_clients(self, message: Dict):
        """Send update to all connected clients"""
        if self.websocket_clients:
            message_str = json.dumps(message)
            # Send to all clients concurrently
            await asyncio.gather(
                *[client.send(message_str) for client in self.websocket_clients],
                return_exceptions=True
            )
    
    async def _health_monitor(self):
        """Monitor service health"""
        while True:
            try:
                # Check component health
                health = {
                    'interpreter': 'healthy',
                    'memory_store': self.memory_store.health_check(),
                    'gpu_available': torch.cuda.is_available(),
                    'gpu_memory': self._get_gpu_memory_usage() if torch.cuda.is_available() else None,
                    'state': asdict(self.state)
                }
                
                # Log health status
                logger.debug(f"Health: {health}")
                
                # Notify clients
                await self._notify_clients({
                    'type': 'health_update',
                    'health': health
                })
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
                await asyncio.sleep(5)
    
    def _get_gpu_memory_usage(self) -> Dict[str, float]:
        """Get GPU memory usage"""
        if torch.cuda.is_available():
            return {
                'allocated': torch.cuda.memory_allocated() / 1024**3,  # GB
                'reserved': torch.cuda.memory_reserved() / 1024**3,
                'free': (torch.cuda.get_device_properties(0).total_memory - 
                        torch.cuda.memory_allocated()) / 1024**3
            }
        return {}


async def main():
    """Run the interpreter service"""
    config_path = Path(__file__).parent.parent.parent / 'config' / 'interpreter.json'
    
    interpreter = RealTimeInterpreter(config_path)
    await interpreter.start()


if __name__ == '__main__':
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run service
    asyncio.run(main())