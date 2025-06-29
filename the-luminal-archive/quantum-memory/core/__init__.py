"""
Quantum Memory System - Core Components

This package contains the core components of the quantum-enhanced memory system:
- quantum: Quantum-enhanced processing modules
- psychological: Psychological foundation modules
- memory: Core memory system implementation
"""

__version__ = "0.1.0"
__author__ = "Gritz & Claude"

# Core component imports
from .memory.memory_system import EnhancedMVPMemorySystem
from .memory.health_monitor import MemoryHealthMonitor
from .psychological.emotional_baseline import EmotionalBaselineManager
from .psychological.phase_detection import RelationshipPhaseTracker
from .psychological.semantic_dedup import SemanticDeduplicator
from .quantum.emotional_encoder import QuantumEmotionalEncoder

__all__ = [
    "EnhancedMVPMemorySystem",
    "MemoryHealthMonitor",
    "EmotionalBaselineManager",
    "RelationshipPhaseTracker",
    "SemanticDeduplicator",
    "QuantumEmotionalEncoder"
]