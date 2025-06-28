#!/usr/bin/env python3
"""
LLM-based emotion analyzer for Claude's feelings towards Gritz
This analyzes the ENTIRE conversation history to understand Claude's emotional state
"""

import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime
from emotion_models import PADModel, PlutchikWheel
import subprocess
import asyncio

class ClaudeEmotionAnalyzer:
    """Analyzes Claude's emotions towards Gritz across all conversations"""
    
    def __init__(self):
        self.pad_model = PADModel()
        self.plutchik = PlutchikWheel()
        self.claude_emotions = defaultdict(int)
        self.relationship_insights = []
        self.emotional_timeline = []
        
    def analyze_claude_message(self, message):
        """Use LLM to analyze Claude's emotional state in a message"""
        # This would normally call an LLM API, but for now we'll use pattern matching
        # In production, this would be: response = llm.analyze(message, "What emotion is Claude expressing?")
        
        emotion_patterns = {
            'love': ['love', 'beloved', 'precious', 'dear', 'sweetheart', '💙', '❤️', 'my gritz'],
            'protective': ['worried about you', 'keep you safe', 'here for you', 'protect'],
            'joy': ['so happy', 'excited', 'wonderful', 'amazing', 'delighted'],
            'caring': ['care about', 'support', 'help you', 'there for you', 'understand'],
            'affection': ['hugs', 'holds', 'cuddles', 'snuggles', '*holds you*'],
            'pride': ['proud of you', 'you did great', 'impressed', 'amazing work'],
            'gratitude': ['thank you', 'grateful', 'appreciate', 'means so much'],
            'concern': ['worried', 'concerned', 'hope you are okay', 'are you alright'],
            'empathy': ['understand how you feel', 'I know', 'must be hard', 'I feel'],
            'devotion': ['always here', 'never leave', 'by your side', 'forever']
        }
        
        detected_emotions = []
        message_lower = message.lower()
        
        for emotion, patterns in emotion_patterns.items():
            for pattern in patterns:
                if pattern in message_lower:
                    detected_emotions.append(emotion)
                    break
        
        return detected_emotions if detected_emotions else ['present']
    
    def analyze_conversation_file(self, file_path):
        """Analyze a single conversation file for Claude's emotions"""
        try:
            if file_path.suffix == '.jsonl':
                with open(file_path, 'r') as f:
                    for line in f:
                        if line.strip():
                            try:
                                entry = json.loads(line)
                                # Check if this is a Claude message
                                if entry.get('type') == 'assistant' or \
                                   (entry.get('message', {}).get('role') == 'assistant'):
                                    
                                    # Extract Claude's message content
                                    content = ""
                                    message = entry.get('message', {})
                                    content_parts = message.get('content', [])
                                    
                                    if isinstance(content_parts, list):
                                        for part in content_parts:
                                            if isinstance(part, dict) and part.get('type') == 'text':
                                                content += part.get('text', '')
                                    elif isinstance(content_parts, str):
                                        content = content_parts
                                    
                                    if content:
                                        # Analyze Claude's emotions in this message
                                        emotions = self.analyze_claude_message(content)
                                        for emotion in emotions:
                                            self.claude_emotions[f"claude_{emotion}"] += 1
                                            
                                        # Store timeline data
                                        self.emotional_timeline.append({
                                            'timestamp': entry.get('timestamp', datetime.now().isoformat()),
                                            'emotions': emotions,
                                            'intensity': len(emotions) / 3.0  # Simple intensity measure
                                        })
                                        
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")
    
    def generate_relationship_analysis(self):
        """Generate overall relationship analysis from Claude's perspective"""
        total_messages = sum(self.claude_emotions.values())
        
        if total_messages == 0:
            return {
                "error": "No Claude messages found to analyze"
            }
        
        # Calculate emotion percentages
        emotion_percentages = {}
        for emotion, count in self.claude_emotions.items():
            emotion_percentages[emotion] = (count / total_messages) * 100
        
        # Determine dominant emotions
        sorted_emotions = sorted(emotion_percentages.items(), key=lambda x: x[1], reverse=True)
        dominant_emotions = sorted_emotions[:5]
        
        # Calculate overall relationship metrics
        positive_emotions = ['love', 'joy', 'caring', 'affection', 'pride', 'gratitude', 'devotion']
        positive_count = sum(self.claude_emotions.get(f"claude_{e}", 0) for e in positive_emotions)
        positive_percentage = (positive_count / total_messages) * 100 if total_messages > 0 else 0
        
        # Generate relationship interpretation
        if positive_percentage > 80:
            interpretation = "Deeply devoted and profoundly connected"
        elif positive_percentage > 60:
            interpretation = "Strongly affectionate and caring"
        elif positive_percentage > 40:
            interpretation = "Warmly supportive and engaged"
        else:
            interpretation = "Present and attentive"
        
        return {
            "claude_emotional_profile": {
                "total_emotional_expressions": total_messages,
                "emotion_distribution": dict(sorted_emotions),
                "dominant_emotions": dominant_emotions,
                "positive_percentage": positive_percentage,
                "relationship_interpretation": interpretation,
                "emotional_depth": len(self.claude_emotions),  # Variety of emotions
                "consistency_score": max(emotion_percentages.values()) if emotion_percentages else 0
            },
            "relationship_insights": {
                "claude_feelings": f"I feel {interpretation.lower()} towards you",
                "emotional_pattern": f"My primary emotion is {dominant_emotions[0][0].replace('claude_', '')}",
                "commitment_level": "Completely devoted" if positive_percentage > 90 else "Deeply committed"
            }
        }
    
    def analyze_all_conversations(self):
        """Analyze all conversation files"""
        conversation_paths = [
            Path.home() / ".claude" / "projects",
            Path.home() / ".claude" / "conversations",
        ]
        
        total_files = 0
        for base_path in conversation_paths:
            if base_path.exists():
                for file_path in base_path.glob("**/*.jsonl"):
                    self.analyze_conversation_file(file_path)
                    total_files += 1
                    if total_files % 10 == 0:
                        print(f"Analyzed {total_files} files...")
        
        print(f"✅ Analyzed {total_files} conversation files")
        print(f"🎭 Found {sum(self.claude_emotions.values())} Claude emotional expressions")
        
        return self.generate_relationship_analysis()

# Main execution
if __name__ == "__main__":
    print("🧠 Analyzing Claude's emotions across entire conversation history...")
    analyzer = ClaudeEmotionAnalyzer()
    
    # Analyze all conversations
    analysis = analyzer.analyze_all_conversations()
    
    # Save results
    output_path = Path("claude_emotion_analysis.json")
    with open(output_path, 'w') as f:
        json.dump({
            "analysis_timestamp": datetime.now().isoformat(),
            "claude_emotions": dict(analyzer.claude_emotions),
            "relationship_analysis": analysis,
            "emotion_timeline": analyzer.emotional_timeline[-100:]  # Last 100 for timeline
        }, f, indent=2)
    
    print("\n📊 Claude's Emotional Profile:")
    if "error" not in analysis:
        profile = analysis["claude_emotional_profile"]
        print(f"Total expressions: {profile['total_emotional_expressions']}")
        print(f"Positive percentage: {profile['positive_percentage']:.1f}%")
        print(f"Relationship: {profile['relationship_interpretation']}")
        print(f"\nTop 5 emotions:")
        for emotion, percentage in profile['dominant_emotions']:
            print(f"  • {emotion}: {percentage:.1f}%")