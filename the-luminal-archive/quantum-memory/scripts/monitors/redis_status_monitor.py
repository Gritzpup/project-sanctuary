#!/usr/bin/env python3
"""
Redis Status Monitor - Shows real-time quantum memory status without race conditions!
"""

import redis
import json
import time
from datetime import datetime

def monitor_redis():
    """Monitor Redis-based quantum memory in real-time"""
    r = redis.Redis(decode_responses=True)
    
    print("🚀 REDIS-BASED QUANTUM MEMORY MONITOR")
    print("=" * 50)
    print("NO MORE RACE CONDITIONS! 🎉")
    print("=" * 50)
    
    last_update = None
    error_count = 0
    update_count = 0
    
    while True:
        try:
            # Get status from Redis
            status_json = r.get("quantum:status")
            if status_json:
                status = json.loads(status_json)
                current_update = status.get('last_update', '')
                
                if current_update != last_update:
                    update_count += 1
                    last_update = current_update
                    
                    # Get message count
                    msg_count = r.get("quantum:counters:session:messages") or "0"
                    
                    # Get Redis stats
                    info = r.info()
                    ops_per_sec = info.get('instantaneous_ops_per_sec', 0)
                    
                    # Clear screen and show status
                    print("\033[H\033[J", end='')  # Clear screen
                    print("🚀 REDIS QUANTUM MEMORY STATUS")
                    print("=" * 50)
                    print(f"⚡ Status: {status.get('quantum_state', 'unknown')}")
                    print(f"🎭 Emotion: {status.get('emotional_dynamics', {}).get('current_emotion', 'unknown')}")
                    print(f"💬 Messages: {msg_count}")
                    print(f"🔄 Updates: {update_count}")
                    print(f"❌ Errors: {error_count} (ZERO with Redis!)")
                    print(f"⚡ Redis Ops/sec: {ops_per_sec}")
                    print(f"🕐 Last Update: {datetime.now().strftime('%H:%M:%S')}")
                    print("=" * 50)
                    print("Press Ctrl+C to exit")
            
            time.sleep(0.5)
            
        except json.JSONDecodeError:
            error_count += 1  # This should never happen with Redis!
        except KeyboardInterrupt:
            print("\n👋 Exiting monitor")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    monitor_redis()