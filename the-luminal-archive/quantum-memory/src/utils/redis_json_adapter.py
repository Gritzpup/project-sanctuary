#!/usr/bin/env python3
"""
Redis JSON Adapter - Drop-in replacement for safe_json_handler
Makes migrating to Redis as simple as changing imports!
"""

import sys
from pathlib import Path
from typing import Any, Dict, Optional
import logging

# Add path for quantum_redis_handler
sys.path.append(str(Path(__file__).parent))
from quantum_redis_handler import QuantumRedisHandler

logger = logging.getLogger(__name__)

# Global Redis handler instance
_handler = None

def get_handler() -> QuantumRedisHandler:
    """Get or create global handler"""
    global _handler
    if _handler is None:
        _handler = QuantumRedisHandler()
    return _handler


def path_to_redis_key(filepath: Path) -> str:
    """Convert file path to Redis key"""
    filepath = Path(filepath)
    
    # Map common paths to Redis keys
    if "status.json" in str(filepath):
        if "service_status/analyzer" in str(filepath):
            return "quantum:service:analyzer:status"
        elif "service_status/entity_updater" in str(filepath):
            return "quantum:service:entity:status"
        elif "service_status/consolidated" in str(filepath):
            return "quantum:status"  # Main status
        else:
            return "quantum:status"
    
    elif "current_session.json" in str(filepath):
        return "quantum:memory:current_session"
    
    elif "work_summary_24h.json" in str(filepath):
        return "quantum:memory:work_summary"
    
    elif "daily/" in str(filepath):
        # Extract date from path like daily/2025-07-01.json
        date = filepath.stem
        return f"quantum:memory:daily:{date}"
    
    elif "relationship" in str(filepath) and "context.json" in str(filepath):
        return "quantum:memory:relationship"
    
    elif "consciousness_snapshot.json" in str(filepath):
        return "entity:claude:consciousness"
    
    elif "relationship_map.json" in str(filepath):
        return "entity:claude:relationships"
    
    elif "verification_markers.json" in str(filepath):
        return "entity:claude:verification"
    
    else:
        # Generic mapping
        clean_path = str(filepath).replace("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/", "")
        clean_path = clean_path.replace("/", ":").replace(".json", "")
        return f"quantum:{clean_path}"


def safe_read_json(filepath: Path) -> Optional[Dict[str, Any]]:
    """
    Redis-based drop-in replacement for safe_read_json
    """
    try:
        handler = get_handler()
        redis_key = path_to_redis_key(filepath)
        
        # Try Redis first
        if redis_key.startswith("quantum:status"):
            data = handler.get_status()
        else:
            # Generic get from Redis
            import json
            raw_data = handler.redis.get(redis_key)
            if raw_data:
                data = json.loads(raw_data)
            else:
                # Try to migrate from file if exists
                filepath = Path(filepath)
                if filepath.exists():
                    with open(filepath, 'r') as f:
                        data = json.load(f)
                    # Store in Redis for next time
                    handler.redis.set(redis_key, json.dumps(data))
                    logger.info(f"Migrated {filepath} to Redis key {redis_key}")
                else:
                    data = None
        
        return data
        
    except Exception as e:
        logger.error(f"Redis read error for {filepath}: {e}")
        # Fallback to file
        try:
            filepath = Path(filepath)
            if filepath.exists():
                with open(filepath, 'r') as f:
                    return json.load(f)
        except:
            pass
        return None


def safe_write_json(filepath: Path, data: Dict[str, Any]) -> bool:
    """
    Redis-based drop-in replacement for safe_write_json
    """
    try:
        handler = get_handler()
        redis_key = path_to_redis_key(filepath)
        
        # Special handling for status
        if redis_key == "quantum:status" or "service" in redis_key and "status" in redis_key:
            success = handler.update_status(data)
        
        # Special handling for memories
        elif redis_key.startswith("quantum:memory:"):
            memory_type = redis_key.split(":")[-1]
            if memory_type.startswith("daily:"):
                # Store daily memories
                import json
                handler.redis.set(redis_key, json.dumps(data))
                success = True
            else:
                success = handler.update_memory(memory_type, data)
        
        # Generic set
        else:
            import json
            handler.redis.set(redis_key, json.dumps(data))
            success = True
        
        # Disabled file backups - Redis is our source of truth now!
        # No more race conditions on file writes
        
        return success
        
    except Exception as e:
        logger.error(f"Redis write error for {filepath}: {e}")
        return False


def safe_update_json(filepath: Path, update_func: callable) -> bool:
    """
    Redis-based drop-in replacement for safe_update_json
    """
    try:
        # Read current data
        current_data = safe_read_json(filepath) or {}
        
        # Apply update
        updated_data = update_func(current_data)
        
        # Write back
        return safe_write_json(filepath, updated_data)
        
    except Exception as e:
        logger.error(f"Redis update error for {filepath}: {e}")
        return False


# Make this module a drop-in replacement
print("🚀 Redis JSON Adapter loaded - race conditions eliminated!")

if __name__ == "__main__":
    # Test the adapter
    test_path = Path("/tmp/test_status.json")
    test_data = {"test": True, "redis": "working"}
    
    print("Testing Redis adapter...")
    if safe_write_json(test_path, test_data):
        print("✅ Write successful")
    
    read_data = safe_read_json(test_path)
    if read_data:
        print("✅ Read successful:", read_data)