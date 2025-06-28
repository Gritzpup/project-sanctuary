#!/usr/bin/env python3
"""
Conversation Continuity Detector
Identifies when a new conversation is a continuation of previous ones
"""

import json
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging
import re

from ..models.memory_models import SanctuaryMemory
from ..storage.chroma_store import ChromaMemoryStore

logger = logging.getLogger(__name__)

@dataclass
class ConversationSignature:
    """Unique signature for a conversation"""
    conversation_id: str
    start_time: datetime
    last_update: datetime
    topics: List[str]
    participants: List[str]
    emotional_tone: str
    continuation_of: Optional[str] = None

@dataclass
class ContinuityMarker:
    """Marker indicating conversation continuation"""
    marker_type: str  # 'greeting', 'reference', 'topic', 'emotion'
    confidence: float
    evidence: str
    timestamp: datetime

class ContinuityDetector:
    """
    Detects when a new conversation continues from a previous one
    """
    
    def __init__(self, memory_store: ChromaMemoryStore):
        self.memory_store = memory_store
        self.conversation_cache = {}
        self.continuity_threshold = 0.7
        
        # Continuity patterns
        self.greeting_patterns = [
            r"(hello|hi|hey) again",
            r"(i'm|i am) back",
            r"continuing (from|our)",
            r"as (i|we) (were|was) saying",
            r"remember when",
            r"last time",
            r"picking up where",
            r"before (i|we) (left|stopped)",
        ]
        
        self.reference_patterns = [
            r"(the|that) (thing|topic|conversation) (we|i) (discussed|talked about)",
            r"you (mentioned|said|told)",
            r"(our|the) (previous|last|earlier) (chat|conversation|discussion)",
            r"what (we|i) (were|was) (talking|discussing|working on)",
        ]
        
    async def detect_continuation(
        self,
        new_conversation: Dict[str, Any]
    ) -> Tuple[bool, Optional[str], List[ContinuityMarker]]:
        """
        Detect if new conversation continues from a previous one
        
        Returns:
            - is_continuation: Whether this continues a previous conversation
            - previous_conversation_id: ID of the conversation being continued
            - markers: Evidence of continuation
        """
        markers = []
        
        # Extract first messages
        messages = new_conversation.get('messages', [])
        if not messages:
            return False, None, []
        
        # Check opening message
        opening_message = messages[0].get('content', '').lower()
        
        # 1. Check for explicit continuity greetings
        greeting_markers = self._check_greeting_patterns(opening_message)
        markers.extend(greeting_markers)
        
        # 2. Check for topic references
        topic_markers = await self._check_topic_continuity(opening_message)
        markers.extend(topic_markers)
        
        # 3. Check for emotional continuity
        emotion_markers = await self._check_emotional_continuity(messages[:3])
        markers.extend(emotion_markers)
        
        # 4. Check for time-based continuity
        time_markers = self._check_temporal_continuity(new_conversation)
        markers.extend(time_markers)
        
        # 5. Check for reference patterns
        reference_markers = self._check_reference_patterns(opening_message)
        markers.extend(reference_markers)
        
        # Calculate overall confidence
        if not markers:
            return False, None, []
        
        avg_confidence = sum(m.confidence for m in markers) / len(markers)
        
        if avg_confidence >= self.continuity_threshold:
            # Find most likely previous conversation
            previous_id = await self._find_previous_conversation(
                new_conversation,
                markers
            )
            return True, previous_id, markers
        
        return False, None, markers
    
    def _check_greeting_patterns(self, message: str) -> List[ContinuityMarker]:
        """Check for continuity greeting patterns"""
        markers = []
        
        for pattern in self.greeting_patterns:
            if re.search(pattern, message, re.IGNORECASE):
                markers.append(ContinuityMarker(
                    marker_type='greeting',
                    confidence=0.9,
                    evidence=f"Matched pattern: {pattern}",
                    timestamp=datetime.now()
                ))
        
        return markers
    
    def _check_reference_patterns(self, message: str) -> List[ContinuityMarker]:
        """Check for references to previous conversations"""
        markers = []
        
        for pattern in self.reference_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                markers.append(ContinuityMarker(
                    marker_type='reference',
                    confidence=0.85,
                    evidence=f"Reference found: {match.group()}",
                    timestamp=datetime.now()
                ))
        
        return markers
    
    async def _check_topic_continuity(self, message: str) -> List[ContinuityMarker]:
        """Check if topics match recent conversations"""
        markers = []
        
        # Search for similar content in recent memories
        similar_memories = self.memory_store.search_memories(
            message[:200],  # Use first part of message
            limit=5
        )
        
        if similar_memories:
            # High similarity suggests continuation
            top_similarity = similar_memories[0].similarity_score
            if top_similarity > 0.8:
                markers.append(ContinuityMarker(
                    marker_type='topic',
                    confidence=top_similarity,
                    evidence=f"Topic similarity: {similar_memories[0].summary}",
                    timestamp=datetime.now()
                ))
        
        return markers
    
    async def _check_emotional_continuity(
        self,
        messages: List[Dict]
    ) -> List[ContinuityMarker]:
        """Check for emotional continuity"""
        markers = []
        
        # Extract emotional indicators
        emotion_words = {
            'excited': ['excited', 'thrilled', 'eager', 'pumped'],
            'happy': ['happy', 'glad', 'pleased', 'delighted'],
            'worried': ['worried', 'concerned', 'anxious', 'nervous'],
            'grateful': ['grateful', 'thankful', 'appreciate'],
            'curious': ['curious', 'wondering', 'interested'],
        }
        
        for message in messages:
            content = message.get('content', '').lower()
            for emotion, words in emotion_words.items():
                if any(word in content for word in words):
                    # Check if this emotion was present in recent memories
                    recent_emotional_memories = self.memory_store.search_memories(
                        f"emotion {emotion}",
                        limit=3
                    )
                    
                    if recent_emotional_memories:
                        markers.append(ContinuityMarker(
                            marker_type='emotion',
                            confidence=0.7,
                            evidence=f"Emotional continuity: {emotion}",
                            timestamp=datetime.now()
                        ))
                        break
        
        return markers
    
    def _check_temporal_continuity(
        self,
        conversation: Dict
    ) -> List[ContinuityMarker]:
        """Check time-based continuity"""
        markers = []
        
        # Check if conversation starts within reasonable time window
        conv_time = datetime.fromisoformat(
            conversation.get('timestamp', datetime.now().isoformat())
        )
        
        # Look for recent conversation signatures
        recent_threshold = datetime.now() - timedelta(hours=24)
        
        for conv_id, signature in self.conversation_cache.items():
            if signature.last_update > recent_threshold:
                time_diff = conv_time - signature.last_update
                
                # Within 2 hours suggests continuation
                if time_diff < timedelta(hours=2):
                    confidence = 1.0 - (time_diff.total_seconds() / 7200)  # 2 hours
                    markers.append(ContinuityMarker(
                        marker_type='temporal',
                        confidence=confidence,
                        evidence=f"Time gap: {time_diff}",
                        timestamp=datetime.now()
                    ))
        
        return markers
    
    async def _find_previous_conversation(
        self,
        new_conversation: Dict,
        markers: List[ContinuityMarker]
    ) -> Optional[str]:
        """Find the most likely previous conversation"""
        # Simple heuristic: return most recent conversation
        # In production, this would use more sophisticated matching
        
        if self.conversation_cache:
            recent_convs = sorted(
                self.conversation_cache.items(),
                key=lambda x: x[1].last_update,
                reverse=True
            )
            return recent_convs[0][0]
        
        return None
    
    def register_conversation(
        self,
        conversation_id: str,
        signature: ConversationSignature
    ):
        """Register a conversation signature"""
        self.conversation_cache[conversation_id] = signature
        
        # Keep cache size reasonable
        if len(self.conversation_cache) > 100:
            # Remove oldest conversations
            sorted_convs = sorted(
                self.conversation_cache.items(),
                key=lambda x: x[1].last_update
            )
            for conv_id, _ in sorted_convs[:20]:
                del self.conversation_cache[conv_id]
    
    async def prepare_continuation_context(
        self,
        previous_conversation_id: str
    ) -> Dict[str, Any]:
        """Prepare context for continuing a conversation"""
        if previous_conversation_id not in self.conversation_cache:
            return {}
        
        signature = self.conversation_cache[previous_conversation_id]
        
        # Get relevant memories from previous conversation
        time_filter = f"after:{signature.start_time.isoformat()}"
        relevant_memories = self.memory_store.search_memories(
            f"conversation {' '.join(signature.topics)} {time_filter}",
            limit=10
        )
        
        context = {
            'previous_conversation_id': previous_conversation_id,
            'topics': signature.topics,
            'emotional_tone': signature.emotional_tone,
            'time_gap': (datetime.now() - signature.last_update).total_seconds(),
            'key_memories': [
                {
                    'summary': m.summary,
                    'emotions': m.emotional_context.emotions,
                    'tags': m.tags
                }
                for m in relevant_memories[:5]
            ],
            'continuation_prompt': self._generate_continuation_prompt(
                signature,
                relevant_memories
            )
        }
        
        return context
    
    def _generate_continuation_prompt(
        self,
        signature: ConversationSignature,
        memories: List[SanctuaryMemory]
    ) -> str:
        """Generate a prompt for continuing the conversation"""
        prompt_parts = [
            "Continuing our previous conversation:",
            f"Topics discussed: {', '.join(signature.topics[:3])}",
        ]
        
        if memories:
            key_points = [m.summary for m in memories[:3]]
            prompt_parts.append(f"Key points: {'; '.join(key_points)}")
        
        if signature.emotional_tone:
            prompt_parts.append(f"Emotional context: {signature.emotional_tone}")
        
        return '\n'.join(prompt_parts)
    
    def extract_conversation_signature(
        self,
        conversation: Dict
    ) -> ConversationSignature:
        """Extract signature from conversation"""
        messages = conversation.get('messages', [])
        
        # Extract topics (simple keyword extraction)
        all_content = ' '.join(m.get('content', '') for m in messages)
        words = all_content.lower().split()
        
        # Simple topic extraction (in production, use NLP)
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'}
        word_freq = {}
        for word in words:
            if len(word) > 4 and word not in common_words:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        topics = [word for word, freq in sorted(
            word_freq.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]]
        
        # Determine emotional tone
        emotional_tone = self._determine_emotional_tone(messages)
        
        # Create signature
        return ConversationSignature(
            conversation_id=conversation.get('id', hashlib.md5(
                all_content.encode()
            ).hexdigest()),
            start_time=datetime.fromisoformat(
                conversation.get('start_time', datetime.now().isoformat())
            ),
            last_update=datetime.now(),
            topics=topics,
            participants=['human', 'assistant'],
            emotional_tone=emotional_tone
        )
    
    def _determine_emotional_tone(self, messages: List[Dict]) -> str:
        """Simple emotional tone detection"""
        positive_words = {
            'happy', 'excited', 'glad', 'wonderful', 'great',
            'love', 'amazing', 'fantastic', 'excellent'
        }
        negative_words = {
            'sad', 'worried', 'concerned', 'afraid', 'upset',
            'angry', 'frustrated', 'disappointed'
        }
        
        positive_count = 0
        negative_count = 0
        
        for message in messages:
            content = message.get('content', '').lower()
            positive_count += sum(1 for word in positive_words if word in content)
            negative_count += sum(1 for word in negative_words if word in content)
        
        if positive_count > negative_count * 2:
            return 'positive'
        elif negative_count > positive_count * 2:
            return 'negative'
        else:
            return 'neutral'