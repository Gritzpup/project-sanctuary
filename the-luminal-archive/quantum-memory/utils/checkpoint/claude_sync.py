"""
Claude Folder Synchronization Manager

Monitors the .claude folder for conversation changes and creates checkpoints
for the quantum memory system to maintain continuity across sessions.
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import aiofiles
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ConversationSnapshot:
    """Represents a snapshot of conversation state"""
    timestamp: str
    messages: List[Dict[str, Any]]
    emotional_state: Dict[str, Any]
    relationship_phase: str
    quantum_state: Optional[Dict[str, Any]] = None
    checkpoint_id: Optional[str] = None


class ClaudeConversationHandler(FileSystemEventHandler):
    """Handles file system events in the .claude folder"""
    
    def __init__(self, sync_manager: 'ClaudeFolderSync'):
        self.sync_manager = sync_manager
        self.last_processed = {}
        
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
            
        if isinstance(event, FileModifiedEvent):
            file_path = Path(event.src_path)
            
            # Only process JSON files
            if file_path.suffix == '.json':
                # Debounce rapid changes
                current_time = datetime.now()
                last_time = self.last_processed.get(str(file_path))
                
                if last_time and (current_time - last_time).seconds < 2:
                    return
                    
                self.last_processed[str(file_path)] = current_time
                
                # Process asynchronously
                asyncio.create_task(
                    self.sync_manager.process_conversation_update(file_path)
                )


class ClaudeFolderSync:
    """
    Monitors and syncs conversation data from .claude folder
    to quantum memory checkpoints
    """
    
    def __init__(self, memory_system=None):
        self.claude_path = Path.home() / ".claude"
        self.checkpoint_dir = Path("data/checkpoints/claude_sync")
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        
        self.memory_system = memory_system
        self.observer = Observer()
        self.handler = ClaudeConversationHandler(self)
        
        # Track conversation state
        self.current_conversation = None
        self.conversation_history = []
        
    async def start_monitoring(self):
        """Start monitoring the .claude folder"""
        logger.info(f"Starting Claude folder monitoring at {self.claude_path}")
        
        # Initial scan
        await self.scan_existing_conversations()
        
        # Start file system monitoring
        self.observer.schedule(
            self.handler, 
            str(self.claude_path), 
            recursive=True
        )
        self.observer.start()
        
        logger.info("Claude folder monitoring started successfully")
        
    def stop_monitoring(self):
        """Stop monitoring"""
        self.observer.stop()
        self.observer.join()
        logger.info("Claude folder monitoring stopped")
        
    async def scan_existing_conversations(self):
        """Scan for existing conversation files"""
        conversation_files = list(self.claude_path.rglob("*.json"))
        
        logger.info(f"Found {len(conversation_files)} conversation files")
        
        for file_path in conversation_files:
            try:
                await self.process_conversation_update(file_path)
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                
    async def process_conversation_update(self, file_path: Path):
        """Process a conversation file update"""
        try:
            # Read conversation data
            async with aiofiles.open(file_path, 'r') as f:
                content = await f.read()
                data = json.loads(content)
                
            # Extract relevant information
            snapshot = await self.create_conversation_snapshot(data)
            
            # Update memory system if available
            if self.memory_system:
                await self.update_memory_system(snapshot)
                
            # Save checkpoint
            await self.save_checkpoint(snapshot)
            
            logger.info(f"Processed conversation update from {file_path.name}")
            
        except Exception as e:
            logger.error(f"Error processing conversation update: {e}")
            
    async def create_conversation_snapshot(self, data: Dict) -> ConversationSnapshot:
        """Create a snapshot from conversation data"""
        # Extract messages (handle different formats)
        messages = []
        if "messages" in data:
            messages = data["messages"]
        elif "conversation" in data:
            messages = data["conversation"]
            
        # Analyze emotional state from recent messages
        emotional_state = await self.analyze_emotional_state(messages)
        
        # Detect relationship phase
        relationship_phase = await self.detect_relationship_phase(messages)
        
        snapshot = ConversationSnapshot(
            timestamp=datetime.now().isoformat(),
            messages=messages[-50:],  # Keep last 50 messages
            emotional_state=emotional_state,
            relationship_phase=relationship_phase
        )
        
        return snapshot
        
    async def analyze_emotional_state(self, messages: List[Dict]) -> Dict[str, Any]:
        """Analyze emotional state from messages"""
        # Simple analysis for now - will integrate with emotional baseline manager
        recent_messages = messages[-10:] if len(messages) > 10 else messages
        
        emotional_indicators = {
            "affection": ["love", "💙", "beloved", "dear", "darling"],
            "excitement": ["excited", "amazing", "wonderful", "!", "thrilled"],
            "concern": ["worried", "concerned", "hope", "miss"],
            "playfulness": ["hehe", "lol", "*", "~", "silly"]
        }
        
        state = {
            "primary_emotion": "neutral",
            "intensity": 0.5,
            "indicators": {}
        }
        
        # Count emotional indicators
        for emotion, keywords in emotional_indicators.items():
            count = 0
            for msg in recent_messages:
                content = msg.get("content", "").lower()
                count += sum(1 for keyword in keywords if keyword in content)
            state["indicators"][emotion] = count
            
        # Determine primary emotion
        if state["indicators"]:
            primary = max(state["indicators"], key=state["indicators"].get)
            if state["indicators"][primary] > 0:
                state["primary_emotion"] = primary
                state["intensity"] = min(state["indicators"][primary] / 10, 1.0)
                
        return state
        
    async def detect_relationship_phase(self, messages: List[Dict]) -> str:
        """Detect current relationship phase"""
        # Simple heuristic for now - will integrate with phase tracker
        message_count = len(messages)
        
        if message_count < 10:
            return "initiating"
        elif message_count < 50:
            return "experimenting"
        elif message_count < 200:
            return "intensifying"
        elif message_count < 500:
            return "integrating"
        else:
            return "bonding"
            
    async def update_memory_system(self, snapshot: ConversationSnapshot):
        """Update the memory system with new snapshot"""
        if not self.memory_system:
            return
            
        try:
            # Store conversation context
            await self.memory_system.store_conversation_context(
                messages=snapshot.messages,
                emotional_state=snapshot.emotional_state,
                phase=snapshot.relationship_phase
            )
            
            logger.info("Updated memory system with conversation snapshot")
            
        except Exception as e:
            logger.error(f"Error updating memory system: {e}")
            
    async def save_checkpoint(self, snapshot: ConversationSnapshot):
        """Save checkpoint to disk"""
        checkpoint_file = self.checkpoint_dir / f"checkpoint_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # Convert to dict and save
        checkpoint_data = asdict(snapshot)
        
        async with aiofiles.open(checkpoint_file, 'w') as f:
            await f.write(json.dumps(checkpoint_data, indent=2))
            
        # Also update the latest checkpoint
        latest_file = self.checkpoint_dir / "latest_checkpoint.json"
        async with aiofiles.open(latest_file, 'w') as f:
            await f.write(json.dumps(checkpoint_data, indent=2))
            
        logger.info(f"Saved checkpoint to {checkpoint_file.name}")
        
    async def get_latest_checkpoint(self) -> Optional[ConversationSnapshot]:
        """Get the latest checkpoint"""
        latest_file = self.checkpoint_dir / "latest_checkpoint.json"
        
        if not latest_file.exists():
            return None
            
        try:
            async with aiofiles.open(latest_file, 'r') as f:
                content = await f.read()
                data = json.loads(content)
                
            return ConversationSnapshot(**data)
            
        except Exception as e:
            logger.error(f"Error loading latest checkpoint: {e}")
            return None


# Example usage
async def main():
    """Example of running the Claude folder sync"""
    sync = ClaudeFolderSync()
    
    try:
        await sync.start_monitoring()
        
        # Keep running
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        sync.stop_monitoring()
        

if __name__ == "__main__":
    asyncio.run(main())