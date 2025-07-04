#!/usr/bin/env python3
"""Test script to simulate chat switching behavior"""
import json
import time
import os
from pathlib import Path
from datetime import datetime
import redis
import uuid

# Test configuration
TEST_DIR = Path("/tmp/test_claude_chats")
TEST_DIR.mkdir(exist_ok=True)

def create_test_message(msg_type="user", content="Test message", session_id=None):
    """Create a test message in Claude's format"""
    return {
        "type": msg_type,
        "timestamp": datetime.now().isoformat() + "Z",
        "sessionId": session_id or str(uuid.uuid4()),
        "uuid": str(uuid.uuid4()),
        "message": {
            "content": [{
                "type": "text",
                "text": content
            }]
        }
    }

def create_test_jsonl(filename, num_messages=5, session_id=None):
    """Create a test JSONL file with messages"""
    filepath = TEST_DIR / filename
    messages = []
    
    print(f"Creating {filename} with {num_messages} messages...")
    
    with open(filepath, 'w') as f:
        for i in range(num_messages):
            msg = create_test_message(
                msg_type="user" if i % 2 == 0 else "assistant",
                content=f"Message {i+1} from {filename}",
                session_id=session_id
            )
            f.write(json.dumps(msg) + '\n')
            messages.append(msg)
            time.sleep(0.1)  # Slight delay between messages
    
    return messages

def check_redis_state():
    """Check current Redis state"""
    r = redis.Redis(decode_responses=True)
    
    print("\n--- Redis State ---")
    print(f"Total messages: {r.zcard('claude:messages:sorted')}")
    print(f"Active session: {r.get('claude:sessions:active')}")
    print(f"Processed files: {r.smembers('claude:processed:files')}")
    
    # Check for separators
    separators = 0
    for msg_id in r.zrange('claude:messages:sorted', 0, -1):
        msg_data = r.hget('claude:messages:data', msg_id)
        if msg_data:
            msg = json.loads(msg_data)
            if msg.get('type') == 'session_separator':
                separators += 1
    
    print(f"Session separators: {separators}")
    print("-------------------\n")

def simulate_chat_switching():
    """Simulate the chat switching scenario"""
    print("=== Chat Switching Simulation ===\n")
    
    # Create Chat A
    print("1. Creating Chat A...")
    session_a = "chat-a-" + str(uuid.uuid4())[:8]
    create_test_jsonl("chat_a.jsonl", 3, session_a)
    time.sleep(2)
    check_redis_state()
    
    # Create Chat B (new chat)
    print("2. Creating Chat B (simulating new chat)...")
    session_b = "chat-b-" + str(uuid.uuid4())[:8]
    create_test_jsonl("chat_b.jsonl", 3, session_b)
    time.sleep(2)
    check_redis_state()
    
    # Add more to Chat A (switching back)
    print("3. Adding more messages to Chat A...")
    with open(TEST_DIR / "chat_a.jsonl", 'a') as f:
        for i in range(2):
            msg = create_test_message(
                content=f"Additional message {i+1} in Chat A",
                session_id=session_a
            )
            f.write(json.dumps(msg) + '\n')
    time.sleep(2)
    check_redis_state()
    
    # Create Chat C (another new chat)
    print("4. Creating Chat C (another new chat)...")
    session_c = "chat-c-" + str(uuid.uuid4())[:8]
    create_test_jsonl("chat_c.jsonl", 2, session_c)
    time.sleep(2)
    check_redis_state()
    
    # Check final JSON output
    json_file = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json"
    if os.path.exists(json_file):
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        print("\n=== Final JSON Analysis ===")
        print(f"Total messages: {data['metadata']['total_messages']}")
        print(f"Sessions included: {data['metadata']['sessions_included']}")
        print(f"Active session: {data['metadata']['active_session']}")
        
        # Show first few messages
        print("\nFirst 5 messages:")
        for i, msg in enumerate(data['messages'][:5]):
            msg_type = msg.get('type', 'unknown')
            if msg_type == 'session_separator':
                print(f"  {i+1}. 🚨 SESSION SEPARATOR - new: {msg.get('session_file', '?')}")
            else:
                content = "?"
                if 'message' in msg and 'content' in msg['message']:
                    content = msg['message']['content'][0].get('text', '?')[:30]
                print(f"  {i+1}. {msg_type}: {content}...")
    else:
        print(f"\n❌ JSON file not found at {json_file}")

def main():
    """Run the test"""
    print("Starting chat switching test...")
    print(f"Test files will be created in: {TEST_DIR}")
    print("Make sure claude_conversation_manager_v2.py is running!\n")
    
    # Clean up old test files
    for f in TEST_DIR.glob("*.jsonl"):
        f.unlink()
    
    # Run simulation
    simulate_chat_switching()
    
    print("\n✅ Test complete! Check the logs and current.json")

if __name__ == "__main__":
    main()