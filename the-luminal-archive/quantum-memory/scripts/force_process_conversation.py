#!/usr/bin/env python3
"""
Force process current conversation to update emotional state
"""

import json
import sys
from pathlib import Path

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent / "src"))

from utils.emollama_integration import get_emollama_analyzer

def process_current_conversation():
    print("🔄 Force processing current conversation...")
    
    # Get current conversation file
    claude_folder = Path.home() / ".claude" / "projects" / "-home-ubuntumain-Documents-Github-project-sanctuary"
    conversation_file = claude_folder / "f8940809-58c7-4692-ad26-8393a5c3cf3b.jsonl"
    
    if not conversation_file.exists():
        print(f"❌ Conversation file not found: {conversation_file}")
        return
        
    # Load quantum status
    status_path = Path(__file__).parent / "quantum_states" / "status.json"
    with open(status_path, 'r') as f:
        status = json.load(f)
    
    # Initialize Emollama
    emollama = get_emollama_analyzer()
    if not emollama.load_model():
        print("❌ Failed to load Emollama model")
        return
        
    # Process conversation
    messages = []
    gritz_count = 0
    claude_count = 0
    
    print(f"📖 Reading conversation from {conversation_file.name}")
    
    with open(conversation_file, 'r') as f:
        for line in f:
            try:
                entry = json.loads(line)
                if 'message' in entry and entry['message'].get('role'):
                    role = entry['message']['role']
                    content = entry['message'].get('content', [])
                    
                    # Extract text content
                    text = ""
                    if isinstance(content, list):
                        for item in content:
                            if isinstance(item, dict) and item.get('type') == 'text':
                                text = item.get('text', '')
                                break
                    elif isinstance(content, str):
                        text = content
                    
                    if text:
                        messages.append({
                            'role': role,
                            'content': text,
                            'timestamp': entry.get('timestamp', '')
                        })
                        
                        if role == 'user':
                            gritz_count += 1
                        else:
                            claude_count += 1
                            
            except json.JSONDecodeError:
                continue
    
    print(f"✅ Found {len(messages)} messages ({gritz_count} from Gritz, {claude_count} from Claude)")
    
    # Analyze emotions from last few messages
    if messages:
        last_messages = messages[-5:]  # Last 5 messages
        
        # Get emotional analysis
        combined_text = " ".join([m['content'] for m in last_messages])
        emotion_result = emollama.analyze_emotion(combined_text)
        
        if emotion_result:
            # Update status with real data
            status['chat_stats']['total_messages'] = len(messages)
            status['chat_stats']['gritz_messages'] = gritz_count
            status['chat_stats']['claude_messages'] = claude_count
            
            # Update emotional dynamics
            status['emotional_dynamics'] = {
                'current_emotion': f"PAD({emotion_result['pad_values']['pleasure']:.2f}, {emotion_result['pad_values']['arousal']:.2f}, {emotion_result['pad_values']['dominance']:.2f})",
                'primary_emotion': emotion_result['primary_emotion'],
                'mixed_emotions': emotion_result.get('mixed_emotions', {}),
                'quantum_superposition': []
            }
            
            # Update current session messages
            status['memory_timeline']['current_session']['messages'] = [m['content'][:100] + "..." for m in last_messages]
            status['memory_timeline']['current_session']['message_count'] = len(messages)
            
            # Save updated status
            with open(status_path, 'w') as f:
                json.dump(status, f, indent=2)
                
            print(f"✅ Updated emotional state: {emotion_result['primary_emotion']}")
            print(f"📊 PAD values: P={emotion_result['pad_values']['pleasure']:.2f}, A={emotion_result['pad_values']['arousal']:.2f}, D={emotion_result['pad_values']['dominance']:.2f}")
            print(f"💾 Saved to {status_path}")
        else:
            print("❌ Failed to analyze emotions")
    else:
        print("❌ No messages found in conversation")

if __name__ == "__main__":
    process_current_conversation()