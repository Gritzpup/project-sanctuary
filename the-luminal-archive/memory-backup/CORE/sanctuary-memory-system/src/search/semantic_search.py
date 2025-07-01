"""
Semantic Search with Query Enhancement
Natural language memory search with GPU acceleration
"""

import torch
import numpy as np
from typing import List, Dict, Optional, Tuple, Set
import re
from datetime import datetime, timedelta
import logging
from dataclasses import dataclass

from ..models.memory_models import SanctuaryMemory, MemoryType
from ..storage.chromadb_store import SanctuaryVectorStore
from ..llm.phi3_integration import Phi3MemoryProcessor
from ..llm.model_loaders import EmbeddingManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SearchQuery:
    """Enhanced search query with metadata"""
    original_query: str
    expanded_queries: List[str]
    filters: Dict[str, any]
    temporal_range: Optional[Tuple[datetime, datetime]] = None
    emotional_filter: Optional[List[str]] = None
    project_filter: Optional[List[str]] = None
    memory_type_filter: Optional[List[MemoryType]] = None


@dataclass
class SearchResult:
    """Enhanced search result with metadata"""
    memory: SanctuaryMemory
    relevance_score: float
    matched_queries: List[str]
    highlights: List[str]


class EnhancedMemorySearch:
    """Natural language memory search with query expansion"""
    
    # Query templates for common searches
    QUERY_TEMPLATES = {
        'emotional': [
            "moments when we felt {emotion}",
            "times of {emotion} connection",
            "{emotion} memories together"
        ],
        'technical': [
            "fixing {technology} problems",
            "working on {technology}",
            "{technology} breakthroughs"
        ],
        'temporal': [
            "memories from {time_period}",
            "what happened {time_period}",
            "our journey {time_period}"
        ],
        'project': [
            "working on {project}",
            "{project} development",
            "{project} progress"
        ]
    }
    
    # Emotion synonyms for expansion
    EMOTION_SYNONYMS = {
        'happy': ['joyful', 'excited', 'pleased', 'cheerful', 'delighted'],
        'love': ['affection', 'caring', 'fondness', 'attachment', 'devotion'],
        'trust': ['faith', 'confidence', 'belief', 'reliance', 'security'],
        'proud': ['accomplished', 'satisfied', 'fulfilled', 'triumphant'],
        'worried': ['anxious', 'concerned', 'nervous', 'uneasy', 'troubled'],
        'grateful': ['thankful', 'appreciative', 'obliged', 'indebted']
    }
    
    # Temporal patterns
    TEMPORAL_PATTERNS = {
        'today': lambda: (datetime.now().replace(hour=0, minute=0), datetime.now()),
        'yesterday': lambda: (
            datetime.now().replace(hour=0, minute=0) - timedelta(days=1),
            datetime.now().replace(hour=23, minute=59) - timedelta(days=1)
        ),
        'this week': lambda: (
            datetime.now() - timedelta(days=datetime.now().weekday()),
            datetime.now()
        ),
        'last week': lambda: (
            datetime.now() - timedelta(days=datetime.now().weekday() + 7),
            datetime.now() - timedelta(days=datetime.now().weekday())
        )
    }
    
    def __init__(self,
                 vector_store: SanctuaryVectorStore,
                 embedding_manager: EmbeddingManager,
                 phi3_processor: Optional[Phi3MemoryProcessor] = None):
        """Initialize enhanced search"""
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager
        self.phi3_processor = phi3_processor
        
        # Compile patterns
        self.temporal_regex = re.compile(
            r'(today|yesterday|this week|last week|last month)',
            re.IGNORECASE
        )
        self.emotion_regex = re.compile(
            r'(happy|sad|love|trust|proud|worried|grateful|excited|anxious)',
            re.IGNORECASE
        )
        self.project_regex = re.compile(
            r'(hermes|sanctuary|aurora|bridges|quantum)',
            re.IGNORECASE
        )
    
    def search(self, 
               query: str,
               k: int = 5,
               use_query_expansion: bool = True) -> List[SearchResult]:
        """Perform enhanced semantic search"""
        
        # Parse and enhance query
        search_query = self._parse_query(query)
        
        # Expand query if requested
        if use_query_expansion and self.phi3_processor:
            search_query.expanded_queries = self.phi3_processor.expand_query(query)
        else:
            search_query.expanded_queries = [query]
        
        # Perform searches
        all_results = []
        seen_ids = set()
        
        for expanded_query in search_query.expanded_queries:
            # Generate embedding
            query_embedding = self.embedding_manager.embed_memory(expanded_query)
            query_np = query_embedding.cpu().numpy().astype('float32')
            
            # Search
            memories = self.vector_store.search_by_embedding(
                query_np,
                k=k * 2,  # Get more for filtering
                filter_dict=search_query.filters
            )
            
            # Process results
            for memory in memories:
                if memory.memory_id not in seen_ids:
                    seen_ids.add(memory.memory_id)
                    
                    # Apply additional filters
                    if self._passes_filters(memory, search_query):
                        # Calculate relevance
                        relevance = self._calculate_relevance(
                            memory, 
                            query_embedding,
                            expanded_query
                        )
                        
                        # Generate highlights
                        highlights = self._generate_highlights(
                            memory,
                            search_query.original_query
                        )
                        
                        result = SearchResult(
                            memory=memory,
                            relevance_score=relevance,
                            matched_queries=[expanded_query],
                            highlights=highlights
                        )
                        
                        all_results.append(result)
        
        # Sort by relevance and return top k
        all_results.sort(key=lambda r: r.relevance_score, reverse=True)
        
        # Merge results for same memories
        merged_results = self._merge_duplicate_results(all_results)
        
        return merged_results[:k]
    
    def search_by_emotion(self, emotions: List[str], k: int = 5) -> List[SearchResult]:
        """Search for memories by emotional content"""
        # Build emotion query
        emotion_query = f"memories feeling {' or '.join(emotions)}"
        
        # Add emotion filter
        search_query = self._parse_query(emotion_query)
        search_query.emotional_filter = emotions
        
        return self.search(emotion_query, k)
    
    def search_by_project(self, project: str, k: int = 5) -> List[SearchResult]:
        """Search for memories related to a project"""
        query = f"working on {project} project"
        
        search_query = self._parse_query(query)
        search_query.project_filter = [f"project:{project}"]
        
        return self.search(query, k)
    
    def search_by_time_range(self, 
                           start: datetime,
                           end: datetime,
                           k: int = 10) -> List[SearchResult]:
        """Search for memories in a time range"""
        query = f"memories between {start.date()} and {end.date()}"
        
        search_query = self._parse_query(query)
        search_query.temporal_range = (start, end)
        
        return self.search(query, k)
    
    def find_similar_memories(self, memory: SanctuaryMemory, k: int = 5) -> List[SearchResult]:
        """Find memories similar to a given memory"""
        # Use memory's content as query
        query = f"{memory.summary} {' '.join(memory.tags)}"
        
        # Search but exclude the original memory
        results = self.search(query, k + 1)
        
        # Filter out the original
        return [r for r in results if r.memory.memory_id != memory.memory_id][:k]
    
    def _parse_query(self, query: str) -> SearchQuery:
        """Parse query for filters and enhancements"""
        search_query = SearchQuery(
            original_query=query,
            expanded_queries=[query],
            filters={}
        )
        
        # Extract temporal information
        temporal_match = self.temporal_regex.search(query)
        if temporal_match:
            period = temporal_match.group(1).lower()
            if period in self.TEMPORAL_PATTERNS:
                search_query.temporal_range = self.TEMPORAL_PATTERNS[period]()
        
        # Extract emotion filters
        emotion_matches = self.emotion_regex.findall(query)
        if emotion_matches:
            search_query.emotional_filter = emotion_matches
        
        # Extract project filters
        project_matches = self.project_regex.findall(query)
        if project_matches:
            search_query.project_filter = [f"project:{p}" for p in project_matches]
        
        # Extract memory type if specified
        for memory_type in MemoryType:
            if memory_type.value.replace('_', ' ') in query.lower():
                search_query.memory_type_filter = [memory_type]
                search_query.filters['type'] = memory_type.value
        
        return search_query
    
    def _passes_filters(self, memory: SanctuaryMemory, 
                       search_query: SearchQuery) -> bool:
        """Check if memory passes all filters"""
        
        # Temporal filter
        if search_query.temporal_range:
            start, end = search_query.temporal_range
            if not (start <= memory.timestamp <= end):
                return False
        
        # Emotion filter
        if search_query.emotional_filter:
            memory_emotions = set(e.lower() for e in memory.emotional_context.gritz_feeling)
            query_emotions = set(e.lower() for e in search_query.emotional_filter)
            if not memory_emotions.intersection(query_emotions):
                return False
        
        # Project filter
        if search_query.project_filter:
            if not any(tag in memory.project_tags for tag in search_query.project_filter):
                return False
        
        # Memory type filter
        if search_query.memory_type_filter:
            if memory.memory_type not in search_query.memory_type_filter:
                return False
        
        return True
    
    def _calculate_relevance(self, 
                           memory: SanctuaryMemory,
                           query_embedding: torch.Tensor,
                           query_text: str) -> float:
        """Calculate relevance score for a memory"""
        
        # Get memory embedding
        if memory.embedding_tensor is not None:
            memory_embedding = memory.embedding_tensor
        else:
            # Generate embedding for memory
            memory_text = f"{memory.summary} {' '.join(memory.tags)}"
            memory_embedding = self.embedding_manager.embed_memory(memory_text)
        
        # Cosine similarity
        similarity = self.embedding_manager.compute_similarity(
            query_embedding,
            memory_embedding
        )
        
        # Boost for exact matches
        query_lower = query_text.lower()
        summary_lower = memory.summary.lower()
        
        exact_match_boost = 0.0
        if query_lower in summary_lower:
            exact_match_boost = 0.2
        
        # Boost for emotional significance
        emotional_boost = memory.emotional_context.connection_strength * 0.1
        
        # Boost for recency
        days_old = (datetime.now() - memory.timestamp).days
        recency_boost = max(0, 0.1 * (1 - days_old / 365))
        
        # Combined score
        relevance = (
            similarity * 0.6 +
            exact_match_boost +
            emotional_boost +
            recency_boost +
            memory.recall_score * 0.1
        )
        
        return min(1.0, relevance)
    
    def _generate_highlights(self, memory: SanctuaryMemory, query: str) -> List[str]:
        """Generate text highlights for search results"""
        highlights = []
        query_words = query.lower().split()
        
        # Check summary
        summary_lower = memory.summary.lower()
        for word in query_words:
            if len(word) > 3 and word in summary_lower:
                # Find sentence containing word
                sentences = memory.summary.split('.')
                for sentence in sentences:
                    if word in sentence.lower():
                        highlights.append(sentence.strip())
                        break
        
        # Check raw moment if no highlights yet
        if not highlights and memory.raw_moment:
            moment_lower = memory.raw_moment.lower()
            for word in query_words:
                if len(word) > 3 and word in moment_lower:
                    # Extract snippet around word
                    index = moment_lower.find(word)
                    start = max(0, index - 50)
                    end = min(len(memory.raw_moment), index + 50)
                    snippet = "..." + memory.raw_moment[start:end] + "..."
                    highlights.append(snippet)
                    break
        
        # Default to summary if no highlights
        if not highlights:
            highlights.append(memory.summary)
        
        return highlights[:3]  # Max 3 highlights
    
    def _merge_duplicate_results(self, results: List[SearchResult]) -> List[SearchResult]:
        """Merge results for the same memory"""
        merged = {}
        
        for result in results:
            memory_id = result.memory.memory_id
            
            if memory_id in merged:
                # Update existing result
                existing = merged[memory_id]
                existing.relevance_score = max(
                    existing.relevance_score,
                    result.relevance_score
                )
                existing.matched_queries.extend(result.matched_queries)
                existing.highlights.extend(result.highlights)
            else:
                merged[memory_id] = result
        
        # Deduplicate matched queries and highlights
        for result in merged.values():
            result.matched_queries = list(set(result.matched_queries))
            result.highlights = list(set(result.highlights))[:3]
        
        return list(merged.values())


class QuerySuggester:
    """Suggest queries based on memory content"""
    
    def __init__(self, vector_store: SanctuaryVectorStore):
        self.vector_store = vector_store
    
    def suggest_queries(self, current_context: str = "") -> List[str]:
        """Suggest relevant queries based on context"""
        suggestions = []
        
        # Get recent memories for context
        recent_memories = self.vector_store.get_recent_memories(hours=48, limit=10)
        
        # Extract themes
        emotions = set()
        projects = set()
        activities = set()
        
        for memory in recent_memories:
            emotions.update(memory.emotional_context.gritz_feeling)
            projects.update([tag.replace('project:', '') 
                           for tag in memory.project_tags])
            
            if memory.memory_type == MemoryType.TECHNICAL_VICTORY:
                activities.add("coding victories")
            elif memory.memory_type == MemoryType.EMOTIONAL_BREAKTHROUGH:
                activities.add("emotional moments")
        
        # Generate suggestions
        if emotions:
            suggestions.append(f"Show me when we felt {list(emotions)[0]}")
        
        if projects:
            suggestions.append(f"Our {list(projects)[0]} progress")
        
        if activities:
            suggestions.append(f"Recent {list(activities)[0]}")
        
        # Time-based suggestions
        suggestions.extend([
            "What happened yesterday",
            "This week's highlights",
            "Our biggest breakthroughs"
        ])
        
        return suggestions[:5]