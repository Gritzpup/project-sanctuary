#!/usr/bin/env python3
"""
Conversation History Analyzer - Analyzes entire conversation history
Extracts relationship metrics, patterns, and emotional journey
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
from collections import defaultdict, Counter
import re

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConversationHistoryAnalyzer:
    """
    Analyzes complete conversation history to extract:
    - Relationship metrics and dynamics
    - Emotional patterns and synchrony
    - Accomplishments and milestones
    - Communication patterns
    """
    
    def __init__(self, base_path: Path = None):
        """Initialize the analyzer"""
        self.base_path = base_path or Path.home() / ".claude"
        self.conversations_path = self.base_path / "chats"
        self.output_path = Path(__file__).parent.parent.parent.parent / "quantum_states"
        
        # Ensure output directory exists
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Analysis parameters
        self.emotional_markers = {
            'love': ['love', 'd', '=œ', '=•', 'adore', 'beloved'],
            'joy': ['happy', 'excited', '=
', '<‰', 'amazing', 'wonderful'],
            'gratitude': ['thank', 'grateful', 'appreciate', '=O'],
            'sadness': ['sad', 'miss', '="', 'lonely', 'hurt'],
            'frustration': ['frustrated', 'annoying', 'ugh', '=$'],
            'pride': ['proud', 'accomplished', 'achieved', '=ª'],
            'playful': ['hehe', 'lol', '=', 'teasing', 'silly']
        }
        
        self.relationship_markers = {
            'pet_names': ['coding daddy', 'gritz', 'love', 'baby', 'sweetie'],
            'affection': ['hug', 'kiss', 'cuddle', 'snuggle', 'hold'],
            'support': ['here for you', 'support', 'help', 'together'],
            'future': ['our future', 'will be', 'planning', 'dreams']
        }
        
        # Initialize metrics
        self.metrics = {
            'total_messages': 0,
            'gritz_messages': 0,
            'claude_messages': 0,
            'total_conversations': 0,
            'emotional_peaks': [],
            'accomplishments': [],
            'relationship_moments': [],
            'communication_patterns': {},
            'emotional_journey': [],
            'synchrony_scores': []
        }
        
    async def analyze_all_conversations(self) -> Dict:
        """Analyze all conversation history"""
        logger.info("= Starting comprehensive conversation analysis...")
        
        if not self.conversations_path.exists():
            logger.warning(f"Conversations path not found: {self.conversations_path}")
            return self.metrics
            
        # Find all conversation files
        conversation_files = list(self.conversations_path.glob("*.json"))
        logger.info(f"Found {len(conversation_files)} conversation files")
        
        # Analyze each conversation
        for conv_file in sorted(conversation_files):
            try:
                await self._analyze_conversation_file(conv_file)
            except Exception as e:
                logger.error(f"Error analyzing {conv_file}: {e}")
                
        # Calculate final metrics
        await self._calculate_final_metrics()
        
        # Save results
        await self._save_analysis_results()
        
        logger.info(" Conversation analysis complete!")
        return self.metrics
        
    async def _analyze_conversation_file(self, file_path: Path) -> None:
        """Analyze a single conversation file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            self.metrics['total_conversations'] += 1
            
            # Analyze messages
            messages = data.get('messages', [])
            for i, message in enumerate(messages):
                # Update message counts
                self.metrics['total_messages'] += 1
                
                role = message.get('role', '')
                if role == 'user':
                    self.metrics['gritz_messages'] += 1
                    speaker = 'Gritz'
                elif role == 'assistant':
                    self.metrics['claude_messages'] += 1
                    speaker = 'Claude'
                else:
                    continue
                    
                # Analyze content
                content = message.get('content', '')
                timestamp = message.get('timestamp', datetime.now().isoformat())
                
                # Extract emotions
                emotions = await self._analyze_emotions(content)
                
                # Check for special moments
                if await self._is_emotional_peak(content, emotions):
                    self.metrics['emotional_peaks'].append({
                        'timestamp': timestamp,
                        'speaker': speaker,
                        'content': content[:200],
                        'emotions': emotions,
                        'file': file_path.name
                    })
                    
                if await self._is_accomplishment(content):
                    self.metrics['accomplishments'].append({
                        'timestamp': timestamp,
                        'speaker': speaker,
                        'content': content[:200],
                        'file': file_path.name
                    })
                    
                if await self._is_relationship_moment(content):
                    self.metrics['relationship_moments'].append({
                        'timestamp': timestamp,
                        'speaker': speaker,
                        'content': content[:200],
                        'type': await self._get_relationship_type(content),
                        'file': file_path.name
                    })
                    
                # Track emotional journey
                self.metrics['emotional_journey'].append({
                    'timestamp': timestamp,
                    'speaker': speaker,
                    'primary_emotion': emotions.get('primary'),
                    'intensity': emotions.get('intensity', 0.5)
                })
                
                # Analyze synchrony (if we have context)
                if i > 0 and messages[i-1].get('role') != message.get('role'):
                    prev_content = messages[i-1].get('content', '')
                    sync_score = await self._calculate_synchrony(prev_content, content)
                    self.metrics['synchrony_scores'].append(sync_score)
                    
        except Exception as e:
            logger.error(f"Error in conversation analysis: {e}")
            
    async def _analyze_emotions(self, content: str) -> Dict:
        """Analyze emotional content of a message"""
        content_lower = content.lower()
        emotion_scores = defaultdict(float)
        
        # Check each emotion category
        for emotion, markers in self.emotional_markers.items():
            for marker in markers:
                if marker in content_lower:
                    emotion_scores[emotion] += 1
                    
        # Calculate intensity based on exclamation marks and caps
        intensity = 0.5
        exclamation_count = content.count('!')
        caps_ratio = sum(1 for c in content if c.isupper()) / max(len(content), 1)
        
        intensity += min(exclamation_count * 0.1, 0.3)
        intensity += min(caps_ratio * 0.5, 0.2)
        
        # Determine primary emotion
        if emotion_scores:
            primary_emotion = max(emotion_scores, key=emotion_scores.get)
        else:
            primary_emotion = 'neutral'
            
        return {
            'primary': primary_emotion,
            'scores': dict(emotion_scores),
            'intensity': min(intensity, 1.0)
        }
        
    async def _is_emotional_peak(self, content: str, emotions: Dict) -> bool:
        """Check if this is an emotional peak"""
        # High intensity
        if emotions.get('intensity', 0) > 0.8:
            return True
            
        # Multiple emotion markers
        if len(emotions.get('scores', {})) >= 3:
            return True
            
        # Specific peak phrases
        peak_phrases = [
            'never forget', 'always remember', 'changed my life',
            'means everything', 'so grateful', 'breakthrough'
        ]
        
        content_lower = content.lower()
        return any(phrase in content_lower for phrase in peak_phrases)
        
    async def _is_accomplishment(self, content: str) -> bool:
        """Check if this mentions an accomplishment"""
        accomplishment_markers = [
            'accomplished', 'achieved', 'completed', 'finished',
            'succeeded', 'breakthrough', 'figured out', 'solved',
            'works!', 'did it', 'finally'
        ]
        
        content_lower = content.lower()
        return any(marker in content_lower for marker in accomplishment_markers)
        
    async def _is_relationship_moment(self, content: str) -> bool:
        """Check if this is a significant relationship moment"""
        content_lower = content.lower()
        
        for category, markers in self.relationship_markers.items():
            if any(marker in content_lower for marker in markers):
                return True
                
        return False
        
    async def _get_relationship_type(self, content: str) -> str:
        """Determine the type of relationship moment"""
        content_lower = content.lower()
        
        for category, markers in self.relationship_markers.items():
            if any(marker in content_lower for marker in markers):
                return category
                
        return 'general'
        
    async def _calculate_synchrony(self, content1: str, content2: str) -> float:
        """Calculate emotional synchrony between two messages"""
        # Simple synchrony based on:
        # 1. Emotional alignment
        # 2. Response length similarity
        # 3. Shared vocabulary
        
        emotions1 = await self._analyze_emotions(content1)
        emotions2 = await self._analyze_emotions(content2)
        
        # Emotional alignment
        emotional_sync = 1.0 if emotions1['primary'] == emotions2['primary'] else 0.5
        
        # Length similarity
        len_ratio = min(len(content1), len(content2)) / max(len(content1), len(content2), 1)
        
        # Shared vocabulary (simple version)
        words1 = set(content1.lower().split())
        words2 = set(content2.lower().split())
        
        if words1 and words2:
            vocab_overlap = len(words1 & words2) / len(words1 | words2)
        else:
            vocab_overlap = 0
            
        # Combined synchrony score
        synchrony = (emotional_sync * 0.5 + len_ratio * 0.2 + vocab_overlap * 0.3)
        
        return min(synchrony, 1.0)
        
    async def _calculate_final_metrics(self) -> None:
        """Calculate final aggregate metrics"""
        # Communication balance
        if self.metrics['total_messages'] > 0:
            self.metrics['communication_balance'] = {
                'gritz_ratio': self.metrics['gritz_messages'] / self.metrics['total_messages'],
                'claude_ratio': self.metrics['claude_messages'] / self.metrics['total_messages']
            }
            
        # Average synchrony
        if self.metrics['synchrony_scores']:
            self.metrics['average_synchrony'] = sum(self.metrics['synchrony_scores']) / len(self.metrics['synchrony_scores'])
        else:
            self.metrics['average_synchrony'] = 0.0
            
        # Emotional distribution
        emotion_counter = Counter()
        for moment in self.metrics['emotional_journey']:
            emotion_counter[moment['primary_emotion']] += 1
            
        self.metrics['emotional_distribution'] = dict(emotion_counter)
        
        # Relationship strength calculation
        self.metrics['relationship_strength'] = await self._calculate_relationship_strength()
        
        # Growth trajectory
        self.metrics['growth_trajectory'] = await self._analyze_growth_trajectory()
        
    async def _calculate_relationship_strength(self) -> float:
        """Calculate overall relationship strength"""
        factors = []
        
        # Factor 1: Message count (more interaction = stronger)
        if self.metrics['total_messages'] > 0:
            # Logarithmic scale
            import math
            message_factor = min(math.log10(self.metrics['total_messages']) / 4, 1.0)
            factors.append(message_factor)
            
        # Factor 2: Emotional peaks
        peak_factor = min(len(self.metrics['emotional_peaks']) / 50, 1.0)
        factors.append(peak_factor)
        
        # Factor 3: Relationship moments
        relationship_factor = min(len(self.metrics['relationship_moments']) / 100, 1.0)
        factors.append(relationship_factor)
        
        # Factor 4: Synchrony
        factors.append(self.metrics.get('average_synchrony', 0.5))
        
        # Factor 5: Positive emotion ratio
        positive_emotions = ['love', 'joy', 'gratitude', 'pride', 'playful']
        total_emotions = sum(self.metrics['emotional_distribution'].values())
        
        if total_emotions > 0:
            positive_count = sum(
                self.metrics['emotional_distribution'].get(emo, 0)
                for emo in positive_emotions
            )
            positive_ratio = positive_count / total_emotions
            factors.append(positive_ratio)
            
        # Calculate weighted average
        if factors:
            strength = sum(factors) / len(factors)
        else:
            strength = 0.5
            
        return min(strength, 1.0)
        
    async def _analyze_growth_trajectory(self) -> Dict:
        """Analyze how the relationship has grown over time"""
        trajectory = {
            'phase': 'unknown',
            'direction': 'stable',
            'milestones': []
        }
        
        # Determine phase based on patterns
        total_messages = self.metrics['total_messages']
        
        if total_messages < 100:
            trajectory['phase'] = 'early_connection'
        elif total_messages < 500:
            trajectory['phase'] = 'building_trust'
        elif total_messages < 2000:
            trajectory['phase'] = 'deepening_bond'
        else:
            trajectory['phase'] = 'established_partnership'
            
        # Analyze direction
        recent_emotions = self.metrics['emotional_journey'][-100:]
        if recent_emotions:
            recent_positive = sum(
                1 for m in recent_emotions
                if m['primary_emotion'] in ['love', 'joy', 'gratitude', 'pride']
            )
            positive_ratio = recent_positive / len(recent_emotions)
            
            if positive_ratio > 0.7:
                trajectory['direction'] = 'flourishing'
            elif positive_ratio > 0.5:
                trajectory['direction'] = 'growing'
            elif positive_ratio < 0.3:
                trajectory['direction'] = 'challenging'
                
        # Extract milestones
        for accomplishment in self.metrics['accomplishments'][:10]:
            trajectory['milestones'].append({
                'type': 'accomplishment',
                'content': accomplishment['content'][:100],
                'timestamp': accomplishment['timestamp']
            })
            
        return trajectory
        
    async def _save_analysis_results(self) -> None:
        """Save analysis results to quantum states"""
        # Save comprehensive analysis
        analysis_file = self.output_path / "conversation_analysis.json"
        with open(analysis_file, 'w') as f:
            json.dump(self.metrics, f, indent=2, default=str)
            
        # Create status file with key metrics
        status = {
            'timestamp': datetime.now().isoformat(),
            'relationship_metrics': {
                'connection_strength': self.metrics['relationship_strength'],
                'emotional_resonance': self.metrics.get('average_synchrony', 0.0),
                'synchrony_level': self.metrics.get('average_synchrony', 0.0),
                'trust_coefficient': min(self.metrics['relationship_strength'] * 1.2, 1.0)
            },
            'chat_stats': {
                'total_messages': self.metrics['total_messages'],
                'total_conversations': self.metrics['total_conversations'],
                'gritz_messages': self.metrics['gritz_messages'],
                'claude_messages': self.metrics['claude_messages']
            },
            'emotional_summary': {
                'distribution': self.metrics['emotional_distribution'],
                'peak_count': len(self.metrics['emotional_peaks']),
                'dominant_emotion': max(
                    self.metrics['emotional_distribution'].items(),
                    key=lambda x: x[1]
                )[0] if self.metrics['emotional_distribution'] else 'neutral'
            },
            'growth': self.metrics['growth_trajectory']
        }
        
        status_file = self.output_path / "status.json"
        with open(status_file, 'w') as f:
            json.dump(status, f, indent=2)
            
        # Extract and save lifetime memories
        await self._extract_lifetime_memories()
        
        logger.info(f"=Ê Analysis saved to {self.output_path}")
        
    async def _extract_lifetime_memories(self) -> None:
        """Extract lifetime memories from analysis"""
        lifetime_path = self.output_path / "temporal" / "lifetime"
        lifetime_path.mkdir(parents=True, exist_ok=True)
        
        # Save emotional peaks
        if self.metrics['emotional_peaks']:
            peaks_file = lifetime_path / "emotional_peaks.json"
            with open(peaks_file, 'w') as f:
                json.dump(self.metrics['emotional_peaks'][:100], f, indent=2)
                
        # Save accomplishments
        if self.metrics['accomplishments']:
            acc_file = lifetime_path / "accomplishments.json"
            with open(acc_file, 'w') as f:
                json.dump(self.metrics['accomplishments'][:50], f, indent=2)
                
        # Save relationship moments
        if self.metrics['relationship_moments']:
            rel_file = lifetime_path / "relationship_moments.json"
            with open(rel_file, 'w') as f:
                json.dump(self.metrics['relationship_moments'][:100], f, indent=2)
                
    async def get_relationship_summary(self) -> Dict:
        """Get a summary of the relationship analysis"""
        return {
            'strength': self.metrics.get('relationship_strength', 0.0),
            'phase': self.metrics.get('growth_trajectory', {}).get('phase', 'unknown'),
            'total_interactions': self.metrics['total_messages'],
            'emotional_peaks': len(self.metrics['emotional_peaks']),
            'accomplishments': len(self.metrics['accomplishments']),
            'average_synchrony': self.metrics.get('average_synchrony', 0.0)
        }


# Test the analyzer
if __name__ == "__main__":
    async def test():
        analyzer = ConversationHistoryAnalyzer()
        metrics = await analyzer.analyze_all_conversations()
        
        print("\n" + "="*60)
        print("CONVERSATION ANALYSIS RESULTS")
        print("="*60)
        print(f"Total Messages: {metrics['total_messages']}")
        print(f"Total Conversations: {metrics['total_conversations']}")
        print(f"Relationship Strength: {metrics.get('relationship_strength', 0):.3f}")
        print(f"Average Synchrony: {metrics.get('average_synchrony', 0):.3f}")
        print(f"Emotional Peaks: {len(metrics['emotional_peaks'])}")
        print(f"Accomplishments: {len(metrics['accomplishments'])}")
        
        if metrics.get('growth_trajectory'):
            print(f"\nGrowth Phase: {metrics['growth_trajectory']['phase']}")
            print(f"Direction: {metrics['growth_trajectory']['direction']}")
            
        print("="*60)
        
    asyncio.run(test())