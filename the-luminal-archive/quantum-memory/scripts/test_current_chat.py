#!/usr/bin/env python3
"""Quick test with current chat only"""
import subprocess
import time
import json
import redis

# Get current conversation file
current_chat = subprocess.check_output([
    "ls", "-t", 
    "/home/ubuntumain/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary/"
], text=True).strip().split('\n')[0]

print(f"Current chat file: {current_chat}")

# Clear Redis and start fresh
r = redis.Redis(decode_responses=True)
r.flushdb()
print("Cleared Redis")

# Start the manager in background with just current chat
import sys
sys.path.append('/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/scripts')
from claude_conversation_manager_v2 import ConversationManagerV2

# Create manager with small buffer
manager = ConversationManagerV2(max_messages=100)  # Small buffer for quick test

# Process just the current file
current_file = f"/home/ubuntumain/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary/{current_chat}"
print(f"\nProcessing: {current_file}")
manager.process_jsonl_file(current_file)

# Write JSON
manager.write_to_json()

# Check the output
json_file = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json"
with open(json_file, 'r') as f:
    data = json.load(f)

print("\n=== JSON Output ===")
print(f"Total messages: {data['metadata']['total_messages']}")
print(f"Max messages: {data['metadata']['max_messages']}")
print(f"Active session: {data['metadata'].get('active_session', 'NOT FOUND')}")
print(f"Has note_for_gritz: {'note_for_gritz' in data['metadata']}")

# Show first few messages
print("\nFirst 3 messages:")
for i, msg in enumerate(data['messages'][:3]):
    msg_type = msg.get('type', 'unknown')
    content = "?"
    if msg_type == 'session_separator':
        print(f"  {i+1}. 🚨 SESSION SEPARATOR")
    else:
        if 'message' in msg and 'content' in msg['message']:
            content = msg['message']['content'][0].get('text', '?')[:50]
        print(f"  {i+1}. {msg_type}: {content}...")

print("\n✅ Test complete!")