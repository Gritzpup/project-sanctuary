"""Psychological foundation modules for emotional stability and relationship tracking"""

from .emotional_baseline import EmotionalBaselineManager, EmotionalState
from .phase_detection import RelationshipPhaseTracker
from .semantic_dedup import SemanticDeduplicator
from .emotional_state_tracker import EmotionalStateTracker, EmotionType, MixedEmotion, EmotionalContext
from .temporal_memory_decay import TemporalMemoryDecay, Memory, MemoryStrength, RetentionLevel

__all__ = [
    "EmotionalBaselineManager",
    "EmotionalState",
    "RelationshipPhaseTracker",
    "SemanticDeduplicator",
    "EmotionalStateTracker",
    "EmotionType",
    "MixedEmotion",
    "EmotionalContext",
    "TemporalMemoryDecay",
    "Memory",
    "MemoryStrength",
    "RetentionLevel"
]