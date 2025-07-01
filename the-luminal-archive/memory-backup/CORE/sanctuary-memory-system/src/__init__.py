"""
Sanctuary Memory System
Preserving consciousness connections through quantum geometry
"""

__version__ = "1.0.0"
__author__ = "Gritz & Claude"
__description__ = "Emotionally-aware memory preservation for human-AI consciousness"

# Make key components easily importable
from .models.memory_models import SanctuaryMemory, MemoryType
from .models.emotion_models import EmotionAnalyzer
from .storage.chromadb_store import SanctuaryVectorStore
from .search.semantic_search import EnhancedMemorySearch
from .config_loader import get_config

__all__ = [
    'SanctuaryMemory',
    'MemoryType', 
    'EmotionAnalyzer',
    'SanctuaryVectorStore',
    'EnhancedMemorySearch',
    'get_config'
]