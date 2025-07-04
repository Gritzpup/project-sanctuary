#!/usr/bin/env python3
"""
Redis Memory Manager - Unified storage for all memory systems
Provides atomic operations and prevents race conditions
"""

import json
import time
import redis
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta
from pathlib import Path
import threading

logger = logging.getLogger(__name__)

class RedisMemoryManager:
    """Unified Redis-based memory storage for all quantum memory systems"""
    
    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0):
        """Initialize Redis connection and key prefixes"""
        self.redis = redis.Redis(host=host, port=port, db=db, decode_responses=True)
        self.pubsub = self.redis.pubsub()
        
        # Key prefixes for different memory types
        self.PREFIXES = {
            'conversation': 'memory:conversation:',
            'temporal': 'memory:temporal:',
            'entity': 'memory:entity:',
            'emotional': 'memory:emotional:',
            'relationship': 'memory:relationship:',
            'work': 'memory:work:',
            'quantum': 'memory:quantum:'
        }
        
        # Special keys
        self.LOCK_PREFIX = 'lock:'
        self.UPDATE_CHANNEL = 'memory:updates'
        
        # Test connection
        try:
            self.redis.ping()
            logger.info("Redis Memory Manager connected successfully")
        except redis.ConnectionError:
            logger.error("Failed to connect to Redis")
            raise
    
    def _get_key(self, memory_type: str, key: str) -> str:
        """Get full Redis key for a memory item"""
        if memory_type not in self.PREFIXES:
            raise ValueError(f"Unknown memory type: {memory_type}")
        return f"{self.PREFIXES[memory_type]}{key}"
    
    def _acquire_lock(self, key: str, timeout: int = 10) -> bool:
        """Acquire a distributed lock"""
        lock_key = f"{self.LOCK_PREFIX}{key}"
        identifier = f"{threading.current_thread().ident}:{time.time()}"
        
        end = time.time() + timeout
        while time.time() < end:
            if self.redis.set(lock_key, identifier, nx=True, ex=timeout):
                return True
            time.sleep(0.001)
        return False
    
    def _release_lock(self, key: str):
        """Release a distributed lock"""
        lock_key = f"{self.LOCK_PREFIX}{key}"
        self.redis.delete(lock_key)
    
    # Conversation Memory Operations
    def add_conversation_message(self, message: Dict[str, Any]) -> str:
        """Add a conversation message"""
        timestamp = message.get('timestamp', datetime.now().isoformat())
        message_id = f"msg_{int(time.time() * 1000000)}"
        
        # Store in sorted set by timestamp
        score = time.time()
        self.redis.zadd(
            self._get_key('conversation', 'messages'),
            {message_id: score}
        )
        
        # Store message data
        self.redis.hset(
            self._get_key('conversation', 'data'),
            message_id,
            json.dumps(message)
        )
        
        # Publish update
        self.redis.publish(self.UPDATE_CHANNEL, json.dumps({
            'type': 'conversation',
            'action': 'add',
            'message_id': message_id
        }))
        
        return message_id
    
    def get_recent_conversations(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent conversation messages"""
        # Get message IDs sorted by time (newest first)
        message_ids = self.redis.zrevrange(
            self._get_key('conversation', 'messages'),
            0, limit - 1
        )
        
        if not message_ids:
            return []
        
        # Get message data
        messages = []
        for msg_id in message_ids:
            data = self.redis.hget(
                self._get_key('conversation', 'data'),
                msg_id
            )
            if data:
                messages.append(json.loads(data))
        
        return messages
    
    # Temporal Memory Operations
    def update_temporal_memory(self, date: str, summary: Dict[str, Any]):
        """Update temporal memory for a specific date"""
        key = self._get_key('temporal', f'daily:{date}')
        
        if self._acquire_lock(key):
            try:
                # Get existing data
                existing = self.redis.get(key)
                if existing:
                    data = json.loads(existing)
                    # Merge with new summary
                    for k, v in summary.items():
                        if isinstance(v, list) and k in data:
                            data[k].extend(v)
                        elif isinstance(v, dict) and k in data:
                            data[k].update(v)
                        else:
                            data[k] = v
                else:
                    data = summary
                
                # Save updated data
                self.redis.set(key, json.dumps(data))
                
                # Update index
                self.redis.zadd(
                    self._get_key('temporal', 'index'),
                    {date: time.mktime(datetime.fromisoformat(date).timetuple())}
                )
                
                # Publish update
                self.redis.publish(self.UPDATE_CHANNEL, json.dumps({
                    'type': 'temporal',
                    'action': 'update',
                    'date': date
                }))
                
            finally:
                self._release_lock(key)
    
    def get_temporal_range(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get temporal memories within date range"""
        start_score = time.mktime(datetime.fromisoformat(start_date).timetuple())
        end_score = time.mktime(datetime.fromisoformat(end_date).timetuple())
        
        # Get dates in range
        dates = self.redis.zrangebyscore(
            self._get_key('temporal', 'index'),
            start_score,
            end_score
        )
        
        memories = {}
        for date in dates:
            data = self.redis.get(self._get_key('temporal', f'daily:{date}'))
            if data:
                memories[date] = json.loads(data)
        
        return memories
    
    # Entity State Operations
    def update_entity_state(self, entity: str, state: Dict[str, Any]):
        """Update entity state atomically"""
        key = self._get_key('entity', entity)
        
        if self._acquire_lock(key):
            try:
                # Get current state
                current = self.redis.get(key)
                if current:
                    current_state = json.loads(current)
                    # Deep merge
                    self._deep_merge(current_state, state)
                    state = current_state
                
                # Add timestamp
                state['last_updated'] = datetime.now().isoformat()
                
                # Save state
                self.redis.set(key, json.dumps(state))
                
                # Track entity
                self.redis.sadd(self._get_key('entity', 'index'), entity)
                
                # Publish update
                self.redis.publish(self.UPDATE_CHANNEL, json.dumps({
                    'type': 'entity',
                    'action': 'update',
                    'entity': entity
                }))
                
            finally:
                self._release_lock(key)
    
    def get_entity_state(self, entity: str) -> Optional[Dict[str, Any]]:
        """Get current entity state"""
        data = self.redis.get(self._get_key('entity', entity))
        return json.loads(data) if data else None
    
    def get_all_entities(self) -> List[str]:
        """Get list of all tracked entities"""
        return list(self.redis.smembers(self._get_key('entity', 'index')))
    
    # Emotional State Operations
    def record_emotional_state(self, entity: str, emotion: Dict[str, Any]):
        """Record emotional state with timestamp"""
        timestamp = time.time()
        emotion_id = f"emo_{entity}_{int(timestamp * 1000)}"
        
        # Store in time series
        self.redis.zadd(
            self._get_key('emotional', f'{entity}:timeline'),
            {emotion_id: timestamp}
        )
        
        # Store emotion data
        emotion['timestamp'] = datetime.now().isoformat()
        emotion['entity'] = entity
        
        self.redis.hset(
            self._get_key('emotional', 'data'),
            emotion_id,
            json.dumps(emotion)
        )
        
        # Update current state
        self.redis.set(
            self._get_key('emotional', f'{entity}:current'),
            json.dumps(emotion)
        )
        
        return emotion_id
    
    def get_emotional_history(self, entity: str, hours: int = 24) -> List[Dict[str, Any]]:
        """Get emotional history for entity"""
        cutoff = time.time() - (hours * 3600)
        
        # Get emotion IDs within timeframe
        emotion_ids = self.redis.zrangebyscore(
            self._get_key('emotional', f'{entity}:timeline'),
            cutoff,
            '+inf'
        )
        
        emotions = []
        for emo_id in emotion_ids:
            data = self.redis.hget(
                self._get_key('emotional', 'data'),
                emo_id
            )
            if data:
                emotions.append(json.loads(data))
        
        return emotions
    
    # Relationship Memory Operations
    def update_relationship(self, entity1: str, entity2: str, interaction: Dict[str, Any]):
        """Update relationship between two entities"""
        # Create canonical key (alphabetically sorted)
        rel_key = f"{min(entity1, entity2)}:{max(entity1, entity2)}"
        key = self._get_key('relationship', rel_key)
        
        if self._acquire_lock(key):
            try:
                # Get current relationship
                current = self.redis.get(key)
                if current:
                    relationship = json.loads(current)
                else:
                    relationship = {
                        'entities': [entity1, entity2],
                        'created': datetime.now().isoformat(),
                        'interactions': [],
                        'bond_strength': 0.0
                    }
                
                # Add interaction
                interaction['timestamp'] = datetime.now().isoformat()
                relationship['interactions'].append(interaction)
                
                # Update bond strength
                if 'bond_delta' in interaction:
                    relationship['bond_strength'] += interaction['bond_delta']
                    relationship['bond_strength'] = max(-1, min(1, relationship['bond_strength']))
                
                relationship['last_interaction'] = interaction['timestamp']
                
                # Save
                self.redis.set(key, json.dumps(relationship))
                
                # Track in index
                self.redis.sadd(self._get_key('relationship', 'index'), rel_key)
                
            finally:
                self._release_lock(key)
    
    # Work Memory Operations  
    def update_work_context(self, context: Dict[str, Any]):
        """Update current work context"""
        key = self._get_key('work', 'current')
        
        context['updated_at'] = datetime.now().isoformat()
        self.redis.set(key, json.dumps(context))
        
        # Archive to history
        history_id = f"work_{int(time.time() * 1000)}"
        self.redis.zadd(
            self._get_key('work', 'history'),
            {history_id: time.time()}
        )
        self.redis.hset(
            self._get_key('work', 'history_data'),
            history_id,
            json.dumps(context)
        )
    
    def get_work_context(self) -> Optional[Dict[str, Any]]:
        """Get current work context"""
        data = self.redis.get(self._get_key('work', 'current'))
        return json.loads(data) if data else None
    
    # Quantum State Operations
    def update_quantum_state(self, state_type: str, state: Dict[str, Any]):
        """Update quantum memory state"""
        key = self._get_key('quantum', state_type)
        
        state['observed_at'] = datetime.now().isoformat()
        state['coherence'] = state.get('coherence', 1.0)
        
        self.redis.set(key, json.dumps(state))
        
        # Track state evolution
        evolution_id = f"quantum_{state_type}_{int(time.time() * 1000)}"
        self.redis.zadd(
            self._get_key('quantum', f'{state_type}:evolution'),
            {evolution_id: time.time()}
        )
        self.redis.hset(
            self._get_key('quantum', 'evolution_data'),
            evolution_id,
            json.dumps(state)
        )
    
    # Utility Methods
    def _deep_merge(self, base: Dict, update: Dict):
        """Deep merge two dictionaries"""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            elif key in base and isinstance(base[key], list) and isinstance(value, list):
                base[key].extend(value)
            else:
                base[key] = value
    
    def export_all_memory(self) -> Dict[str, Any]:
        """Export all memory data for backup"""
        export = {
            'timestamp': datetime.now().isoformat(),
            'memories': {}
        }
        
        # Export each memory type
        for mem_type, prefix in self.PREFIXES.items():
            export['memories'][mem_type] = {}
            
            # Get all keys for this type
            keys = self.redis.keys(f"{prefix}*")
            for key in keys:
                key_type = self.redis.type(key)
                
                if key_type == 'string':
                    export['memories'][mem_type][key] = self.redis.get(key)
                elif key_type == 'hash':
                    export['memories'][mem_type][key] = self.redis.hgetall(key)
                elif key_type == 'zset':
                    export['memories'][mem_type][key] = self.redis.zrange(key, 0, -1, withscores=True)
                elif key_type == 'set':
                    export['memories'][mem_type][key] = list(self.redis.smembers(key))
        
        return export
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get statistics about memory usage"""
        stats = {
            'timestamp': datetime.now().isoformat(),
            'memory_types': {}
        }
        
        for mem_type, prefix in self.PREFIXES.items():
            keys = self.redis.keys(f"{prefix}*")
            stats['memory_types'][mem_type] = {
                'key_count': len(keys),
                'total_size': sum(self.redis.memory_usage(k) or 0 for k in keys)
            }
        
        stats['total_keys'] = sum(s['key_count'] for s in stats['memory_types'].values())
        stats['total_memory'] = sum(s['total_size'] for s in stats['memory_types'].values())
        
        return stats