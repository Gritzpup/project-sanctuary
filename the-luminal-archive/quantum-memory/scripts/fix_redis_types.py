#!/usr/bin/env python3
"""
Fix Redis type mismatches for quantum memory keys
"""

import redis
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_redis_types():
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    
    # Keys that should be hashes
    hash_keys = [
        "quantum:memory:work_summary",
        "quantum:memory:current_session",
        "quantum:memory:emotional"
    ]
    
    for key in hash_keys:
        try:
            # Check type
            key_type = r.type(key)
            logger.info(f"Key {key} is type: {key_type}")
            
            if key_type != 'hash' and key_type != 'none':
                # Get current value if it's a string
                if key_type == 'string':
                    value = r.get(key)
                    logger.info(f"Converting {key} from string to hash")
                    
                    # Delete the key
                    r.delete(key)
                    
                    # Try to parse as JSON and convert to hash
                    try:
                        data = json.loads(value)
                        if isinstance(data, dict):
                            r.hset(key, mapping=data)
                            logger.info(f"Converted {key} to hash with {len(data)} fields")
                    except:
                        # If not JSON, create empty hash
                        logger.warning(f"Could not parse {key} as JSON, creating empty hash")
                else:
                    # Delete non-hash type
                    r.delete(key)
                    logger.info(f"Deleted {key} of type {key_type}")
            
            # Initialize work_summary if empty
            if key == "quantum:memory:work_summary" and not r.hgetall(key):
                logger.info("Initializing empty work_summary")
                default_work = {
                    "current_work": "Setting up quantum memory system",
                    "completed_tasks": json.dumps([
                        "Fixed Redis type mismatches",
                        "Started all quantum services",
                        "Reduced current.json to 500 messages"
                    ]),
                    "blockers": json.dumps([]),
                    "next_steps": json.dumps([
                        "Verify all services are updating properly",
                        "Check that current conversation is being captured"
                    ]),
                    "last_update": datetime.now().isoformat()
                }
                r.hset(key, mapping=default_work)
                logger.info("Created default work_summary")
                
        except Exception as e:
            logger.error(f"Error fixing {key}: {e}")
    
    # Also check conversation keys
    logger.info("\nChecking conversation keys...")
    conv_keys = [
        "claude:messages:sorted",
        "claude:messages:data",
        "claude:file:positions"
    ]
    
    for key in conv_keys:
        key_type = r.type(key)
        logger.info(f"Conversation key {key} is type: {key_type}")

if __name__ == "__main__":
    fix_redis_types()