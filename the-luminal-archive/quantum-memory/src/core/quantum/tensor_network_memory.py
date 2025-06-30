"""
Tensor Network Memory Storage System
Implements MPS-based quantum memory with efficient compression and retrieval
"""

import numpy as np
import torch
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import logging
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)


@dataclass
class MemoryNode:
    """Represents a single memory node in the tensor network"""
    timestamp: datetime
    emotional_state: np.ndarray  # PAD values
    quantum_state: torch.Tensor  # Quantum state representation
    metadata: Dict[str, Any]
    bond_left: Optional[int] = None
    bond_right: Optional[int] = None
    importance: float = 1.0
    

class TensorNetworkMemory:
    """
    Efficient quantum memory storage using Matrix Product States (MPS)
    Implements memory compression, retrieval, and association
    """
    
    def __init__(self, 
                 max_bond_dim: int = 128,
                 memory_capacity: int = 1000,
                 device: str = "cuda:0",
                 compression_threshold: float = 0.95):
        """
        Initialize tensor network memory system
        
        Args:
            max_bond_dim: Maximum bond dimension for MPS
            memory_capacity: Maximum number of memories to store
            device: Computation device
            compression_threshold: SVD truncation threshold for compression
        """
        self.max_bond_dim = max_bond_dim
        self.memory_capacity = memory_capacity
        self.device = device if torch.cuda.is_available() else "cpu"
        self.compression_threshold = compression_threshold
        
        # Memory storage
        self.memories: List[MemoryNode] = []
        self.memory_index: Dict[str, int] = {}  # Fast lookup by ID
        
        # MPS tensors for the memory network
        self.mps_tensors: List[torch.Tensor] = []
        
        # Importance decay parameters
        self.decay_rate = 0.99
        self.min_importance = 0.01
        
        logger.info(f"Initialized TensorNetworkMemory with capacity {memory_capacity}, "
                   f"bond dimension {max_bond_dim} on {self.device}")
        
    def store_memory(self, emotional_state: np.ndarray, 
                    quantum_state: torch.Tensor,
                    metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Store a new memory in the tensor network
        
        Args:
            emotional_state: PAD emotional values
            quantum_state: Quantum state representation
            metadata: Additional memory metadata
            
        Returns:
            Memory ID for retrieval
        """
        # Generate memory ID
        memory_id = f"mem_{datetime.now().timestamp()}"
        
        # Create memory node
        memory_node = MemoryNode(
            timestamp=datetime.now(),
            emotional_state=emotional_state.copy(),
            quantum_state=quantum_state.clone() if isinstance(quantum_state, torch.Tensor) else torch.tensor(quantum_state, device=self.device),
            metadata=metadata or {},
            importance=1.0
        )
        
        # Check capacity and remove least important if needed
        if len(self.memories) >= self.memory_capacity:
            self._evict_least_important()
            
        # Add to memory store
        self.memories.append(memory_node)
        self.memory_index[memory_id] = len(self.memories) - 1
        
        # Update MPS representation
        self._update_mps_representation(memory_node)
        
        # Create associations with existing memories
        self._create_associations(memory_node)
        
        logger.debug(f"Stored memory {memory_id} with emotional state {emotional_state}")
        return memory_id
        
    def _update_mps_representation(self, new_memory: MemoryNode):
        """Update the MPS tensor network with new memory"""
        # Convert quantum state to MPS tensor
        # Shape: (bond_left, physical_dim, bond_right)
        
        physical_dim = 2  # Binary representation for simplicity
        
        if len(self.mps_tensors) == 0:
            # First memory
            tensor = torch.zeros(1, physical_dim, self.max_bond_dim, 
                               dtype=torch.complex64, device=self.device)
            # Encode quantum state into tensor
            tensor[0, :, 0] = new_memory.quantum_state[:physical_dim]
            self.mps_tensors.append(tensor)
        else:
            # Add new tensor to chain
            bond_left = min(self.mps_tensors[-1].shape[2], self.max_bond_dim)
            tensor = torch.zeros(bond_left, physical_dim, self.max_bond_dim,
                               dtype=torch.complex64, device=self.device)
            
            # Simple encoding - in practice would use more sophisticated method
            tensor[0, :, 0] = new_memory.quantum_state[:physical_dim]
            
            self.mps_tensors.append(tensor)
            
            # Compress if needed
            if len(self.mps_tensors) % 10 == 0:
                self._compress_mps()
                
    def _compress_mps(self):
        """Compress MPS using SVD to maintain efficiency"""
        if len(self.mps_tensors) < 2:
            return
            
        # Right-to-left sweep
        for i in range(len(self.mps_tensors) - 1, 0, -1):
            # Merge adjacent tensors
            left_tensor = self.mps_tensors[i-1]
            right_tensor = self.mps_tensors[i]
            
            # Reshape for SVD
            left_shape = left_tensor.shape
            right_shape = right_tensor.shape
            
            # Contract tensors
            merged = torch.einsum('abc,cde->abde', left_tensor, right_tensor)
            merged_matrix = merged.reshape(left_shape[0] * left_shape[1], -1)
            
            # SVD decomposition
            u, s, v = torch.svd(merged_matrix)
            
            # Truncate based on singular values
            cumsum = torch.cumsum(s**2, dim=0)
            cumsum = cumsum / cumsum[-1]
            keep = torch.sum(cumsum < self.compression_threshold).item() + 1
            keep = min(keep, self.max_bond_dim)
            
            # Update tensors
            u_truncated = u[:, :keep]
            s_truncated = s[:keep]
            v_truncated = v[:, :keep].t()
            
            # Reshape back
            self.mps_tensors[i-1] = u_truncated.reshape(left_shape[0], left_shape[1], keep)
            # Convert s to complex before multiplication
            s_complex = torch.diag(s_truncated.to(self.mps_tensors[i].dtype))
            self.mps_tensors[i] = (s_complex @ v_truncated).reshape(keep, right_shape[1], right_shape[2])
            
        logger.debug(f"Compressed MPS network, max bond dimension: {max(t.shape[2] for t in self.mps_tensors)}")
        
    def retrieve_memory(self, memory_id: str) -> Optional[MemoryNode]:
        """Retrieve a specific memory by ID"""
        if memory_id not in self.memory_index:
            return None
            
        idx = self.memory_index[memory_id]
        if idx < len(self.memories):
            return self.memories[idx]
        return None
        
    def find_similar_memories(self, emotional_state: np.ndarray, 
                            top_k: int = 5) -> List[Tuple[MemoryNode, float]]:
        """
        Find memories with similar emotional states
        
        Args:
            emotional_state: Query PAD values
            top_k: Number of similar memories to return
            
        Returns:
            List of (memory, similarity_score) tuples
        """
        similarities = []
        
        for memory in self.memories:
            # Calculate emotional similarity (cosine similarity)
            similarity = np.dot(emotional_state, memory.emotional_state) / (
                np.linalg.norm(emotional_state) * np.linalg.norm(memory.emotional_state) + 1e-8
            )
            
            # Weight by importance
            weighted_similarity = similarity * memory.importance
            similarities.append((memory, weighted_similarity))
            
        # Sort by similarity and return top k
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]
        
    def _create_associations(self, new_memory: MemoryNode):
        """Create associations between new memory and existing memories"""
        # Find similar memories
        similar_memories = self.find_similar_memories(new_memory.emotional_state, top_k=3)
        
        for similar_memory, similarity in similar_memories:
            if similarity > 0.7:  # Strong association threshold
                # Update bond strengths in metadata
                if 'associations' not in new_memory.metadata:
                    new_memory.metadata['associations'] = []
                    
                new_memory.metadata['associations'].append({
                    'memory_id': self._get_memory_id(similar_memory),
                    'strength': similarity
                })
                
    def _get_memory_id(self, memory: MemoryNode) -> Optional[str]:
        """Get memory ID from node"""
        for mem_id, idx in self.memory_index.items():
            if idx < len(self.memories) and self.memories[idx] is memory:
                return mem_id
        return None
        
    def update_importance(self):
        """Update importance scores with temporal decay"""
        current_time = datetime.now()
        
        for memory in self.memories:
            # Calculate time decay
            time_diff = (current_time - memory.timestamp).total_seconds() / 3600  # Hours
            decay_factor = self.decay_rate ** time_diff
            
            # Update importance
            memory.importance = max(memory.importance * decay_factor, self.min_importance)
            
    def _evict_least_important(self):
        """Remove least important memory when capacity is reached"""
        if not self.memories:
            return
            
        # Find least important memory
        min_importance = float('inf')
        min_idx = 0
        
        for i, memory in enumerate(self.memories):
            if memory.importance < min_importance:
                min_importance = memory.importance
                min_idx = i
                
        # Remove from memories
        removed_memory = self.memories.pop(min_idx)
        
        # Update indices
        self.memory_index = {mem_id: idx for mem_id, idx in self.memory_index.items() 
                           if idx != min_idx}
        # Adjust indices after removal
        for mem_id, idx in self.memory_index.items():
            if idx > min_idx:
                self.memory_index[mem_id] = idx - 1
                
        logger.debug(f"Evicted memory with importance {min_importance}")
        
    def get_memory_statistics(self) -> Dict[str, Any]:
        """Get statistics about the memory system"""
        if not self.memories:
            return {
                'total_memories': 0,
                'average_importance': 0,
                'capacity_usage': 0
            }
            
        importances = [m.importance for m in self.memories]
        
        return {
            'total_memories': len(self.memories),
            'average_importance': np.mean(importances),
            'min_importance': np.min(importances),
            'max_importance': np.max(importances),
            'capacity_usage': len(self.memories) / self.memory_capacity,
            'mps_tensors': len(self.mps_tensors),
            'max_bond_dimension': max(t.shape[2] for t in self.mps_tensors) if self.mps_tensors else 0
        }
        
    def create_memory_context(self, current_emotion: np.ndarray, 
                            context_size: int = 5) -> torch.Tensor:
        """
        Create a quantum context from recent and related memories
        
        Args:
            current_emotion: Current emotional state
            context_size: Number of memories to include in context
            
        Returns:
            Quantum state representing memory context
        """
        # Get recent memories
        recent_memories = self.memories[-context_size//2:] if self.memories else []
        
        # Get similar memories
        similar_memories = self.find_similar_memories(current_emotion, top_k=context_size//2)
        
        # Combine memories
        context_memories = recent_memories + [m[0] for m in similar_memories]
        
        if not context_memories:
            # Return zero state if no memories
            return torch.zeros(2**10, dtype=torch.complex64, device=self.device)
            
        # Create superposition of memory states
        context_state = torch.zeros_like(context_memories[0].quantum_state)
        
        for i, memory in enumerate(context_memories):
            # Weight by recency and importance
            weight = memory.importance * (0.8 ** i)
            context_state += weight * memory.quantum_state
            
        # Normalize
        norm = torch.norm(context_state)
        if norm > 0:
            context_state = context_state / norm
            
        return context_state
        
    def save_to_disk(self, filepath: str):
        """Save memory network to disk"""
        save_data = {
            'memories': [],
            'memory_index': self.memory_index,
            'mps_tensors': [t.cpu().numpy() for t in self.mps_tensors],
            'config': {
                'max_bond_dim': self.max_bond_dim,
                'memory_capacity': self.memory_capacity,
                'compression_threshold': self.compression_threshold,
                'decay_rate': self.decay_rate
            }
        }
        
        # Convert memories to serializable format
        for memory in self.memories:
            mem_data = {
                'timestamp': memory.timestamp.isoformat(),
                'emotional_state': memory.emotional_state.tolist(),
                'quantum_state': memory.quantum_state.cpu().numpy().tolist(),
                'metadata': memory.metadata,
                'importance': memory.importance
            }
            save_data['memories'].append(mem_data)
            
        with open(filepath, 'w') as f:
            json.dump(save_data, f, indent=2)
            
        logger.info(f"Saved {len(self.memories)} memories to {filepath}")
        
    def load_from_disk(self, filepath: str):
        """Load memory network from disk"""
        with open(filepath, 'r') as f:
            save_data = json.load(f)
            
        # Restore configuration
        self.max_bond_dim = save_data['config']['max_bond_dim']
        self.memory_capacity = save_data['config']['memory_capacity']
        self.compression_threshold = save_data['config']['compression_threshold']
        self.decay_rate = save_data['config']['decay_rate']
        
        # Restore memories
        self.memories = []
        for mem_data in save_data['memories']:
            memory = MemoryNode(
                timestamp=datetime.fromisoformat(mem_data['timestamp']),
                emotional_state=np.array(mem_data['emotional_state']),
                quantum_state=torch.tensor(mem_data['quantum_state'], 
                                         dtype=torch.complex64, device=self.device),
                metadata=mem_data['metadata'],
                importance=mem_data['importance']
            )
            self.memories.append(memory)
            
        # Restore index
        self.memory_index = save_data['memory_index']
        
        # Restore MPS tensors
        self.mps_tensors = [
            torch.tensor(t, dtype=torch.complex64, device=self.device) 
            for t in save_data['mps_tensors']
        ]
        
        logger.info(f"Loaded {len(self.memories)} memories from {filepath}")


class QuantumAssociativeMemory:
    """
    Implements quantum associative memory using tensor networks
    Allows for pattern completion and associative recall
    """
    
    def __init__(self, pattern_dim: int = 64, device: str = "cuda:0"):
        """
        Initialize quantum associative memory
        
        Args:
            pattern_dim: Dimension of memory patterns
            device: Computation device
        """
        self.pattern_dim = pattern_dim
        self.device = device if torch.cuda.is_available() else "cpu"
        
        # Stored patterns as quantum states
        self.patterns: List[torch.Tensor] = []
        self.pattern_labels: List[str] = []
        
        # Hopfield-like energy function parameters
        self.coupling_matrix = torch.zeros(pattern_dim, pattern_dim, 
                                         dtype=torch.complex64, device=self.device)
        
    def store_pattern(self, pattern: torch.Tensor, label: str):
        """Store a pattern in associative memory"""
        if pattern.shape[0] != self.pattern_dim:
            raise ValueError(f"Pattern dimension mismatch: {pattern.shape[0]} != {self.pattern_dim}")
            
        # Normalize pattern
        pattern = pattern / torch.norm(pattern)
        
        self.patterns.append(pattern)
        self.pattern_labels.append(label)
        
        # Update coupling matrix (Hebbian learning)
        self.coupling_matrix += torch.outer(pattern, pattern.conj())
        
        # Remove self-coupling
        self.coupling_matrix.fill_diagonal_(0)
        
    def recall_pattern(self, partial_pattern: torch.Tensor, 
                      iterations: int = 10) -> Tuple[torch.Tensor, str, float]:
        """
        Recall complete pattern from partial input
        
        Args:
            partial_pattern: Incomplete pattern
            iterations: Number of recall iterations
            
        Returns:
            Recalled pattern, label, and confidence
        """
        # Initialize state with partial pattern
        state = partial_pattern / torch.norm(partial_pattern)
        
        # Iterative recall using quantum dynamics
        for _ in range(iterations):
            # Apply coupling matrix (mean-field approximation)
            state = self.coupling_matrix @ state
            
            # Add quantum fluctuations
            noise = torch.randn_like(state) * 0.01
            state = state + noise
            
            # Normalize
            state = state / torch.norm(state)
            
        # Find closest stored pattern
        best_overlap = -1
        best_idx = 0
        
        for i, pattern in enumerate(self.patterns):
            overlap = torch.abs(torch.vdot(state, pattern)).item()
            if overlap > best_overlap:
                best_overlap = overlap
                best_idx = i
                
        return self.patterns[best_idx], self.pattern_labels[best_idx], best_overlap


# Example usage
if __name__ == "__main__":
    # Initialize tensor network memory
    tn_memory = TensorNetworkMemory(max_bond_dim=64, memory_capacity=100)
    
    # Store some memories
    emotions = [
        np.array([0.8, 0.6, 0.5]),   # Happy
        np.array([-0.6, 0.3, -0.4]), # Sad
        np.array([0.2, 0.9, 0.7]),   # Excited
    ]
    
    for i, emotion in enumerate(emotions):
        # Create simple quantum state (in practice would use proper encoding)
        quantum_state = torch.randn(1024, dtype=torch.complex64)
        quantum_state = quantum_state / torch.norm(quantum_state)
        
        memory_id = tn_memory.store_memory(
            emotion, 
            quantum_state,
            metadata={'emotion_type': f'emotion_{i}'}
        )
        print(f"Stored memory {memory_id}")
        
    # Find similar memories
    query_emotion = np.array([0.7, 0.5, 0.6])  # Similar to happy
    similar = tn_memory.find_similar_memories(query_emotion, top_k=2)
    
    print(f"\nMemories similar to {query_emotion}:")
    for memory, score in similar:
        print(f"  Emotion: {memory.emotional_state}, Similarity: {score:.3f}")
        
    # Get statistics
    stats = tn_memory.get_memory_statistics()
    print(f"\nMemory statistics: {stats}")