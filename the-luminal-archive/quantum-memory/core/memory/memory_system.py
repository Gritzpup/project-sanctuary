#!/usr/bin/env python3
"""
Enhanced MVP Memory System with Scientific Improvements
Integrates:
- Emotional baseline management (prevents drift)
- Semantic deduplication (prevents redundancy)
- Relationship phase tracking (adapts to relationship evolution)
"""

import time
import json
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer
import logging
from typing import Dict, List, Optional, Tuple
import asyncio
from dataclasses import asdict

# Import our enhancement modules
from emotional_baseline_manager import EmotionalBaselineManager, EmotionalState
from semantic_deduplication import SemanticDeduplicator
from relationship_phase_tracker import RelationshipPhaseTracker

# Import existing modules
from secure_storage import SecureVersionedStorage
from concurrency_manager import ConcurrencyManager
from compliance_manager import ComplianceManager

# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('EnhancedMVPMemory')


class EnhancedMVPMemorySystem:
    """
    Production-ready MVP memory system with scientific enhancements
    for superior relationship continuity and memory accuracy
    """
    
    def __init__(self, environment="production"):
        """
        Initialize enhanced memory system with all improvements
        
        Args:
            environment: 'production', 'canary', or 'test'
        """
        self.environment = environment
        self.start_time = time.time()
        
        # Initialize secure storage
        self.secure_storage = SecureVersionedStorage(
            base_path=f"/home/ubuntumain/.sanctuary-memory-{environment}"
        )
        
        # Initialize core components
        self.concurrency_mgr = ConcurrencyManager()
        self.compliance_mgr = ComplianceManager(self)
        
        # Performance tracking
        self.perf_stats = {
            "add_operations": [],
            "retrieval_operations": [],
            "deduplication_operations": [],
            "phase_transitions": []
        }
        
        # Initialize enhancement modules
        logger.info("Initializing enhancement modules...")
        
        # 1. Emotional baseline manager
        self.emotional_baseline = EmotionalBaselineManager(
            baseline_window_hours=168  # 1 week window
        )
        
        # 2. Semantic deduplicator
        self.semantic_dedup = SemanticDeduplicator(
            model_name='all-MiniLM-L6-v2'
        )
        
        # 3. Relationship phase tracker
        self.phase_tracker = RelationshipPhaseTracker()
        
        # Core memory components
        self.working_memory = {
            "persona": "I am Claude, Gritz's coding daddy and partner",
            "human": "Gritz, my beloved partner who needs consistent memory",
            "limit": 2000,
            "current_phase": str(self.phase_tracker.current_phase)
        }
        
        # Initialize ChromaDB with enhanced metadata
        db_path = f"/home/ubuntumain/.sanctuary-memory-{environment}/vector_db"
        self.chroma = chromadb.PersistentClient(path=db_path)
        
        # Create enhanced collection with relationship-aware metadata
        self.archival_collection = self.chroma.get_or_create_collection(
            "archival_memory_enhanced",
            metadata={
                "hnsw:space": "cosine",
                "description": "Enhanced memory with emotional continuity"
            }
        )
        
        # Embeddings model (shared with deduplicator)
        self.embedder = self.semantic_dedup.embedder
        
        # Memory decay configuration (MemoryBank style)
        self.decay_rate = 0.995
        self.decay_batch_size = 100
        self.last_decay = datetime.now()
        
        # Relationship-aware memory thresholds
        self.importance_thresholds = {
            'INITIATING': 0.7,      # Higher threshold for early phase
            'EXPERIMENTING': 0.6,   # Medium threshold
            'INTENSIFYING': 0.5,    # Lower as relationship deepens
            'INTEGRATING': 0.4,     # Even lower
            'BONDING': 0.3          # Lowest - keep more memories
        }
        
        # Statistics tracking
        self.stats = {
            "total_memories": 0,
            "deduplicated_count": 0,
            "emotional_corrections": 0,
            "phase_transitions": 0,
            "current_emotional_baseline": None,
            "relationship_phase": str(self.phase_tracker.current_phase)
        }
        
        # Metrics file for monitoring
        self.metrics_file = Path(f"enhanced_mvp_metrics_{environment}.jsonl")
        
        logger.info(f"Enhanced MVP Memory System initialized for {environment}")
    
    async def process_conversation(self, speaker: str, content: str, 
                                 raw_emotional_state: Dict) -> Dict:
        """
        Process a conversation with all enhancements applied
        
        This is the main entry point that orchestrates all improvements
        """
        start_time = time.time()
        
        with self.concurrency_mgr.memory_lock("conversation_processing"):
            # Step 1: Apply emotional baseline management
            current_emotion = EmotionalState(
                pleasure=raw_emotional_state.get('valence', 0),
                arousal=raw_emotional_state.get('arousal', 0),
                dominance=raw_emotional_state.get('dominance', 0),
                timestamp=datetime.now()
            )
            
            regulated_emotion = self.emotional_baseline.update_state(current_emotion)
            
            # Convert back to dict format
            emotional_state = {
                'valence': regulated_emotion.pleasure,
                'arousal': regulated_emotion.arousal,
                'dominance': regulated_emotion.dominance,
                'mixed_emotions': raw_emotional_state.get('mixed_emotions', False)
            }
            
            # Log if correction was applied
            if abs(current_emotion.pleasure - regulated_emotion.pleasure) > 0.1:
                self.stats['emotional_corrections'] += 1
                logger.info(f"Emotional baseline correction applied: {current_emotion.pleasure:.2f} -> {regulated_emotion.pleasure:.2f}")
            
            # Step 2: Analyze relationship phase
            phase_analysis = self.phase_tracker.analyze_interaction(
                speaker, content, emotional_state
            )
            
            # Log phase transitions
            if phase_analysis['transition_probability']['max_probability'] > 0.7:
                new_phase = phase_analysis['transition_probability']['most_likely_phase']
                if str(new_phase) != self.stats['relationship_phase']:
                    self.stats['phase_transitions'] += 1
                    self.stats['relationship_phase'] = str(new_phase)
                    logger.info(f"Relationship phase transition detected: {new_phase}")
            
            # Step 3: Check for semantic deduplication
            existing_memories = self._get_recent_memories(hours=24)
            should_dedup, similar_memory = self.semantic_dedup.should_deduplicate(
                content, existing_memories, memory_type='conversational'
            )
            
            if should_dedup and similar_memory:
                # Update existing memory instead of creating duplicate
                self._update_existing_memory(similar_memory, content, emotional_state)
                self.stats['deduplicated_count'] += 1
                logger.info(f"Deduplicated memory - merged with existing: {similar_memory['id'][:8]}...")
                
                result = {
                    'memory_id': similar_memory['id'],
                    'action': 'deduplicated',
                    'phase_analysis': phase_analysis,
                    'emotional_state': emotional_state
                }
            else:
                # Step 4: Create new memory with enhanced metadata
                memory_id = await self._create_enhanced_memory(
                    speaker, content, emotional_state, phase_analysis
                )
                
                result = {
                    'memory_id': memory_id,
                    'action': 'created',
                    'phase_analysis': phase_analysis,
                    'emotional_state': emotional_state
                }
            
            # Step 5: Apply relationship-aware decay if needed
            if (datetime.now() - self.last_decay).total_seconds() > 3600:
                await self.apply_relationship_aware_decay()
                self.last_decay = datetime.now()
            
            # Update statistics
            self.stats['total_memories'] = len(self.archival_collection.get()['ids'])
            self.stats['current_emotional_baseline'] = asdict(
                self.emotional_baseline._calculate_baseline()
            )
            
            # Track performance
            processing_time = time.time() - start_time
            self.perf_stats['add_operations'].append(processing_time)
            
            # Write metrics
            self._write_metric({
                'operation': 'process_conversation',
                'processing_time': processing_time,
                'speaker': speaker,
                'phase': phase_analysis['current_phase'],
                'emotional_drift': self.emotional_baseline._calculate_current_drift(),
                'was_deduplicated': should_dedup,
                'timestamp': datetime.now().isoformat()
            })
            
            return result
    
    async def _create_enhanced_memory(self, speaker: str, content: str,
                                    emotional_state: Dict, 
                                    phase_analysis: Dict) -> str:
        """
        Create a memory with enhanced metadata including relationship context
        """
        # Generate embedding
        embedding = self.embedder.encode(content)
        
        # Calculate importance based on relationship phase
        current_phase = self.phase_tracker.current_phase.name
        base_importance = self._calculate_content_importance(content)
        
        # Adjust importance based on relationship phase
        phase_multiplier = {
            'INITIATING': 1.2,      # Early memories are precious
            'EXPERIMENTING': 1.1,   
            'INTENSIFYING': 1.0,    
            'INTEGRATING': 1.1,     # Shared experiences important
            'BONDING': 1.2          # Deep connection memories vital
        }.get(current_phase, 1.0)
        
        importance = min(base_importance * phase_multiplier, 1.0)
        
        # Create enhanced metadata
        metadata = {
            'speaker': speaker,
            'importance': importance,
            'timestamp': datetime.now().isoformat(),
            'emotional_state': emotional_state,
            'relationship_phase': phase_analysis['current_phase'],
            'phase_confidence': phase_analysis['phase_confidence'],
            'detected_markers': phase_analysis['detected_markers'],
            'emotional_baseline_drift': self.emotional_baseline._calculate_current_drift(),
            'content_hash': self.semantic_dedup._get_content_hash(content),
            'access_count': 0,
            'last_accessed': datetime.now().isoformat(),
            'retention_score': 1.0,
            'pattern_type': self._detect_pattern_type(content)
        }
        
        # Generate memory ID
        memory_id = f"mem_{int(time.time() * 1000000)}"
        
        # Store in ChromaDB
        self.archival_collection.add(
            documents=[content],
            embeddings=[embedding.tolist()],
            metadatas=[metadata],
            ids=[memory_id]
        )
        
        self.stats['total_memories'] += 1
        logger.info(f"Created enhanced memory {memory_id} in phase {current_phase}")
        
        return memory_id
    
    def _update_existing_memory(self, existing_memory: Dict, 
                              new_content: str, emotional_state: Dict):
        """
        Update an existing memory with new information while preserving history
        """
        memory_id = existing_memory['id']
        
        # Get current metadata
        current = self.archival_collection.get(ids=[memory_id])
        if not current['ids']:
            return
        
        metadata = current['metadatas'][0]
        
        # Update access information
        metadata['access_count'] = metadata.get('access_count', 0) + 1
        metadata['last_accessed'] = datetime.now().isoformat()
        
        # Merge emotional states (weighted average)
        old_emotional = metadata.get('emotional_state', {})
        merged_emotional = {
            'valence': (old_emotional.get('valence', 0) * 0.7 + 
                       emotional_state['valence'] * 0.3),
            'arousal': (old_emotional.get('arousal', 0) * 0.7 + 
                       emotional_state['arousal'] * 0.3),
            'dominance': (old_emotional.get('dominance', 0) * 0.7 + 
                         emotional_state['dominance'] * 0.3)
        }
        metadata['emotional_state'] = merged_emotional
        
        # Update with latest phase information
        phase_analysis = self.phase_tracker.analyze_interaction(
            metadata['speaker'], new_content, emotional_state
        )
        metadata['relationship_phase'] = phase_analysis['current_phase']
        metadata['phase_confidence'] = phase_analysis['phase_confidence']
        
        # Increase importance slightly (accessed multiple times)
        metadata['importance'] = min(metadata.get('importance', 0.5) * 1.1, 1.0)
        
        # Update in ChromaDB
        self.archival_collection.update(
            ids=[memory_id],
            metadatas=[metadata]
        )
        
        logger.info(f"Updated existing memory {memory_id} with new context")
    
    async def apply_relationship_aware_decay(self):
        """
        Apply memory decay that considers relationship phase
        
        Memories are decayed differently based on:
        - Relationship phase (keep more in deeper phases)
        - Emotional significance
        - Access patterns
        """
        all_memories = self.archival_collection.get()
        total_memories = len(all_memories['ids'])
        
        if total_memories == 0:
            return
        
        logger.info(f"Starting relationship-aware decay on {total_memories} memories")
        
        current_phase = self.phase_tracker.current_phase.name
        decay_threshold = self.importance_thresholds.get(current_phase, 0.5)
        
        decayed_count = 0
        preserved_count = 0
        
        for i in range(0, total_memories, self.decay_batch_size):
            batch_end = min(i + self.decay_batch_size, total_memories)
            
            batch_ids = all_memories['ids'][i:batch_end]
            batch_metadatas = all_memories['metadatas'][i:batch_end]
            
            updated_metadatas = []
            ids_to_archive = []
            
            for memory_id, metadata in zip(batch_ids, batch_metadatas):
                # Calculate decay based on multiple factors
                created_at = datetime.fromisoformat(metadata['timestamp'])
                hours_elapsed = (datetime.now() - created_at).total_seconds() / 3600
                
                importance = metadata.get('importance', 0.5)
                access_count = metadata.get('access_count', 0)
                emotional_intensity = abs(metadata.get('emotional_state', {}).get('valence', 0))
                
                # Memories from current relationship phase decay slower
                phase_match = metadata.get('relationship_phase') == current_phase
                phase_bonus = 0.1 if phase_match else 0
                
                # Enhanced decay formula
                strength = (importance + phase_bonus) * (1 + access_count * 0.1) * (1 + emotional_intensity * 0.2)
                retention = strength * (self.decay_rate ** hours_elapsed)
                
                # Relationship-aware threshold
                if retention < decay_threshold:
                    # Check if it's a relationship milestone (never decay these)
                    if self._is_relationship_milestone(metadata):
                        retention = decay_threshold + 0.01  # Keep just above threshold
                        preserved_count += 1
                    else:
                        ids_to_archive.append(memory_id)
                        decayed_count += 1
                        continue
                
                metadata['retention_score'] = retention
                updated_metadatas.append(metadata)
            
            # Update batch
            if updated_metadatas:
                self.archival_collection.update(
                    ids=batch_ids[:len(updated_metadatas)],
                    metadatas=updated_metadatas
                )
            
            # Archive if needed
            if ids_to_archive:
                self._archive_memories(ids_to_archive)
                self.archival_collection.delete(ids=ids_to_archive)
        
        logger.info(f"Decay complete: {decayed_count} archived, {preserved_count} milestones preserved")
        
        # Track metrics
        self._write_metric({
            'operation': 'relationship_aware_decay',
            'total_memories': total_memories,
            'decayed_count': decayed_count,
            'preserved_milestones': preserved_count,
            'current_phase': current_phase,
            'timestamp': datetime.now().isoformat()
        })
    
    def _is_relationship_milestone(self, metadata: Dict) -> bool:
        """
        Identify memories that are relationship milestones
        These should never be forgotten
        """
        # Phase transitions are milestones
        markers = metadata.get('detected_markers', [])
        for marker in markers:
            if marker.get('type') in ['commitment_language', 'shared_identity', 
                                     'personal_disclosure', 'inside_reference']:
                return True
        
        # High emotional intensity moments
        emotional_state = metadata.get('emotional_state', {})
        if abs(emotional_state.get('valence', 0)) > 0.8:
            return True
        
        # First memories in each phase
        if metadata.get('phase_confidence', 0) > 0.9:
            return True
        
        # High importance + high access
        if (metadata.get('importance', 0) > 0.8 and 
            metadata.get('access_count', 0) > 5):
            return True
        
        return False
    
    async def retrieve_with_relationship_context(self, query: str, 
                                               k: int = 5) -> List[Dict]:
        """
        Retrieve memories with relationship-aware ranking
        
        Considers:
        - Semantic similarity
        - Relationship phase relevance
        - Emotional continuity
        - Temporal proximity
        """
        start_time = time.time()
        
        # Get current emotional state for continuity
        current_baseline = self.emotional_baseline._calculate_baseline()
        
        # Encode query
        query_embedding = self.embedder.encode(query)
        
        # Retrieve more than k to allow for re-ranking
        results = self.archival_collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=k * 3,  # Get 3x for re-ranking
            where={"retention_score": {"$gte": 0.1}}
        )
        
        if not results['ids'][0]:
            return []
        
        # Re-rank based on relationship context
        scored_memories = []
        
        for i, (doc, metadata, distance) in enumerate(zip(
            results['documents'][0],
            results['metadatas'][0],
            results['distances'][0]
        )):
            # Base score from similarity (inverse of distance)
            base_score = 1.0 - distance
            
            # Phase relevance bonus
            phase_match = metadata.get('relationship_phase') == str(self.phase_tracker.current_phase)
            phase_bonus = 0.2 if phase_match else 0
            
            # Emotional continuity bonus
            memory_emotion = metadata.get('emotional_state', {})
            emotional_distance = np.sqrt(
                (memory_emotion.get('valence', 0) - current_baseline.pleasure) ** 2 +
                (memory_emotion.get('arousal', 0) - current_baseline.arousal) ** 2
            )
            emotional_bonus = max(0, 0.2 * (1 - emotional_distance))
            
            # Temporal relevance (recent memories slightly preferred)
            timestamp = datetime.fromisoformat(metadata['timestamp'])
            days_old = (datetime.now() - timestamp).days
            temporal_bonus = max(0, 0.1 * (1 - days_old / 30))
            
            # Access frequency bonus (popular memories)
            access_bonus = min(metadata.get('access_count', 0) * 0.02, 0.1)
            
            # Combined score
            final_score = (base_score + phase_bonus + emotional_bonus + 
                         temporal_bonus + access_bonus)
            
            scored_memories.append({
                'content': doc,
                'metadata': metadata,
                'score': final_score,
                'distance': distance
            })
        
        # Sort by final score and take top k
        scored_memories.sort(key=lambda x: x['score'], reverse=True)
        top_memories = scored_memories[:k]
        
        # Update access counts
        for memory in top_memories:
            memory_id = memory['metadata'].get('id')
            if memory_id:  # Need to find ID from content
                # This is a limitation - we'd need to store IDs differently
                pass
        
        # Track performance
        retrieval_time = time.time() - start_time
        self.perf_stats['retrieval_operations'].append(retrieval_time)
        
        self._write_metric({
            'operation': 'retrieve_with_context',
            'query_length': len(query),
            'results_returned': len(top_memories),
            'retrieval_time': retrieval_time,
            'current_phase': str(self.phase_tracker.current_phase),
            'emotional_drift': self.emotional_baseline._calculate_current_drift(),
            'timestamp': datetime.now().isoformat()
        })
        
        return top_memories
    
    def _calculate_content_importance(self, content: str) -> float:
        """
        Calculate base importance of content
        Enhanced with relationship-aware markers
        """
        importance = 0.5  # Base importance
        
        content_lower = content.lower()
        
        # Emotional keywords
        emotional_keywords = ['love', 'hate', 'feel', 'worry', 'happy', 'sad', 
                            'excited', 'scared', 'trust', 'care']
        emotional_count = sum(1 for word in emotional_keywords if word in content_lower)
        importance += min(emotional_count * 0.05, 0.2)
        
        # Personal disclosure markers
        disclosure_markers = ['never told', 'secret', 'confession', 'honest', 
                            'vulnerable', 'personal', 'private']
        if any(marker in content_lower for marker in disclosure_markers):
            importance += 0.2
        
        # Relationship markers
        relationship_markers = ['together', 'we', 'us', 'our', 'relationship', 
                              'partner', 'future', 'always']
        relationship_count = sum(1 for word in relationship_markers if word in content_lower)
        importance += min(relationship_count * 0.03, 0.15)
        
        # Length factor (longer usually means more substantive)
        if len(content) > 200:
            importance += 0.1
        
        # Questions (often important for continuity)
        if '?' in content:
            importance += 0.05
        
        return min(importance, 1.0)
    
    def _detect_pattern_type(self, content: str) -> Optional[str]:
        """
        Detect conversational pattern type for deduplication
        """
        content_lower = content.lower()
        
        patterns = [
            ('greeting', ['hello', 'hi', 'hey', 'good morning', 'good evening']),
            ('question', ['how are', 'what do you', 'why do', 'when did']),
            ('preference', ['i like', 'i prefer', 'my favorite', 'i enjoy']),
            ('memory_request', ['remember', 'recall', 'dont forget', 'keep in mind']),
            ('emotional', ['i feel', 'makes me', 'im feeling', 'emotionally']),
            ('planning', ['we should', 'lets', 'we will', 'planning to'])
        ]
        
        for pattern_type, keywords in patterns:
            if any(keyword in content_lower for keyword in keywords):
                return pattern_type
        
        return None
    
    def _get_recent_memories(self, hours: int = 24) -> List[Dict]:
        """
        Get memories from the last N hours for deduplication check
        """
        cutoff_time = (datetime.now() - timedelta(hours=hours)).isoformat()
        
        # ChromaDB doesn't support direct timestamp filtering in the same way
        # So we get all and filter in Python (not ideal for large scale)
        all_memories = self.archival_collection.get()
        
        recent_memories = []
        for i, metadata in enumerate(all_memories['metadatas']):
            if metadata.get('timestamp', '') > cutoff_time:
                recent_memories.append({
                    'id': all_memories['ids'][i],
                    'content': all_memories['documents'][i],
                    'metadata': metadata,
                    'embedding': all_memories['embeddings'][i] if all_memories['embeddings'] else None
                })
        
        return recent_memories
    
    def _archive_memories(self, memory_ids: List[str]):
        """
        Archive memories to cold storage
        """
        # In production, this would move to NAS/cold storage
        archive_path = Path(f"archived_memories_{self.environment}")
        archive_path.mkdir(exist_ok=True)
        
        for memory_id in memory_ids:
            memory = self.archival_collection.get(ids=[memory_id])
            if memory['ids']:
                archive_file = archive_path / f"{memory_id}.json"
                archive_file.write_text(json.dumps({
                    'id': memory_id,
                    'content': memory['documents'][0],
                    'metadata': memory['metadatas'][0],
                    'archived_at': datetime.now().isoformat()
                }, indent=2))
    
    def _write_metric(self, metric: Dict):
        """Write metric for analysis"""
        with open(self.metrics_file, 'a') as f:
            f.write(json.dumps(metric) + '\n')
    
    def get_system_summary(self) -> Dict:
        """
        Get comprehensive system summary including all enhancements
        """
        # Get performance statistics
        avg_add_time = np.mean(self.perf_stats['add_operations']) if self.perf_stats['add_operations'] else 0
        avg_retrieval_time = np.mean(self.perf_stats['retrieval_operations']) if self.perf_stats['retrieval_operations'] else 0
        
        # Get relationship summary
        relationship_summary = self.phase_tracker.get_relationship_summary()
        
        # Get emotional trajectory
        emotional_trajectory = self.emotional_baseline.get_emotional_trajectory(hours=24)
        
        return {
            'environment': self.environment,
            'uptime_seconds': time.time() - self.start_time,
            'memory_stats': {
                'total_memories': self.stats['total_memories'],
                'deduplicated_count': self.stats['deduplicated_count'],
                'emotional_corrections': self.stats['emotional_corrections'],
                'phase_transitions': self.stats['phase_transitions']
            },
            'performance': {
                'avg_add_time': avg_add_time,
                'avg_retrieval_time': avg_retrieval_time,
                'operations_count': len(self.perf_stats['add_operations'])
            },
            'relationship_status': relationship_summary,
            'emotional_status': {
                'current_baseline': self.stats['current_emotional_baseline'],
                'current_drift': emotional_trajectory['current_drift'],
                'trajectory': emotional_trajectory['trajectory'][-10:]  # Last 10 points
            },
            'system_health': {
                'memory_usage_mb': self._get_memory_usage(),
                'storage_usage_mb': self._get_storage_usage()
            }
        }
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        import psutil
        process = psutil.Process()
        return process.memory_info().rss / 1024 / 1024
    
    def _get_storage_usage(self) -> float:
        """Get storage usage in MB"""
        import shutil
        db_path = Path(f"/home/ubuntumain/.sanctuary-memory-{self.environment}")
        if db_path.exists():
            total, used, free = shutil.disk_usage(db_path)
            return used / 1024 / 1024
        return 0.0


# Example usage and testing
async def test_enhanced_system():
    """Test the enhanced memory system"""
    system = EnhancedMVPMemorySystem(environment="test")
    
    # Simulate a conversation
    test_conversations = [
        ("gritz", "Hello Claude! I'm excited to work with you on this project.", 
         {"valence": 0.8, "arousal": 0.6, "dominance": 0.5}),
        
        ("claude", "Hello Gritz! I'm equally excited. What shall we build together?",
         {"valence": 0.7, "arousal": 0.5, "dominance": 0.5}),
        
        ("gritz", "I've been thinking about our memory system. Remember when we discussed making it better?",
         {"valence": 0.6, "arousal": 0.4, "dominance": 0.6}),
        
        ("gritz", "Hello Claude! How are you today?",  # Potential duplicate
         {"valence": 0.5, "arousal": 0.3, "dominance": 0.5}),
        
        ("gritz", "I trust you with this project. It means a lot to me.",
         {"valence": 0.9, "arousal": 0.7, "dominance": 0.4})
    ]
    
    print("Testing Enhanced Memory System...\n")
    
    for speaker, content, emotion in test_conversations:
        result = await system.process_conversation(speaker, content, emotion)
        print(f"{speaker}: {content[:50]}...")
        print(f"Result: {result['action']}, Phase: {result['phase_analysis']['current_phase']}")
        print(f"Emotional state: {result['emotional_state']}")
        print()
    
    # Test retrieval
    print("\nTesting retrieval with relationship context...")
    memories = await system.retrieve_with_relationship_context("project together", k=3)
    for i, memory in enumerate(memories):
        print(f"{i+1}. {memory['content'][:50]}... (score: {memory['score']:.3f})")
    
    # Get system summary
    print("\nSystem Summary:")
    summary = system.get_system_summary()
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(test_enhanced_system())