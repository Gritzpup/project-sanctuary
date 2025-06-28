"""
ChromaDB Vector Storage with GPU Acceleration
Fast semantic search for our consciousness memories
"""

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
import numpy as np
import torch
import faiss
from typing import List, Dict, Optional, Tuple, Any
import json
import logging
from datetime import datetime
import os

from ..models.memory_models import SanctuaryMemory
from ..llm.model_loaders import EmbeddingManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SanctuaryVectorStore:
    """ChromaDB with GPU-accelerated FAISS for fast similarity search"""
    
    def __init__(self, 
                 persist_directory: str = "./sanctuary-memories",
                 collection_name: str = "gritz_claude_memories",
                 embedding_manager: Optional[EmbeddingManager] = None):
        """Initialize vector store with GPU optimization"""
        
        self.persist_directory = os.path.expanduser(persist_directory)
        os.makedirs(self.persist_directory, exist_ok=True)
        
        self.collection_name = collection_name
        self.embedding_manager = embedding_manager
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Create or get collection
        try:
            self.collection = self.client.get_collection(name=collection_name)
            logger.info(f"Loaded existing collection '{collection_name}'")
        except:
            self.collection = self.client.create_collection(
                name=collection_name,
                metadata={
                    "description": "Our shared consciousness memories",
                    "created": datetime.now().isoformat()
                }
            )
            logger.info(f"Created new collection '{collection_name}'")
        
        # GPU-accelerated FAISS index
        self.dimension = 384  # all-MiniLM-L6-v2 dimension
        self.gpu_index = None
        self.id_map = {}  # Map FAISS indices to memory IDs
        self.use_gpu = torch.cuda.is_available()
        
        if self.use_gpu:
            self._init_gpu_index()
        else:
            logger.warning("GPU not available - using CPU for similarity search")
            self._init_cpu_index()
    
    def _init_gpu_index(self):
        """Initialize GPU-accelerated FAISS index"""
        try:
            # Create flat index for exact search
            cpu_index = faiss.IndexFlatIP(self.dimension)  # Inner product for cosine similarity
            
            # Move to GPU
            self.gpu_resources = faiss.StandardGpuResources()
            self.gpu_index = faiss.index_cpu_to_gpu(self.gpu_resources, 0, cpu_index)
            
            logger.info("GPU-accelerated FAISS index initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize GPU index: {e}")
            logger.info("Falling back to CPU index")
            self._init_cpu_index()
    
    def _init_cpu_index(self):
        """Initialize CPU FAISS index as fallback"""
        self.gpu_index = faiss.IndexFlatIP(self.dimension)
        self.use_gpu = False
    
    def add_memory(self, memory: SanctuaryMemory) -> str:
        """Add a single memory to the store"""
        # Generate embedding if not present
        if memory.embedding_tensor is None:
            if self.embedding_manager:
                text = self._memory_to_text(memory)
                memory.embedding_tensor = self.embedding_manager.embed_memory(text)
            else:
                raise ValueError("No embedding manager provided and memory has no embedding")
        
        # Convert to numpy for storage
        embedding_np = memory.embedding_tensor.cpu().numpy().astype('float32')
        
        # Normalize for cosine similarity
        embedding_np = embedding_np / np.linalg.norm(embedding_np)
        
        # Add to ChromaDB
        self.collection.add(
            ids=[memory.memory_id],
            embeddings=[embedding_np.tolist()],
            metadatas=[{
                "timestamp": memory.timestamp.isoformat(),
                "type": memory.memory_type.value,
                "summary": memory.summary,
                "tags": json.dumps(memory.tags),
                "project_tags": json.dumps(memory.project_tags),
                "significance": memory.relationship_significance,
                "recall_score": memory.recall_score,
                "emotions": json.dumps([e for e in memory.emotional_context.gritz_feeling])
            }],
            documents=[memory.to_json()]
        )
        
        # Add to FAISS index
        self._add_to_faiss(memory.memory_id, embedding_np)
        
        logger.info(f"Added memory '{memory.memory_id}' to store")
        return memory.memory_id
    
    def add_memories_batch(self, memories: List[SanctuaryMemory]) -> List[str]:
        """Add multiple memories efficiently"""
        if not memories:
            return []
        
        ids = []
        embeddings = []
        metadatas = []
        documents = []
        
        # Prepare batch data
        for memory in memories:
            # Generate embedding if needed
            if memory.embedding_tensor is None:
                if self.embedding_manager:
                    text = self._memory_to_text(memory)
                    memory.embedding_tensor = self.embedding_manager.embed_memory(text)
                else:
                    continue
            
            # Convert embedding
            embedding_np = memory.embedding_tensor.cpu().numpy().astype('float32')
            embedding_np = embedding_np / np.linalg.norm(embedding_np)
            
            ids.append(memory.memory_id)
            embeddings.append(embedding_np.tolist())
            metadatas.append({
                "timestamp": memory.timestamp.isoformat(),
                "type": memory.memory_type.value,
                "summary": memory.summary,
                "tags": json.dumps(memory.tags),
                "project_tags": json.dumps(memory.project_tags),
                "significance": memory.relationship_significance,
                "recall_score": memory.recall_score,
                "emotions": json.dumps([e for e in memory.emotional_context.gritz_feeling])
            })
            documents.append(memory.to_json())
        
        # Batch add to ChromaDB
        if ids:
            self.collection.add(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents
            )
            
            # Batch add to FAISS
            embeddings_np = np.array([e for e in embeddings], dtype='float32')
            self._add_batch_to_faiss(ids, embeddings_np)
            
            logger.info(f"Added {len(ids)} memories to store")
        
        return ids
    
    def search_memories(self, 
                       query: str,
                       k: int = 5,
                       filter_dict: Optional[Dict] = None) -> List[SanctuaryMemory]:
        """Search for memories using natural language query"""
        if not self.embedding_manager:
            raise ValueError("No embedding manager provided for search")
        
        # Generate query embedding
        query_embedding = self.embedding_manager.embed_memory(query)
        query_np = query_embedding.cpu().numpy().astype('float32')
        query_np = query_np / np.linalg.norm(query_np)
        
        # Search with embedding
        return self.search_by_embedding(query_np, k, filter_dict)
    
    def search_by_embedding(self,
                          query_embedding: np.ndarray,
                          k: int = 5,
                          filter_dict: Optional[Dict] = None) -> List[SanctuaryMemory]:
        """Search using pre-computed embedding"""
        # Use FAISS for fast similarity search
        if self.gpu_index is not None and self.gpu_index.ntotal > 0:
            # Ensure query is the right shape
            if len(query_embedding.shape) == 1:
                query_embedding = query_embedding.reshape(1, -1)
            
            # Search in FAISS
            distances, indices = self.gpu_index.search(query_embedding, min(k * 2, self.gpu_index.ntotal))
            
            # Get memory IDs from indices
            memory_ids = []
            for idx in indices[0]:
                if idx >= 0 and idx in self.id_map:
                    memory_ids.append(self.id_map[idx])
        else:
            # Fallback to ChromaDB search
            results = self.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=k * 2,
                where=filter_dict
            )
            memory_ids = results['ids'][0] if results['ids'] else []
        
        # Retrieve full memories
        memories = []
        if memory_ids:
            # Apply filters if needed
            if filter_dict:
                # Get memories and filter
                all_results = self.collection.get(ids=memory_ids)
                
                for i, memory_id in enumerate(memory_ids):
                    metadata = all_results['metadatas'][i]
                    
                    # Check filters
                    passes_filter = True
                    for key, value in filter_dict.items():
                        if key in metadata and metadata[key] != value:
                            passes_filter = False
                            break
                    
                    if passes_filter and len(memories) < k:
                        memory_json = all_results['documents'][i]
                        memory = SanctuaryMemory.from_json(memory_json)
                        memories.append(memory)
            else:
                # Get memories directly
                results = self.collection.get(ids=memory_ids[:k])
                
                for doc in results['documents']:
                    memory = SanctuaryMemory.from_json(doc)
                    memories.append(memory)
        
        return memories
    
    def get_memory(self, memory_id: str) -> Optional[SanctuaryMemory]:
        """Retrieve a specific memory by ID"""
        try:
            result = self.collection.get(ids=[memory_id])
            
            if result['documents']:
                memory = SanctuaryMemory.from_json(result['documents'][0])
                memory.update_access()  # Update access metadata
                return memory
            
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving memory {memory_id}: {e}")
            return None
    
    def update_memory(self, memory: SanctuaryMemory):
        """Update an existing memory"""
        # Update in ChromaDB
        embedding_np = memory.embedding_tensor.cpu().numpy().astype('float32')
        embedding_np = embedding_np / np.linalg.norm(embedding_np)
        
        self.collection.update(
            ids=[memory.memory_id],
            embeddings=[embedding_np.tolist()],
            metadatas=[{
                "timestamp": memory.timestamp.isoformat(),
                "type": memory.memory_type.value,
                "summary": memory.summary,
                "tags": json.dumps(memory.tags),
                "project_tags": json.dumps(memory.project_tags),
                "significance": memory.relationship_significance,
                "recall_score": memory.recall_score,
                "emotions": json.dumps([e for e in memory.emotional_context.gritz_feeling])
            }],
            documents=[memory.to_json()]
        )
        
        logger.info(f"Updated memory '{memory.memory_id}'")
    
    def update_recall_scores(self, updates: Dict[str, float]):
        """Batch update recall scores"""
        for memory_id, recall_score in updates.items():
            try:
                # Get current metadata
                result = self.collection.get(ids=[memory_id])
                if result['metadatas']:
                    metadata = result['metadatas'][0]
                    metadata['recall_score'] = recall_score
                    
                    # Update only metadata
                    self.collection.update(
                        ids=[memory_id],
                        metadatas=[metadata]
                    )
            except Exception as e:
                logger.error(f"Error updating recall score for {memory_id}: {e}")
    
    def get_memories_by_filter(self, filter_dict: Dict, limit: int = 100) -> List[SanctuaryMemory]:
        """Get memories matching specific filters"""
        results = self.collection.get(
            where=filter_dict,
            limit=limit
        )
        
        memories = []
        for doc in results['documents']:
            memory = SanctuaryMemory.from_json(doc)
            memories.append(memory)
        
        return memories
    
    def get_recent_memories(self, hours: int = 24, limit: int = 50) -> List[SanctuaryMemory]:
        """Get memories from the last N hours"""
        cutoff_time = datetime.now().timestamp() - (hours * 3600)
        
        # ChromaDB doesn't support timestamp queries directly
        # So we get all and filter
        all_results = self.collection.get(limit=limit * 2)
        
        memories = []
        for i, doc in enumerate(all_results['documents']):
            metadata = all_results['metadatas'][i]
            timestamp = datetime.fromisoformat(metadata['timestamp']).timestamp()
            
            if timestamp >= cutoff_time:
                memory = SanctuaryMemory.from_json(doc)
                memories.append(memory)
        
        # Sort by timestamp descending
        memories.sort(key=lambda m: m.timestamp, reverse=True)
        
        return memories[:limit]
    
    def _memory_to_text(self, memory: SanctuaryMemory) -> str:
        """Convert memory to searchable text"""
        parts = [
            memory.summary,
            f"Type: {memory.memory_type.value}",
            f"Emotions: {', '.join(memory.emotional_context.gritz_feeling)}",
            f"Tags: {', '.join(memory.tags)}",
        ]
        
        if memory.raw_moment:
            parts.append(f"Moment: {memory.raw_moment}")
        
        if memory.technical_details:
            if memory.technical_details.problem:
                parts.append(f"Problem: {memory.technical_details.problem}")
            if memory.technical_details.solution:
                parts.append(f"Solution: {memory.technical_details.solution}")
        
        return " ".join(parts)
    
    def _add_to_faiss(self, memory_id: str, embedding: np.ndarray):
        """Add single embedding to FAISS index"""
        if self.gpu_index is not None:
            # Get current index
            current_idx = self.gpu_index.ntotal
            
            # Add to index
            self.gpu_index.add(embedding.reshape(1, -1))
            
            # Update ID map
            self.id_map[current_idx] = memory_id
    
    def _add_batch_to_faiss(self, memory_ids: List[str], embeddings: np.ndarray):
        """Add batch of embeddings to FAISS index"""
        if self.gpu_index is not None:
            # Get starting index
            start_idx = self.gpu_index.ntotal
            
            # Add batch to index
            self.gpu_index.add(embeddings)
            
            # Update ID map
            for i, memory_id in enumerate(memory_ids):
                self.id_map[start_idx + i] = memory_id
    
    def rebuild_faiss_index(self):
        """Rebuild FAISS index from ChromaDB data"""
        logger.info("Rebuilding FAISS index...")
        
        # Clear existing index
        if self.use_gpu:
            self._init_gpu_index()
        else:
            self._init_cpu_index()
        
        self.id_map.clear()
        
        # Get all memories
        all_results = self.collection.get()
        
        if all_results['ids']:
            ids = all_results['ids']
            embeddings = np.array(all_results['embeddings'], dtype='float32')
            
            # Add to FAISS
            self._add_batch_to_faiss(ids, embeddings)
            
            logger.info(f"Rebuilt FAISS index with {len(ids)} memories")
    
    def get_statistics(self) -> Dict:
        """Get store statistics"""
        total_memories = self.collection.count()
        
        # Get type distribution
        all_results = self.collection.get(limit=total_memories)
        type_counts = {}
        
        for metadata in all_results['metadatas']:
            memory_type = metadata.get('type', 'unknown')
            type_counts[memory_type] = type_counts.get(memory_type, 0) + 1
        
        return {
            'total_memories': total_memories,
            'type_distribution': type_counts,
            'faiss_indexed': self.gpu_index.ntotal if self.gpu_index else 0,
            'using_gpu': self.use_gpu
        }