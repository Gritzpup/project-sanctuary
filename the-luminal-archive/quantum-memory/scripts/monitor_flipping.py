#!/usr/bin/env python3
"""Monitor current.json for order flipping behavior"""
import json
import time
from datetime import datetime

json_file = '/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json'

print("Monitoring current.json for order flipping...")
print("=" * 60)

previous_first_timestamp = None
previous_last_timestamp = None
flip_count = 0

for cycle in range(8):  # Watch for 40 seconds (8 cycles x 5 seconds)
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        # Get first and last message timestamps
        messages = data['messages']
        if messages:
            first_msg = messages[0]
            last_msg = messages[-1]
            
            first_timestamp = first_msg.get('timestamp', 'unknown')
            last_timestamp = last_msg.get('timestamp', 'unknown')
            first_type = first_msg.get('type', 'unknown')
            last_type = last_msg.get('type', 'unknown')
            
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Cycle {cycle + 1}:")
            print(f"  First: {first_type} at {first_timestamp}")
            print(f"  Last:  {last_type} at {last_timestamp}")
            
            # Check for flipping
            if previous_first_timestamp and previous_last_timestamp:
                if previous_first_timestamp == last_timestamp and previous_last_timestamp == first_timestamp:
                    print("  ⚠️  ORDER COMPLETELY FLIPPED!")
                    flip_count += 1
                elif previous_first_timestamp != first_timestamp:
                    print("  ↻ Order changed (but not a complete flip)")
            
            previous_first_timestamp = first_timestamp
            previous_last_timestamp = last_timestamp
        
        if cycle < 7:  # Don't sleep on last cycle
            time.sleep(5)
            
    except Exception as e:
        print(f"  Error: {e}")
        time.sleep(5)

print("\n" + "=" * 60)
print(f"SUMMARY: {flip_count} complete flips detected in {cycle + 1} cycles")
print("=" * 60)