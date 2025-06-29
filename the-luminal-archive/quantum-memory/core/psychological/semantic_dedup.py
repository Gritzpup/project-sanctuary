#!/usr/bin/env python3
"""
Semantic Deduplication System
Goes beyond exact matching to identify semantically similar memories
Prevents memory bloat while preserving important variations
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import logging
from sentence_transformers import SentenceTransformer, util
import torch
from collections import defaultdict
import hashlib
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


@dataclass
class MemoryCandidate:
    """Represents a memory being evaluated for deduplication"""
    content: str
    embedding: np.ndarray
    metadata: Dict
    similarity_score: float = 0.0
    cluster_id: Optional[int] = None


class SemanticDeduplicator:
    """
    Advanced semantic deduplication using multiple strategies:
    1. Embedding similarity with dynamic thresholds
    2. Structural pattern matching
    3. Temporal proximity consideration
    4. Importance-weighted decisions
    """
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """
        Initialize with specified embedding model
        
        Args:
            model_name: SentenceTransformer model for embeddings
        """
        self.embedder = SentenceTransformer(model_name)
        
        # Similarity thresholds based on memory type
        self.similarity_thresholds = {
            'factual': 0.95,      # Very high for facts (avoid losing precision)
            'experiential': 0.85,  # Medium for experiences
            'emotional': 0.80,     # Lower for emotions (preserve nuance)
            'conversational': 0.90 # High for conversation snippets
        }
        
        # Clustering parameters
        self.min_cluster_size = 2
        self.eps = 0.15  # DBSCAN neighborhood size
        
        # Pattern templates for structural matching
        self.pattern_templates = self._initialize_patterns()
        
        # Cache for efficiency
        self.embedding_cache = {}
        self.pattern_cache = {}
    
    def should_deduplicate(self, new_memory: str, existing_memories: List[Dict],
                          memory_type: str = 'conversational') -> Tuple[bool, Optional[Dict]]:
        """
        Determine if new memory should be deduplicated
        
        Returns:
            Tuple of (should_dedup, similar_memory_info)
        """
        if not existing_memories:
            return False, None
        
        # Get embedding for new memory
        new_embedding = self._get_embedding(new_memory)
        
        # Quick exact match check
        new_hash = hashlib.sha256(new_memory.encode()).hexdigest()
        for existing in existing_memories:
            if existing.get('content_hash') == new_hash:
                return True, existing
        
        # Semantic similarity check
        threshold = self.similarity_thresholds.get(memory_type, 0.85)
        most_similar = self._find_most_similar(new_embedding, existing_memories)
        
        if most_similar and most_similar['similarity'] > threshold:
            # Check if it's actually a duplicate or important variation
            if self._is_important_variation(new_memory, most_similar['memory'], memory_type):
                return False, None
            return True, most_similar['memory']
        
        # Pattern-based deduplication
        if self._matches_existing_pattern(new_memory, existing_memories):
            return True, self._find_pattern_match(new_memory, existing_memories)
        
        return False, None
    
    def merge_similar_memories(self, memories: List[Dict]) -> List[Dict]:
        """
        Merge similar memories using clustering
        Preserves the most informative version of each cluster
        """
        if len(memories) < 2:
            return memories
        
        # Get embeddings for all memories
        embeddings = []
        for memory in memories:
            if 'embedding' in memory:
                embeddings.append(memory['embedding'])
            else:
                embedding = self._get_embedding(memory['content'])
                embeddings.append(embedding)
        
        embeddings = np.array(embeddings)
        
        # Cluster similar memories
        clustering = DBSCAN(eps=self.eps, min_samples=self.min_cluster_size, 
                           metric='cosine').fit(embeddings)
        
        # Process each cluster
        merged_memories = []
        processed_indices = set()
        
        for cluster_id in set(clustering.labels_):
            if cluster_id == -1:  # Noise points (unique memories)
                noise_indices = np.where(clustering.labels_ == -1)[0]
                for idx in noise_indices:
                    if idx not in processed_indices:
                        merged_memories.append(memories[idx])
                        processed_indices.add(idx)
            else:
                # Get all memories in this cluster
                cluster_indices = np.where(clustering.labels_ == cluster_id)[0]
                cluster_memories = [memories[i] for i in cluster_indices]
                
                # Select the best representative
                best_memory = self._select_best_representative(cluster_memories)
                
                # Merge metadata from all memories in cluster
                merged_metadata = self._merge_metadata(cluster_memories)
                best_memory['metadata'].update(merged_metadata)
                
                merged_memories.append(best_memory)
                processed_indices.update(cluster_indices)
        
        logger.info(f"Merged {len(memories)} memories into {len(merged_memories)}")
        return merged_memories
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding with caching"""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        
        if text_hash not in self.embedding_cache:
            self.embedding_cache[text_hash] = self.embedder.encode(text)
        
        return self.embedding_cache[text_hash]
    
    def _find_most_similar(self, new_embedding: np.ndarray, 
                          existing_memories: List[Dict]) -> Optional[Dict]:
        """Find the most similar existing memory"""
        max_similarity = 0.0
        most_similar = None
        
        for memory in existing_memories:
            # Get or compute embedding
            if 'embedding' in memory:
                existing_embedding = memory['embedding']
            else:
                existing_embedding = self._get_embedding(memory['content'])
            
            # Calculate similarity
            similarity = float(util.cos_sim(new_embedding, existing_embedding))
            
            if similarity > max_similarity:
                max_similarity = similarity
                most_similar = {
                    'memory': memory,
                    'similarity': similarity
                }
        
        return most_similar
    
    def _is_important_variation(self, new_content: str, existing_memory: Dict,
                               memory_type: str) -> bool:
        """
        Determine if a similar memory is an important variation worth keeping
        
        This prevents losing nuanced information while still deduplicating
        truly redundant memories
        """
        existing_content = existing_memory['content']
        
        # Length difference check (significant additions/removals)
        len_ratio = len(new_content) / len(existing_content)
        if len_ratio > 1.5 or len_ratio < 0.67:
            return True
        
        # Temporal importance (recent memories may update older ones)
        if 'timestamp' in existing_memory:
            time_diff = datetime.now() - datetime.fromisoformat(existing_memory['timestamp'])
            if time_diff.days > 7:  # Week old memories can be updated
                return True
        
        # Emotional memories preserve more variation
        if memory_type == 'emotional':
            # Check for emotional intensity differences
            new_intensity = self._calculate_emotional_intensity(new_content)
            existing_intensity = self._calculate_emotional_intensity(existing_content)
            if abs(new_intensity - existing_intensity) > 0.3:
                return True
        
        # Check for new named entities or important keywords
        new_entities = self._extract_key_entities(new_content)
        existing_entities = self._extract_key_entities(existing_content)
        if new_entities - existing_entities:  # New entities present
            return True
        
        return False
    
    def _calculate_emotional_intensity(self, content: str) -> float:
        """
        Simple emotional intensity calculation
        In production, this would use the emotion analyzer
        """
        emotional_words = ['love', 'hate', 'angry', 'happy', 'sad', 'excited',
                          'frustrated', 'amazing', 'terrible', 'wonderful']
        
        content_lower = content.lower()
        intensity = sum(1 for word in emotional_words if word in content_lower)
        
        return min(intensity / 5.0, 1.0)  # Normalize to 0-1
    
    def _extract_key_entities(self, content: str) -> set:
        """
        Extract key entities from content
        Simplified version - production would use NER
        """
        # Simple heuristic: capitalized words that aren't sentence starts
        words = content.split()
        entities = set()
        
        for i, word in enumerate(words):
            if i > 0 and word[0].isupper() and word.isalpha():
                entities.add(word.lower())
        
        return entities
    
    def _initialize_patterns(self) -> List[Dict]:
        """Initialize common conversational patterns"""
        return [
            {
                'pattern': r'my name is (\w+)',
                'type': 'introduction',
                'importance': 'high'
            },
            {
                'pattern': r'i (?:like|love|enjoy) (\w+)',
                'type': 'preference',
                'importance': 'medium'
            },
            {
                'pattern': r'remember (?:that|when) (.+)',
                'type': 'memory_request',
                'importance': 'high'
            },
            {
                'pattern': r'(?:how are you|how\'s it going|what\'s up)',
                'type': 'greeting',
                'importance': 'low'
            }
        ]
    
    def _matches_existing_pattern(self, content: str, 
                                 existing_memories: List[Dict]) -> bool:
        """Check if content matches a pattern already in memories"""
        import re
        
        content_lower = content.lower()
        
        for pattern_dict in self.pattern_templates:
            pattern = pattern_dict['pattern']
            if re.search(pattern, content_lower):
                # Check if this pattern type already exists
                pattern_type = pattern_dict['type']
                for memory in existing_memories:
                    if memory.get('pattern_type') == pattern_type:
                        if pattern_dict['importance'] == 'low':
                            return True  # Deduplicate low importance patterns
        
        return False
    
    def _find_pattern_match(self, content: str, 
                           existing_memories: List[Dict]) -> Optional[Dict]:
        """Find which existing memory matches the pattern"""
        import re
        
        content_lower = content.lower()
        
        for pattern_dict in self.pattern_templates:
            pattern = pattern_dict['pattern']
            if re.search(pattern, content_lower):
                pattern_type = pattern_dict['type']
                for memory in existing_memories:
                    if memory.get('pattern_type') == pattern_type:
                        return memory
        
        return None
    
    def _select_best_representative(self, cluster_memories: List[Dict]) -> Dict:
        """
        Select the best memory to represent a cluster
        Considers: completeness, recency, importance, clarity
        """
        best_score = -1
        best_memory = cluster_memories[0]
        
        for memory in cluster_memories:
            score = 0
            
            # Length score (prefer more complete memories)
            score += min(len(memory['content']) / 500, 1.0)
            
            # Recency score
            if 'timestamp' in memory:
                age_days = (datetime.now() - datetime.fromisoformat(memory['timestamp'])).days
                score += max(0, 1 - age_days / 30)  # Decay over 30 days
            
            # Importance score
            score += memory.get('importance', 0.5) * 2
            
            # Access frequency score
            score += min(memory.get('access_count', 0) / 10, 1.0)
            
            if score > best_score:
                best_score = score
                best_memory = memory
        
        return best_memory.copy()
    
    def _merge_metadata(self, memories: List[Dict]) -> Dict:
        """Merge metadata from multiple memories"""
        merged = {
            'access_count': 0,
            'importance': 0.0,
            'deduplicated_count': len(memories),
            'original_timestamps': []
        }
        
        for memory in memories:
            metadata = memory.get('metadata', {})
            merged['access_count'] += metadata.get('access_count', 0)
            merged['importance'] = max(merged['importance'], 
                                     metadata.get('importance', 0.5))
            if 'timestamp' in memory:
                merged['original_timestamps'].append(memory['timestamp'])
        
        return merged
    
    def suggest_memory_compression(self, memories: List[Dict], 
                                  target_reduction: float = 0.3) -> Dict:
        """
        Suggest which memories can be safely compressed/deduplicated
        to achieve target reduction while preserving important information
        """
        total_memories = len(memories)
        target_count = int(total_memories * (1 - target_reduction))
        
        # Score all memories for importance
        scored_memories = []
        for i, memory in enumerate(memories):
            score = self._calculate_memory_importance(memory)
            scored_memories.append((i, score))
        
        # Sort by importance (descending)
        scored_memories.sort(key=lambda x: x[1], reverse=True)
        
        # Keep top memories up to target
        keep_indices = set(idx for idx, _ in scored_memories[:target_count])
        
        suggestion = {
            'total_memories': total_memories,
            'suggested_keep': len(keep_indices),
            'reduction_achieved': 1 - (len(keep_indices) / total_memories),
            'keep_indices': keep_indices,
            'safe_to_remove': [i for i in range(total_memories) if i not in keep_indices]
        }
        
        return suggestion
    
    def _calculate_memory_importance(self, memory: Dict) -> float:
        """Calculate importance score for memory retention decisions"""
        score = 0.0
        
        # Base importance
        score += memory.get('importance', 0.5) * 3
        
        # Access frequency (logarithmic)
        access_count = memory.get('access_count', 0)
        score += min(np.log1p(access_count), 2.0)
        
        # Recency
        if 'timestamp' in memory:
            age_days = (datetime.now() - datetime.fromisoformat(memory['timestamp'])).days
            score += max(0, 2 - age_days / 14)  # 2 week decay
        
        # Content richness
        content_length = len(memory.get('content', ''))
        score += min(content_length / 200, 1.0)
        
        # Emotional content bonus
        if memory.get('emotional_intensity', 0) > 0.5:
            score += 1.0
        
        # Relationship markers bonus
        relationship_keywords = ['love', 'together', 'remember', 'important', 'special']
        content_lower = memory.get('content', '').lower()
        if any(keyword in content_lower for keyword in relationship_keywords):
            score += 1.5
        
        return score