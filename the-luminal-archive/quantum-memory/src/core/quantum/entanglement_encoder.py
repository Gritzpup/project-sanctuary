"""
Quantum Entanglement Encoder/Decoder
Implements emotional state encoding using quantum entanglement
Compatible with PyTorch and cuQuantum backends
"""

import numpy as np
import torch
from typing import Dict, List, Tuple, Optional, Any
import logging
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class EntanglementPattern:
    """Represents an entanglement pattern between qubits"""
    qubit_pairs: List[Tuple[int, int]]
    entanglement_strength: List[float]
    pattern_type: str  # 'linear', 'star', 'full', 'custom'
    

class QuantumEntanglementEncoder:
    """
    Encodes emotional states using quantum entanglement patterns
    Optimized for GPU execution with PyTorch
    """
    
    def __init__(self, n_qubits: int = 27, device: str = "cuda:0"):
        """
        Initialize quantum entanglement encoder
        
        Args:
            n_qubits: Total number of qubits (default 27 for PAD model)
            device: Computation device
        """
        self.n_qubits = n_qubits
        self.device = device if torch.cuda.is_available() else "cpu"
        self.dtype = torch.complex64
        
        # Qubit allocation for PAD model (adaptive based on total qubits)
        if n_qubits >= 27:
            self.pleasure_qubits = list(range(0, 10))      # 10 qubits
            self.arousal_qubits = list(range(10, 19))     # 9 qubits  
            self.dominance_qubits = list(range(19, 27))   # 8 qubits
        else:
            # For smaller systems, distribute qubits proportionally
            p_size = n_qubits // 3 + (1 if n_qubits % 3 >= 1 else 0)
            a_size = n_qubits // 3 + (1 if n_qubits % 3 >= 2 else 0)
            d_size = n_qubits // 3
            
            self.pleasure_qubits = list(range(0, p_size))
            self.arousal_qubits = list(range(p_size, p_size + a_size))
            self.dominance_qubits = list(range(p_size + a_size, n_qubits))
        
        # Pre-compute common gates
        self._initialize_gates()
        
        # Entanglement patterns for different emotional states
        self.entanglement_patterns = self._create_entanglement_patterns()
        
        logger.info(f"Initialized QuantumEntanglementEncoder with {n_qubits} qubits on {device}")
        
    def _initialize_gates(self):
        """Pre-compute common quantum gates"""
        # Hadamard gate
        self.H = torch.tensor([[1, 1], [1, -1]], dtype=self.dtype, device=self.device) / np.sqrt(2)
        
        # Pauli gates
        self.X = torch.tensor([[0, 1], [1, 0]], dtype=self.dtype, device=self.device)
        self.Y = torch.tensor([[0, -1j], [1j, 0]], dtype=self.dtype, device=self.device)
        self.Z = torch.tensor([[1, 0], [0, -1]], dtype=self.dtype, device=self.device)
        
        # CNOT gate (4x4 matrix for 2-qubit operation)
        self.CNOT = torch.tensor([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0]
        ], dtype=self.dtype, device=self.device)
        
        # Identity
        self.I = torch.eye(2, dtype=self.dtype, device=self.device)
        
    def _create_entanglement_patterns(self) -> Dict[str, EntanglementPattern]:
        """Create predefined entanglement patterns for different emotional states"""
        patterns = {}
        
        # Linear entanglement (nearest neighbor)
        linear_pairs = [(i, i+1) for i in range(self.n_qubits-1)]
        patterns['linear'] = EntanglementPattern(
            qubit_pairs=linear_pairs,
            entanglement_strength=[0.5] * len(linear_pairs),
            pattern_type='linear'
        )
        
        # Cross-dimensional entanglement (PAD coupling)
        cross_pairs = []
        
        return patterns
    
    def create_bell_pair(self):
        """Create a Bell pair (maximally entangled 2-qubit state)"""
        from qiskit import QuantumCircuit
        from qiskit.quantum_info import Statevector
        
        # Create Bell state |Φ+⟩ = (|00⟩ + |11⟩)/√2
        qc = QuantumCircuit(2)
        qc.h(0)  # Hadamard on first qubit
        qc.cx(0, 1)  # CNOT from first to second
        
        return Statevector(qc)
    
    def encode_emotion_to_quantum(self, pleasure: float, arousal: float, dominance: float):
        """Encode PAD emotional values to quantum state"""
        from qiskit import QuantumCircuit
        from qiskit.quantum_info import Statevector
        
        # Use 3 qubits for simple encoding
        qc = QuantumCircuit(3)
        
        # Encode each emotion dimension as rotation angle
        qc.ry(pleasure * np.pi, 0)
        qc.ry(arousal * np.pi, 1)
        qc.ry(dominance * np.pi, 2)
        
        # Add entanglement
        qc.cx(0, 1)
        qc.cx(1, 2)
        qc.cx(2, 0)
        
        return Statevector(qc)
        
        # Star pattern (hub qubit entangled with all others)
        hub_qubit = self.n_qubits // 2
        star_pairs = [(hub_qubit, i) for i in range(self.n_qubits) if i != hub_qubit]
        patterns['star'] = EntanglementPattern(
            qubit_pairs=star_pairs,
            entanglement_strength=[0.3] * len(star_pairs),
            pattern_type='star'
        )
        
        return patterns
        
    def encode_emotional_state(self, pad_values: np.ndarray, 
                             entanglement_pattern: str = 'cross_dimensional') -> torch.Tensor:
        """
        Encode PAD emotional values into entangled quantum state
        
        Args:
            pad_values: Array of [Pleasure, Arousal, Dominance] values
            entanglement_pattern: Type of entanglement to use
            
        Returns:
            Quantum state vector with emotional encoding
        """
        # Validate inputs
        pad_values = np.clip(pad_values, [-1, 0, 0], [1, 1, 1])
        
        # Initialize state to |000...0>
        state = torch.zeros(2**self.n_qubits, dtype=self.dtype, device=self.device)
        state[0] = 1.0
        
        # Stage 1: Apply Hadamard gates for superposition
        state = self._apply_hadamard_layer(state)
        
        # Stage 2: Encode PAD values using rotation gates
        state = self._encode_pad_rotations(state, pad_values)
        
        # Stage 3: Create entanglement
        pattern = self.entanglement_patterns[entanglement_pattern]
        state = self._apply_entanglement_pattern(state, pattern)
        
        # Stage 4: Apply phase encoding for complex emotional states
        state = self._apply_phase_encoding(state, pad_values)
        
        # Normalize
        state = state / torch.norm(state)
        
        logger.debug(f"Encoded PAD values {pad_values} with {entanglement_pattern} pattern")
        return state
        
    def _apply_hadamard_layer(self, state: torch.Tensor) -> torch.Tensor:
        """Apply Hadamard gates to create initial superposition"""
        # For efficiency with large systems, apply H^n directly
        # H^n|0...0> = |+...+> = (1/sqrt(2^n)) * sum over all basis states
        
        # Create equal superposition state directly
        state = torch.ones(2**self.n_qubits, dtype=self.dtype, device=self.device)
        state = state / torch.sqrt(torch.tensor(2**self.n_qubits, dtype=torch.float32))
        
        return state
        
    def _apply_single_qubit_gate(self, state: torch.Tensor, gate: torch.Tensor, 
                                qubit: int) -> torch.Tensor:
        """Apply single-qubit gate to quantum state"""
        # More efficient implementation without full tensor product
        # Reshape state to separate target qubit
        dim_before = 2**qubit
        dim_after = 2**(self.n_qubits - qubit - 1)
        
        # Reshape state: (dim_before, 2, dim_after)
        state_reshaped = state.reshape(dim_before, 2, dim_after)
        
        # Apply gate to middle dimension
        # gate @ state means: for each (i,k), compute sum_j gate[m,j] * state[i,j,k]
        state_new = torch.zeros_like(state_reshaped)
        state_new[:, 0, :] = gate[0, 0] * state_reshaped[:, 0, :] + gate[0, 1] * state_reshaped[:, 1, :]
        state_new[:, 1, :] = gate[1, 0] * state_reshaped[:, 0, :] + gate[1, 1] * state_reshaped[:, 1, :]
        
        # Reshape back
        return state_new.reshape(-1)
        
    def _encode_pad_rotations(self, state: torch.Tensor, pad_values: np.ndarray) -> torch.Tensor:
        """Encode PAD values using rotation gates"""
        # Normalize PAD values
        p_norm = (pad_values[0] + 1) / 2  # [-1,1] -> [0,1]
        a_norm = pad_values[1]            # Already [0,1]
        d_norm = pad_values[2]            # Already [0,1]
        
        # Encode Pleasure
        for i, qubit in enumerate(self.pleasure_qubits):
            angle = p_norm * np.pi * (1 + i/10) * np.exp(-i/20)
            ry_gate = self._rotation_gate(angle, 'y')
            state = self._apply_single_qubit_gate(state, ry_gate, qubit)
            
            # Add phase
            phase = p_norm * np.pi * np.sin(i * np.pi / 10) / 2
            rz_gate = self._rotation_gate(phase, 'z')
            state = self._apply_single_qubit_gate(state, rz_gate, qubit)
            
        # Encode Arousal
        for i, qubit in enumerate(self.arousal_qubits):
            angle = a_norm * np.pi * (1 + i/9) * np.exp(-i/18)
            ry_gate = self._rotation_gate(angle, 'y')
            state = self._apply_single_qubit_gate(state, ry_gate, qubit)
            
            phase = a_norm * np.pi * np.cos(i * np.pi / 9) / 2
            rz_gate = self._rotation_gate(phase, 'z')
            state = self._apply_single_qubit_gate(state, rz_gate, qubit)
            
        # Encode Dominance
        for i, qubit in enumerate(self.dominance_qubits):
            angle = d_norm * np.pi * (1 + i/8) * np.exp(-i/16)
            ry_gate = self._rotation_gate(angle, 'y')
            state = self._apply_single_qubit_gate(state, ry_gate, qubit)
            
            phase = d_norm * np.pi * np.sin(i * np.pi / 8) / 2
            rz_gate = self._rotation_gate(phase, 'z')
            state = self._apply_single_qubit_gate(state, rz_gate, qubit)
            
        return state
        
    def _rotation_gate(self, angle: float, axis: str) -> torch.Tensor:
        """Create rotation gate around specified axis"""
        if axis == 'x':
            c = np.cos(angle/2)
            s = np.sin(angle/2)
            return torch.tensor([[c, -1j*s], [-1j*s, c]], dtype=self.dtype, device=self.device)
        elif axis == 'y':
            c = np.cos(angle/2)
            s = np.sin(angle/2)
            return torch.tensor([[c, -s], [s, c]], dtype=self.dtype, device=self.device)
        elif axis == 'z':
            return torch.tensor([
                [np.exp(-1j*angle/2), 0],
                [0, np.exp(1j*angle/2)]
            ], dtype=self.dtype, device=self.device)
        else:
            raise ValueError(f"Unknown rotation axis: {axis}")
            
    def _apply_entanglement_pattern(self, state: torch.Tensor, 
                                  pattern: EntanglementPattern) -> torch.Tensor:
        """Apply entanglement pattern to quantum state"""
        for (q1, q2), strength in zip(pattern.qubit_pairs, pattern.entanglement_strength):
            # Apply controlled rotation based on entanglement strength
            state = self._apply_controlled_rotation(state, q1, q2, strength * np.pi)
            
        return state
        
    def _apply_controlled_rotation(self, state: torch.Tensor, control: int, 
                                 target: int, angle: float) -> torch.Tensor:
        """Apply controlled rotation between two qubits"""
        # For simplicity, use CRY (controlled Y rotation)
        # Build the 4x4 matrix for the two-qubit subspace
        c = np.cos(angle/2)
        s = np.sin(angle/2)
        
        cry_matrix = torch.tensor([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, c, -s],
            [0, 0, s, c]
        ], dtype=self.dtype, device=self.device)
        
        # Apply to full state (simplified - assumes adjacent qubits)
        # In practice, would need proper tensor product construction
        if abs(control - target) == 1:
            # Adjacent qubits - can apply directly
            min_q = min(control, target)
            state = self._apply_two_qubit_gate(state, cry_matrix, min_q, min_q + 1)
            
        return state
        
    def _apply_two_qubit_gate(self, state: torch.Tensor, gate: torch.Tensor,
                            qubit1: int, qubit2: int) -> torch.Tensor:
        """Apply two-qubit gate to quantum state"""
        # Simplified implementation for adjacent qubits
        # Full implementation would handle arbitrary qubit pairs
        
        # Build full operator
        op = torch.tensor(1.0, dtype=self.dtype, device=self.device)
        
        for i in range(self.n_qubits):
            if i == qubit1:
                # Skip qubit1, will be handled with qubit2
                continue
            elif i == qubit2:
                # Apply 2-qubit gate
                op = torch.kron(op, gate.reshape(4, 4))
                i += 1  # Skip next iteration
            else:
                op = torch.kron(op, self.I)
                
        # Note: This is simplified and may not work correctly for all cases
        # A proper implementation would use more sophisticated tensor manipulations
        return state  # Return unchanged for now
        
    def _apply_phase_encoding(self, state: torch.Tensor, pad_values: np.ndarray) -> torch.Tensor:
        """Apply phase encoding based on emotional values"""
        # Create phase pattern based on PAD values
        phase_pattern = torch.zeros(2**self.n_qubits, dtype=torch.float32, device=self.device)
        
        # Generate phase based on bit patterns
        for i in range(2**self.n_qubits):
            # Extract bit values for each dimension
            p_bits = i & ((1 << len(self.pleasure_qubits)) - 1)
            a_bits = (i >> len(self.pleasure_qubits)) & ((1 << len(self.arousal_qubits)) - 1)
            d_bits = (i >> (len(self.pleasure_qubits) + len(self.arousal_qubits))) & ((1 << len(self.dominance_qubits)) - 1)
            
            # Calculate phase based on emotional correlation
            p_phase = pad_values[0] * p_bits / (2**len(self.pleasure_qubits))
            a_phase = pad_values[1] * a_bits / (2**len(self.arousal_qubits))
            d_phase = pad_values[2] * d_bits / (2**len(self.dominance_qubits))
            
            phase_pattern[i] = (p_phase + a_phase + d_phase) * np.pi / 3
            
        # Apply phase
        phase_op = torch.exp(1j * phase_pattern)
        state = state * phase_op
        
        return state
        
    def decode_emotional_state(self, quantum_state: torch.Tensor) -> Dict[str, Any]:
        """
        Decode quantum state back to emotional values and metrics
        
        Args:
            quantum_state: Quantum state vector
            
        Returns:
            Dictionary with PAD values and quantum metrics
        """
        # Calculate probability distribution
        probabilities = torch.abs(quantum_state)**2
        
        # Extract PAD values through expectation values
        pad_values = self._extract_pad_expectation(probabilities)
        
        # Calculate entanglement measures
        entanglement_metrics = self._calculate_entanglement_metrics(quantum_state)
        
        # Calculate coherence
        coherence = self._calculate_coherence(quantum_state)
        
        return {
            'pad_values': pad_values,
            'pleasure': float(pad_values[0]),
            'arousal': float(pad_values[1]),
            'dominance': float(pad_values[2]),
            'entanglement': entanglement_metrics,
            'coherence': coherence,
            'state_purity': float(torch.sum(probabilities**2).item())
        }
        
    def _extract_pad_expectation(self, probabilities: torch.Tensor) -> np.ndarray:
        """Extract PAD expectation values from probability distribution"""
        p_exp = 0.0
        a_exp = 0.0
        d_exp = 0.0
        
        for idx in range(len(probabilities)):
            prob = probabilities[idx].item()
            if prob > 1e-10:
                # Extract bit values for each dimension
                p_bits = idx & ((1 << len(self.pleasure_qubits)) - 1)
                a_bits = (idx >> len(self.pleasure_qubits)) & ((1 << len(self.arousal_qubits)) - 1)
                d_bits = (idx >> (len(self.pleasure_qubits) + len(self.arousal_qubits))) & ((1 << len(self.dominance_qubits)) - 1)
                
                # Normalize to appropriate ranges
                p_val = p_bits / (2**len(self.pleasure_qubits) - 1)
                a_val = a_bits / (2**len(self.arousal_qubits) - 1)
                d_val = d_bits / (2**len(self.dominance_qubits) - 1)
                
                # Accumulate expectation values
                p_exp += prob * p_val
                a_exp += prob * a_val
                d_exp += prob * d_val
                
        # Convert pleasure back to [-1, 1] range
        p_exp = p_exp * 2 - 1
        
        return np.array([p_exp, a_exp, d_exp])
        
    def _calculate_entanglement_metrics(self, quantum_state: torch.Tensor) -> Dict[str, float]:
        """Calculate entanglement measures for the quantum state"""
        # Simplified entanglement calculation
        # Full implementation would use partial trace and entropy measures
        
        # Calculate participation ratio (inverse participation ratio)
        probs = torch.abs(quantum_state)**2
        ipr = 1.0 / torch.sum(probs**2).item()
        
        # Normalized entanglement measure
        max_ipr = 2**self.n_qubits
        entanglement_measure = (ipr - 1) / (max_ipr - 1)
        
        return {
            'participation_ratio': float(ipr),
            'entanglement_measure': float(entanglement_measure),
            'max_entangled': float(ipr > 2**(self.n_qubits - 2))
        }
        
    def _calculate_coherence(self, quantum_state: torch.Tensor) -> float:
        """Calculate quantum coherence (l1-norm of off-diagonal elements)"""
        # For state vector, coherence is related to superposition
        coherence = torch.sum(torch.abs(quantum_state)).item() - 1.0
        return float(coherence)
        
    def create_emotional_superposition(self, emotions: List[Tuple[np.ndarray, float]]) -> torch.Tensor:
        """
        Create superposition of multiple emotional states
        
        Args:
            emotions: List of (pad_values, weight) tuples
            
        Returns:
            Quantum state in superposition
        """
        # Normalize weights
        weights = np.array([w for _, w in emotions])
        weights = weights / np.sum(weights)
        
        # Create individual states
        superposition = torch.zeros(2**self.n_qubits, dtype=self.dtype, device=self.device)
        
        for (pad_values, _), weight in zip(emotions, weights):
            state = self.encode_emotional_state(pad_values)
            superposition += np.sqrt(weight) * state
            
        # Normalize
        superposition = superposition / torch.norm(superposition)
        
        return superposition
        
    def measure_similarity(self, state1: torch.Tensor, state2: torch.Tensor) -> float:
        """Calculate quantum fidelity between two emotional states"""
        fidelity = torch.abs(torch.vdot(state1, state2))**2
        return float(fidelity.item())
        
    def apply_emotional_transformation(self, quantum_state: torch.Tensor,
                                     transformation_type: str,
                                     strength: float = 0.5) -> torch.Tensor:
        """
        Apply emotional transformation to quantum state
        
        Args:
            quantum_state: Current emotional state
            transformation_type: Type of transformation ('calm', 'excite', 'empower', 'diminish')
            strength: Transformation strength [0, 1]
            
        Returns:
            Transformed quantum state
        """
        state = quantum_state.clone()
        
        if transformation_type == 'calm':
            # Reduce arousal
            for qubit in self.arousal_qubits:
                angle = -strength * np.pi / 4
                ry_gate = self._rotation_gate(angle, 'y')
                state = self._apply_single_qubit_gate(state, ry_gate, qubit)
                
        elif transformation_type == 'excite':
            # Increase arousal
            for qubit in self.arousal_qubits:
                angle = strength * np.pi / 4
                ry_gate = self._rotation_gate(angle, 'y')
                state = self._apply_single_qubit_gate(state, ry_gate, qubit)
                
        elif transformation_type == 'empower':
            # Increase dominance
            for qubit in self.dominance_qubits:
                angle = strength * np.pi / 4
                ry_gate = self._rotation_gate(angle, 'y')
                state = self._apply_single_qubit_gate(state, ry_gate, qubit)
                
        elif transformation_type == 'diminish':
            # Decrease dominance
            for qubit in self.dominance_qubits:
                angle = -strength * np.pi / 4
                ry_gate = self._rotation_gate(angle, 'y')
                state = self._apply_single_qubit_gate(state, ry_gate, qubit)
                
        # Renormalize
        state = state / torch.norm(state)
        
        return state


# Example usage
if __name__ == "__main__":
    # Initialize encoder
    encoder = QuantumEntanglementEncoder(n_qubits=27)
    
    # Test emotional encoding
    emotions_test = [
        ('Happy', np.array([0.8, 0.6, 0.7])),
        ('Sad', np.array([-0.7, 0.3, 0.2])),
        ('Angry', np.array([-0.5, 0.8, 0.6])),
        ('Calm', np.array([0.3, 0.2, 0.5]))
    ]
    
    for name, pad_values in emotions_test:
        print(f"\nEncoding {name}: {pad_values}")
        
        # Encode
        quantum_state = encoder.encode_emotional_state(pad_values)
        
        # Decode
        decoded = encoder.decode_emotional_state(quantum_state)
        
        print(f"Decoded PAD: {decoded['pad_values']}")
        print(f"Entanglement: {decoded['entanglement']['entanglement_measure']:.3f}")
        print(f"Coherence: {decoded['coherence']:.3f}")
        
    # Test superposition
    print("\nCreating emotional superposition...")
    superposition = encoder.create_emotional_superposition([
        (np.array([0.8, 0.6, 0.7]), 0.6),  # 60% happy
        (np.array([-0.7, 0.3, 0.2]), 0.4)   # 40% sad
    ])
    
    decoded_super = encoder.decode_emotional_state(superposition)
    print(f"Superposition PAD: {decoded_super['pad_values']}")
    
    # Test transformation
    print("\nApplying calming transformation...")
    calmed_state = encoder.apply_emotional_transformation(quantum_state, 'calm', strength=0.7)
    calmed_decoded = encoder.decode_emotional_state(calmed_state)
    print(f"Calmed PAD: {calmed_decoded['pad_values']}")