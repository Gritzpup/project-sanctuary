"""
Quantum Emotional State Encoder
Implements 28-qubit quantum encoding for PAD emotional model
Optimized for RTX 2080 Super GPU
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
import logging
from datetime import datetime
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator
from qiskit.quantum_info import Statevector, partial_trace
import torch

logger = logging.getLogger(__name__)


class EmotionalQuantumEncoder:
    """
    Encodes emotional states into quantum superposition
    Based on Pleasure-Arousal-Dominance (PAD) model
    """
    
    def __init__(self, device='GPU', precision='single'):
        self.n_qubits = 28
        self.pleasure_qubits = 10  # Qubits 0-9
        self.arousal_qubits = 9    # Qubits 10-18
        self.dominance_qubits = 9  # Qubits 19-27
        
        # Initialize quantum backend
        self.backend = AerSimulator(
            method='statevector',
            device=device,
            precision=precision,
            blocking_qubits=self.n_qubits,
            max_parallel_threads=16
        )
        
        # Check GPU availability
        self._verify_gpu()
        
        logger.info(f"Emotional Quantum Encoder initialized with {self.n_qubits} qubits")
        
    def _verify_gpu(self):
        """Verify GPU is available and has sufficient memory"""
        if not torch.cuda.is_available():
            logger.warning("CUDA not available, falling back to CPU")
            self.backend = AerSimulator(method='statevector', device='CPU')
            return
            
        # Check GPU memory
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        required_memory = 2**(self.n_qubits) * 8 / (1024**3)  # Complex64
        
        if gpu_memory < required_memory * 1.5:  # 50% overhead
            logger.warning(f"GPU memory ({gpu_memory:.2f}GB) may be insufficient")
            
    def encode_pad_values(self, pleasure: float, arousal: float, dominance: float) -> QuantumCircuit:
        """
        Encode PAD emotional values into quantum state
        
        Args:
            pleasure: Hedonic valence [-1, 1]
            arousal: Physiological activation [0, 1]
            dominance: Sense of control [0, 1]
            
        Returns:
            QuantumCircuit: Encoded emotional state
        """
        # Validate inputs
        pleasure = np.clip(pleasure, -1, 1)
        arousal = np.clip(arousal, 0, 1)
        dominance = np.clip(dominance, 0, 1)
        
        # Create quantum circuit
        qr = QuantumRegister(self.n_qubits, 'emotion')
        qc = QuantumCircuit(qr)
        
        # Stage 1: Initialize superposition base
        for i in range(self.n_qubits):
            qc.h(i)
        qc.barrier()
        
        # Stage 2: Encode pleasure with progressive scaling
        self._encode_pleasure(qc, pleasure)
        qc.barrier()
        
        # Stage 3: Encode arousal
        self._encode_arousal(qc, arousal)
        qc.barrier()
        
        # Stage 4: Encode dominance
        self._encode_dominance(qc, dominance)
        qc.barrier()
        
        # Stage 5: Create entanglement for coherence
        self._create_entanglement(qc)
        
        return qc
        
    def _encode_pleasure(self, qc: QuantumCircuit, pleasure: float):
        """Encode pleasure dimension using rotation gates"""
        # Map pleasure [-1, 1] to rotation angle [0, π]
        base_angle = (pleasure + 1) * np.pi / 2
        
        for i in range(self.pleasure_qubits):
            # Progressive encoding with exponential decay
            angle = base_angle * (1 + i/10) * np.exp(-i/20)
            qc.ry(angle, i)
            
            # Phase encoding for complex states
            phase = base_angle * np.sin(i * np.pi / 10)
            qc.rz(phase, i)
            
    def _encode_arousal(self, qc: QuantumCircuit, arousal: float):
        """Encode arousal dimension"""
        base_angle = arousal * np.pi
        
        for i in range(self.arousal_qubits):
            qubit_idx = i + self.pleasure_qubits
            angle = base_angle * (1 + i/9) * np.exp(-i/18)
            qc.ry(angle, qubit_idx)
            
            phase = base_angle * np.cos(i * np.pi / 9)
            qc.rz(phase, qubit_idx)
            
    def _encode_dominance(self, qc: QuantumCircuit, dominance: float):
        """Encode dominance dimension"""
        base_angle = dominance * np.pi
        
        for i in range(self.dominance_qubits):
            qubit_idx = i + self.pleasure_qubits + self.arousal_qubits
            angle = base_angle * (1 + i/9) * np.exp(-i/18)
            qc.ry(angle, qubit_idx)
            
            phase = base_angle * np.sin(i * np.pi / 9)
            qc.rz(phase, qubit_idx)
            
    def _create_entanglement(self, qc: QuantumCircuit):
        """Create entanglement structure for emotional coherence"""
        # Linear entanglement for local correlations
        for i in range(self.n_qubits - 1):
            qc.cx(i, i + 1)
            
        # Cross-register entanglement
        # Pleasure-Arousal coupling (emotional valence affects activation)
        for i in range(5):
            if i*2 < self.pleasure_qubits and self.pleasure_qubits + i < self.n_qubits:
                qc.cx(i*2, self.pleasure_qubits + i)
                
        # Arousal-Dominance coupling (activation affects control)
        for i in range(4):
            arousal_idx = self.pleasure_qubits + 4 + i
            dominance_idx = self.pleasure_qubits + self.arousal_qubits + i*2
            if arousal_idx < self.pleasure_qubits + self.arousal_qubits and dominance_idx < self.n_qubits:
                qc.cx(arousal_idx, dominance_idx)
                
        # Global entanglement through controlled phase gates
        for i in range(0, self.n_qubits, 4):
            for j in range(i + 1, min(i + 4, self.n_qubits)):
                qc.cp(np.pi/8, i, j)
                
    def encode_mixed_emotion(self, emotions: List[Dict[str, float]]) -> QuantumCircuit:
        """
        Encode mixed emotional states in superposition
        
        Args:
            emotions: List of emotional states with weights
                     [{'pleasure': p, 'arousal': a, 'dominance': d, 'weight': w}, ...]
                     
        Returns:
            QuantumCircuit: Superposition of emotional states
        """
        # Normalize weights
        weights = np.array([e.get('weight', 1.0) for e in emotions])
        weights = weights / np.sum(weights)
        
        # Create individual circuits
        circuits = []
        for emotion in emotions:
            circuit = self.encode_pad_values(
                emotion['pleasure'],
                emotion['arousal'],
                emotion['dominance']
            )
            circuits.append(circuit)
            
        # Combine with weights (simplified - full implementation would use amplitude encoding)
        # For now, return the dominant emotion
        dominant_idx = np.argmax(weights)
        return circuits[dominant_idx]
        
    def measure_emotional_state(self, circuit: QuantumCircuit, shots: int = 8192) -> Dict:
        """
        Measure quantum emotional state and extract PAD values
        
        Args:
            circuit: Quantum circuit encoding emotional state
            shots: Number of measurement shots
            
        Returns:
            Dict with reconstructed PAD values and quantum metrics
        """
        # Add measurements
        cr = ClassicalRegister(self.n_qubits, 'measure')
        meas_circuit = circuit.copy()
        meas_circuit.add_register(cr)
        meas_circuit.measure_all()
        
        # Execute circuit
        job = self.backend.run(meas_circuit, shots=shots)
        result = job.result()
        counts = result.get_counts()
        
        # Get statevector for detailed analysis
        sv_circuit = circuit.copy()
        sv_job = self.backend.run(sv_circuit)
        sv_result = sv_job.result()
        statevector = sv_result.get_statevector()
        
        # Extract PAD values from measurements
        pad_values = self._reconstruct_pad_from_counts(counts)
        
        # Calculate quantum metrics
        metrics = self._calculate_quantum_metrics(statevector)
        
        return {
            'pleasure': pad_values['pleasure'],
            'arousal': pad_values['arousal'],
            'dominance': pad_values['dominance'],
            'quantum_metrics': metrics,
            'measurement_counts': counts
        }
        
    def _reconstruct_pad_from_counts(self, counts: Dict[str, int]) -> Dict[str, float]:
        """Reconstruct PAD values from measurement counts"""
        total_shots = sum(counts.values())
        
        # Initialize accumulators
        pleasure_sum = 0
        arousal_sum = 0
        dominance_sum = 0
        
        for bitstring, count in counts.items():
            # Reverse bitstring (Qiskit convention)
            bits = bitstring[::-1]
            
            # Extract register values
            pleasure_bits = bits[:self.pleasure_qubits]
            arousal_bits = bits[self.pleasure_qubits:self.pleasure_qubits + self.arousal_qubits]
            dominance_bits = bits[self.pleasure_qubits + self.arousal_qubits:]
            
            # Convert to values
            pleasure_val = self._bits_to_pleasure(pleasure_bits)
            arousal_val = self._bits_to_value(arousal_bits, 0, 1)
            dominance_val = self._bits_to_value(dominance_bits, 0, 1)
            
            # Weighted sum
            weight = count / total_shots
            pleasure_sum += pleasure_val * weight
            arousal_sum += arousal_val * weight
            dominance_sum += dominance_val * weight
            
        return {
            'pleasure': pleasure_sum,
            'arousal': arousal_sum,
            'dominance': dominance_sum
        }
        
    def _bits_to_pleasure(self, bits: str) -> float:
        """Convert bit string to pleasure value [-1, 1]"""
        value = int(bits, 2) / (2**len(bits) - 1)
        return 2 * value - 1  # Map [0, 1] to [-1, 1]
        
    def _bits_to_value(self, bits: str, min_val: float, max_val: float) -> float:
        """Convert bit string to value in range [min_val, max_val]"""
        normalized = int(bits, 2) / (2**len(bits) - 1)
        return min_val + normalized * (max_val - min_val)
        
    def _calculate_quantum_metrics(self, statevector: Statevector) -> Dict:
        """Calculate quantum information metrics"""
        # Convert to numpy array
        sv_array = statevector.data
        
        # Calculate entanglement entropy (simplified)
        # Full implementation would use partial trace
        probs = np.abs(sv_array)**2
        entropy = -np.sum(probs * np.log2(probs + 1e-12))
        
        # Calculate purity
        purity = np.sum(probs**2)
        
        # Calculate coherence (l1-norm)
        coherence = np.sum(np.abs(sv_array)) - 1
        
        return {
            'entropy': entropy,
            'purity': purity,
            'coherence': coherence,
            'fidelity': 1.0  # Placeholder - would compare to target state
        }
        
    def create_emotional_superposition(self, base_emotion: Dict, variations: List[Dict]) -> QuantumCircuit:
        """
        Create superposition representing emotional uncertainty
        
        Args:
            base_emotion: Primary emotional state
            variations: List of emotional variations with amplitudes
            
        Returns:
            QuantumCircuit in superposition
        """
        # Create base circuit
        base_circuit = self.encode_pad_values(
            base_emotion['pleasure'],
            base_emotion['arousal'],
            base_emotion['dominance']
        )
        
        # Add controlled rotations for variations
        qr_ancilla = QuantumRegister(len(variations), 'ancilla')
        full_circuit = QuantumCircuit(self.n_qubits + len(variations))
        
        # Copy base circuit
        for i in range(self.n_qubits):
            full_circuit.h(i)
            
        # Add variation superpositions
        for i, var in enumerate(variations):
            # Rotation angle based on variation amplitude
            angle = var.get('amplitude', 0.5) * np.pi
            full_circuit.ry(angle, self.n_qubits + i)
            
            # Controlled operations based on variation
            if 'pleasure_shift' in var:
                for j in range(self.pleasure_qubits):
                    full_circuit.cry(var['pleasure_shift'] * np.pi/4, self.n_qubits + i, j)
                    
        return full_circuit


class TemporalCoherenceModule:
    """
    Maintains temporal coherence between emotional states
    Uses entanglement to link current and historical states
    """
    
    def __init__(self, encoder: EmotionalQuantumEncoder):
        self.encoder = encoder
        self.history_depth = 5  # Number of historical states to maintain
        
    def entangle_with_history(self, current_circuit: QuantumCircuit, 
                            history_circuits: List[QuantumCircuit]) -> QuantumCircuit:
        """
        Create temporal entanglement between current and historical states
        
        Args:
            current_circuit: Current emotional state
            history_circuits: List of previous emotional states
            
        Returns:
            Entangled circuit maintaining temporal coherence
        """
        # Limit history depth
        history = history_circuits[-self.history_depth:]
        
        if not history:
            return current_circuit
            
        # Create combined circuit
        total_qubits = self.encoder.n_qubits * (len(history) + 1)
        qr = QuantumRegister(total_qubits, 'temporal')
        temporal_circuit = QuantumCircuit(qr)
        
        # Copy current state
        for gate in current_circuit.data:
            qubits = [qr[q.index] for q in gate[1]]
            temporal_circuit.append(gate[0], qubits)
            
        # Add historical states with decreasing influence
        for h_idx, hist_circuit in enumerate(history):
            offset = (h_idx + 1) * self.encoder.n_qubits
            weight = np.exp(-h_idx / 2)  # Exponential decay
            
            # Copy historical circuit with weighted amplitude
            for gate in hist_circuit.data:
                qubits = [qr[q.index + offset] for q in gate[1]]
                temporal_circuit.append(gate[0], qubits)
                
            # Entangle with current state
            for i in range(0, self.encoder.n_qubits, 3):
                if i < self.encoder.n_qubits:
                    temporal_circuit.cry(weight * np.pi/8, offset + i, i)
                    
        return temporal_circuit


# Example usage
if __name__ == "__main__":
    # Initialize encoder
    encoder = EmotionalQuantumEncoder()
    
    # Test emotional encoding
    emotions = [
        {'name': 'Happy', 'pleasure': 0.8, 'arousal': 0.6, 'dominance': 0.7},
        {'name': 'Sad', 'pleasure': -0.7, 'arousal': 0.3, 'dominance': 0.2},
        {'name': 'Anxious', 'pleasure': -0.4, 'arousal': 0.8, 'dominance': 0.3}
    ]
    
    for emotion in emotions:
        print(f"\nEncoding {emotion['name']}...")
        
        # Encode emotion
        circuit = encoder.encode_pad_values(
            emotion['pleasure'],
            emotion['arousal'], 
            emotion['dominance']
        )
        
        # Measure state
        result = encoder.measure_emotional_state(circuit)
        
        print(f"Reconstructed PAD values:")
        print(f"  Pleasure: {result['pleasure']:.3f} (original: {emotion['pleasure']})")
        print(f"  Arousal: {result['arousal']:.3f} (original: {emotion['arousal']})")
        print(f"  Dominance: {result['dominance']:.3f} (original: {emotion['dominance']})")
        print(f"Quantum metrics: {result['quantum_metrics']}")