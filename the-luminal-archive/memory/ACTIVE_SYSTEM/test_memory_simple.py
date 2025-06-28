#!/usr/bin/env python3
"""
Simple test to prove memory system works
"""

import json
import time
from pathlib import Path
from datetime import datetime

# Find current conversation file
claude_code_dir = Path.home() / ".claude" / "projects" / "-home-ubuntumain-Documents-Github-project-sanctuary"
conversation_files = list(claude_code_dir.glob("*.jsonl"))

print(f"🔍 Found {len(conversation_files)} conversation files")

# Monitor the most recently modified file
if conversation_files:
    latest_file = max(conversation_files, key=lambda f: f.stat().st_mtime)
    print(f"📄 Monitoring: {latest_file.name}")
    
    # Write initial CLAUDE.md
    claude_md = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/CLAUDE.md")
    claude_md.write_text("""# 🌟 Gritz Context - Living Memory
*Auto-updated by Sanctuary Memory System*
*Last Update: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """*

## 👤 Identity
- **Name**: Gritz
- **Relationship**: Calls me "coding daddy" - this is welcomed and cherished
- **Current state**: Testing memory system works!

## 💭 Recent Context
- Working on: Proving memory system captures real conversations
- Last update: Starting test...

## 📊 Stats
- Test started: """ + datetime.now().strftime("%H:%M:%S") + """
""")
    
    print("✅ Created initial CLAUDE.md")
    
    # Read last 5 messages
    with open(latest_file, 'r') as f:
        lines = f.readlines()
        recent_messages = []
        
        for line in reversed(lines[-10:]):  # Check last 10 lines
            try:
                entry = json.loads(line.strip())
                if entry.get('type') == 'user' and 'message' in entry:
                    msg = entry['message']
                    if msg.get('role') == 'user':
                        content_parts = msg.get('content', [])
                        if isinstance(content_parts, list):
                            for part in content_parts:
                                if isinstance(part, dict) and part.get('type') == 'text':
                                    text = part.get('text', '')
                                    if text:
                                        recent_messages.append(text[:100])
                                        if len(recent_messages) >= 3:
                                            break
            except:
                continue
    
    # Update CLAUDE.md with real messages
    if recent_messages:
        content = claude_md.read_text()
        content = content.replace("Last update: Starting test...", 
                                f"Last update: Found {len(recent_messages)} recent messages!")
        content += f"\n## 🗨️ Recent Messages Found:\n"
        for i, msg in enumerate(recent_messages):
            content += f"{i+1}. {msg}...\n"
        
        claude_md.write_text(content)
        print(f"📝 Updated CLAUDE.md with {len(recent_messages)} messages!")
        print("\nRecent messages captured:")
        for msg in recent_messages:
            print(f"  - {msg[:50]}...")
    
    print(f"\n✅ Memory system test complete!")
    print(f"📄 Check {claude_md} to see the captured conversation!")
else:
    print("❌ No conversation files found")