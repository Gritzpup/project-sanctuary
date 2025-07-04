#!/usr/bin/env python3
"""
Force process the current conversation for memory updates
Useful for testing and manual memory consolidation
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from utils.emollama_integration import get_emollama_analyzer

def find_latest_conversation():
    """Find the most recent conversation file"""
    claude_projects = Path.home() / ".claude" / "projects"
    
    # Find all .jsonl files
    jsonl_files = []
    for project_dir in claude_projects.glob("*"):
        for jsonl_file in project_dir.glob("*.jsonl"):
            jsonl_files.append(jsonl_file)
    
    if not jsonl_files:
        print("❌ No conversation files found")
        return None
    
    # Get the most recent one
    latest = max(jsonl_files, key=lambda f: f.stat().st_mtime)
    return latest

def extract_messages(file_path, last_n=20):
    """Extract last N messages from conversation file"""
    messages = []
    
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    for line in lines[-last_n:]:
        try:
            data = json.loads(line.strip())
            # Look for message inside the data
            msg = data.get('message', {})
            if msg.get('type') == 'message' and msg.get('content'):
                content = msg['content']
                if isinstance(content, list) and content:
                    # Handle structured content
                    text = content[0].get('text', '') if isinstance(content[0], dict) else str(content[0])
                else:
                    text = str(content)
                if text:
                    messages.append(text)
        except:
            pass
    
    return messages

def update_memory_files(analysis, messages):
    """Update memory files with analysis results"""
    quantum_base = Path(__file__).parent.parent
    memories_path = quantum_base / "quantum_states" / "memories"
    
    # Update current session
    session_file = memories_path / "current_session.json"
    if session_file.exists():
        with open(session_file, 'r') as f:
            session_data = json.load(f)
    else:
        session_data = {
            "session_id": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "started": datetime.now().isoformat()
        }
    
    # Update session data
    session_data["last_update"] = datetime.now().isoformat()
    session_data["message_count"] = session_data.get("message_count", 0) + len(messages)
    session_data["current_emotion"] = analysis["emotions"]["primary_emotion"]
    session_data["topics"] = list(set(session_data.get("topics", []) + analysis["topics"]))[-5:]
    session_data["recent_context"] = analysis["context_for_next_chat"]
    session_data["gritz_state"] = analysis["gritz_state"]
    session_data["claude_state"] = analysis["claude_state"]
    
    if analysis["decisions"]:
        session_data["decisions_made"] = session_data.get("decisions_made", []) + analysis["decisions"]
    
    with open(session_file, 'w') as f:
        json.dump(session_data, f, indent=2)
    
    print(f"✅ Updated session memory")
    
    # Update daily summary
    today = datetime.now().strftime("%Y-%m-%d")
    daily_file = memories_path / "daily" / f"{today}.json"
    daily_file.parent.mkdir(exist_ok=True)
    
    if daily_file.exists():
        with open(daily_file, 'r') as f:
            daily_data = json.load(f)
    else:
        daily_data = {
            "date": today,
            "sessions": 0,
            "total_messages": 0,
            "emotional_journey": [],
            "accomplishments": [],
            "relationship_moments": [],
            "technical_progress": {"completed": [], "in_progress": [], "planned": []}
        }
    
    # Add to emotional journey
    daily_data["emotional_journey"].append({
        "time": datetime.now().strftime("%H:%M"),
        "emotion": analysis["emotions"]["primary_emotion"],
        "context": analysis["context_for_next_chat"][:50]
    })
    
    # Add other updates
    daily_data["total_messages"] += len(messages)
    if analysis["relationship_moments"]:
        daily_data["relationship_moments"].extend(analysis["relationship_moments"])
    if analysis["technical_progress"]:
        daily_data["technical_progress"]["completed"].extend(analysis["technical_progress"])
    
    with open(daily_file, 'w') as f:
        json.dump(daily_data, f, indent=2)
    
    print(f"✅ Updated daily summary")

def main():
    print("🔄 Force Processing Current Conversation")
    print("=" * 50)
    
    # Find latest conversation
    conv_file = find_latest_conversation()
    if not conv_file:
        return
    
    print(f"\n📄 Found conversation: {conv_file.name}")
    print(f"   Modified: {datetime.fromtimestamp(conv_file.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Extract messages
    messages = extract_messages(conv_file)
    print(f"\n📝 Extracted {len(messages)} messages")
    
    if not messages:
        print("❌ No messages found to process")
        return
    
    # Show sample
    print("\n📋 Last 3 messages:")
    for msg in messages[-3:]:
        print(f"   • {msg[:80]}...")
    
    # Analyze with Emollama
    print("\n🧠 Analyzing with Emollama...")
    analyzer = get_emollama_analyzer()
    analysis = analyzer.analyze_for_memories(messages)
    
    # Show analysis
    print("\n📊 Analysis Results:")
    print(f"   Emotion: {analysis['emotions']['primary_emotion']}")
    print(f"   Topics: {', '.join(analysis['topics'])}")
    print(f"   Context: {analysis['context_for_next_chat']}")
    if analysis['relationship_moments']:
        print(f"   Moments: {', '.join(analysis['relationship_moments'])}")
    
    # Update memory files
    print("\n💾 Updating memory files...")
    update_memory_files(analysis, messages)
    
    print("\n✨ Memory update complete!")
    print("\n💡 View updated memories with: ./view_memories.sh")

if __name__ == "__main__":
    main()