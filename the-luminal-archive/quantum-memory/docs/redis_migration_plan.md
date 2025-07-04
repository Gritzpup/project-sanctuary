# Redis Migration Plan for Quantum Memory System

## Why Redis is Perfect for This Use Case

### Current Problems:
1. **Race Conditions**: Multiple services corrupting JSON files
2. **Performance**: File I/O every 5-10 seconds from multiple processes
3. **Data Loss**: Files being emptied during concurrent access
4. **Scalability**: Can't handle increased update frequency

### Redis Benefits:
1. **Atomic Operations**: No more race conditions
2. **In-Memory Speed**: 100x faster than file I/O
3. **Pub/Sub**: Real-time updates to dashboard
4. **Persistence**: RDB snapshots + AOF for durability
5. **JSON Support**: RedisJSON module for structured data
6. **Built-in TTL**: Auto-expire old session data
7. **Lua Scripting**: Complex atomic operations

## Architecture Design

### 1. Data Structure Mapping

```
Current JSON Files → Redis Keys
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

quantum_states/status.json → quantum:status (RedisJSON)
quantum_states/memories/current_session.json → quantum:session:current
quantum_states/memories/daily/2025-07-01.json → quantum:daily:2025-07-01
quantum_states/memories/work_summary_24h.json → quantum:work:summary24h
consciousness/entities/claude/* → entity:claude:*
```

### 2. Service Communication

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Analyzer     │     │ Entity Updater  │     │ WebSocket Server│
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         ├───────────────────────┴─────────────────────────┤
         │                                                 │
         ▼                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Redis Server                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ JSON Store  │  │ Pub/Sub Bus  │  │ Persistence (RDB+AOF) │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Implementation Steps

#### Phase 1: Setup Redis (Day 1)
```bash
# Install Redis with modules
sudo apt update
sudo apt install redis-server redis-tools

# Install RedisJSON module
wget https://github.com/RedisJSON/RedisJSON/releases/download/v2.6.6/rejson.Linux-ubuntu22.04-x86_64.2.6.6.tar
tar -xf rejson.Linux-ubuntu22.04-x86_64.2.6.6.tar
sudo cp rejson.so /usr/lib/redis/modules/

# Configure Redis
echo "loadmodule /usr/lib/redis/modules/rejson.so" | sudo tee -a /etc/redis/redis.conf
echo "save 60 1000" | sudo tee -a /etc/redis/redis.conf  # Persist every 60s if 1000+ changes
echo "appendonly yes" | sudo tee -a /etc/redis/redis.conf  # Enable AOF
sudo systemctl restart redis-server
```

#### Phase 2: Create Redis Wrapper (Day 1)
```python
# src/utils/redis_handler.py
import redis
import json
from typing import Any, Dict, Optional
from redis.commands.json import JSON

class QuantumRedisHandler:
    def __init__(self):
        self.redis = redis.Redis(decode_responses=True)
        self.json = self.redis.json()
        self.pubsub = self.redis.pubsub()
    
    def update_status(self, data: Dict[str, Any]):
        """Atomic status update with pub/sub notification"""
        key = "quantum:status"
        self.json.set(key, "$", data)
        self.redis.publish("quantum:updates", json.dumps({
            "type": "status_update",
            "key": key,
            "data": data
        }))
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status"""
        return self.json.get("quantum:status") or {}
```

#### Phase 3: Migrate Services (Day 2)
1. Update analyzer to use Redis instead of JSON files
2. Update entity_state_updater to use Redis
3. Update WebSocket server to subscribe to Redis pub/sub
4. Add migration script for existing JSON data

#### Phase 4: Add Advanced Features (Day 3)
1. **Stream Processing**: Use Redis Streams for event log
2. **Time Series**: Track metrics over time
3. **Lua Scripts**: Complex atomic operations
4. **Clustering**: Scale to multiple machines if needed

### 4. Migration Script Example

```python
#!/usr/bin/env python3
"""Migrate JSON files to Redis"""
import json
from pathlib import Path
from quantum_redis_handler import QuantumRedisHandler

def migrate_to_redis():
    handler = QuantumRedisHandler()
    
    # Migrate status.json
    status_file = Path("quantum_states/status.json")
    if status_file.exists():
        with open(status_file) as f:
            data = json.load(f)
        handler.json.set("quantum:status", "$", data)
        print(f"✅ Migrated {status_file}")
    
    # Migrate daily memories
    daily_path = Path("quantum_states/memories/daily")
    for daily_file in daily_path.glob("*.json"):
        date = daily_file.stem
        with open(daily_file) as f:
            data = json.load(f)
        handler.json.set(f"quantum:daily:{date}", "$", data)
        print(f"✅ Migrated daily/{date}.json")
    
    # Continue for other files...

if __name__ == "__main__":
    migrate_to_redis()
```

### 5. Performance Comparison

| Operation | JSON Files | Redis | Improvement |
|-----------|------------|-------|-------------|
| Read Status | 5-10ms | 0.1ms | 50-100x |
| Write Status | 10-20ms | 0.2ms | 50-100x |
| Concurrent Access | Race Conditions | Atomic | ∞ |
| Real-time Updates | Polling | Pub/Sub | Instant |
| Data Integrity | Corruptions | ACID | 100% |

### 6. Monitoring & Debugging

```bash
# Monitor all Redis commands in real-time
redis-cli monitor

# Check memory usage
redis-cli info memory

# View all quantum keys
redis-cli --scan --pattern "quantum:*"

# Subscribe to updates
redis-cli subscribe "quantum:updates"
```

### 7. Backup Strategy

```bash
# Automated daily backups
0 3 * * * redis-cli BGSAVE && cp /var/lib/redis/dump.rdb /backup/redis/dump-$(date +\%Y\%m\%d).rdb
```

## Benefits for Your Quantum Memory System

1. **No More Race Conditions**: Atomic operations guarantee data integrity
2. **Real-time Dashboard**: WebSocket server gets instant updates via pub/sub
3. **Better Performance**: In-memory operations are blazing fast
4. **Scalability**: Can handle 100,000+ ops/sec
5. **Persistence**: Your memories are safe with RDB+AOF
6. **Simplicity**: Less code than file locking implementation

## Next Steps

1. Install Redis with RedisJSON
2. Create the Redis wrapper class
3. Migrate one service as proof of concept
4. Monitor performance improvements
5. Migrate remaining services
6. Add advanced features (streams, time series)

This will completely eliminate your race condition problems while making the system faster and more reliable!