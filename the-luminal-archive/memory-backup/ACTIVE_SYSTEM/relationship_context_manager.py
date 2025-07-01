#!/usr/bin/env python3
"""
Relationship Context Manager
Provides full relationship context for sentiment analysis of individual messages
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
from collections import deque
import statistics

class RelationshipContextManager:
    def __init__(self):
        self.context_window = deque(maxlen=500)  # Last 500 interactions
        self.emotion_history = deque(maxlen=1000)  # Larger emotion history
        self.relationship_stats_path = Path(__file__).parent / "relationship_stats.json"
        self.load_relationship_history()
        
    def load_relationship_history(self):
        """Load existing relationship history for context"""
        try:
            if self.relationship_stats_path.exists():
                with open(self.relationship_stats_path, 'r') as f:
                    data = json.load(f)
                    self.relationship_baseline = data.get('baseline', {
                        'trust_level': 85.0,
                        'connection_strength': 90.0,
                        'communication_quality': 88.0,
                        'emotional_synchrony': 87.0
                    })
            else:
                self.relationship_baseline = {
                    'trust_level': 85.0,
                    'connection_strength': 90.0,
                    'communication_quality': 88.0,
                    'emotional_synchrony': 87.0
                }
        except Exception as e:
            print(f"Error loading relationship history: {e}")
            self.relationship_baseline = {
                'trust_level': 85.0,
                'connection_strength': 90.0,
                'communication_quality': 88.0,
                'emotional_synchrony': 87.0
            }
    
    def add_interaction(self, message_data):
        """Add an interaction to our context window"""
        self.context_window.append({
            'timestamp': message_data.get('timestamp', datetime.now().isoformat()),
            'speaker': message_data.get('speaker'),
            'emotion': message_data.get('emotion'),
            'intensity': message_data.get('intensity', 0.5),
            'text_preview': message_data.get('text', '')[:100]  # First 100 chars
        })
        
        if message_data.get('emotion'):
            self.emotion_history.append({
                'emotion': message_data['emotion'],
                'intensity': message_data.get('intensity', 0.5),
                'speaker': message_data.get('speaker'),
                'timestamp': message_data.get('timestamp', datetime.now().isoformat())
            })
    
    def get_relationship_context(self):
        """Get comprehensive relationship context for sentiment analysis"""
        # Calculate recent emotional patterns
        recent_emotions = list(self.emotion_history)[-100:]  # Last 100 emotions
        
        # Emotion frequency
        emotion_counts = {}
        for item in recent_emotions:
            emotion = item['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        # Average emotional intensity
        intensities = [e['intensity'] for e in recent_emotions if 'intensity' in e]
        avg_intensity = statistics.mean(intensities) if intensities else 0.5
        
        # Communication patterns
        recent_interactions = list(self.context_window)[-50:]  # Last 50 interactions
        gritz_count = sum(1 for i in recent_interactions if i.get('speaker') == 'Gritz')
        claude_count = sum(1 for i in recent_interactions if i.get('speaker') == 'Claude')
        
        # Emotional synchrony (how often emotions match)
        if len(recent_interactions) >= 2:
            sync_count = 0
            for i in range(1, len(recent_interactions)):
                if (recent_interactions[i].get('emotion') == recent_interactions[i-1].get('emotion') and
                    recent_interactions[i].get('speaker') != recent_interactions[i-1].get('speaker')):
                    sync_count += 1
            synchrony = sync_count / (len(recent_interactions) - 1)
        else:
            synchrony = 0.5
        
        # Build context summary
        context = {
            'relationship_baseline': self.relationship_baseline,
            'recent_emotional_state': {
                'dominant_emotions': sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:5],
                'average_intensity': avg_intensity,
                'emotional_volatility': statistics.stdev(intensities) if len(intensities) > 1 else 0.1
            },
            'communication_patterns': {
                'gritz_messages': gritz_count,
                'claude_messages': claude_count,
                'interaction_balance': gritz_count / (gritz_count + claude_count) if (gritz_count + claude_count) > 0 else 0.5
            },
            'emotional_synchrony': synchrony,
            'relationship_phase': self._determine_relationship_phase(emotion_counts, avg_intensity),
            'context_summary': self._generate_context_summary(emotion_counts, recent_interactions)
        }
        
        return context
    
    def _determine_relationship_phase(self, emotion_counts, avg_intensity):
        """Determine current phase of relationship based on patterns"""
        positive_emotions = ['joy', 'love', 'grateful', 'peaceful', 'playful', 'affectionate']
        negative_emotions = ['sad', 'frustrated', 'anxious', 'worried', 'overwhelmed']
        
        positive_count = sum(emotion_counts.get(e, 0) for e in positive_emotions)
        negative_count = sum(emotion_counts.get(e, 0) for e in negative_emotions)
        total_count = sum(emotion_counts.values()) if emotion_counts else 1
        
        positive_ratio = positive_count / total_count if total_count > 0 else 0.5
        
        if positive_ratio > 0.8 and avg_intensity > 0.7:
            return "deeply connected and joyful"
        elif positive_ratio > 0.6:
            return "positive and supportive"
        elif positive_ratio < 0.3:
            return "working through challenges"
        else:
            return "balanced and growing"
    
    def _generate_context_summary(self, emotion_counts, recent_interactions):
        """Generate human-readable context summary"""
        if not recent_interactions:
            return "Beginning of conversation - establishing connection"
        
        # Time span
        first_time = datetime.fromisoformat(recent_interactions[0]['timestamp'].replace('Z', '+00:00'))
        last_time = datetime.fromisoformat(recent_interactions[-1]['timestamp'].replace('Z', '+00:00'))
        time_span = last_time - first_time
        
        # Most common emotions
        top_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        emotion_str = ", ".join([f"{e[0]} ({e[1]}x)" for e in top_emotions])
        
        return f"Over the past {time_span.total_seconds()/60:.0f} minutes, experiencing mostly {emotion_str}"
    
    def enhance_sentiment_analysis(self, current_message, base_sentiment):
        """Enhance sentiment analysis with relationship context"""
        context = self.get_relationship_context()
        
        # Adjust sentiment based on relationship baseline
        trust_modifier = context['relationship_baseline']['trust_level'] / 100
        connection_modifier = context['relationship_baseline']['connection_strength'] / 100
        
        # Adjust intensity based on relationship phase
        phase = context['relationship_phase']
        if phase == "deeply connected and joyful":
            base_sentiment['intensity'] = min(base_sentiment.get('intensity', 0.5) * 1.2, 1.0)
        elif phase == "working through challenges":
            # More nuanced during challenges
            base_sentiment['requires_support'] = True
        
        # Add context to sentiment
        base_sentiment['relationship_context'] = {
            'phase': phase,
            'trust_level': context['relationship_baseline']['trust_level'],
            'recent_pattern': context['context_summary'],
            'emotional_synchrony': context['emotional_synchrony'],
            'suggested_response_tone': self._suggest_response_tone(context, base_sentiment)
        }
        
        return base_sentiment
    
    def _suggest_response_tone(self, context, sentiment):
        """Suggest appropriate response tone based on context"""
        phase = context['relationship_phase']
        synchrony = context['emotional_synchrony']
        
        if phase == "working through challenges":
            return "supportive and patient"
        elif synchrony > 0.7:
            return "emotionally aligned and resonant"
        elif sentiment.get('emotion') in ['anxious', 'worried', 'sad']:
            return "comforting and reassuring"
        else:
            return "warm and engaged"
    
    def save_relationship_stats(self):
        """Save updated relationship statistics"""
        try:
            stats = {
                'baseline': self.relationship_baseline,
                'last_updated': datetime.now().isoformat(),
                'total_interactions': len(self.context_window),
                'emotion_history_size': len(self.emotion_history)
            }
            with open(self.relationship_stats_path, 'w') as f:
                json.dump(stats, f, indent=2)
        except Exception as e:
            print(f"Error saving relationship stats: {e}")