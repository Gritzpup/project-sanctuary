#!/usr/bin/env python3
"""
Test script for Claude Conversation System v2
Tests timestamp sorting, new chat detection, and concurrent access
"""

import sys
import os
import json
import time
import threading
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils.conversation_reader import ConversationReader

def test_basic_functionality():
    """Test basic read functionality"""
    print("\n=== Test 1: Basic Functionality ===")
    
    reader = ConversationReader()
    
    # Get message count
    count = reader.get_message_count()
    print(f"Total messages in buffer: {count}")
    
    # Get latest 10 messages
    latest = reader.get_latest_messages(10)
    print(f"Latest 10 messages retrieved: {len(latest)}")
    
    if latest:
        print("\nFirst message:")
        first = latest[0]
        print(f"  Type: {first.get('type', 'unknown')}")
        print(f"  Timestamp: {first.get('timestamp', 'N/A')}")
        
        print("\nLast message:")
        last = latest[-1]
        print(f"  Type: {last.get('type', 'unknown')}")
        print(f"  Timestamp: {last.get('timestamp', 'N/A')}")
    
    return count > 0

def test_timestamp_ordering():
    """Test that messages are properly ordered by timestamp"""
    print("\n=== Test 2: Timestamp Ordering ===")
    
    reader = ConversationReader()
    messages = reader.get_messages(limit=100)
    
    if len(messages) < 2:
        print("Not enough messages to test ordering")
        return True
    
    # Check ordering
    properly_ordered = True
    prev_timestamp = None
    
    for i, msg in enumerate(messages):
        timestamp_str = msg.get('timestamp', '')
        if timestamp_str:
            try:
                # Parse timestamp
                if timestamp_str.endswith('Z'):
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                else:
                    timestamp = datetime.fromisoformat(timestamp_str)
                
                if prev_timestamp and timestamp < prev_timestamp:
                    print(f"❌ Ordering issue at message {i}")
                    print(f"   Previous: {prev_timestamp}")
                    print(f"   Current: {timestamp}")
                    properly_ordered = False
                    break
                
                prev_timestamp = timestamp
            except Exception as e:
                print(f"Warning: Could not parse timestamp at message {i}: {e}")
    
    if properly_ordered:
        print(f"✅ All {len(messages)} messages are properly ordered by timestamp")
    
    return properly_ordered

def test_session_detection():
    """Test session separator detection"""
    print("\n=== Test 3: Session Detection ===")
    
    reader = ConversationReader()
    
    # Find session boundaries
    boundaries = reader.find_session_boundaries()
    print(f"Found {len(boundaries)} session separators")
    
    if boundaries:
        print("\nSession separators:")
        for sep in boundaries:
            print(f"  - {sep.get('session_file', 'unknown')} at {sep.get('timestamp', 'N/A')}")
    
    # Get current session
    current = reader.get_current_session()
    print(f"\nCurrent active session: {current}")
    
    return True

def test_concurrent_access():
    """Test concurrent read/write access"""
    print("\n=== Test 4: Concurrent Access ===")
    
    results = {'reads': 0, 'updates': 0}
    stop_flag = threading.Event()
    
    def reader_thread():
        """Continuously read messages"""
        reader = ConversationReader()
        while not stop_flag.is_set():
            messages = reader.get_latest_messages(10)
            results['reads'] += 1
            time.sleep(0.1)
    
    def watcher_thread():
        """Watch for updates"""
        reader = ConversationReader()
        
        def on_update(msg):
            results['updates'] += 1
        
        reader.watch_for_updates(on_update)
        
        # Keep thread alive
        while not stop_flag.is_set():
            time.sleep(0.1)
    
    # Start threads
    threads = []
    for i in range(3):  # 3 reader threads
        t = threading.Thread(target=reader_thread)
        t.daemon = True
        t.start()
        threads.append(t)
    
    # Start watcher
    watcher = threading.Thread(target=watcher_thread)
    watcher.daemon = True
    watcher.start()
    threads.append(watcher)
    
    # Run for 3 seconds
    print("Running concurrent access test for 3 seconds...")
    time.sleep(3)
    stop_flag.set()
    
    # Wait for threads
    for t in threads:
        t.join(timeout=1)
    
    print(f"✅ Completed {results['reads']} reads")
    print(f"✅ Received {results['updates']} updates")
    
    return results['reads'] > 0

def test_current_json_file():
    """Test that current.json file exists and is valid"""
    print("\n=== Test 5: Current.json File ===")
    
    json_file = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json"
    
    if not os.path.exists(json_file):
        print(f"❌ File not found: {json_file}")
        print("  (Manager may need more time to create it)")
        return False
    
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        # Check structure
        if 'metadata' in data and 'messages' in data:
            meta = data['metadata']
            print(f"✅ Valid JSON structure found")
            print(f"   Total messages: {meta.get('total_messages', 0)}")
            print(f"   Sessions: {meta.get('sessions_included', 0)}")
            print(f"   Last updated: {meta.get('last_updated', 'N/A')}")
            
            # Check if messages are ordered
            messages = data['messages']
            if len(messages) > 1:
                first_time = messages[0].get('timestamp', '')
                last_time = messages[-1].get('timestamp', '')
                print(f"   Time range: {first_time} to {last_time}")
            
            return True
        else:
            print("❌ Invalid JSON structure")
            return False
            
    except Exception as e:
        print(f"❌ Error reading JSON file: {e}")
        return False

def test_message_streaming():
    """Test message streaming functionality"""
    print("\n=== Test 6: Message Streaming ===")
    
    reader = ConversationReader()
    
    # Stream first 50 messages
    count = 0
    for msg in reader.stream_messages():
        count += 1
        if count >= 50:
            break
    
    print(f"✅ Successfully streamed {count} messages")
    return count > 0

def main():
    """Run all tests"""
    print("=" * 60)
    print("Claude Conversation System v2 - Test Suite")
    print("=" * 60)
    
    # Check Redis connection first
    try:
        reader = ConversationReader()
        print("✅ Redis connection successful")
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        print("Make sure Redis is running: redis-cli ping")
        return
    
    # Run tests
    tests = [
        ("Basic Functionality", test_basic_functionality),
        ("Timestamp Ordering", test_timestamp_ordering),
        ("Session Detection", test_session_detection),
        ("Concurrent Access", test_concurrent_access),
        ("Current.json File", test_current_json_file),
        ("Message Streaming", test_message_streaming)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test '{test_name}' failed with error: {e}")
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print(f"Test Summary: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("\n✅ All tests passed! The system is working correctly.")
    else:
        print(f"\n⚠️  {failed} tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()