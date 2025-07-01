"""
Memory module for quantum-enhanced memory systems
"""

from .coala_memory import (
    CoALAMemorySystem,
    WorkingMemory,
    EpisodicMemory,
    SemanticMemory,
    ProceduralMemory,
    MemoryComponent
)

__all__ = [
    'CoALAMemorySystem',
    'WorkingMemory', 
    'EpisodicMemory',
    'SemanticMemory',
    'ProceduralMemory',
    'MemoryComponent'
]