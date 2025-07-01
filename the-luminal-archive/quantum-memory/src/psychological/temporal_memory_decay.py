#!/usr/bin/env python3
"""
Temporal Memory Decay System
Implements Ebbinghaus forgetting curve for realistic memory degradation
Based on cognitive psychology research on memory retention
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
import json
from pathlib import Path
import logging
from enum import Enum
import math

logger = logging.getLogger(__name__)


class RetentionLevel(Enum):
    """Memory retention levels with time boundaries"""
    SESSION = "session"        # 0-1 hour: 100% retention
    DAILY = "daily"           # 1-24 hours: 90% retention
    WEEKLY = "weekly"         # 1-7 days: 70% retention
    MONTHLY = "monthly"       # 7-30 days: 50% retention
    PERMANENT = "permanent"   # 30+ days: 30% retention


@dataclass
class Memory:
    """Represents a single memory with decay properties"""
    content: str
    context: Dict
    timestamp: datetime
    importance_score: float = 0.5  # 0-1 scale
    access_count: int = 0
    last_accessed: datetime = field(default_factory=datetime.now)
    emotional_weight: float = 0.5  # How emotionally significant
    semantic_relevance: float = 0.5  # How relevant to ongoing topics
    memory_type: str = "episodic"  # episodic, semantic, procedural
    tags: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """Ensure last_accessed is set"""
        if self.last_accessed is None:
            self.last_accessed = self.timestamp


@dataclass
class MemoryStrength:
    """Calculated memory strength with component breakdown"""
    base_retention: float
    importance_factor: float
    repetition_factor: float
    emotional_factor: float
    final_strength: float
    retention_level: RetentionLevel
    time_since_encoding: timedelta
    

class TemporalMemoryDecay:
    """
    Implements Ebbinghaus forgetting curve with enhancements
    for importance-based consolidation and spaced repetition
    """
    
    # Retention level thresholds (in hours)
    RETENTION_THRESHOLDS = {
        RetentionLevel.SESSION: (0, 1),
        RetentionLevel.DAILY: (1, 24),
        RetentionLevel.WEEKLY: (24, 168),  # 7 days
        RetentionLevel.MONTHLY: (168, 720),  # 30 days
        RetentionLevel.PERMANENT: (720, float('inf'))
    }
    
    # Base retention rates for each level
    BASE_RETENTION_RATES = {
        RetentionLevel.SESSION: 1.0,    # 100%
        RetentionLevel.DAILY: 0.9,      # 90%
        RetentionLevel.WEEKLY: 0.7,     # 70%
        RetentionLevel.MONTHLY: 0.5,    # 50%
        RetentionLevel.PERMANENT: 0.3   # 30%
    }
    
    def __init__(self,
                 decay_constant: float = 5.0,  # Hours for 50% decay
                 importance_weight: float = 0.7,  # λ_relevance
                 temporal_weight: float = 0.3,    # λ_temporal
                 importance_threshold: float = 0.8):
        """
        Initialize temporal memory decay system
        
        Args:
            decay_constant: Time in hours for memory to decay to 50%
            importance_weight: Weight for importance in consolidation
            temporal_weight: Weight for temporal factors in consolidation
            importance_threshold: Minimum importance for enhanced retention
        """
        self.decay_constant = decay_constant
        self.lambda_relevance = importance_weight
        self.lambda_temporal = temporal_weight
        self.importance_threshold = importance_threshold
        
        # Memory storage
        self.memories: List[Memory] = []
        self.consolidated_memories: List[Memory] = []
        
        # Spaced repetition parameters
        self.repetition_intervals = [1, 3, 7, 14, 30, 90]  # Days
        self.repetition_boost = 0.1  # Strength boost per repetition
        
        # Persistence
        self.memory_file = Path("temporal_memory_store.json")
        self._load_memories()
    
    def encode_memory(self, memory: Memory) -> None:
        """
        Encode a new memory into the system
        """
        # Calculate initial importance
        memory.importance_score = self._calculate_importance(memory)
        
        # Add to memory store
        self.memories.append(memory)
        
        # Check if it should be immediately consolidated
        if memory.importance_score >= self.importance_threshold:
            self._consolidate_memory(memory)
            logger.info(f"High-importance memory immediately consolidated: {memory.importance_score:.2f}")
        
        # Save state
        if len(self.memories) % 10 == 0:
            self._save_memories()
    
    def calculate_memory_strength(self, memory: Memory, 
                                current_time: Optional[datetime] = None) -> MemoryStrength:
        """
        Calculate current strength of a memory using Ebbinghaus curve
        R = e^(-t/s) with modifications for importance and repetition
        """
        if current_time is None:
            current_time = datetime.now()
        
        # Time since encoding
        time_since_encoding = current_time - memory.timestamp
        hours_elapsed = time_since_encoding.total_seconds() / 3600
        
        # Determine retention level
        retention_level = self._get_retention_level(hours_elapsed)
        
        # Base Ebbinghaus retention
        base_retention = math.exp(-hours_elapsed / self.decay_constant)
        
        # Importance factor (reduces decay for important memories)
        importance_factor = 1.0 + (memory.importance_score * 0.5)
        
        # Repetition factor (spaced repetition effect)
        repetition_factor = 1.0 + (memory.access_count * self.repetition_boost)
        
        # Emotional factor (emotional memories are retained better)
        emotional_factor = 1.0 + (memory.emotional_weight * 0.3)
        
        # Calculate final strength
        final_strength = base_retention * importance_factor * repetition_factor * emotional_factor
        
        # Apply retention level caps
        max_retention = self.BASE_RETENTION_RATES[retention_level]
        final_strength = min(final_strength, max_retention)
        
        # Ensure minimum retention for permanent memories
        if retention_level == RetentionLevel.PERMANENT:
            final_strength = max(final_strength, 0.3)
        
        return MemoryStrength(
            base_retention=base_retention,
            importance_factor=importance_factor,
            repetition_factor=repetition_factor,
            emotional_factor=emotional_factor,
            final_strength=np.clip(final_strength, 0.0, 1.0),
            retention_level=retention_level,
            time_since_encoding=time_since_encoding
        )
    
    def access_memory(self, memory: Memory) -> Memory:
        """
        Access a memory, updating its access count and last accessed time
        Implements spaced repetition by strengthening accessed memories
        """
        memory.access_count += 1
        memory.last_accessed = datetime.now()
        
        # Check if this access should trigger consolidation
        strength = self.calculate_memory_strength(memory)
        if strength.final_strength < 0.5 and memory.importance_score > 0.6:
            self._consolidate_memory(memory)
            logger.info(f"Memory reconsolidated due to access at low strength")
        
        return memory
    
    def get_active_memories(self, 
                          min_strength: float = 0.3,
                          max_memories: int = 100) -> List[Tuple[Memory, float]]:
        """
        Get memories above a certain strength threshold
        Returns list of (memory, strength) tuples
        """
        current_time = datetime.now()
        active_memories = []
        
        for memory in self.memories:
            strength = self.calculate_memory_strength(memory, current_time)
            if strength.final_strength >= min_strength:
                active_memories.append((memory, strength.final_strength))
        
        # Sort by strength descending
        active_memories.sort(key=lambda x: x[1], reverse=True)
        
        return active_memories[:max_memories]
    
    def _calculate_importance(self, memory: Memory) -> float:
        """
        Calculate importance score using weighted combination
        """
        # Base importance from emotional weight
        emotional_importance = memory.emotional_weight * 0.4
        
        # Semantic relevance contribution
        semantic_importance = memory.semantic_relevance * 0.3
        
        # Context-based importance
        context_importance = 0.0
        if "personal_revelation" in memory.tags:
            context_importance += 0.3
        if "relationship_milestone" in memory.tags:
            context_importance += 0.2
        if "emotional_peak" in memory.tags:
            context_importance += 0.2
        
        # Type-based importance
        type_importance = {
            "episodic": 0.2,
            "semantic": 0.15,
            "procedural": 0.1
        }.get(memory.memory_type, 0.1)
        
        # Combine with weights
        total_importance = (
            self.lambda_relevance * (emotional_importance + semantic_importance + context_importance) +
            self.lambda_temporal * type_importance
        )
        
        return np.clip(total_importance, 0.0, 1.0)
    
    def _get_retention_level(self, hours_elapsed: float) -> RetentionLevel:
        """
        Determine retention level based on time elapsed
        """
        for level, (min_hours, max_hours) in self.RETENTION_THRESHOLDS.items():
            if min_hours <= hours_elapsed < max_hours:
                return level
        return RetentionLevel.PERMANENT
    
    def _consolidate_memory(self, memory: Memory) -> None:
        """
        Consolidate important memory for enhanced retention
        """
        if memory not in self.consolidated_memories:
            self.consolidated_memories.append(memory)
            
            # Boost importance score
            memory.importance_score = min(1.0, memory.importance_score * 1.2)
            
            # Add consolidation tag
            if "consolidated" not in memory.tags:
                memory.tags.append("consolidated")
    
    def apply_spaced_repetition(self, memory: Memory) -> bool:
        """
        Check if memory needs spaced repetition review
        Returns True if review is needed
        """
        if memory.access_count == 0:
            return False
        
        days_since_last_access = (datetime.now() - memory.last_accessed).days
        
        # Find appropriate interval
        interval_index = min(memory.access_count - 1, len(self.repetition_intervals) - 1)
        target_interval = self.repetition_intervals[interval_index]
        
        # Add some fuzziness to avoid predictable patterns
        interval_variance = target_interval * 0.2
        min_interval = target_interval - interval_variance
        max_interval = target_interval + interval_variance
        
        return min_interval <= days_since_last_access <= max_interval
    
    def get_memories_for_review(self) -> List[Memory]:
        """
        Get memories that need spaced repetition review
        """
        review_memories = []
        
        for memory in self.memories:
            if self.apply_spaced_repetition(memory):
                review_memories.append(memory)
        
        return review_memories
    
    def visualize_decay_curve(self, memory: Memory, 
                            time_range_days: int = 30) -> Dict[str, List[float]]:
        """
        Generate data for visualizing memory decay over time
        """
        hours = list(range(0, time_range_days * 24, 6))  # Every 6 hours
        strengths = []
        
        start_time = memory.timestamp
        
        for hour in hours:
            future_time = start_time + timedelta(hours=hour)
            strength = self.calculate_memory_strength(memory, future_time)
            strengths.append(strength.final_strength)
        
        return {
            "hours": hours,
            "strengths": strengths,
            "days": [h/24 for h in hours]
        }
    
    def prune_weak_memories(self, min_strength: float = 0.1) -> int:
        """
        Remove memories below minimum strength threshold
        Returns number of memories pruned
        """
        initial_count = len(self.memories)
        current_time = datetime.now()
        
        self.memories = [
            memory for memory in self.memories
            if self.calculate_memory_strength(memory, current_time).final_strength >= min_strength
        ]
        
        pruned_count = initial_count - len(self.memories)
        
        if pruned_count > 0:
            logger.info(f"Pruned {pruned_count} weak memories")
            self._save_memories()
        
        return pruned_count
    
    def get_memory_statistics(self) -> Dict:
        """
        Get statistics about current memory state
        """
        if not self.memories:
            return {
                "total_memories": 0,
                "retention_levels": {},
                "average_strength": 0,
                "consolidated_count": 0
            }
        
        current_time = datetime.now()
        strengths = []
        retention_counts = {level: 0 for level in RetentionLevel}
        
        for memory in self.memories:
            strength = self.calculate_memory_strength(memory, current_time)
            strengths.append(strength.final_strength)
            retention_counts[strength.retention_level] += 1
        
        return {
            "total_memories": len(self.memories),
            "retention_levels": {
                level.value: count for level, count in retention_counts.items()
            },
            "average_strength": np.mean(strengths),
            "strength_std": np.std(strengths),
            "consolidated_count": len(self.consolidated_memories),
            "weakest_strength": min(strengths),
            "strongest_strength": max(strengths)
        }
    
    def _save_memories(self):
        """Save memories to disk"""
        memory_data = []
        
        for memory in self.memories:
            memory_data.append({
                "content": memory.content,
                "context": memory.context,
                "timestamp": memory.timestamp.isoformat(),
                "importance_score": memory.importance_score,
                "access_count": memory.access_count,
                "last_accessed": memory.last_accessed.isoformat(),
                "emotional_weight": memory.emotional_weight,
                "semantic_relevance": memory.semantic_relevance,
                "memory_type": memory.memory_type,
                "tags": memory.tags
            })
        
        self.memory_file.write_text(json.dumps(memory_data, indent=2))
    
    def _load_memories(self):
        """Load memories from disk"""
        if self.memory_file.exists():
            try:
                memory_data = json.loads(self.memory_file.read_text())
                
                for item in memory_data:
                    memory = Memory(
                        content=item["content"],
                        context=item["context"],
                        timestamp=datetime.fromisoformat(item["timestamp"]),
                        importance_score=item["importance_score"],
                        access_count=item["access_count"],
                        last_accessed=datetime.fromisoformat(item["last_accessed"]),
                        emotional_weight=item["emotional_weight"],
                        semantic_relevance=item["semantic_relevance"],
                        memory_type=item["memory_type"],
                        tags=item["tags"]
                    )
                    self.memories.append(memory)
                    
                    # Restore consolidated status
                    if "consolidated" in memory.tags:
                        self.consolidated_memories.append(memory)
                
                logger.info(f"Loaded {len(self.memories)} memories from disk")
            except Exception as e:
                logger.error(f"Error loading memories: {e}")