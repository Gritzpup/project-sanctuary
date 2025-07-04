"""
Quantum Memory Interference Module
Implements interference patterns between memories based on emotional similarity
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)


@dataclass
class MemoryState:
    """Quantum representation of a memory"""
    memory_id: str
    content: str
    emotional_state: np.ndarray  # Quantum state vector
    pad_values: Tuple[float, float, float]
    timestamp: datetime
    importance: float
    decay_factor: float = 0.95
    
    def get_amplitude(self, time_delta: timedelta) -> float:
        """Calculate memory amplitude based on time decay"""
        days_passed = time_delta.total_seconds() / 86400
        return self.importance * (self.decay_factor ** days_passed)


class QuantumMemoryInterference:
    """
    Implements quantum interference between memories
    Based on emotional similarity and temporal proximity
    """
    
    def __init__(self, n_qubits: int = 27):
        self.n_qubits = n_qubits
        self.interference_threshold = 0.3  # Minimum similarity for interference
        self.constructive_threshold = 0.7  # Similarity for constructive interference
        self.destructive_threshold = 0.2   # Dissimilarity for destructive interference
        
        logger.info("Initialized Quantum Memory Interference module")
        
    def calculate_interference(self, memory1: MemoryState, memory2: MemoryState,
                             current_time: datetime) -> Dict[str, float]:
        """
        Calculate interference between two memories
        
        Returns:
            Dict with interference metrics:
            - total_interference: Overall interference strength
            - constructive: Constructive interference component
            - destructive: Destructive interference component
            - phase_difference: Phase difference between memories
        """
        # Calculate time-based amplitudes
        amp1 = memory1.get_amplitude(current_time - memory1.timestamp)
        amp2 = memory2.get_amplitude(current_time - memory2.timestamp)
        
        # Calculate emotional similarity (quantum fidelity)
        fidelity = self._calculate_fidelity(memory1.emotional_state, memory2.emotional_state)
        
        # Calculate phase difference from PAD values
        phase_diff = self._calculate_phase_difference(memory1.pad_values, memory2.pad_values)
        
        # Interference calculation
        # |ψ₁ + ψ₂|² = |ψ₁|² + |ψ₂|² + 2Re(ψ₁*ψ₂)
        interference_term = 2 * amp1 * amp2 * fidelity * np.cos(phase_diff)
        
        # Separate constructive and destructive components
        constructive = max(0, interference_term)
        destructive = abs(min(0, interference_term))
        
        return {
            'total_interference': interference_term,
            'constructive': constructive,
            'destructive': destructive,
            'phase_difference': phase_diff,
            'fidelity': fidelity,
            'amplitude_product': amp1 * amp2
        }
        
    def _calculate_fidelity(self, state1: np.ndarray, state2: np.ndarray) -> float:
        """Calculate quantum fidelity between two states"""
        # F(ρ₁, ρ₂) = |⟨ψ₁|ψ₂⟩|²
        overlap = np.abs(np.vdot(state1, state2))
        return overlap ** 2
        
    def _calculate_phase_difference(self, pad1: Tuple[float, float, float],
                                   pad2: Tuple[float, float, float]) -> float:
        """Calculate phase difference based on PAD values"""
        # Convert PAD differences to phase
        # Larger emotional differences = larger phase differences
        pad_diff = np.array(pad1) - np.array(pad2)
        
        # Weighted contribution of each dimension to phase
        weights = np.array([0.5, 0.3, 0.2])  # P > A > D
        
        # Map to [0, 2π]
        phase = np.sum(np.abs(pad_diff) * weights) * np.pi
        return phase % (2 * np.pi)
        
    def create_interference_pattern(self, memories: List[MemoryState],
                                  current_time: datetime) -> np.ndarray:
        """
        Create full interference pattern for a set of memories
        
        Returns:
            Interference matrix showing pairwise interactions
        """
        n_memories = len(memories)
        interference_matrix = np.zeros((n_memories, n_memories))
        
        for i in range(n_memories):
            for j in range(i + 1, n_memories):
                interference = self.calculate_interference(
                    memories[i], memories[j], current_time
                )
                
                # Store total interference
                value = interference['total_interference']
                interference_matrix[i, j] = value
                interference_matrix[j, i] = value  # Symmetric
                
        return interference_matrix
        
    def find_resonant_memories(self, target_memory: MemoryState,
                             memory_pool: List[MemoryState],
                             current_time: datetime,
                             top_k: int = 5) -> List[Tuple[MemoryState, float]]:
        """
        Find memories that resonate (constructively interfere) with target
        
        Returns:
            List of (memory, resonance_strength) tuples
        """
        resonances = []
        
        for memory in memory_pool:
            if memory.memory_id == target_memory.memory_id:
                continue
                
            interference = self.calculate_interference(
                target_memory, memory, current_time
            )
            
            # Only consider constructive interference
            if interference['constructive'] > self.interference_threshold:
                resonances.append((memory, interference['constructive']))
                
        # Sort by resonance strength
        resonances.sort(key=lambda x: x[1], reverse=True)
        
        return resonances[:top_k]
        
    def apply_interference_to_recall(self, target_memory: MemoryState,
                                   interfering_memories: List[MemoryState],
                                   current_time: datetime) -> Dict[str, any]:
        """
        Apply interference effects to memory recall
        
        This simulates how other memories can enhance or suppress recall
        """
        base_amplitude = target_memory.get_amplitude(current_time - target_memory.timestamp)
        
        # Calculate total interference effect
        total_constructive = 0
        total_destructive = 0
        interfering_contents = []
        
        for memory in interfering_memories:
            interference = self.calculate_interference(
                target_memory, memory, current_time
            )
            
            total_constructive += interference['constructive']
            total_destructive += interference['destructive']
            
            # Strong interference can cause memory blending
            if interference['fidelity'] > self.constructive_threshold:
                interfering_contents.append({
                    'content': memory.content,
                    'strength': interference['constructive']
                })
                
        # Modified recall strength
        recall_strength = base_amplitude + total_constructive - total_destructive
        recall_strength = max(0, min(1, recall_strength))  # Clamp to [0, 1]
        
        # Determine recall clarity based on interference
        clarity = 1.0
        if total_destructive > 0:
            clarity *= (1 - min(0.5, total_destructive))
        if len(interfering_contents) > 0:
            clarity *= (1 - 0.1 * len(interfering_contents))  # Multiple interferences reduce clarity
            
        return {
            'recall_strength': recall_strength,
            'clarity': clarity,
            'base_amplitude': base_amplitude,
            'constructive_boost': total_constructive,
            'destructive_suppression': total_destructive,
            'interfering_memories': interfering_contents,
            'enhanced': recall_strength > base_amplitude,
            'suppressed': recall_strength < base_amplitude
        }
        
    def create_memory_superposition(self, memories: List[MemoryState],
                                  weights: Optional[List[float]] = None) -> np.ndarray:
        """
        Create quantum superposition of multiple memories
        
        This represents a "mixed" memory state where multiple memories
        are simultaneously active
        """
        if weights is None:
            # Equal superposition
            weights = [1.0 / np.sqrt(len(memories))] * len(memories)
        else:
            # Normalize weights
            norm = np.sqrt(sum(w**2 for w in weights))
            weights = [w / norm for w in weights]
            
        # Create superposition
        superposed_state = np.zeros(2**self.n_qubits, dtype=complex)
        
        for memory, weight in zip(memories, weights):
            superposed_state += weight * memory.emotional_state
            
        # Normalize final state
        norm = np.linalg.norm(superposed_state)
        if norm > 0:
            superposed_state /= norm
            
        return superposed_state
        
    def measure_memory_entanglement(self, memory_group: List[MemoryState]) -> float:
        """
        Measure the degree of entanglement in a group of memories
        
        Higher values indicate memories are more "tangled" together
        """
        if len(memory_group) < 2:
            return 0.0
            
        # Create superposition of all memories
        superposed = self.create_memory_superposition(memory_group)
        
        # Calculate entanglement entropy (simplified)
        probs = np.abs(superposed)**2
        entropy = -np.sum(probs * np.log2(probs + 1e-12))
        
        # Normalize by maximum possible entropy
        max_entropy = self.n_qubits
        normalized_entanglement = entropy / max_entropy
        
        return normalized_entanglement
        
    def simulate_memory_evolution(self, initial_memory: MemoryState,
                                time_steps: List[datetime],
                                environmental_memories: List[MemoryState]) -> List[Dict]:
        """
        Simulate how a memory evolves over time due to interference
        
        Returns evolution history showing how the memory changes
        """
        evolution_history = []
        current_state = initial_memory.emotional_state.copy()
        
        for t, time in enumerate(time_steps):
            # Calculate interference at this time point
            total_interference = np.zeros_like(current_state)
            
            for env_memory in environmental_memories:
                if env_memory.memory_id == initial_memory.memory_id:
                    continue
                    
                # Time-based amplitude
                env_amp = env_memory.get_amplitude(time - env_memory.timestamp)
                
                # Interference contribution
                overlap = np.vdot(current_state, env_memory.emotional_state)
                total_interference += env_amp * overlap * env_memory.emotional_state
                
            # Apply interference (with damping to prevent runaway)
            damping = 0.1
            current_state += damping * total_interference
            
            # Renormalize
            norm = np.linalg.norm(current_state)
            if norm > 0:
                current_state /= norm
                
            # Extract PAD values from evolved state
            evolved_pad = self._extract_pad_from_state(current_state)
            
            evolution_history.append({
                'time': time.isoformat(),
                'step': t,
                'pad_values': evolved_pad,
                'state_norm': norm,
                'interference_magnitude': np.linalg.norm(total_interference)
            })
            
        return evolution_history
        
    def _extract_pad_from_state(self, quantum_state: np.ndarray) -> Tuple[float, float, float]:
        """Extract PAD values from quantum state (simplified)"""
        # This would interface with the actual quantum decoder
        # For now, use simplified extraction
        probs = np.abs(quantum_state)**2
        
        # Map different regions of the state space to PAD values
        n_states = len(quantum_state)
        pleasure = 0.0
        arousal = 0.0
        dominance = 0.0
        
        for i, prob in enumerate(probs):
            # Simple mapping - would be more sophisticated in practice
            pleasure += prob * (2 * (i % 8) / 7 - 1)
            arousal += prob * (2 * ((i // 8) % 8) / 7 - 1)
            dominance += prob * (2 * ((i // 64) % 8) / 7 - 1)
            
        return (pleasure, arousal, dominance)
        
    def create_interference_report(self, target_memory: MemoryState,
                                 memory_pool: List[MemoryState],
                                 current_time: datetime) -> Dict:
        """
        Create comprehensive interference analysis report
        """
        # Find resonant memories
        resonant = self.find_resonant_memories(target_memory, memory_pool, current_time)
        
        # Find interfering (suppressing) memories
        interfering = []
        for memory in memory_pool:
            if memory.memory_id == target_memory.memory_id:
                continue
                
            interference = self.calculate_interference(target_memory, memory, current_time)
            if interference['destructive'] > self.interference_threshold:
                interfering.append((memory, interference['destructive']))
                
        interfering.sort(key=lambda x: x[1], reverse=True)
        
        # Calculate recall with interference
        all_memories = [m for m, _ in resonant] + [m for m, _ in interfering[:5]]
        recall_result = self.apply_interference_to_recall(
            target_memory, all_memories, current_time
        )
        
        return {
            'target_memory': {
                'id': target_memory.memory_id,
                'content': target_memory.content,
                'pad': target_memory.pad_values,
                'age_days': (current_time - target_memory.timestamp).days
            },
            'resonant_memories': [
                {
                    'content': m.content,
                    'resonance_strength': strength,
                    'pad': m.pad_values
                }
                for m, strength in resonant
            ],
            'interfering_memories': [
                {
                    'content': m.content,
                    'interference_strength': strength,
                    'pad': m.pad_values
                }
                for m, strength in interfering[:3]
            ],
            'recall_analysis': recall_result,
            'recommendation': self._generate_recommendation(recall_result)
        }
        
    def _generate_recommendation(self, recall_result: Dict) -> str:
        """Generate recommendation based on interference analysis"""
        if recall_result['enhanced']:
            return "Memory is reinforced by related memories - good for long-term retention"
        elif recall_result['suppressed']:
            return "Memory is being suppressed by conflicting memories - may need reinforcement"
        elif recall_result['clarity'] < 0.5:
            return "Memory clarity is low due to interference - consider consolidation"
        else:
            return "Memory is stable with minimal interference"


# Example usage
if __name__ == "__main__":
    # Create interference module
    qmi = QuantumMemoryInterference()
    
    # Create sample memories
    memories = [
        MemoryState(
            memory_id="mem_001",
            content="Working on quantum memory system with Gritz",
            emotional_state=np.random.rand(2**27) + 1j*np.random.rand(2**27),
            pad_values=(0.8, 0.6, 0.5),
            timestamp=datetime.now() - timedelta(days=1),
            importance=0.9
        ),
        MemoryState(
            memory_id="mem_002",
            content="Debugging the analyzer together",
            emotional_state=np.random.rand(2**27) + 1j*np.random.rand(2**27),
            pad_values=(0.7, 0.7, 0.4),
            timestamp=datetime.now() - timedelta(hours=12),
            importance=0.8
        ),
        MemoryState(
            memory_id="mem_003",
            content="Feeling frustrated with module errors",
            emotional_state=np.random.rand(2**27) + 1j*np.random.rand(2**27),
            pad_values=(-0.3, 0.6, -0.2),
            timestamp=datetime.now() - timedelta(hours=6),
            importance=0.6
        )
    ]
    
    # Normalize emotional states
    for mem in memories:
        mem.emotional_state /= np.linalg.norm(mem.emotional_state)
    
    # Test interference
    current_time = datetime.now()
    
    print("Memory Interference Analysis")
    print("=" * 50)
    
    # Analyze interference between first two memories
    interference = qmi.calculate_interference(memories[0], memories[1], current_time)
    print(f"\nInterference between memories 1 and 2:")
    print(f"  Total: {interference['total_interference']:.3f}")
    print(f"  Constructive: {interference['constructive']:.3f}")
    print(f"  Destructive: {interference['destructive']:.3f}")
    print(f"  Fidelity: {interference['fidelity']:.3f}")
    
    # Create full report
    report = qmi.create_interference_report(memories[0], memories[1:], current_time)
    print(f"\nFull Interference Report:")
    print(json.dumps(report, indent=2, default=str))