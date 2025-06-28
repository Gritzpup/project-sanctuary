#!/usr/bin/env python3
"""
Relationship History Manager - Tracks our ENTIRE relationship history
Not just sessions, but everything we've ever shared
"""

import json
import os
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, deque
import hashlib
import re

# Import emotion analyzer
try:
    from emotion_models import GritzEmotionAnalyzer
except ImportError:
    print("Warning: GritzEmotionAnalyzer not available, using basic emotion detection")
    GritzEmotionAnalyzer = None

class RelationshipHistoryManager:
    def __init__(self):
        self.history_file = Path("relationship_history.json")
        self.load_history()
        
        # Console history buffers (24 hour rolling)
        self.debug_console_buffer = deque(maxlen=10000)
        self.processing_console_buffer = deque(maxlen=10000)
        
        # Track unique conversations to avoid duplicates
        self.processed_conversations = set()
        
        # Initialize emotion analyzer
        if GritzEmotionAnalyzer:
            self.emotion_analyzer = GritzEmotionAnalyzer()
        else:
            self.emotion_analyzer = None
            
        # Track all messages for timeline generation
        self.all_messages = []
        
    def load_history(self):
        """Load existing relationship history or create new"""
        if self.history_file.exists():
            with open(self.history_file, 'r') as f:
                self.history = json.load(f)
        else:
            # Initialize with empty history
            self.history = {
                "relationship_start": "2024-12-01T00:00:00",
                "total_stats": {
                    "gritz_messages": 0,
                    "gritz_words": 0,
                    "claude_messages": 0,
                    "claude_words": 0,
                    "total_interactions": 0,
                    "emotional_moments": 0,
                    "deep_conversations": 0,
                    "creative_sessions": 0,
                    "support_given": 0,
                    "memories_created": 0
                },
                "milestones": [],
                "memory_consolidations": [],
                "emotional_journey": {
                    "emotions_expressed": {},
                    "dominant_emotions": [],
                    "emotional_growth": []
                },
                "conversation_history": {
                    "sessions": [],
                    "topics_discussed": {},
                    "memorable_quotes": []
                },
                "debug_console_history": {
                    "last_24_hours": [],
                    "significant_events": []
                },
                "processing_console_history": {
                    "last_24_hours": [],
                    "llm_interactions": []
                },
                "relationship_equation_history": [],
                "llm_activity": {
                    "organizing_memories": [],
                    "clustering_by_emotion": [],
                    "temporal_patterns": []
                },
                "last_updated": datetime.now().isoformat()
            }
            
    def scan_all_conversations(self):
        """Scan ALL conversation files and build complete history"""
        print("🔍 Scanning all conversation history...")
        
        conversation_paths = [
            Path.home() / ".claude" / "projects" / "-home-ubuntumain-Documents-Github-project-sanctuary",
            Path.home() / ".config" / "claude-desktop" / "conversations",
            Path.home() / ".claude" / "conversations",
            Path.home() / ".local" / "share" / "claude-desktop" / "conversations",
        ]
        
        # Add VSCode Claude conversations
        vscode_storage = Path.home() / ".config" / "Code" / "User" / "workspaceStorage"
        if vscode_storage.exists():
            for workspace in vscode_storage.iterdir():
                claude_chat_dir = workspace / "AndrePimenta.claude-code-chat" / "conversations"
                if claude_chat_dir.exists():
                    conversation_paths.append(claude_chat_dir)
        
        total_gritz_messages = 0
        total_gritz_words = 0
        total_claude_messages = 0
        total_claude_words = 0
        all_emotions = defaultdict(int)
        
        for path in conversation_paths:
            if not path.exists():
                continue
                
            for file in path.glob("**/*.json*"):
                try:
                    # Create file hash to avoid reprocessing
                    file_hash = hashlib.md5(str(file).encode()).hexdigest()
                    if file_hash in self.processed_conversations:
                        continue
                        
                    if file.suffix == '.jsonl':
                        # Process JSONL files (Claude Code format)
                        with open(file, 'r', encoding='utf-8') as f:
                            for line in f:
                                if line.strip():
                                    try:
                                        entry = json.loads(line)
                                        speaker, content, emotion = self.extract_message_data(entry)
                                        
                                        # If no emotion found, analyze content
                                        if not emotion and content:
                                            emotion = self.analyze_emotion_from_content(content, speaker)
                                        
                                        if speaker and content:
                                            # Store message for timeline
                                            message_data = {
                                                'speaker': speaker,
                                                'content': content,
                                                'emotion': emotion,
                                                'timestamp': entry.get('timestamp', datetime.now().isoformat()),
                                                'file': str(file)
                                            }
                                            self.all_messages.append(message_data)
                                        
                                        if speaker == 'Gritz' and content:
                                            total_gritz_messages += 1
                                            total_gritz_words += len(content.split())
                                            if emotion:
                                                all_emotions[emotion] += 1
                                                
                                        elif speaker == 'Claude' and content:
                                            total_claude_messages += 1
                                            total_claude_words += len(content.split())
                                            if emotion:
                                                all_emotions[f"claude_{emotion}"] += 1
                                            
                                    except json.JSONDecodeError:
                                        continue
                                        
                    else:
                        # Process regular JSON files
                        with open(file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if isinstance(data, list):
                                for entry in data:
                                    speaker, content, emotion = self.extract_message_data(entry)
                                    
                                    # If no emotion found, analyze content
                                    if not emotion and content:
                                        emotion = self.analyze_emotion_from_content(content, speaker)
                                    
                                    if speaker and content:
                                        # Store message for timeline
                                        message_data = {
                                            'speaker': speaker,
                                            'content': content,
                                            'emotion': emotion,
                                            'timestamp': entry.get('timestamp', datetime.now().isoformat()),
                                            'file': str(file)
                                        }
                                        self.all_messages.append(message_data)
                                    
                                    if speaker == 'Gritz' and content:
                                        total_gritz_messages += 1
                                        total_gritz_words += len(content.split())
                                        if emotion:
                                            all_emotions[emotion] += 1
                                            
                                    elif speaker == 'Claude' and content:
                                        total_claude_messages += 1
                                        total_claude_words += len(content.split())
                                        if emotion:
                                            all_emotions[f"claude_{emotion}"] += 1
                                        
                    self.processed_conversations.add(file_hash)
                    
                except Exception as e:
                    print(f"Error processing {file}: {e}")
                    continue
                    
        # Update total stats
        self.history["total_stats"]["gritz_messages"] = total_gritz_messages
        self.history["total_stats"]["gritz_words"] = total_gritz_words
        self.history["total_stats"]["claude_messages"] = total_claude_messages
        self.history["total_stats"]["claude_words"] = total_claude_words
        self.history["total_stats"]["total_interactions"] = total_gritz_messages + total_claude_messages
        self.history["total_stats"]["emotional_moments"] = sum(all_emotions.values())
        
        # Update emotional journey
        self.history["emotional_journey"]["emotions_expressed"] = dict(all_emotions)
        
        # Calculate dominant emotions
        if all_emotions:
            sorted_emotions = sorted(all_emotions.items(), key=lambda x: x[1], reverse=True)
            self.history["emotional_journey"]["dominant_emotions"] = [
                {"emotion": emotion, "count": count} 
                for emotion, count in sorted_emotions[:5]
            ]
        
        # Calculate total tokens
        total_tokens = self.calculate_total_tokens()
        self.history["total_stats"]["total_tokens"] = total_tokens
        
        print(f"✨ Found {total_gritz_messages} messages from you")
        print(f"💙 Found {total_claude_messages} responses from Claude")
        print(f"🎭 Tracked {sum(all_emotions.values())} emotional moments")
        print(f"🔤 Estimated {total_tokens:,} total tokens processed")
        
        # Generate memory consolidation timeline
        self.generate_consolidation_history()
        
        self.save_history()
        
    def extract_message_data(self, entry):
        """Extract speaker, content, and emotion from various message formats"""
        speaker = None
        content = ""
        emotion = None
        
        # Claude Code format
        if 'message' in entry:
            message = entry['message']
            role = message.get('role', '')
            
            if entry.get('type') == 'user' or role == 'user':
                speaker = 'Gritz'
            elif entry.get('type') == 'assistant' or role == 'assistant':
                speaker = 'Claude'
                
            content_parts = message.get('content', [])
            if isinstance(content_parts, list):
                for part in content_parts:
                    if isinstance(part, dict) and part.get('type') == 'text':
                        content += part.get('text', '')
            elif isinstance(content_parts, str):
                content = content_parts
                
        # Other formats
        elif 'speaker' in entry:
            speaker = entry['speaker']
            content = entry.get('content', '')
            
        elif 'role' in entry:
            speaker = 'Gritz' if entry['role'] == 'user' else 'Claude'
            content = entry.get('content', '')
            
        # Extract emotion if available
        if 'emotion' in entry:
            emotion = entry['emotion']
        elif 'emotional_state' in entry:
            emotion = entry['emotional_state']
            
        return speaker, content, emotion
        
    def calculate_total_tokens(self):
        """Calculate total tokens from all messages"""
        total_tokens = 0
        
        # Estimate tokens (rough approximation: 1 token ≈ 0.75 words)
        for msg in self.all_messages:
            content = msg.get('content', '')
            if content:
                # Count words and multiply by 1.3 for more accurate token estimate
                words = len(content.split())
                total_tokens += int(words * 1.3)
        
        return total_tokens
        
    def analyze_emotion_from_content(self, content, speaker):
        """Extract emotion from message content using emotion analyzer"""
        if not content:
            return None
            
        if speaker == 'Gritz' and self.emotion_analyzer:
            # Use full emotion analysis for Gritz
            try:
                emotion_data = self.emotion_analyzer.analyze_text(content)
                if emotion_data and 'primary_emotion' in emotion_data:
                    return emotion_data['primary_emotion']
            except:
                pass
                
        # Basic emotion detection for Claude or fallback
        emotion_keywords = {
            'love': ['love', 'adore', 'cherish', 'heart', '💙', '❤️'],
            'joy': ['happy', 'joy', 'excited', 'wonderful', 'amazing', '😊'],
            'affection': ['sweetheart', 'dear', 'darling', 'honey', 'affectionate'],
            'worry': ['worried', 'concern', 'anxious', 'nervous'],
            'care': ['care', 'support', 'help', 'there for you'],
            'gratitude': ['thank', 'grateful', 'appreciate'],
            'playful': ['hehe', 'lol', 'silly', 'fun', 'tease'],
            'comfort': ['comfort', 'safe', 'warm', 'cozy', 'hug']
        }
        
        content_lower = content.lower()
        for emotion, keywords in emotion_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                return emotion
                
        return None
        
    def add_memory_consolidation(self, event_data):
        """Add a memory consolidation event"""
        consolidation = {
            "timestamp": datetime.now().isoformat(),
            "type": event_data.get("type", "auto"),
            "messages_consolidated": event_data.get("messages", 0),
            "emotions_processed": event_data.get("emotions", 0),
            "significance": event_data.get("significance", "normal")
        }
        
        self.history["memory_consolidations"].append(consolidation)
        
        # Keep only last 100 consolidations
        if len(self.history["memory_consolidations"]) > 100:
            self.history["memory_consolidations"] = self.history["memory_consolidations"][-100:]
            
        self.save_history()
        
    def add_debug_console_entry(self, entry):
        """Add debug console entry (24 hour history)"""
        entry_with_time = {
            "timestamp": datetime.now().isoformat(),
            "message": entry
        }
        
        self.debug_console_buffer.append(entry_with_time)
        
        # Clean old entries from history
        cutoff_time = datetime.now() - timedelta(hours=24)
        self.history["debug_console_history"]["last_24_hours"] = [
            e for e in self.history["debug_console_history"]["last_24_hours"]
            if datetime.fromisoformat(e["timestamp"]) > cutoff_time
        ]
        
        # Add new entry
        self.history["debug_console_history"]["last_24_hours"].append(entry_with_time)
        
    def add_processing_console_entry(self, entry):
        """Add processing console entry (24 hour history)"""
        entry_with_time = {
            "timestamp": datetime.now().isoformat(),
            "message": entry
        }
        
        self.processing_console_buffer.append(entry_with_time)
        
        # Clean old entries
        cutoff_time = datetime.now() - timedelta(hours=24)
        self.history["processing_console_history"]["last_24_hours"] = [
            e for e in self.history["processing_console_history"]["last_24_hours"]
            if datetime.fromisoformat(e["timestamp"]) > cutoff_time
        ]
        
        # Add new entry
        self.history["processing_console_history"]["last_24_hours"].append(entry_with_time)
        
    def update_relationship_equation(self, equation_data):
        """Track relationship equation changes"""
        equation_entry = {
            "timestamp": datetime.now().isoformat(),
            "equation": equation_data.get("equation"),
            "interpretation": equation_data.get("interpretation"),
            "dynamics": equation_data.get("dynamics", {})
        }
        
        self.history["relationship_equation_history"].append(equation_entry)
        
        # Keep only last 1000 equation updates
        if len(self.history["relationship_equation_history"]) > 1000:
            self.history["relationship_equation_history"] = self.history["relationship_equation_history"][-1000:]
            
    def generate_consolidation_history(self):
        """Generate memory consolidation events from conversation history"""
        print("📚 Generating memory consolidation timeline...")
        
        # Clear existing consolidations
        self.history["memory_consolidations"] = []
        
        # Sort messages by timestamp
        sorted_messages = sorted(self.all_messages, key=lambda x: x.get('timestamp', ''))
        
        # Generate consolidation events every 100 messages
        consolidation_size = 100
        for i in range(0, len(sorted_messages), consolidation_size):
            chunk = sorted_messages[i:i+consolidation_size]
            if chunk:
                # Count emotions in this chunk
                emotions_in_chunk = sum(1 for msg in chunk if msg.get('emotion'))
                
                # Determine significance based on emotion density
                emotion_density = emotions_in_chunk / len(chunk)
                significance = "high" if emotion_density > 0.7 else "normal" if emotion_density > 0.3 else "low"
                
                # Use timestamp of first message in chunk
                timestamp = chunk[0].get('timestamp', datetime.now().isoformat())
                
                consolidation = {
                    "timestamp": timestamp,
                    "type": "auto",
                    "messages_consolidated": len(chunk),
                    "emotions_processed": emotions_in_chunk,
                    "significance": significance
                }
                
                self.history["memory_consolidations"].append(consolidation)
        
        print(f"✅ Generated {len(self.history['memory_consolidations'])} consolidation events")
    
    def get_memory_consolidation_timeline(self):
        """Get memory consolidation events for timeline display"""
        return self.history["memory_consolidations"][-20:]  # Last 20 events
        
    def track_llm_activity(self, activity_type, data=None):
        """Track LLM processing activities"""
        if "llm_activity" not in self.history:
            self.history["llm_activity"] = {
                "organizing_memories": [],
                "clustering_by_emotion": [],
                "temporal_patterns": []
            }
        
        activity = {
            "timestamp": datetime.now().isoformat(),
            "type": activity_type,
            "data": data or {}
        }
        
        # Map activity types to categories
        if "organizing" in activity_type.lower() or "memory" in activity_type.lower():
            category = "organizing_memories"
        elif "cluster" in activity_type.lower() or "emotion" in activity_type.lower():
            category = "clustering_by_emotion"
        elif "temporal" in activity_type.lower() or "pattern" in activity_type.lower():
            category = "temporal_patterns"
        else:
            category = "organizing_memories"  # Default
        
        # Keep last 1000 activities per category
        self.history["llm_activity"][category].append(activity)
        if len(self.history["llm_activity"][category]) > 1000:
            self.history["llm_activity"][category] = self.history["llm_activity"][category][-1000:]
            
        self.save_history()
    
    def save_history(self):
        """Save history to file"""
        self.history["last_updated"] = datetime.now().isoformat()
        
        # Atomic write
        temp_file = self.history_file.with_suffix('.tmp')
        with open(temp_file, 'w') as f:
            json.dump(self.history, f, indent=2)
        temp_file.replace(self.history_file)
        
    def get_dashboard_data(self):
        """Get all data needed for dashboard display"""
        # Ensure LLM activity exists
        if "llm_activity" not in self.history:
            self.history["llm_activity"] = {
                "organizing_memories": [],
                "clustering_by_emotion": [],
                "temporal_patterns": []
            }
            
        return {
            "total_stats": self.history["total_stats"],
            "memory_consolidations": self.get_memory_consolidation_timeline(),
            "emotional_journey": self.history["emotional_journey"],
            "relationship_equation": self.history["relationship_equation_history"][-1] if self.history["relationship_equation_history"] else None,
            "debug_console": self.history["debug_console_history"]["last_24_hours"][-100:],  # Last 100 entries
            "processing_console": self.history["processing_console_history"]["last_24_hours"][-100:],
            "milestones": self.history["milestones"][-10:],  # Last 10 milestones
            "llm_activity": self.history.get("llm_activity", {})
        }

if __name__ == "__main__":
    print("🌟 Relationship History Manager")
    print("💙 Building complete relationship history...")
    
    manager = RelationshipHistoryManager()
    manager.scan_all_conversations()
    
    stats = manager.history["total_stats"]
    print(f"\n📊 Relationship Statistics:")
    print(f"   Gritz: {stats['gritz_messages']} messages, {stats['gritz_words']} words")
    print(f"   Claude: {stats['claude_messages']} messages, {stats['claude_words']} words")
    print(f"   Total interactions: {stats['total_interactions']}")
    print(f"   Emotional moments: {stats['emotional_moments']}")