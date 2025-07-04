#!/usr/bin/env python3
"""
Quantum-Enhanced Conversation Buffer
Scientifically optimized buffer with overlap preservation and quantum state preparation
"""

import asyncio
from collections import deque
from pathlib import Path
import json
import hashlib
from typing import List, Dict, Optional, Set, Tuple
try:
    import aiofiles
except ImportError:
    # Fallback to sync file operations
    aiofiles = None
import time
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class QuantumConversationBuffer:
    """
    Advanced conversation buffer with quantum state preparation
    
    Features:
    - Efficient file position tracking
    - Message deduplication
    - Overlap preservation for context
    - Quantum state preparation
    - Async I/O for performance
    """
    
    def __init__(self, max_messages: int = 1000, overlap: int = 200):
        """
        Initialize conversation buffer
        
        Args:
            max_messages: Maximum messages to keep in memory
            overlap: Number of messages to preserve for context continuity
        """
        self.max_messages = max_messages
        self.overlap = overlap
        self.buffer = deque(maxlen=max_messages)
        self.file_positions = {}  # Track read positions per file
        self.message_hashes: Set[str] = set()  # Deduplication
        self.conversation_states = {}  # Track quantum states per conversation
        self.last_update_times = {}  # Track update frequency
        
        logger.info(f"Initialized QuantumConversationBuffer with capacity {max_messages}")
        
    async def read_new_messages_async(self, file_path: Path) -> List[Dict]:
        """
        Asynchronously read only new messages from file
        
        Args:
            file_path: Path to conversation JSONL file
            
        Returns:
            List of new messages since last read
        """
        file_key = str(file_path)
        
        # Initialize position if first time reading
        if file_key not in self.file_positions:
            self.file_positions[file_key] = 0
            logger.debug(f"First time reading {file_path.name}")
            
        new_messages = []
        
        try:
            if aiofiles:
                # Async file reading
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    # Seek to last position
                    await f.seek(self.file_positions[file_key])
                    
                    # Read new lines
                    async for line in f:
                        try:
                            msg = json.loads(line.strip())
                            
                            # Create hash for deduplication
                            msg_content = json.dumps(msg, sort_keys=True)
                            msg_hash = hashlib.sha256(msg_content.encode()).hexdigest()[:16]
                            
                            if msg_hash not in self.message_hashes:
                                # Add timestamp if missing
                                if 'timestamp' not in msg:
                                    msg['timestamp'] = datetime.now().isoformat()
                                    
                                new_messages.append(msg)
                                self.message_hashes.add(msg_hash)
                                self.buffer.append(msg)
                                
                        except json.JSONDecodeError:
                            continue
                        except Exception as e:
                            logger.warning(f"Error processing message: {e}")
                            
                    # Update position
                    self.file_positions[file_key] = await f.tell()
            else:
                # Fallback to sync reading
                with open(file_path, 'r', encoding='utf-8') as f:
                    # Seek to last position
                    f.seek(self.file_positions[file_key])
                    
                    # Read new lines
                    for line in f:
                        try:
                            msg = json.loads(line.strip())
                            
                            # Create hash for deduplication
                            msg_content = json.dumps(msg, sort_keys=True)
                            msg_hash = hashlib.sha256(msg_content.encode()).hexdigest()[:16]
                            
                            if msg_hash not in self.message_hashes:
                                # Add timestamp if missing
                                if 'timestamp' not in msg:
                                    msg['timestamp'] = datetime.now().isoformat()
                                    
                                new_messages.append(msg)
                                self.message_hashes.add(msg_hash)
                                self.buffer.append(msg)
                                
                        except json.JSONDecodeError:
                            continue
                        except Exception as e:
                            logger.warning(f"Error processing message: {e}")
                            
                    # Update position
                    self.file_positions[file_key] = f.tell()
                
        except FileNotFoundError:
            logger.warning(f"File not found: {file_path}")
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
            
        # Update last read time
        self.last_update_times[file_key] = time.time()
        
        if new_messages:
            logger.info(f"Read {len(new_messages)} new messages from {file_path.name}")
            
        return new_messages
    
    def get_context_window(self, num_messages: int = 100) -> List[Dict]:
        """
        Get recent messages with overlap for context
        
        Args:
            num_messages: Number of messages to return
            
        Returns:
            List of recent messages
        """
        return list(self.buffer)[-num_messages:]
    
    def prepare_quantum_context(self, num_messages: int = 100) -> Dict:
        """
        Prepare messages for quantum processing
        
        Groups messages by emotion and prepares for superposition
        
        Returns:
            Dict with quantum-ready message data
        """
        recent = self.get_context_window(num_messages)
        
        # Group by emotion for superposition preparation
        emotion_groups = {}
        work_context = []
        todos_mentioned = []
        
        for msg in recent:
            # Extract emotions
            if 'emotion' in msg or 'emotions' in msg:
                emotions = msg.get('emotions', [msg.get('emotion', 'neutral')])
                if isinstance(emotions, str):
                    emotions = [emotions]
                    
                for emotion in emotions:
                    if emotion not in emotion_groups:
                        emotion_groups[emotion] = []
                    emotion_groups[emotion].append(msg)
            
            # Extract work context
            content = msg.get('content', '')
            if any(keyword in content.lower() for keyword in ['error', 'fix', 'bug', 'implement', 'todo']):
                work_context.append({
                    'content': content,
                    'timestamp': msg.get('timestamp'),
                    'type': 'work'
                })
                
            # Extract todos
            if 'todo' in content.lower():
                todos_mentioned.append(content)
                
        # Calculate emotion weights for quantum superposition
        total_messages = len(recent)
        emotion_weights = {}
        
        for emotion, messages in emotion_groups.items():
            weight = len(messages) / total_messages if total_messages > 0 else 0
            emotion_weights[emotion] = weight
            
        return {
            'messages': recent,
            'emotion_groups': emotion_groups,
            'emotion_weights': emotion_weights,
            'work_context': work_context,
            'todos_mentioned': todos_mentioned,
            'quantum_ready': True,
            'prepared_at': datetime.now().isoformat()
        }
    
    def get_conversation_stats(self, file_path: Optional[Path] = None) -> Dict:
        """
        Get statistics about buffered conversations
        
        Args:
            file_path: Optional specific file to get stats for
            
        Returns:
            Dict with conversation statistics
        """
        if file_path:
            file_key = str(file_path)
            return {
                'file': file_path.name,
                'position': self.file_positions.get(file_key, 0),
                'last_update': self.last_update_times.get(file_key, 0),
                'messages_in_buffer': len([m for m in self.buffer if m.get('file') == file_key])
            }
        else:
            return {
                'total_messages': len(self.buffer),
                'unique_messages': len(self.message_hashes),
                'files_tracked': len(self.file_positions),
                'oldest_message': self.buffer[0].get('timestamp') if self.buffer else None,
                'newest_message': self.buffer[-1].get('timestamp') if self.buffer else None
            }
    
    async def find_active_conversations(self, claude_dir: Path, max_age_seconds: int = 300) -> List[Dict]:
        """
        Find recently active conversation files
        
        Args:
            claude_dir: Base directory for Claude conversations
            max_age_seconds: Maximum age to consider "active"
            
        Returns:
            List of active conversation info
        """
        active_convs = []
        current_time = time.time()
        
        # Find all JSONL files
        jsonl_files = list(claude_dir.glob("**/*.jsonl"))
        
        # Sort by modification time
        jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        
        # Check top 10 most recent
        for conv_file in jsonl_files[:10]:
            try:
                stat = conv_file.stat()
                age_seconds = current_time - stat.st_mtime
                
                conv_info = {
                    'path': str(conv_file),
                    'name': conv_file.name,
                    'session_id': conv_file.stem,
                    'last_modified': stat.st_mtime,
                    'age_seconds': age_seconds,
                    'age_minutes': age_seconds / 60,
                    'is_active': age_seconds < max_age_seconds,
                    'size_kb': stat.st_size / 1024,
                    'size_mb': stat.st_size / (1024 * 1024)
                }
                
                active_convs.append(conv_info)
                
            except Exception as e:
                logger.warning(f"Error checking {conv_file}: {e}")
                
        return active_convs
    
    def clear_old_messages(self, max_age_hours: int = 24):
        """
        Clear messages older than specified age
        
        Args:
            max_age_hours: Maximum age in hours
        """
        if not self.buffer:
            return
            
        cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)
        
        # Remove old messages
        while self.buffer:
            msg = self.buffer[0]
            msg_time = msg.get('timestamp', '')
            
            try:
                if isinstance(msg_time, str):
                    msg_timestamp = datetime.fromisoformat(msg_time.replace('Z', '+00:00')).timestamp()
                else:
                    msg_timestamp = msg_time
                    
                if msg_timestamp < cutoff_time:
                    self.buffer.popleft()
                else:
                    break
            except:
                # If we can't parse timestamp, remove it
                self.buffer.popleft()
                
        logger.info(f"Cleared old messages, {len(self.buffer)} remaining")


# Example usage
if __name__ == "__main__":
    async def test_buffer():
        buffer = QuantumConversationBuffer()
        
        # Test reading messages
        test_file = Path("/home/ubuntumain/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary/current.jsonl")
        if test_file.exists():
            messages = await buffer.read_new_messages_async(test_file)
            print(f"Read {len(messages)} messages")
            
            # Prepare quantum context
            quantum_context = buffer.prepare_quantum_context()
            print(f"Emotion weights: {quantum_context['emotion_weights']}")
            
        # Find active conversations
        claude_dir = Path("/home/ubuntumain/.claude")
        active = await buffer.find_active_conversations(claude_dir)
        print(f"Found {len(active)} conversations, {sum(1 for c in active if c['is_active'])} active")
        
    asyncio.run(test_buffer())