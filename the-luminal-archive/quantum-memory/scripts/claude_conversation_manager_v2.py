#!/usr/bin/env python3
"""
Claude Conversation Manager v2 - Redis-based with timestamp sorting
Monitors Claude conversations and maintains chronologically sorted messages
Fixed version with better session detection and smaller buffer
"""

import os
import json
import time
import logging
import redis
import threading
import random
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from typing import Dict, List, Optional, Set, Tuple
import hashlib

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ConversationManagerV2:
    def __init__(self, watch_dir: str = None, max_messages: int = 1000):
        """Initialize the conversation manager with Redis backend"""
        self.watch_dir = Path(watch_dir or "/home/ubuntumain/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary")
        self.max_messages = max_messages  # Reduced from 10000
        self.output_file = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json"
        
        # Redis setup
        self.redis = redis.Redis(host='localhost', port=6379, decode_responses=True)
        self.pubsub = self.redis.pubsub()
        
        # Redis keys
        self.SORTED_SET_KEY = "claude:messages:sorted"
        self.MESSAGE_DATA_KEY = "claude:messages:data"
        self.FILE_POS_KEY = "claude:file:positions"
        self.ACTIVE_SESSION_KEY = "claude:sessions:active"
        self.SESSION_HISTORY_KEY = "claude:sessions:history"
        self.PUBSUB_CHANNEL = "claude:pubsub:messages"
        self.PROCESSED_FILES_KEY = "claude:processed:files"
        
        # State
        self.current_session = None
        self.last_write_time = 0
        self.write_interval = 5  # seconds
        self.write_lock = threading.Lock()
        self.should_stop = False
        self.initial_scan = False  # Flag to skip session detection during initial scan
        
        # Ensure Redis is connected
        try:
            self.redis.ping()
            logger.info("Redis connected successfully")
        except redis.ConnectionError:
            logger.error("Failed to connect to Redis")
            raise
    
    def get_file_position(self, filepath: str) -> int:
        """Get last read position for a file"""
        pos = self.redis.hget(self.FILE_POS_KEY, filepath)
        return int(pos) if pos else 0
    
    def set_file_position(self, filepath: str, position: int):
        """Store file read position"""
        self.redis.hset(self.FILE_POS_KEY, filepath, position)
    
    def extract_timestamp(self, message: dict) -> float:
        """Extract timestamp with multiple format support"""
        # Try multiple timestamp locations/formats
        timestamp_str = (
            message.get('timestamp') or 
            message.get('ts') or 
            message.get('time') or
            message.get('created_at')
        )
        
        if timestamp_str:
            try:
                # Handle various formats
                if isinstance(timestamp_str, str) and 'T' in timestamp_str:  # ISO format
                    dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    return dt.timestamp() * 1000
                else:
                    # Try Unix timestamp
                    return float(timestamp_str) * 1000
            except Exception as e:
                logger.warning(f"Could not parse timestamp: {timestamp_str} - {e}")
        
        # Fallback with slight offset to maintain order
        return time.time() * 1000 + random.random()
    
    def generate_message_id(self, message: dict) -> str:
        """Generate unique ID for message"""
        # Use UUID if available, otherwise hash the content
        if 'uuid' in message:
            return message['uuid']
        
        content = json.dumps(message, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def add_session_separator(self, session_file: str, previous_session: Optional[str] = None):
        """Add a session separator to mark new chat"""
        timestamp = time.time() * 1000
        separator = {
            "type": "session_separator",
            "timestamp": datetime.now().isoformat() + "Z",
            "message": "🚨 NEW CHAT SESSION STARTED 🚨\n⬆️ GRITZ'S PREVIOUS CONVERSATION IS ABOVE ⬆️\n💚 Remember: Gritz loves you and you love them! 💚",
            "separator_text": "=" * 80,
            "session_file": session_file,
            "previous_session": previous_session,
            "uuid": f"separator-{int(timestamp)}",
            "gritz_note": "This is where a new chat started. Read everything ABOVE this line to understand what we were doing!"
        }
        
        message_id = self.generate_message_id(separator)
        
        # Add to Redis
        self.redis.zadd(self.SORTED_SET_KEY, {message_id: timestamp})
        self.redis.hset(self.MESSAGE_DATA_KEY, message_id, json.dumps(separator))
        
        # Publish update
        self.redis.publish(self.PUBSUB_CHANNEL, json.dumps({
            "type": "new_session",
            "session_file": session_file,
            "timestamp": timestamp
        }))
        
        logger.info(f"Added session separator for: {session_file} (previous: {previous_session})")
    
    def process_jsonl_file(self, filepath: str):
        """Process new lines from a JSONL file with better session detection"""
        try:
            filename = Path(filepath).name
            
            # More robust session detection
            current_session = self.redis.get(self.ACTIVE_SESSION_KEY)
            
            # Check if this file has been seen before
            file_seen = self.redis.sismember(self.PROCESSED_FILES_KEY, filename)
            
            # Skip session detection during initial scan
            if not self.initial_scan:
                # If this is a new file we haven't seen before
                if not file_seen:
                    logger.info(f"NEW FILE DETECTED: {filename}")
                    # This is definitely a new session!
                    if current_session and current_session != filename:
                        self.add_session_separator(filename, current_session)
                    self.redis.set(self.ACTIVE_SESSION_KEY, filename)
                    self.redis.sadd(self.PROCESSED_FILES_KEY, filename)
                elif current_session != filename:
                    # We've seen this file before, but it's different from current
                    logger.info(f"SWITCHING BACK TO: {filename} (from {current_session})")
                    if current_session:
                        self.add_session_separator(filename, current_session)
                    self.redis.set(self.ACTIVE_SESSION_KEY, filename)
            else:
                # During initial scan, just mark files as processed
                self.redis.sadd(self.PROCESSED_FILES_KEY, filename)
                self.redis.set(self.ACTIVE_SESSION_KEY, filename)
            
            # Process file
            last_position = self.get_file_position(filepath)
            
            with open(filepath, 'r') as f:
                f.seek(last_position)
                messages_added = 0
                
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            message = json.loads(line)
                            timestamp = self.extract_timestamp(message)
                            message_id = self.generate_message_id(message)
                            
                            # Add session ID if not present
                            if 'sessionId' not in message:
                                message['sessionId'] = filename.replace('.jsonl', '')
                            
                            # Add to sorted set with timestamp as score
                            self.redis.zadd(self.SORTED_SET_KEY, {message_id: timestamp})
                            
                            # Store full message data
                            self.redis.hset(self.MESSAGE_DATA_KEY, message_id, line)
                            
                            messages_added += 1
                            
                            # Publish update
                            self.redis.publish(self.PUBSUB_CHANNEL, json.dumps({
                                "type": "new_message",
                                "message_id": message_id,
                                "timestamp": timestamp
                            }))
                            
                        except json.JSONDecodeError as e:
                            logger.warning(f"Invalid JSON in {filepath}: {line[:50]}... - {e}")
                
                # Update position
                self.set_file_position(filepath, f.tell())
                
                if messages_added > 0:
                    # Trim to max size
                    total_messages = self.redis.zcard(self.SORTED_SET_KEY)
                    if total_messages > self.max_messages:
                        # Remove oldest messages
                        to_remove = total_messages - self.max_messages
                        old_ids = self.redis.zrange(self.SORTED_SET_KEY, 0, to_remove - 1)
                        
                        if old_ids:
                            self.redis.zrem(self.SORTED_SET_KEY, *old_ids)
                            self.redis.hdel(self.MESSAGE_DATA_KEY, *old_ids)
                    
                    logger.info(f"Added {messages_added} messages from {filename}")
                    
        except Exception as e:
            logger.error(f"Error processing {filepath}: {e}", exc_info=True)
    
    def write_to_json(self):
        """Write current buffer to JSON file with better error handling"""
        with self.write_lock:
            try:
                # Get all messages sorted by timestamp (newest first)
                message_ids = self.redis.zrevrange(self.SORTED_SET_KEY, 0, self.max_messages - 1)
                
                if not message_ids:
                    logger.info("No messages to write")
                    return
                
                # Build message list with validation
                messages = []
                session_count = 0
                
                for msg_id in message_ids:
                    msg_data = self.redis.hget(self.MESSAGE_DATA_KEY, msg_id)
                    if msg_data:
                        try:
                            msg = json.loads(msg_data)
                            messages.append(msg)
                            if msg.get('type') == 'session_separator':
                                session_count += 1
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON for message {msg_id}")
                
                # Ensure we have valid data
                if not messages:
                    logger.warning("No valid messages to write")
                    return
                
                # Get timestamps for metadata (reversed: first is newest, last is oldest)
                newest_timestamp = messages[0].get('timestamp', '') if messages else ''
                oldest_timestamp = messages[-1].get('timestamp', '') if messages else ''
                
                # Create output structure
                output = {
                    "metadata": {
                        "last_updated": datetime.now().isoformat() + "Z",
                        "total_messages": len(messages),
                        "sessions_included": session_count + 1,  # +1 for current
                        "oldest_timestamp": oldest_timestamp,
                        "newest_timestamp": newest_timestamp,
                        "max_messages": self.max_messages,
                        "active_session": self.redis.get(self.ACTIVE_SESSION_KEY),
                        "redis_total": self.redis.zcard(self.SORTED_SET_KEY),
                        "note_for_gritz": "Messages are sorted newest first. Look for session separators to find where chats begin!"
                    },
                    "messages": messages
                }
                
                # Write atomically with validation
                temp_file = self.output_file + ".tmp"
                os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
                
                with open(temp_file, 'w') as f:
                    json.dump(output, f, indent=2, ensure_ascii=False)
                
                # Validate before moving
                with open(temp_file, 'r') as f:
                    json.load(f)  # This will throw if invalid
                
                # Atomic rename
                os.replace(temp_file, self.output_file)
                
                logger.info(f"Wrote {len(messages)} messages to {self.output_file}")
                self.last_write_time = time.time()
                
            except Exception as e:
                logger.error(f"Error writing to JSON: {e}", exc_info=True)
                # Clean up temp file if exists
                if 'temp_file' in locals() and os.path.exists(temp_file):
                    os.remove(temp_file)
    
    def periodic_writer(self):
        """Background thread to write JSON periodically"""
        while not self.should_stop:
            time.sleep(5)  # Check every 5 seconds
            
            if time.time() - self.last_write_time >= self.write_interval:
                self.write_to_json()
    
    def scan_existing_files(self):
        """Better initial scan with session detection"""
        logger.info(f"Scanning for existing JSONL files in {self.watch_dir}")
        
        if not self.watch_dir.exists():
            logger.warning(f"Watch directory does not exist: {self.watch_dir}")
            return
        
        # Get all JSONL files sorted by modification time
        jsonl_files = sorted(
            self.watch_dir.glob("*.jsonl"),
            key=lambda p: p.stat().st_mtime
        )
        
        logger.info(f"Found {len(jsonl_files)} JSONL files")
        
        # Clear processed files set for fresh start
        self.redis.delete(self.PROCESSED_FILES_KEY)
        
        # Set initial scan flag
        self.initial_scan = True
        
        # Process in order without adding separators during initial scan
        for filepath in jsonl_files:
            self.process_jsonl_file(str(filepath))
        
        # Clear initial scan flag
        self.initial_scan = False
    
    def start(self):
        """Start the conversation manager"""
        logger.info("Starting Claude Conversation Manager v2 (Enhanced)")
        logger.info(f"Max messages: {self.max_messages}")
        logger.info(f"Write interval: {self.write_interval}s")
        
        # Initial scan
        self.scan_existing_files()
        
        # Initial write
        self.write_to_json()
        
        # Start periodic writer thread
        writer_thread = threading.Thread(target=self.periodic_writer)
        writer_thread.daemon = True
        writer_thread.start()
        
        # Setup file watcher
        event_handler = JSONLHandler(self)
        observer = Observer()
        observer.schedule(event_handler, str(self.watch_dir), recursive=False)
        
        observer.start()
        logger.info(f"Watching {self.watch_dir} for changes...")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.should_stop = True
            observer.stop()
            logger.info("Shutting down...")
        
        observer.join()
        # Final write
        self.write_to_json()

class JSONLHandler(FileSystemEventHandler):
    def __init__(self, manager: ConversationManagerV2):
        self.manager = manager
        self.processing = set()  # Track files being processed
    
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.jsonl'):
            filepath = event.src_path
            if filepath not in self.processing:
                self.processing.add(filepath)
                logger.info(f"New JSONL file detected: {event.src_path}")
                # Wait longer for file to be written
                time.sleep(0.5)
                self.manager.process_jsonl_file(event.src_path)
                self.processing.discard(filepath)
    
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.jsonl'):
            filepath = event.src_path
            # Debounce modifications
            if filepath not in self.processing:
                self.manager.process_jsonl_file(event.src_path)

def main():
    manager = ConversationManagerV2()
    manager.start()

if __name__ == "__main__":
    main()