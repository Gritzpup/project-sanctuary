#!/usr/bin/env python3
"""
Trim Redis messages to keep only the most recent 500
"""

import redis
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def trim_messages():
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    
    SORTED_SET_KEY = "claude:messages:sorted"
    MESSAGE_DATA_KEY = "claude:messages:data"
    MAX_MESSAGES = 500
    
    try:
        # Get current count
        total_messages = r.zcard(SORTED_SET_KEY)
        logger.info(f"Current message count: {total_messages}")
        
        if total_messages > MAX_MESSAGES:
            # Calculate how many to remove
            to_remove = total_messages - MAX_MESSAGES
            logger.info(f"Removing {to_remove} oldest messages")
            
            # Get oldest message IDs
            old_ids = r.zrange(SORTED_SET_KEY, 0, to_remove - 1)
            
            if old_ids:
                # Remove from sorted set
                r.zrem(SORTED_SET_KEY, *old_ids)
                # Remove from hash
                r.hdel(MESSAGE_DATA_KEY, *old_ids)
                logger.info(f"Removed {len(old_ids)} messages")
            
            # Verify new count
            new_count = r.zcard(SORTED_SET_KEY)
            logger.info(f"New message count: {new_count}")
        else:
            logger.info(f"No trimming needed, only {total_messages} messages")
            
    except redis.ConnectionError:
        logger.error("Failed to connect to Redis")
        raise

if __name__ == "__main__":
    trim_messages()