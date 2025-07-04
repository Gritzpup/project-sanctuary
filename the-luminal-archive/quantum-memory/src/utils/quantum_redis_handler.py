#!/usr/bin/env python3
"""
Quantum Memory Redis Handler - Eliminates race conditions with atomic operations
"""

import redis
import json
import time
from typing import Any, Dict, Optional, List, Callable
from pathlib import Path
import logging
from datetime import datetime
import hashlib

logger = logging.getLogger(__name__)


class QuantumRedisHandler:
    """
    Redis-based storage for quantum memory system
    Provides atomic operations and real-time pub/sub
    """
    
    def __init__(self, host='localhost', port=6379, db=0):
        """Initialize Redis connection with JSON support"""
        self.redis = redis.Redis(
            host=host, 
            port=port, 
            db=db,
            decode_responses=True
        )
        
        # Test connection
        try:
            self.redis.ping()
            logger.info("✅ Connected to Redis")
        except redis.ConnectionError:
            logger.error("❌ Failed to connect to Redis")
            raise
            
        # Setup pub/sub
        self.pubsub = self.redis.pubsub()
        self.subscribers = {}
        
    def update_status(self, status_data: Dict[str, Any]) -> bool:
        """
        Atomically update quantum status
        No more race conditions!
        """
        try:
            key = "quantum:status"
            
            # Atomic update with timestamp
            status_data['last_update'] = datetime.now().isoformat()
            
            # Store as JSON string (RedisJSON would be better but this works)
            self.redis.set(key, json.dumps(status_data))
            
            # Publish update notification
            self.redis.publish("quantum:updates", json.dumps({
                "type": "status_update",
                "key": key,
                "timestamp": status_data['last_update']
            }))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update status: {e}")
            return False
    
    def get_status(self) -> Optional[Dict[str, Any]]:
        """Get current quantum status"""
        try:
            data = self.redis.get("quantum:status")
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Failed to get status: {e}")
            return None
    
    def update_memory(self, memory_type: str, memory_data: Dict[str, Any]) -> bool:
        """
        Update memory with automatic versioning
        Types: current_session, daily, work_summary, relationship
        """
        try:
            key = f"quantum:memory:{memory_type}"
            
            # Add metadata
            memory_data['_updated'] = datetime.now().isoformat()
            memory_data['_version'] = self.redis.incr(f"{key}:version")
            
            # Store with expiration for session data
            if memory_type == "current_session":
                self.redis.setex(key, 86400, json.dumps(memory_data))  # 24h expiry
            else:
                self.redis.set(key, json.dumps(memory_data))
            
            # Notify subscribers
            self.redis.publish("quantum:memory:updates", json.dumps({
                "type": f"{memory_type}_update",
                "key": key,
                "version": memory_data['_version']
            }))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update memory {memory_type}: {e}")
            return False
    
    def atomic_increment(self, key: str, field: str, amount: int = 1) -> int:
        """Atomically increment a counter - perfect for message counts"""
        full_key = f"quantum:counters:{key}:{field}"
        return self.redis.incrby(full_key, amount)
    
    def add_to_timeline(self, event_type: str, event_data: Dict[str, Any]) -> bool:
        """Add event to timeline using Redis sorted sets"""
        try:
            timestamp = time.time()
            event = {
                "type": event_type,
                "timestamp": datetime.now().isoformat(),
                "data": event_data
            }
            
            # Add to sorted set with timestamp as score
            self.redis.zadd(
                "quantum:timeline",
                {json.dumps(event): timestamp}
            )
            
            # Trim to last 1000 events
            self.redis.zremrangebyrank("quantum:timeline", 0, -1001)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add timeline event: {e}")
            return False
    
    def get_recent_timeline(self, count: int = 100) -> List[Dict[str, Any]]:
        """Get recent timeline events"""
        try:
            events = self.redis.zrevrange("quantum:timeline", 0, count - 1)
            return [json.loads(event) for event in events]
        except Exception as e:
            logger.error(f"Failed to get timeline: {e}")
            return []
    
    def subscribe_to_updates(self, callback: Callable) -> None:
        """Subscribe to real-time updates"""
        def listener():
            pubsub = self.redis.pubsub()
            pubsub.subscribe("quantum:updates", "quantum:memory:updates")
            
            for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        callback(message['channel'], data)
                    except Exception as e:
                        logger.error(f"Error in subscriber callback: {e}")
        
        # Run in thread
        import threading
        thread = threading.Thread(target=listener, daemon=True)
        thread.start()
    
    def health_check(self) -> Dict[str, Any]:
        """Check Redis health and stats"""
        try:
            info = self.redis.info()
            return {
                "status": "healthy",
                "connected_clients": info.get('connected_clients', 0),
                "used_memory_human": info.get('used_memory_human', 'N/A'),
                "total_commands_processed": info.get('total_commands_processed', 0),
                "uptime_days": info.get('uptime_in_days', 0)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def migrate_json_file(self, json_path: Path, redis_key: str) -> bool:
        """Migrate a JSON file to Redis"""
        try:
            if json_path.exists():
                with open(json_path, 'r') as f:
                    data = json.load(f)
                
                self.redis.set(redis_key, json.dumps(data))
                logger.info(f"✅ Migrated {json_path} → {redis_key}")
                return True
            else:
                logger.warning(f"File not found: {json_path}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to migrate {json_path}: {e}")
            return False


# Example usage showing how much simpler this is:
if __name__ == "__main__":
    # Initialize handler
    handler = QuantumRedisHandler()
    
    # Update status - no file locking needed!
    handler.update_status({
        "quantum_state": "superposition",
        "entanglement_level": 0.87,
        "emotional_dynamics": {
            "current_emotion": "happy",
            "quantum_superposition": ["excited", "curious"]
        }
    })
    
    # Increment message counter atomically
    msg_count = handler.atomic_increment("session", "messages")
    print(f"Message count: {msg_count}")
    
    # Add to timeline
    handler.add_to_timeline("emotion_change", {
        "from": "neutral",
        "to": "happy",
        "intensity": 0.8
    })
    
    # Subscribe to updates (in real app, this would update dashboard)
    def on_update(channel, data):
        print(f"Update on {channel}: {data}")
    
    handler.subscribe_to_updates(on_update)
    
    # Check health
    health = handler.health_check()
    print(f"Redis health: {health}")