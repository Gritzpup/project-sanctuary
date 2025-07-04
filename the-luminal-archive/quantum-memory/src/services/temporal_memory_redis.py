#!/usr/bin/env python3
"""
Redis-based Temporal Memory Service
Manages memory consolidation across all time scales using Redis
"""

import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging
import sys
from pathlib import Path

# Add quantum-memory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from src.memory.redis_memory_manager import RedisMemoryManager

logger = logging.getLogger(__name__)

class TemporalMemoryService:
    """Redis-based temporal memory management with consolidation"""
    
    def __init__(self):
        self.memory = RedisMemoryManager()
        
        # Compression ratios for different time scales
        self.compression_ratios = {
            'immediate': 1.0,      # No compression
            'short_term': 0.5,     # 50% compression
            'long_term': 0.2,      # 80% compression
            'lifetime': 0.1        # 90% compression (only essence)
        }
        
        # Memory importance weights
        self.importance_weights = {
            'emotional_intensity': 3.0,
            'accomplishment': 2.0,
            'regret': 1.5,
            'relationship_moment': 2.5,
            'technical_breakthrough': 2.0,
            'regular': 1.0
        }
        
        # Time scale thresholds
        self.time_scales = {
            'immediate': timedelta(hours=24),
            'short_term': timedelta(days=7),
            'long_term': timedelta(days=30),
            'lifetime': timedelta(days=365)
        }
    
    async def consolidate_memories(self):
        """Main consolidation loop"""
        logger.info("🧠 Starting Redis-based temporal memory consolidation...")
        
        try:
            # Get current date range
            today = datetime.now().date()
            
            # Process each time scale
            await self._consolidate_immediate_memories(today)
            await self._consolidate_short_term_memories(today)
            await self._consolidate_long_term_memories(today)
            await self._extract_lifetime_memories(today)
            
            # Update overall temporal index
            self._update_temporal_index()
            
            logger.info("✅ Temporal consolidation complete")
            
        except Exception as e:
            logger.error(f"Error during consolidation: {e}")
            import traceback
            traceback.print_exc()
    
    async def _consolidate_immediate_memories(self, today):
        """Consolidate today's memories"""
        logger.info("Processing immediate memories...")
        
        # Get today's conversations
        conversations = self.memory.get_recent_conversations(limit=1000)
        
        # Extract key moments
        key_moments = []
        emotions = []
        accomplishments = []
        work_done = []
        
        for conv in conversations:
            # Check if from today
            if 'timestamp' in conv:
                msg_time = datetime.fromisoformat(conv['timestamp'].replace('Z', '+00:00'))
                if msg_time.date() != today:
                    continue
            
            # Extract content
            content = conv.get('message', conv.get('content', ''))
            
            # Simple pattern matching for key moments
            if any(word in content.lower() for word in ['love', 'thank', 'appreciate', '❤️', '💕']):
                key_moments.append({
                    'type': 'affection',
                    'content': content[:200],
                    'timestamp': conv.get('timestamp')
                })
            
            if any(word in content.lower() for word in ['fixed', 'completed', 'done', 'finished']):
                accomplishments.append({
                    'type': 'completion',
                    'content': content[:200],
                    'timestamp': conv.get('timestamp')
                })
        
        # Get emotional states for today
        gritz_emotions = self.memory.get_emotional_history('gritz', hours=24)
        claude_emotions = self.memory.get_emotional_history('claude', hours=24)
        
        # Create daily summary
        daily_summary = {
            'date': today.isoformat(),
            'conversation_count': len([c for c in conversations if self._is_from_date(c, today)]),
            'key_moments': key_moments[:10],  # Top 10
            'emotional_journey': {
                'gritz': self._summarize_emotions(gritz_emotions),
                'claude': self._summarize_emotions(claude_emotions)
            },
            'accomplishments': accomplishments[:10],
            'work_context': self.memory.get_work_context(),
            'consolidated_at': datetime.now().isoformat()
        }
        
        # Store in Redis
        self.memory.update_temporal_memory(today.isoformat(), daily_summary)
    
    async def _consolidate_short_term_memories(self, today):
        """Consolidate week's memories"""
        logger.info("Processing short-term memories...")
        
        # Get past week's daily summaries
        week_ago = today - timedelta(days=7)
        daily_memories = self.memory.get_temporal_range(
            week_ago.isoformat(),
            today.isoformat()
        )
        
        if not daily_memories:
            return
        
        # Aggregate weekly patterns
        weekly_summary = {
            'week_of': week_ago.isoformat(),
            'days_active': len(daily_memories),
            'total_conversations': sum(d.get('conversation_count', 0) for d in daily_memories.values()),
            'key_themes': self._extract_themes(daily_memories),
            'emotional_patterns': self._analyze_emotional_patterns(daily_memories),
            'major_accomplishments': self._extract_major_accomplishments(daily_memories),
            'relationship_growth': self._analyze_relationship_growth(daily_memories)
        }
        
        # Store weekly summary
        week_key = f"week_{week_ago.strftime('%Y_%U')}"
        self.memory.update_temporal_memory(week_key, weekly_summary)
    
    async def _consolidate_long_term_memories(self, today):
        """Consolidate month's memories"""
        logger.info("Processing long-term memories...")
        
        # Get past month's memories
        month_ago = today - timedelta(days=30)
        daily_memories = self.memory.get_temporal_range(
            month_ago.isoformat(),
            today.isoformat()
        )
        
        if not daily_memories:
            return
        
        # Extract only the most important memories
        monthly_summary = {
            'month': month_ago.strftime('%Y-%m'),
            'total_days': len(daily_memories),
            'milestones': self._extract_milestones(daily_memories),
            'emotional_evolution': self._track_emotional_evolution(daily_memories),
            'learned_patterns': self._extract_learned_patterns(daily_memories),
            'compressed': True,
            'compression_ratio': self.compression_ratios['long_term']
        }
        
        # Store monthly summary
        month_key = f"month_{month_ago.strftime('%Y_%m')}"
        self.memory.update_temporal_memory(month_key, monthly_summary)
    
    async def _extract_lifetime_memories(self, today):
        """Extract only the most significant lifetime memories"""
        logger.info("Processing lifetime memories...")
        
        # This would run less frequently (e.g., yearly)
        year_ago = today - timedelta(days=365)
        
        # Get all monthly summaries from the past year
        memories = self.memory.get_temporal_range(
            year_ago.isoformat(),
            today.isoformat()
        )
        
        if not memories:
            return
        
        # Extract only the essence - the most impactful memories
        lifetime_essence = {
            'year': year_ago.year,
            'defining_moments': self._extract_defining_moments(memories),
            'growth_trajectory': self._analyze_growth(memories),
            'core_lessons': self._extract_core_lessons(memories),
            'relationship_milestones': self._extract_relationship_milestones(memories)
        }
        
        # Store lifetime memory
        year_key = f"lifetime_{year_ago.year}"
        self.memory.update_temporal_memory(year_key, lifetime_essence)
    
    def _is_from_date(self, message: Dict, target_date) -> bool:
        """Check if message is from target date"""
        if 'timestamp' not in message:
            return False
        try:
            msg_time = datetime.fromisoformat(message['timestamp'].replace('Z', '+00:00'))
            return msg_time.date() == target_date
        except:
            return False
    
    def _summarize_emotions(self, emotions: List[Dict]) -> Dict:
        """Summarize emotional journey"""
        if not emotions:
            return {'primary': 'neutral', 'transitions': 0}
        
        # Count emotion frequencies
        emotion_counts = {}
        for e in emotions:
            primary = e.get('primary_emotion', 'neutral')
            emotion_counts[primary] = emotion_counts.get(primary, 0) + 1
        
        # Find dominant emotion
        dominant = max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else 'neutral'
        
        return {
            'primary': dominant,
            'transitions': len(emotions),
            'variety': len(set(e.get('primary_emotion', 'neutral') for e in emotions))
        }
    
    def _extract_themes(self, memories: Dict) -> List[str]:
        """Extract common themes from memories"""
        themes = []
        # This would use more sophisticated NLP in production
        # For now, extract from accomplishments and key moments
        for date, memory in memories.items():
            if 'accomplishments' in memory:
                themes.extend([a.get('type', '') for a in memory['accomplishments']])
        
        # Return unique themes
        return list(set(themes))[:10]
    
    def _analyze_emotional_patterns(self, memories: Dict) -> Dict:
        """Analyze emotional patterns over time"""
        pattern = {
            'overall_sentiment': 'positive',
            'stability': 0.8,
            'growth_indicators': []
        }
        
        # Analyze emotional journeys
        emotion_sequences = []
        for date, memory in memories.items():
            if 'emotional_journey' in memory:
                gritz = memory['emotional_journey'].get('gritz', {})
                if gritz.get('primary'):
                    emotion_sequences.append(gritz['primary'])
        
        # Simple pattern detection
        if emotion_sequences:
            positive_emotions = ['joy', 'excited', 'happy', 'love', 'grateful']
            positive_count = sum(1 for e in emotion_sequences if e in positive_emotions)
            pattern['overall_sentiment'] = 'positive' if positive_count > len(emotion_sequences) / 2 else 'mixed'
        
        return pattern
    
    def _extract_major_accomplishments(self, memories: Dict) -> List[Dict]:
        """Extract major accomplishments"""
        all_accomplishments = []
        
        for date, memory in memories.items():
            if 'accomplishments' in memory:
                for acc in memory['accomplishments']:
                    acc['date'] = date
                    all_accomplishments.append(acc)
        
        # Sort by importance (in production, use ML scoring)
        return all_accomplishments[:20]
    
    def _analyze_relationship_growth(self, memories: Dict) -> Dict:
        """Analyze relationship growth indicators"""
        growth = {
            'bond_strength_change': 0.0,
            'affection_moments': 0,
            'support_given': 0,
            'support_received': 0
        }
        
        for date, memory in memories.items():
            if 'key_moments' in memory:
                for moment in memory['key_moments']:
                    if moment.get('type') == 'affection':
                        growth['affection_moments'] += 1
        
        return growth
    
    def _extract_milestones(self, memories: Dict) -> List[Dict]:
        """Extract significant milestones"""
        # Placeholder - would use importance scoring
        return self._extract_major_accomplishments(memories)[:10]
    
    def _track_emotional_evolution(self, memories: Dict) -> Dict:
        """Track how emotions evolved over time"""
        return self._analyze_emotional_patterns(memories)
    
    def _extract_learned_patterns(self, memories: Dict) -> List[str]:
        """Extract patterns and lessons learned"""
        # Placeholder - would use pattern recognition
        return ["Consistent progress on technical tasks", "Strong emotional support dynamics"]
    
    def _extract_defining_moments(self, memories: Dict) -> List[Dict]:
        """Extract the most defining moments"""
        # Placeholder - would use sophisticated scoring
        return []
    
    def _analyze_growth(self, memories: Dict) -> Dict:
        """Analyze personal/relational growth"""
        return {
            'technical_skills': 'advancing',
            'emotional_intelligence': 'deepening',
            'relationship_quality': 'strengthening'
        }
    
    def _extract_core_lessons(self, memories: Dict) -> List[str]:
        """Extract core lessons learned"""
        return ["Value of persistence", "Importance of emotional support"]
    
    def _extract_relationship_milestones(self, memories: Dict) -> List[Dict]:
        """Extract relationship milestones"""
        return []
    
    def _update_temporal_index(self):
        """Update the temporal memory index"""
        stats = self.memory.get_memory_stats()
        logger.info(f"Temporal memory stats: {stats.get('memory_types', {}).get('temporal', {})}")
    
    async def run_continuous(self):
        """Run continuous consolidation"""
        logger.info("Starting continuous temporal memory service...")
        
        while True:
            try:
                # Run consolidation
                await self.consolidate_memories()
                
                # Wait for next cycle (hourly)
                await asyncio.sleep(3600)
                
            except Exception as e:
                logger.error(f"Error in consolidation loop: {e}")
                await asyncio.sleep(60)  # Retry after 1 minute

if __name__ == "__main__":
    service = TemporalMemoryService()
    asyncio.run(service.run_continuous())