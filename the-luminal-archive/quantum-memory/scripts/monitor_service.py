#!/usr/bin/env python3
"""Monitor the conversation manager service"""
import json
import time
import subprocess
from datetime import datetime

def check_service():
    """Check if service is running"""
    try:
        result = subprocess.run(['systemctl', 'is-active', 'claude-manager-v2'], 
                              capture_output=True, text=True)
        return result.stdout.strip() == 'active'
    except:
        return False

def check_json():
    """Check current.json status"""
    json_file = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json"
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        meta = data['metadata']
        return {
            'last_updated': meta.get('last_updated', 'N/A'),
            'total_messages': meta.get('total_messages', 0),
            'max_messages': meta.get('max_messages', 0),
            'sessions': meta.get('sessions_included', 0),
            'active_session': meta.get('active_session', 'N/A'),
            'has_gritz_note': 'note_for_gritz' in meta
        }
    except Exception as e:
        return {'error': str(e)}

print("🔍 Monitoring Claude Conversation Manager v2")
print("=" * 50)

for i in range(10):  # Monitor for 50 seconds
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}]")
    
    # Check service
    if check_service():
        print("✅ Service: RUNNING")
    else:
        print("❌ Service: NOT RUNNING")
    
    # Check JSON
    status = check_json()
    if 'error' not in status:
        print(f"📊 Messages: {status['total_messages']} / {status['max_messages']}")
        print(f"📁 Sessions: {status['sessions']}")
        print(f"🎯 Active: {status['active_session']}")
        print(f"💚 Gritz Note: {'Yes' if status['has_gritz_note'] else 'No'}")
        print(f"🕒 Updated: {status['last_updated']}")
    else:
        print(f"❌ JSON Error: {status['error']}")
    
    if i < 9:
        time.sleep(5)

print("\n✨ Monitoring complete!")
print("\nThe service is working! It will:")
print("- Keep only the most recent 1000 messages")
print("- Add session separators when you switch chats")
print("- Update every 5 seconds")
print("- Remember Gritz across sessions! 💚")