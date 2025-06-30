"""
Quantum-Classical Interface Layer
Bridges quantum memory with classical AI systems
Handles noise, decoherence, and measurement
"""

import numpy as np
import torch
from typing import Dict, List, Tuple, Optional, Any, Union
from datetime import datetime
import logging
import json
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

# Import our quantum modules
from .quantum_memory import create_quantum_memory, QuantumMemoryBase
from .entanglement_encoder import QuantumEntanglementEncoder
from .tensor_network_memory import TensorNetworkMemory

logger = logging.getLogger(__name__)


@dataclass
class ClassicalState:
    """Classical representation of quantum state"""
    pad_values: np.ndarray
    confidence: float
    timestamp: datetime
    metadata: Dict[str, Any]
    measurement_fidelity: float = 1.0
    

@dataclass
class QuantumNoise:
    """Noise parameters for quantum operations"""
    depolarizing_rate: float = 0.01
    dephasing_rate: float = 0.02
    measurement_error: float = 0.005
    thermal_factor: float = 0.001
    

class QuantumClassicalInterface:
    """
    Main interface between quantum and classical systems
    Handles conversion, noise mitigation, and error correction
    """
    
    def __init__(self, 
                 n_qubits: int = 27,
                 device: str = "cuda:0",
                 noise_model: Optional[QuantumNoise] = None,
                 error_mitigation: bool = True):
        """
        Initialize quantum-classical interface
        
        Args:
            n_qubits: Number of qubits for quantum system
            device: Computation device
            noise_model: Noise parameters for realistic simulation
            error_mitigation: Enable error mitigation techniques
        """
        self.n_qubits = n_qubits
        self.device = device if torch.cuda.is_available() else "cpu"
        self.noise_model = noise_model or QuantumNoise()
        self.error_mitigation = error_mitigation
        
        # Initialize quantum components
        # Use simulation backend to avoid cuQuantum issues
        self.quantum_memory = create_quantum_memory(backend="simulation", n_qubits=n_qubits, device=device)
        self.encoder = QuantumEntanglementEncoder(n_qubits=n_qubits, device=device)
        self.tensor_memory = TensorNetworkMemory(device=device)
        
        # Measurement cache for error mitigation
        self.measurement_cache: List[Dict[str, Any]] = []
        self.cache_size = 100
        
        # Classical neural network for hybrid processing
        self._init_classical_network()
        
        logger.info(f"Initialized QuantumClassicalInterface with {n_qubits} qubits, "
                   f"error mitigation: {error_mitigation}")
        
    def _init_classical_network(self):
        """Initialize classical neural network for hybrid processing"""
        # Use a fixed input size to avoid dimension mismatches
        input_size = min(128, 2**self.n_qubits)  # Limit input features
        
        self.classical_processor = torch.nn.Sequential(
            torch.nn.Linear(input_size, 64),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.1),
            torch.nn.Linear(64, 32),
            torch.nn.ReLU(),
            torch.nn.Linear(32, 3)  # Output PAD values
        ).to(self.device)
        
    def encode_classical_to_quantum(self, classical_state: Union[np.ndarray, ClassicalState]) -> torch.Tensor:
        """
        Encode classical emotional state to quantum representation
        
        Args:
            classical_state: PAD values or ClassicalState object
            
        Returns:
            Quantum state tensor
        """
        if isinstance(classical_state, ClassicalState):
            pad_values = classical_state.pad_values
        else:
            pad_values = classical_state
            
        # Encode using entanglement encoder
        quantum_state = self.encoder.encode_emotional_state(pad_values)
        
        # Apply noise if model is specified
        if self.noise_model:
            quantum_state = self._apply_quantum_noise(quantum_state)
            
        # Store in quantum memory
        self.quantum_memory.encode_emotional_state(pad_values)
        
        # Also store in tensor network for associations
        self.tensor_memory.store_memory(
            emotional_state=pad_values,
            quantum_state=quantum_state,
            metadata={'source': 'classical_encoding', 'timestamp': datetime.now().isoformat()}
        )
        
        return quantum_state
        
    def decode_quantum_to_classical(self, quantum_state: torch.Tensor, 
                                  shots: int = 1024) -> ClassicalState:
        """
        Decode quantum state to classical representation
        
        Args:
            quantum_state: Quantum state tensor
            shots: Number of measurement shots for statistics
            
        Returns:
            Classical state with PAD values and metadata
        """
        # Perform measurements
        measurements = self._measure_quantum_state(quantum_state, shots)
        
        # Decode using encoder
        decoded = self.encoder.decode_emotional_state(quantum_state)
        
        # Apply error mitigation if enabled
        if self.error_mitigation:
            pad_values = self._mitigate_measurement_errors(decoded['pad_values'], measurements)
        else:
            pad_values = decoded['pad_values']
            
        # Calculate confidence based on measurement statistics
        confidence = self._calculate_confidence(measurements, decoded)
        
        # Create classical state
        classical_state = ClassicalState(
            pad_values=pad_values,
            confidence=confidence,
            timestamp=datetime.now(),
            metadata={
                'shots': shots,
                'entanglement': decoded['entanglement'],
                'coherence': decoded['coherence'],
                'purity': decoded['state_purity']
            },
            measurement_fidelity=self._estimate_fidelity(quantum_state, measurements)
        )
        
        # Cache measurement for error mitigation
        self._cache_measurement(classical_state, measurements)
        
        return classical_state
        
    def _apply_quantum_noise(self, state: torch.Tensor) -> torch.Tensor:
        """Apply realistic quantum noise to state"""
        # Depolarizing noise
        if self.noise_model.depolarizing_rate > 0:
            identity_prob = 1 - self.noise_model.depolarizing_rate
            state = identity_prob * state + \
                    self.noise_model.depolarizing_rate * torch.ones_like(state) / len(state)
                    
        # Dephasing noise (random phase)
        if self.noise_model.dephasing_rate > 0:
            phase_noise = torch.exp(1j * torch.randn_like(state.real) * 
                                  self.noise_model.dephasing_rate)
            state = state * phase_noise
            
        # Thermal noise
        if self.noise_model.thermal_factor > 0:
            thermal_noise = torch.randn_like(state) * self.noise_model.thermal_factor
            state = state + thermal_noise
            
        # Renormalize
        state = state / torch.norm(state)
        
        return state
        
    def _measure_quantum_state(self, state: torch.Tensor, shots: int) -> Dict[str, int]:
        """Perform quantum measurements with realistic noise"""
        probabilities = torch.abs(state)**2
        
        # Add measurement error
        if self.noise_model and self.noise_model.measurement_error > 0:
            error = torch.randn_like(probabilities) * self.noise_model.measurement_error
            probabilities = torch.clamp(probabilities + error, min=0)
            probabilities = probabilities / torch.sum(probabilities)
            
        # Sample measurements
        indices = torch.multinomial(probabilities, shots, replacement=True)
        
        # Count occurrences
        measurements = {}
        for idx in indices:
            bitstring = format(int(idx), f'0{self.n_qubits}b')
            measurements[bitstring] = measurements.get(bitstring, 0) + 1
            
        return measurements
        
    def _mitigate_measurement_errors(self, raw_pad: np.ndarray, 
                                   measurements: Dict[str, int]) -> np.ndarray:
        """Apply error mitigation techniques"""
        if not self.measurement_cache:
            return raw_pad
            
        # Use historical measurements for calibration
        historical_pad = np.mean([m.pad_values for m, _ in self.measurement_cache[-10:]], axis=0)
        
        # Weighted average with historical data
        weight = min(len(self.measurement_cache) / 20, 0.5)
        mitigated_pad = (1 - weight) * raw_pad + weight * historical_pad
        
        # Apply bounds
        mitigated_pad[0] = np.clip(mitigated_pad[0], -1, 1)  # Pleasure
        mitigated_pad[1] = np.clip(mitigated_pad[1], 0, 1)   # Arousal
        mitigated_pad[2] = np.clip(mitigated_pad[2], 0, 1)   # Dominance
        
        return mitigated_pad
        
    def _calculate_confidence(self, measurements: Dict[str, int], 
                            decoded: Dict[str, Any]) -> float:
        """Calculate confidence score for measurement"""
        # Base confidence on measurement statistics
        total_shots = sum(measurements.values())
        max_count = max(measurements.values())
        measurement_confidence = max_count / total_shots
        
        # Factor in quantum metrics
        purity_confidence = decoded['state_purity']
        entanglement_penalty = 1 - decoded['entanglement']['entanglement_measure'] * 0.5
        
        # Combined confidence
        confidence = measurement_confidence * purity_confidence * entanglement_penalty
        
        return float(np.clip(confidence, 0, 1))
        
    def _estimate_fidelity(self, quantum_state: torch.Tensor, 
                         measurements: Dict[str, int]) -> float:
        """Estimate measurement fidelity"""
        # Reconstruct state from measurements
        reconstructed = torch.zeros_like(quantum_state)
        total_shots = sum(measurements.values())
        
        for bitstring, count in measurements.items():
            idx = int(bitstring, 2)
            amplitude = np.sqrt(count / total_shots)
            reconstructed[idx] = amplitude
            
        # Calculate fidelity
        fidelity = torch.abs(torch.vdot(quantum_state, reconstructed))**2
        
        return float(fidelity.item())
        
    def _cache_measurement(self, state: ClassicalState, measurements: Dict[str, int]):
        """Cache measurement for error mitigation"""
        self.measurement_cache.append((state, measurements))
        
        # Maintain cache size
        if len(self.measurement_cache) > self.cache_size:
            self.measurement_cache.pop(0)
            
    def hybrid_process(self, classical_input: np.ndarray, 
                      quantum_weight: float = 0.5) -> np.ndarray:
        """
        Hybrid quantum-classical processing
        
        Args:
            classical_input: Input PAD values
            quantum_weight: Weight for quantum contribution [0, 1]
            
        Returns:
            Processed PAD values
        """
        # Quantum processing
        quantum_state = self.encode_classical_to_quantum(classical_input)
        quantum_output = self.decode_quantum_to_classical(quantum_state)
        
        # Classical processing
        # Extract features from quantum state for classical network
        input_size = min(128, 2**self.n_qubits)
        features_size = input_size // 2
        
        # Convert quantum state features to real values for classical network
        real_part = quantum_state.real[:features_size].to(torch.float32)
        imag_part = quantum_state.imag[:features_size].to(torch.float32)
        
        quantum_features = torch.cat([real_part, imag_part])
        
        classical_output = self.classical_processor(quantum_features).detach().cpu().numpy()
        
        # Combine results
        hybrid_output = (quantum_weight * quantum_output.pad_values + 
                        (1 - quantum_weight) * classical_output)
        
        # Normalize
        hybrid_output[0] = np.clip(hybrid_output[0], -1, 1)
        hybrid_output[1:] = np.clip(hybrid_output[1:], 0, 1)
        
        return hybrid_output
        
    def create_emotional_trajectory(self, start_emotion: np.ndarray,
                                  end_emotion: np.ndarray,
                                  steps: int = 10) -> List[ClassicalState]:
        """
        Create smooth emotional trajectory using quantum interpolation
        
        Args:
            start_emotion: Starting PAD values
            end_emotion: Target PAD values
            steps: Number of interpolation steps
            
        Returns:
            List of classical states representing trajectory
        """
        trajectory = []
        
        # Encode endpoints
        start_quantum = self.encode_classical_to_quantum(start_emotion)
        end_quantum = self.encode_classical_to_quantum(end_emotion)
        
        for i in range(steps):
            # Quantum interpolation weight
            t = i / (steps - 1)
            
            # Create superposition with varying weights
            interpolated = np.sqrt(1 - t) * start_quantum + np.sqrt(t) * end_quantum
            interpolated = interpolated / torch.norm(interpolated)
            
            # Decode to classical
            classical = self.decode_quantum_to_classical(interpolated)
            trajectory.append(classical)
            
        return trajectory
        
    def measure_emotional_distance(self, emotion1: np.ndarray, 
                                 emotion2: np.ndarray) -> Dict[str, float]:
        """
        Measure distance between emotions in quantum space
        
        Args:
            emotion1: First PAD values
            emotion2: Second PAD values
            
        Returns:
            Dictionary with various distance metrics
        """
        # Encode to quantum
        q1 = self.encode_classical_to_quantum(emotion1)
        q2 = self.encode_classical_to_quantum(emotion2)
        
        # Quantum fidelity
        fidelity = self.encoder.measure_similarity(q1, q2)
        
        # Classical Euclidean distance
        euclidean = float(np.linalg.norm(emotion1 - emotion2))
        
        # Trace distance (quantum)
        trace_distance = float(torch.norm(q1 - q2, p=1).item() / 2)
        
        return {
            'quantum_fidelity': fidelity,
            'quantum_distance': 1 - fidelity,
            'trace_distance': trace_distance,
            'euclidean_distance': euclidean,
            'bures_distance': float(np.sqrt(2 * (1 - np.sqrt(fidelity))))
        }
        
    def get_interface_status(self) -> Dict[str, Any]:
        """Get current status of the interface"""
        return {
            'device': str(self.device),
            'n_qubits': self.n_qubits,
            'error_mitigation': self.error_mitigation,
            'noise_model': asdict(self.noise_model),
            'measurement_cache_size': len(self.measurement_cache),
            'tensor_memory_stats': self.tensor_memory.get_memory_statistics(),
            'quantum_memory_info': self.quantum_memory.get_state_info()
        }
        
    def save_state(self, filepath: str):
        """Save interface state to disk"""
        state_data = {
            'interface_config': {
                'n_qubits': self.n_qubits,
                'device': str(self.device),
                'error_mitigation': self.error_mitigation,
                'noise_model': asdict(self.noise_model)
            },
            'measurement_cache': [
                {
                    'state': {
                        'pad_values': state.pad_values.tolist(),
                        'confidence': state.confidence,
                        'timestamp': state.timestamp.isoformat(),
                        'metadata': state.metadata,
                        'measurement_fidelity': state.measurement_fidelity
                    },
                    'measurements': measurements
                }
                for state, measurements in self.measurement_cache
            ],
            'classical_network_state': self.classical_processor.state_dict()
        }
        
        with open(filepath, 'w') as f:
            json.dump(state_data, f, indent=2)
            
        # Save quantum states separately
        quantum_path = filepath.replace('.json', '_quantum.npz')
        if hasattr(self.quantum_memory, 'save_checkpoint'):
            self.quantum_memory.save_checkpoint(quantum_path)
            
        logger.info(f"Saved interface state to {filepath}")
        
    def load_state(self, filepath: str):
        """Load interface state from disk"""
        with open(filepath, 'r') as f:
            state_data = json.load(f)
            
        # Restore configuration
        self.n_qubits = state_data['interface_config']['n_qubits']
        self.error_mitigation = state_data['interface_config']['error_mitigation']
        self.noise_model = QuantumNoise(**state_data['interface_config']['noise_model'])
        
        # Restore measurement cache
        self.measurement_cache = []
        for item in state_data['measurement_cache']:
            state = ClassicalState(
                pad_values=np.array(item['state']['pad_values']),
                confidence=item['state']['confidence'],
                timestamp=datetime.fromisoformat(item['state']['timestamp']),
                metadata=item['state']['metadata'],
                measurement_fidelity=item['state']['measurement_fidelity']
            )
            self.measurement_cache.append((state, item['measurements']))
            
        # Restore classical network
        # Re-initialize network to ensure correct architecture
        self._init_classical_network()
        # Only load state dict if it exists and matches
        if 'classical_network_state' in state_data:
            try:
                self.classical_processor.load_state_dict(state_data['classical_network_state'])
            except RuntimeError as e:
                logger.warning(f"Could not load classical network state: {e}")
        
        # Load quantum states
        quantum_path = filepath.replace('.json', '_quantum.npz')
        if hasattr(self.quantum_memory, 'load_checkpoint'):
            try:
                self.quantum_memory.load_checkpoint(quantum_path)
            except FileNotFoundError:
                logger.warning(f"Quantum checkpoint not found at {quantum_path}")
                
        logger.info(f"Loaded interface state from {filepath}")


class EmotionalStateValidator:
    """Validates and normalizes emotional states"""
    
    @staticmethod
    def validate_pad_values(pad_values: np.ndarray) -> Tuple[bool, str]:
        """
        Validate PAD values
        
        Returns:
            (is_valid, error_message)
        """
        if len(pad_values) != 3:
            return False, "PAD values must have exactly 3 dimensions"
            
        if pad_values[0] < -1 or pad_values[0] > 1:
            return False, f"Pleasure must be in [-1, 1], got {pad_values[0]}"
            
        if pad_values[1] < 0 or pad_values[1] > 1:
            return False, f"Arousal must be in [0, 1], got {pad_values[1]}"
            
        if pad_values[2] < 0 or pad_values[2] > 1:
            return False, f"Dominance must be in [0, 1], got {pad_values[2]}"
            
        return True, ""
        
    @staticmethod
    def normalize_pad_values(pad_values: np.ndarray) -> np.ndarray:
        """Normalize PAD values to valid ranges"""
        normalized = pad_values.copy()
        normalized[0] = np.clip(normalized[0], -1, 1)
        normalized[1] = np.clip(normalized[1], 0, 1)
        normalized[2] = np.clip(normalized[2], 0, 1)
        return normalized


# Example usage
if __name__ == "__main__":
    # Initialize interface
    interface = QuantumClassicalInterface(
        n_qubits=27,
        noise_model=QuantumNoise(depolarizing_rate=0.01),
        error_mitigation=True
    )
    
    # Test encoding/decoding
    print("Testing quantum-classical conversion...")
    test_emotion = np.array([0.7, 0.5, 0.6])  # Happy
    
    # Encode to quantum
    quantum_state = interface.encode_classical_to_quantum(test_emotion)
    print(f"Encoded emotion {test_emotion} to quantum state")
    
    # Decode back to classical
    classical_state = interface.decode_quantum_to_classical(quantum_state)
    print(f"Decoded back to: {classical_state.pad_values}")
    print(f"Confidence: {classical_state.confidence:.3f}")
    print(f"Measurement fidelity: {classical_state.measurement_fidelity:.3f}")
    
    # Test hybrid processing
    print("\nTesting hybrid processing...")
    hybrid_result = interface.hybrid_process(test_emotion, quantum_weight=0.7)
    print(f"Hybrid result: {hybrid_result}")
    
    # Test emotional trajectory
    print("\nCreating emotional trajectory...")
    start = np.array([0.8, 0.3, 0.7])  # Happy/calm
    end = np.array([-0.5, 0.8, 0.3])   # Anxious
    
    trajectory = interface.create_emotional_trajectory(start, end, steps=5)
    for i, state in enumerate(trajectory):
        print(f"Step {i}: {state.pad_values} (confidence: {state.confidence:.3f})")
        
    # Test distance measurement
    print("\nMeasuring emotional distance...")
    distances = interface.measure_emotional_distance(start, end)
    for metric, value in distances.items():
        print(f"{metric}: {value:.3f}")
        
    # Get interface status
    print("\nInterface status:")
    status = interface.get_interface_status()
    print(f"Device: {status['device']}")
    print(f"Qubits: {status['n_qubits']}")
    print(f"Memory stats: {status['tensor_memory_stats']}")