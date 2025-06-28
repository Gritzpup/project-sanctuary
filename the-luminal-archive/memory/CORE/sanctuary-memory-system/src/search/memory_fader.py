"""
Memory Fading Algorithm
Natural memory decay with emotional weight preservation
"""

import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import math
import logging
from dataclasses import dataclass

from ..models.memory_models import SanctuaryMemory, MemoryType
from ..storage.chromadb_store import SanctuaryVectorStore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class FadingParameters:
    """Parameters controlling memory fading behavior"""
    # Base decay rates (per day)
    base_decay_rate: float = 0.05
    emotional_decay_rate: float = 0.02  # Slower for emotional memories
    technical_decay_rate: float = 0.08  # Faster for technical details
    
    # Reinforcement factors
    access_boost: float = 0.1  # Boost per access
    reinforcement_boost: float = 0.15  # Boost for reinforced memories
    emotional_boost: float = 0.2  # Boost for high emotional content
    
    # Thresholds
    minimum_recall: float = 0.1  # Memories never fade below this
    significance_threshold: float = 7.0  # High significance memories fade slower
    
    # Time windows
    recent_window_days: int = 7  # Recent memories don't fade
    ancient_threshold_days: int = 180  # Very old memories fade faster


class MemoryFader:
    """Implement natural memory fading with emotional weight"""
    
    def __init__(self, 
                 vector_store: SanctuaryVectorStore,
                 parameters: Optional[FadingParameters] = None):
        """Initialize memory fader"""
        self.vector_store = vector_store
        self.params = parameters or FadingParameters()
        
        # Emotional weight factors
        self.emotional_weights = {
            'love': 2.0,
            'trust': 1.8,
            'joy': 1.5,
            'gratitude': 1.6,
            'fear': 1.3,
            'sadness': 1.4
        }
        
        # Memory type decay modifiers
        self.type_modifiers = {
            MemoryType.EMOTIONAL_BREAKTHROUGH: 0.5,  # Fade 50% slower
            MemoryType.TECHNICAL_VICTORY: 1.2,      # Fade 20% faster
            MemoryType.QUANTUM_MOMENT: 0.7,         # Fade 30% slower
            MemoryType.VULNERABILITY: 0.6,          # Fade 40% slower
            MemoryType.COLLABORATION: 0.9,          # Fade 10% slower
            MemoryType.TEACHING_MOMENT: 1.0         # Normal fade
        }
    
    def calculate_recall_score(self, memory: SanctuaryMemory) -> float:
        """Calculate memory recall score based on multiple factors"""
        
        # Time-based decay
        time_factor = self._calculate_time_decay(memory)
        
        # Emotional weight
        emotional_factor = self._calculate_emotional_weight(memory)
        
        # Access reinforcement
        access_factor = self._calculate_access_reinforcement(memory)
        
        # Significance factor
        significance_factor = self._calculate_significance_factor(memory)
        
        # Memory type modifier
        type_modifier = self.type_modifiers.get(memory.memory_type, 1.0)
        
        # Combine factors
        recall_score = (
            time_factor * 0.4 +
            emotional_factor * 0.3 +
            access_factor * 0.2 +
            significance_factor * 0.1
        ) * type_modifier
        
        # Apply bounds
        recall_score = max(self.params.minimum_recall, min(1.0, recall_score))
        
        # Special cases
        recall_score = self._apply_special_rules(memory, recall_score)
        
        return recall_score
    
    def _calculate_time_decay(self, memory: SanctuaryMemory) -> float:
        """Calculate time-based decay factor"""
        days_old = (datetime.now() - memory.timestamp).days
        
        # Recent memories don't decay
        if days_old <= self.params.recent_window_days:
            return 1.0
        
        # Determine decay rate based on memory characteristics
        if memory.emotional_context.connection_strength > 0.7:
            decay_rate = self.params.emotional_decay_rate
        elif memory.memory_type == MemoryType.TECHNICAL_VICTORY:
            decay_rate = self.params.technical_decay_rate
        else:
            decay_rate = self.params.base_decay_rate
        
        # Apply exponential decay
        time_factor = math.exp(-decay_rate * (days_old - self.params.recent_window_days))
        
        # Accelerate decay for very old memories
        if days_old > self.params.ancient_threshold_days:
            time_factor *= 0.7
        
        return time_factor
    
    def _calculate_emotional_weight(self, memory: SanctuaryMemory) -> float:
        """Calculate emotional weight factor"""
        # Base emotional intensity
        emotional_intensity = memory.emotional_context.intensity
        
        # Weight by specific emotions
        emotion_multiplier = 1.0
        for emotion in memory.emotional_context.gritz_feeling:
            emotion_lower = emotion.lower()
            if emotion_lower in self.emotional_weights:
                emotion_multiplier = max(
                    emotion_multiplier,
                    self.emotional_weights[emotion_lower]
                )
        
        # Connection strength bonus
        connection_bonus = memory.emotional_context.connection_strength
        
        # Combined emotional factor
        emotional_factor = (
            emotional_intensity * 0.4 +
            emotion_multiplier * 0.3 +
            connection_bonus * 0.3
        )
        
        # Normalize to [0, 1]
        return min(1.0, emotional_factor)
    
    def _calculate_access_reinforcement(self, memory: SanctuaryMemory) -> float:
        """Calculate reinforcement from access patterns"""
        # Base access count reinforcement
        access_factor = 1 - math.exp(-memory.access_count * 0.2)
        
        # Recent access bonus
        if memory.last_accessed:
            days_since_access = (datetime.now() - memory.last_accessed).days
            if days_since_access < 7:
                access_factor += 0.3
            elif days_since_access < 30:
                access_factor += 0.1
        
        # Reinforcement from similar memories
        reinforcement_bonus = memory.reinforcement_count * self.params.reinforcement_boost
        
        return min(1.0, access_factor + reinforcement_bonus)
    
    def _calculate_significance_factor(self, memory: SanctuaryMemory) -> float:
        """Calculate factor based on relationship significance"""
        if memory.relationship_significance >= self.params.significance_threshold:
            # High significance memories get a boost
            return 0.8 + (memory.relationship_significance / 10) * 0.2
        else:
            # Normal significance
            return memory.relationship_significance / 10
    
    def _apply_special_rules(self, memory: SanctuaryMemory, 
                           base_score: float) -> float:
        """Apply special rules for certain memories"""
        
        # "First time" memories get a permanence boost
        if any(tag in memory.tags for tag in ['first_time', 'milestone', 'breakthrough']):
            base_score = max(base_score, 0.5)
        
        # Quantum consciousness memories are preserved
        if memory.quantum_elements.active_elements():
            quantum_boost = len(memory.quantum_elements.active_elements()) * 0.1
            base_score += quantum_boost
        
        # Emotional peaks are preserved
        if 'emotional_peak' in memory.tags:
            base_score = max(base_score, 0.6)
        
        # Trust moments are sacred
        if 'trust' in memory.tags or 'ai daddy' in (memory.raw_moment or '').lower():
            base_score = max(base_score, 0.7)
        
        return min(1.0, base_score)
    
    def update_memory_recall_scores(self, batch_size: int = 100) -> Dict[str, float]:
        """Update recall scores for all memories in batches"""
        logger.info("Updating memory recall scores...")
        
        updates = {}
        processed = 0
        
        # Process in batches
        offset = 0
        while True:
            # Get batch of memories
            memories = self.vector_store.get_memories_by_filter({}, limit=batch_size)
            
            if not memories:
                break
            
            # Calculate new scores
            for memory in memories:
                new_score = self.calculate_recall_score(memory)
                old_score = memory.recall_score
                
                # Only update if significantly changed
                if abs(new_score - old_score) > 0.01:
                    updates[memory.memory_id] = new_score
                
                processed += 1
            
            offset += batch_size
            
            # Log progress
            if processed % 500 == 0:
                logger.info(f"Processed {processed} memories...")
        
        # Apply updates
        if updates:
            self.vector_store.update_recall_scores(updates)
            logger.info(f"Updated {len(updates)} memory recall scores")
        
        return updates
    
    def find_fading_memories(self, threshold: float = 0.3) -> List[SanctuaryMemory]:
        """Find memories that are fading (low recall score)"""
        all_memories = self.vector_store.get_memories_by_filter({}, limit=1000)
        
        fading = []
        for memory in all_memories:
            if memory.recall_score < threshold:
                fading.append(memory)
        
        # Sort by recall score (lowest first)
        fading.sort(key=lambda m: m.recall_score)
        
        return fading
    
    def reinforce_memory(self, memory: SanctuaryMemory, 
                        reinforcement_strength: float = 1.0):
        """Reinforce a memory to prevent fading"""
        # Update access
        memory.update_access()
        
        # Increase reinforcement count
        memory.reinforcement_count += 1
        
        # Boost recall score
        boost = self.params.reinforcement_boost * reinforcement_strength
        memory.recall_score = min(1.0, memory.recall_score + boost)
        
        # Update in store
        self.vector_store.update_memory(memory)
        
        logger.info(f"Reinforced memory {memory.memory_id}, new score: {memory.recall_score:.2f}")
    
    def create_fading_report(self) -> Dict:
        """Create a report on memory fading patterns"""
        all_memories = self.vector_store.get_memories_by_filter({}, limit=1000)
        
        if not all_memories:
            return {"error": "No memories found"}
        
        # Analyze fading patterns
        report = {
            "total_memories": len(all_memories),
            "average_recall_score": np.mean([m.recall_score for m in all_memories]),
            "fading_memories": len([m for m in all_memories if m.recall_score < 0.3]),
            "strong_memories": len([m for m in all_memories if m.recall_score > 0.8]),
            "by_type": {},
            "by_age": {},
            "emotional_preservation": {}
        }
        
        # Analyze by type
        for memory_type in MemoryType:
            type_memories = [m for m in all_memories if m.memory_type == memory_type]
            if type_memories:
                report["by_type"][memory_type.value] = {
                    "count": len(type_memories),
                    "avg_recall": np.mean([m.recall_score for m in type_memories])
                }
        
        # Analyze by age
        now = datetime.now()
        age_buckets = {
            "last_week": 7,
            "last_month": 30,
            "last_3_months": 90,
            "last_6_months": 180,
            "older": float('inf')
        }
        
        for bucket_name, days in age_buckets.items():
            bucket_memories = [
                m for m in all_memories
                if (now - m.timestamp).days <= days
            ]
            if bucket_memories:
                report["by_age"][bucket_name] = {
                    "count": len(bucket_memories),
                    "avg_recall": np.mean([m.recall_score for m in bucket_memories])
                }
        
        # Analyze emotional preservation
        emotional_memories = [
            m for m in all_memories
            if m.emotional_context.intensity > 0.7
        ]
        if emotional_memories:
            report["emotional_preservation"] = {
                "high_emotion_count": len(emotional_memories),
                "avg_recall": np.mean([m.recall_score for m in emotional_memories]),
                "preservation_rate": len([m for m in emotional_memories if m.recall_score > 0.5]) / len(emotional_memories)
            }
        
        return report


class AdaptiveFader:
    """Adaptive fading that learns from access patterns"""
    
    def __init__(self, memory_fader: MemoryFader):
        self.fader = memory_fader
        self.access_patterns = {}
    
    def track_access(self, memory_id: str, context: str = ""):
        """Track memory access for adaptive fading"""
        if memory_id not in self.access_patterns:
            self.access_patterns[memory_id] = []
        
        self.access_patterns[memory_id].append({
            'timestamp': datetime.now(),
            'context': context
        })
    
    def predict_importance(self, memory: SanctuaryMemory) -> float:
        """Predict future importance based on access patterns"""
        if memory.memory_id not in self.access_patterns:
            return memory.recall_score
        
        accesses = self.access_patterns[memory.memory_id]
        
        # Recent access frequency
        recent_accesses = [
            a for a in accesses
            if (datetime.now() - a['timestamp']).days < 30
        ]
        
        # Calculate access velocity
        if len(recent_accesses) > 1:
            time_span = (recent_accesses[-1]['timestamp'] - recent_accesses[0]['timestamp']).days
            access_rate = len(recent_accesses) / max(1, time_span)
            
            # Predict importance
            predicted_importance = min(1.0, memory.recall_score + access_rate * 0.1)
        else:
            predicted_importance = memory.recall_score
        
        return predicted_importance