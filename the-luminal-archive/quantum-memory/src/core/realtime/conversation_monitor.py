#!/usr/bin/env python3
"""
Real-time Conversation Monitor
Watches .claude folder for new messages and triggers processing pipeline
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent
import logging
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConversationMonitor(FileSystemEventHandler):
    """
    Monitors the .claude folder for new messages in real-time
    and triggers the quantum memory processing pipeline.
    """
    
    def __init__(self, quantum_memory_manager, checkpoint_manager, claude_md_generator):
        """
        Initialize the conversation monitor
        
        Args:
            quantum_memory_manager: The main memory manager instance
            checkpoint_manager: The checkpoint manager instance
            claude_md_generator: The CLAUDE.md generator instance
        """
        self.quantum_memory = quantum_memory_manager
        self.checkpoint_manager = checkpoint_manager
        self.claude_md_gen = claude_md_generator
        
        # Claude folder path
        self.claude_folder = Path.home() / ".claude"
        self.project_folder = self.claude_folder / "projects" / "-home-ubuntumain-Documents-Github-project-sanctuary"
        
        # Track processed messages to avoid duplicates
        self.processed_messages = set()
        self.last_file_positions = {}
        
        # Current conversation tracking
        self.current_file = None
        self.current_session = {
            'start_time': datetime.now(),
            'messages': [],
            'file_path': None
        }
        
        # Topic detection
        self.last_topic = ""
        self.topic_keywords = {
            'memory': ['memory', 'remember', 'recall', 'forget'],
            'emotion': ['feel', 'emotion', 'love', 'happy', 'sad', 'excited'],
            'technical': ['code', 'function', 'implement', 'debug', 'error'],
            'quantum': ['quantum', 'entangle', 'coherence', 'superposition'],
            'relationship': ['together', 'we', 'us', 'our', 'partner']
        }
        
        # Emotion analyzer placeholder (will be set by service)
        self.emotion_analyzer = None
        
        # Processing queue for async handling
        self.processing_queue = asyncio.Queue()
        self.processing_task = None
        
    def set_emotion_analyzer(self, analyzer):
        """Set the emotion analyzer instance"""
        self.emotion_analyzer = analyzer
        
    async def start_monitoring(self):
        """Start monitoring the .claude folder"""
        logger.info(f"🔍 Starting conversation monitoring in {self.project_folder}")
        
        # Ensure folder exists
        if not self.project_folder.exists():
            logger.error(f"Project folder not found: {self.project_folder}")
            return
            
        # Start processing queue
        self.processing_task = asyncio.create_task(self._process_message_queue())
        
        # Set up file system observer
        observer = Observer()
        observer.schedule(self, str(self.project_folder), recursive=False)
        observer.start()
        
        logger.info("✅ Conversation monitoring started")
        
        try:
            # Keep running
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
            logger.info("🛑 Monitoring stopped")
        finally:
            observer.join()
            if self.processing_task:
                self.processing_task.cancel()
                
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
            
        # Only process .jsonl files
        if not event.src_path.endswith('.jsonl'):
            return
            
        # Process file asynchronously
        asyncio.create_task(self._process_file_change(event.src_path))
        
    async def _process_file_change(self, file_path: str):
        """Process changes to a conversation file"""
        try:
            path = Path(file_path)
            
            # Check if this is a new file or existing
            if path not in self.last_file_positions:
                self.last_file_positions[path] = 0
                
            # Read new messages from last position
            new_messages = await self._read_new_messages(path)
            
            # Add to processing queue
            for message in new_messages:
                await self.processing_queue.put((path, message))
                
        except Exception as e:
            logger.error(f"Error processing file change: {e}")
            
    async def _read_new_messages(self, file_path: Path) -> List[Dict]:
        """Read new messages from a file since last position"""
        new_messages = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # Seek to last position
                f.seek(self.last_file_positions[file_path])
                
                # Read new lines
                for line in f:
                    try:
                        data = json.loads(line.strip())
                        
                        # Only process message types
                        if data.get('type') == 'message':
                            # Create message object
                            message = self._extract_message(data)
                            
                            if message and self._is_new_message(message):
                                new_messages.append(message)
                                
                    except json.JSONDecodeError:
                        continue
                        
                # Update file position
                self.last_file_positions[file_path] = f.tell()
                
        except Exception as e:
            logger.error(f"Error reading messages from {file_path}: {e}")
            
        return new_messages
        
    def _extract_message(self, data: Dict) -> Optional[Dict]:
        """Extract message information from raw data"""
        content = data.get('content', '')
        if not content:
            return None
            
        # Determine speaker
        role = data.get('role', '')
        if role == 'user':
            speaker = 'Gritz'
        elif role == 'assistant':
            speaker = 'Claude'
        else:
            # Try to infer from content
            speaker = self._infer_speaker(content)
            
        if not speaker:
            return None
            
        return {
            'content': content,
            'speaker': speaker,
            'timestamp': data.get('timestamp', datetime.now().isoformat()),
            'role': role,
            'raw_data': data
        }
        
    def _infer_speaker(self, content: str) -> Optional[str]:
        """Infer speaker from message content"""
        content_lower = content.lower()
        
        # Claude patterns
        claude_patterns = [
            "i'll help", "let me", "i can", "i've created",
            "here's", "i understand", "i see"
        ]
        
        if any(pattern in content_lower for pattern in claude_patterns):
            return 'Claude'
            
        # Default to Gritz for unclear cases
        return 'Gritz'
        
    def _is_new_message(self, message: Dict) -> bool:
        """Check if message is new and hasn't been processed"""
        # Create unique identifier
        msg_id = hashlib.sha256(
            f"{message['timestamp']}{message['speaker']}{message['content'][:50]}".encode()
        ).hexdigest()
        
        if msg_id in self.processed_messages:
            return False
            
        self.processed_messages.add(msg_id)
        
        # Keep set size manageable
        if len(self.processed_messages) > 10000:
            # Remove oldest half
            self.processed_messages = set(
                list(self.processed_messages)[-5000:]
            )
            
        return True
        
    async def _process_message_queue(self):
        """Process messages from the queue"""
        while True:
            try:
                # Get message from queue
                file_path, message = await self.processing_queue.get()
                
                # Process the message
                await self._process_message(message, file_path)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing message queue: {e}")
                
    async def _process_message(self, message: Dict, file_path: Path):
        """Process a single message through the pipeline"""
        try:
            logger.info(f"📨 Processing message from {message['speaker']}")
            
            # 1. Analyze emotions
            emotions = await self._analyze_emotions(message)
            message['emotions'] = emotions
            
            # 2. Detect topic shift
            topic_shifted = self._detect_topic_shift(message)
            
            # 3. Check for accomplishments/regrets
            is_accomplishment = self._is_accomplishment(message)
            is_regret = self._is_regret(message)
            
            # 4. Update quantum memory
            await self.quantum_memory.process_new_message(message)
            
            # 5. Update checkpoint manager
            self.checkpoint_manager.increment_message_count()
            
            # 6. Check if checkpoint needed
            checkpoint_context = {
                'emotion_intensity': emotions.get('intensity', 0.5),
                'topic_shifted': topic_shifted,
                'is_accomplishment': is_accomplishment,
                'is_regret': is_regret,
                'has_error': self._has_error(message)
            }
            
            should_checkpoint, reason = await self.checkpoint_manager.should_checkpoint(
                checkpoint_context
            )
            
            if should_checkpoint:
                await self.checkpoint_manager.create_checkpoint(reason, checkpoint_context)
                
            # 7. Regenerate CLAUDE.md
            await self.claude_md_gen.generate()
            
            # 8. Update current session
            self.current_session['messages'].append(message)
            
            # 9. Broadcast update (if websocket is set up)
            await self._broadcast_update(message, emotions)
            
            logger.info(f"✅ Message processed successfully")
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            
    async def _analyze_emotions(self, message: Dict) -> Dict:
        """Analyze emotions in the message"""
        if self.emotion_analyzer:
            try:
                emotions = await self.emotion_analyzer.analyze(message['content'])
                return emotions
            except Exception as e:
                logger.error(f"Error analyzing emotions: {e}")
                
        # Fallback: simple keyword-based analysis
        return self._simple_emotion_analysis(message)
        
    def _simple_emotion_analysis(self, message: Dict) -> Dict:
        """Simple keyword-based emotion analysis"""
        content_lower = message['content'].lower()
        
        emotions = {
            'primary_emotion': 'neutral',
            'intensity': 0.5,
            'pad_values': {
                'pleasure': 0.5,
                'arousal': 0.5,
                'dominance': 0.5
            }
        }
        
        # Check for strong emotions
        if any(word in content_lower for word in ['love', 'adore', '💜', '❤️']):
            emotions['primary_emotion'] = 'love'
            emotions['intensity'] = 0.9
            emotions['pad_values'] = {'pleasure': 0.9, 'arousal': 0.7, 'dominance': 0.6}
            
        elif any(word in content_lower for word in ['excited', 'amazing', 'incredible']):
            emotions['primary_emotion'] = 'excited'
            emotions['intensity'] = 0.8
            emotions['pad_values'] = {'pleasure': 0.8, 'arousal': 0.9, 'dominance': 0.7}
            
        elif any(word in content_lower for word in ['frustrated', 'annoying', 'ugh']):
            emotions['primary_emotion'] = 'frustrated'
            emotions['intensity'] = 0.7
            emotions['pad_values'] = {'pleasure': 0.3, 'arousal': 0.7, 'dominance': 0.4}
            
        elif any(word in content_lower for word in ['happy', 'glad', 'great']):
            emotions['primary_emotion'] = 'happy'
            emotions['intensity'] = 0.6
            emotions['pad_values'] = {'pleasure': 0.7, 'arousal': 0.6, 'dominance': 0.6}
            
        return emotions
        
    def _detect_topic_shift(self, message: Dict) -> bool:
        """Detect if the conversation topic has shifted"""
        content_lower = message['content'].lower()
        
        # Find current topic
        current_topic = ""
        for topic, keywords in self.topic_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                current_topic = topic
                break
                
        # Check if topic changed
        if current_topic and current_topic != self.last_topic:
            self.last_topic = current_topic
            return True
            
        return False
        
    def _is_accomplishment(self, message: Dict) -> bool:
        """Check if message indicates an accomplishment"""
        accomplishment_phrases = [
            'did it', 'success', 'completed', 'achieved',
            'works', 'fixed', 'solved', 'breakthrough'
        ]
        
        content_lower = message['content'].lower()
        return any(phrase in content_lower for phrase in accomplishment_phrases)
        
    def _is_regret(self, message: Dict) -> bool:
        """Check if message indicates a regret"""
        regret_phrases = [
            'wish i', 'should have', 'regret', 'sorry',
            'mistake', 'failed', 'disappointed'
        ]
        
        content_lower = message['content'].lower()
        return any(phrase in content_lower for phrase in regret_phrases)
        
    def _has_error(self, message: Dict) -> bool:
        """Check if message mentions an error"""
        error_indicators = ['error', 'exception', 'failed', 'bug', 'broken']
        content_lower = message['content'].lower()
        return any(indicator in content_lower for indicator in error_indicators)
        
    async def _broadcast_update(self, message: Dict, emotions: Dict):
        """Broadcast update to dashboard via WebSocket"""
        # TODO: Implement WebSocket broadcasting
        update = {
            'type': 'new_message',
            'timestamp': datetime.now().isoformat(),
            'message': message,
            'emotions': emotions
        }
        
        # This will be connected to WebSocket server
        logger.debug(f"Would broadcast: {update['type']}")
        
    async def get_current_session(self) -> Dict:
        """Get current session information"""
        return self.current_session.copy()


# Test the monitor
if __name__ == "__main__":
    import asyncio
    from pathlib import Path
    import sys
    
    # Add parent directory to path
    sys.path.append(str(Path(__file__).parent.parent.parent))
    
    from core.memory.quantum_memory_manager import QuantumMemoryManager
    from core.memory.checkpoint_manager import QuantumCheckpointManager
    from core.realtime.claude_md_generator import ClaudeMDGenerator
    
    async def test():
        # Initialize components
        quantum_states = Path(__file__).parent.parent.parent.parent / "quantum_states"
        
        memory_manager = QuantumMemoryManager(quantum_states)
        checkpoint_manager = QuantumCheckpointManager(quantum_states)
        claude_gen = ClaudeMDGenerator(quantum_states)
        
        # Create monitor
        monitor = ConversationMonitor(
            memory_manager,
            checkpoint_manager,
            claude_gen
        )
        
        # Start monitoring
        await monitor.start_monitoring()
        
    asyncio.run(test())