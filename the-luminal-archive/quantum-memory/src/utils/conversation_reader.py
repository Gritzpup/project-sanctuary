#!/usr/bin/env python3
"""
Conversation Reader - Redis-based reader for concurrent access
Allows reading conversations without file locks
"""

import json
import redis
import threading
from typing import List, Dict, Optional, Callable, Generator
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ConversationReader:
    """Read conversations directly from Redis - no file locking issues"""
    
    def __init__(self, redis_host: str = 'localhost', redis_port: int = 6379):
        """Initialize the reader with Redis connection"""
        self.redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        
        # Redis keys (must match manager)
        self.SORTED_SET_KEY = "claude:messages:sorted"
        self.MESSAGE_DATA_KEY = "claude:messages:data"
        self.ACTIVE_SESSION_KEY = "claude:sessions:active"
        self.PUBSUB_CHANNEL = "claude:pubsub:messages"
        
        # Verify connection
        try:
            self.redis.ping()
        except redis.ConnectionError:
            logger.error("Failed to connect to Redis")
            raise
    
    def get_messages(self, limit: int = 10000, include_separators: bool = True) -> List[Dict]:
        """
        Get messages from Redis sorted by timestamp
        
        Args:
            limit: Maximum number of messages to return
            include_separators: Whether to include session separators
            
        Returns:
            List of message dictionaries sorted by timestamp (oldest first)
        """
        try:
            # Get message IDs sorted by timestamp
            message_ids = self.redis.zrange(self.SORTED_SET_KEY, 0, limit - 1)
            
            if not message_ids:
                return []
            
            # Get message data
            messages = []
            for msg_id in message_ids:
                msg_data = self.redis.hget(self.MESSAGE_DATA_KEY, msg_id)
                if msg_data:
                    msg = json.loads(msg_data)
                    
                    # Skip separators if not wanted
                    if not include_separators and msg.get('type') == 'session_separator':
                        continue
                        
                    messages.append(msg)
            
            return messages
            
        except Exception as e:
            logger.error(f"Error reading messages: {e}")
            return []
    
    def get_messages_after(self, timestamp: float, limit: int = 10000) -> List[Dict]:
        """
        Get only messages after a certain timestamp
        
        Args:
            timestamp: Unix timestamp in seconds
            limit: Maximum number of messages to return
            
        Returns:
            List of messages after the timestamp
        """
        try:
            # Convert to milliseconds
            timestamp_ms = timestamp * 1000
            
            # Get messages with score > timestamp
            message_ids = self.redis.zrangebyscore(
                self.SORTED_SET_KEY, 
                timestamp_ms, 
                '+inf',
                start=0,
                num=limit
            )
            
            messages = []
            for msg_id in message_ids:
                msg_data = self.redis.hget(self.MESSAGE_DATA_KEY, msg_id)
                if msg_data:
                    messages.append(json.loads(msg_data))
            
            return messages
            
        except Exception as e:
            logger.error(f"Error reading messages after timestamp: {e}")
            return []
    
    def get_latest_messages(self, count: int = 100) -> List[Dict]:
        """
        Get the most recent messages
        
        Args:
            count: Number of recent messages to get
            
        Returns:
            List of most recent messages (newest last)
        """
        try:
            # Get from the end of the sorted set
            message_ids = self.redis.zrange(self.SORTED_SET_KEY, -count, -1)
            
            messages = []
            for msg_id in message_ids:
                msg_data = self.redis.hget(self.MESSAGE_DATA_KEY, msg_id)
                if msg_data:
                    messages.append(json.loads(msg_data))
            
            return messages
            
        except Exception as e:
            logger.error(f"Error reading latest messages: {e}")
            return []
    
    def get_current_session(self) -> Optional[str]:
        """Get the current active session file name"""
        return self.redis.get(self.ACTIVE_SESSION_KEY)
    
    def find_session_boundaries(self) -> List[Dict]:
        """Find all session separator messages"""
        messages = self.get_messages(include_separators=True)
        return [msg for msg in messages if msg.get('type') == 'session_separator']
    
    def get_messages_for_session(self, session_file: str) -> List[Dict]:
        """Get all messages for a specific session"""
        all_messages = self.get_messages(include_separators=True)
        
        session_messages = []
        in_session = False
        
        for msg in all_messages:
            if msg.get('type') == 'session_separator':
                if msg.get('session_file') == session_file:
                    in_session = True
                    session_messages.append(msg)
                else:
                    in_session = False
            elif in_session or (not session_messages and msg.get('sessionId') == session_file.replace('.jsonl', '')):
                session_messages.append(msg)
        
        return session_messages
    
    def watch_for_updates(self, callback: Callable[[Dict], None], 
                         include_heartbeat: bool = False) -> None:
        """
        Subscribe to Redis pubsub for real-time updates
        
        Args:
            callback: Function to call with new messages
            include_heartbeat: Whether to include heartbeat messages
        """
        def listener():
            pubsub = self.redis.pubsub()
            pubsub.subscribe(self.PUBSUB_CHANNEL)
            
            for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        
                        # Skip heartbeats if not wanted
                        if not include_heartbeat and data.get('type') == 'heartbeat':
                            continue
                        
                        # Get full message if it's a new message event
                        if data.get('type') == 'new_message':
                            msg_id = data.get('message_id')
                            if msg_id:
                                msg_data = self.redis.hget(self.MESSAGE_DATA_KEY, msg_id)
                                if msg_data:
                                    full_message = json.loads(msg_data)
                                    callback(full_message)
                        else:
                            # For other events (like new_session)
                            callback(data)
                            
                    except Exception as e:
                        logger.error(f"Error processing pubsub message: {e}")
        
        # Run listener in background thread
        thread = threading.Thread(target=listener)
        thread.daemon = True
        thread.start()
    
    def stream_messages(self, start_from: int = 0) -> Generator[Dict, None, None]:
        """
        Stream messages as a generator
        
        Args:
            start_from: Index to start from
            
        Yields:
            Message dictionaries
        """
        batch_size = 100
        offset = start_from
        
        while True:
            message_ids = self.redis.zrange(
                self.SORTED_SET_KEY, 
                offset, 
                offset + batch_size - 1
            )
            
            if not message_ids:
                break
            
            for msg_id in message_ids:
                msg_data = self.redis.hget(self.MESSAGE_DATA_KEY, msg_id)
                if msg_data:
                    yield json.loads(msg_data)
            
            offset += batch_size
    
    def get_message_count(self) -> int:
        """Get total number of messages in buffer"""
        return self.redis.zcard(self.SORTED_SET_KEY)
    
    def clear_all_messages(self) -> bool:
        """Clear all messages from Redis (use with caution!)"""
        try:
            self.redis.delete(self.SORTED_SET_KEY, self.MESSAGE_DATA_KEY)
            return True
        except Exception as e:
            logger.error(f"Error clearing messages: {e}")
            return False


# Convenience functions for quick access
def get_current_conversations(limit: int = 10000) -> List[Dict]:
    """Quick function to get current conversations"""
    reader = ConversationReader()
    return reader.get_messages(limit=limit)

def watch_conversations(callback: Callable[[Dict], None]) -> None:
    """Quick function to watch for new conversations"""
    reader = ConversationReader()
    reader.watch_for_updates(callback)

def get_latest_messages(count: int = 100) -> List[Dict]:
    """Quick function to get latest messages"""
    reader = ConversationReader()
    return reader.get_latest_messages(count)