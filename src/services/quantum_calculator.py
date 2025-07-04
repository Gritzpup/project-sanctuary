#!/usr/bin/env python3
"""
Quantum state calculator using Qiskit for real quantum simulations.
Provides actual quantum state data for the tensor network visualization.
"""

import numpy as np
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit import execute, Aer
from qiskit.quantum_info import Statevector, DensityMatrix, entanglement_of_formation, partial_trace
from qiskit.circuit.library import RYGate, RZGate, CXGate
from typing import Dict, List, Tuple, Complex
import json
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class QuantumTensorNetwork:
    """
    Implements a real quantum tensor network with 6 qubits.
    Creates entangled states and calculates quantum properties.
    """
    
    def __init__(self, num_qubits: int = 6):
        self.num_qubits = num_qubits
        self.qr = QuantumRegister(num_qubits, 'q')
        self.cr = ClassicalRegister(num_qubits, 'c')
        self.circuit = QuantumCircuit(self.qr, self.cr)
        self.backend = Aer.get_backend('statevector_simulator')
        
        # Initialize quantum state
        self._initialize_tensor_network()
    
    def _initialize_tensor_network(self):
        """Create a tensor network with controlled entanglement patterns."""
        # Create superposition states
        for i in range(self.num_qubits):
            # Hadamard for superposition
            self.circuit.h(self.qr[i])
            # Add phase rotation for variety
            self.circuit.rz(np.pi / (i + 2), self.qr[i])
        
        # Create entanglement bonds (matching the WebGL visualization)
        entanglement_pairs = [
            (0, 1), (1, 2),  # Top row
            (3, 4), (4, 5),  # Bottom row
            (0, 3), (1, 4), (2, 5),  # Vertical bonds
            (0, 4), (1, 5)   # Diagonal bonds
        ]
        
        for q1, q2 in entanglement_pairs:
            # Create entanglement with controlled phase
            self.circuit.cx(self.qr[q1], self.qr[q2])
            # Add phase gate for quantum interference
            self.circuit.cz(self.qr[q1], self.qr[q2])
    
    def apply_time_evolution(self, time_step: float):
        """Apply time evolution operator to simulate quantum dynamics."""
        # Hamiltonian evolution: H = Σ σ_z + Σ σ_x σ_x (nearest neighbors)
        for i in range(self.num_qubits):
            # Single qubit evolution
            self.circuit.rz(time_step * 0.5, self.qr[i])
            self.circuit.rx(time_step * 0.3, self.qr[i])
        
        # Two-qubit interactions
        for i in range(self.num_qubits - 1):
            if i % 3 != 2:  # Skip row boundaries
                self.circuit.rxx(time_step * 0.1, self.qr[i], self.qr[i + 1])
    
    def get_quantum_state(self) -> Dict:
        """Calculate and return the full quantum state information."""
        # Execute the circuit
        job = execute(self.circuit, self.backend)
        result = job.result()
        statevector = result.get_statevector()
        
        # Calculate quantum properties
        state_dict = {
            'statevector': self._serialize_statevector(statevector),
            'density_matrix': self._calculate_density_matrix(statevector),
            'entanglement_measures': self._calculate_entanglement(statevector),
            'coherence': self._calculate_coherence(statevector),
            'phase': self._calculate_global_phase(statevector),
            'measurement_probabilities': self._calculate_probabilities(statevector),
            'bloch_vectors': self._calculate_bloch_vectors(statevector),
            'von_neumann_entropy': self._calculate_entropy(statevector),
            'timestamp': time.time()
        }
        
        return state_dict
    
    def _serialize_statevector(self, statevector: Statevector) -> Dict:
        """Convert statevector to serializable format."""
        sv_data = statevector.data
        # Take first few amplitudes for visualization
        amplitudes = []
        for i in range(min(8, len(sv_data))):
            amp = sv_data[i]
            amplitudes.append({
                'real': float(np.real(amp)),
                'imag': float(np.imag(amp)),
                'magnitude': float(np.abs(amp)),
                'phase': float(np.angle(amp))
            })
        
        return {
            'dimension': len(sv_data),
            'amplitudes': amplitudes,
            'norm': float(np.linalg.norm(sv_data))
        }
    
    def _calculate_density_matrix(self, statevector: Statevector) -> Dict:
        """Calculate reduced density matrices for visualization."""
        dm = DensityMatrix(statevector)
        
        # Calculate single-qubit reduced density matrices
        single_qubit_dms = []
        for i in range(self.num_qubits):
            # Trace out all qubits except i
            qubits_to_trace = list(range(self.num_qubits))
            qubits_to_trace.remove(i)
            rdm = partial_trace(dm, qubits_to_trace)
            
            single_qubit_dms.append({
                'qubit': i,
                'matrix': rdm.data.tolist(),
                'purity': float(np.real(np.trace(rdm.data @ rdm.data)))
            })
        
        return {
            'single_qubit': single_qubit_dms,
            'total_purity': float(np.real(np.trace(dm.data @ dm.data)))
        }
    
    def _calculate_entanglement(self, statevector: Statevector) -> Dict:
        """Calculate entanglement measures between qubit pairs."""
        dm = DensityMatrix(statevector)
        entanglement_data = []
        
        # Calculate entanglement for specific pairs
        pairs = [(0, 1), (1, 2), (0, 3), (1, 4), (2, 5)]
        
        for q1, q2 in pairs:
            # Get two-qubit reduced density matrix
            qubits_to_keep = [q1, q2]
            qubits_to_trace = [q for q in range(self.num_qubits) if q not in qubits_to_keep]
            
            rdm_2q = partial_trace(dm, qubits_to_trace)
            
            # Calculate concurrence (related to entanglement of formation)
            # For mixed states, this is an approximation
            eigenvalues = np.linalg.eigvalsh(rdm_2q.data)
            entropy = -np.sum(eigenvalues * np.log2(eigenvalues + 1e-12))
            
            entanglement_data.append({
                'qubits': [q1, q2],
                'entropy': float(entropy),
                'strength': float(min(1.0, entropy / 2.0))  # Normalized
            })
        
        # Calculate average entanglement
        avg_entanglement = np.mean([e['strength'] for e in entanglement_data])
        
        return {
            'pairs': entanglement_data,
            'average': float(avg_entanglement),
            'network_entanglement': float(avg_entanglement * 0.87)  # Scaling factor
        }
    
    def _calculate_coherence(self, statevector: Statevector) -> float:
        """Calculate quantum coherence measure."""
        dm = DensityMatrix(statevector).data
        # l1-norm of coherence
        off_diagonal_sum = 0
        n = dm.shape[0]
        for i in range(n):
            for j in range(n):
                if i != j:
                    off_diagonal_sum += np.abs(dm[i, j])
        
        # Normalize
        max_coherence = n - 1
        coherence = off_diagonal_sum / max_coherence
        return float(min(1.0, coherence))
    
    def _calculate_global_phase(self, statevector: Statevector) -> float:
        """Calculate global phase of the quantum state."""
        # Find the first non-zero amplitude
        sv_data = statevector.data
        for amp in sv_data:
            if np.abs(amp) > 1e-10:
                return float(np.angle(amp))
        return 0.0
    
    def _calculate_probabilities(self, statevector: Statevector) -> List[float]:
        """Calculate measurement probabilities for computational basis."""
        probs = statevector.probabilities()
        # Return probabilities for first few basis states
        return [float(p) for p in probs[:8]]
    
    def _calculate_bloch_vectors(self, statevector: Statevector) -> List[Dict]:
        """Calculate Bloch sphere coordinates for each qubit."""
        dm = DensityMatrix(statevector)
        bloch_vectors = []
        
        # Pauli matrices
        sigma_x = np.array([[0, 1], [1, 0]], dtype=complex)
        sigma_y = np.array([[0, -1j], [1j, 0]], dtype=complex)
        sigma_z = np.array([[1, 0], [0, -1]], dtype=complex)
        
        for i in range(self.num_qubits):
            # Get single-qubit reduced density matrix
            qubits_to_trace = list(range(self.num_qubits))
            qubits_to_trace.remove(i)
            rdm = partial_trace(dm, qubits_to_trace).data
            
            # Calculate Bloch vector components
            rx = float(np.real(np.trace(rdm @ sigma_x)))
            ry = float(np.real(np.trace(rdm @ sigma_y)))
            rz = float(np.real(np.trace(rdm @ sigma_z)))
            
            # Calculate spherical coordinates
            r = np.sqrt(rx**2 + ry**2 + rz**2)
            theta = np.arctan2(np.sqrt(rx**2 + ry**2), rz) if r > 0 else 0
            phi = np.arctan2(ry, rx)
            
            bloch_vectors.append({
                'qubit': i,
                'cartesian': {'x': rx, 'y': ry, 'z': rz},
                'spherical': {
                    'r': float(r),
                    'theta': float(theta),
                    'phi': float(phi)
                }
            })
        
        return bloch_vectors
    
    def _calculate_entropy(self, statevector: Statevector) -> float:
        """Calculate von Neumann entropy of the quantum state."""
        dm = DensityMatrix(statevector).data
        eigenvalues = np.linalg.eigvalsh(dm)
        # Remove numerical noise
        eigenvalues = eigenvalues[eigenvalues > 1e-12]
        entropy = -np.sum(eigenvalues * np.log2(eigenvalues))
        return float(entropy)


class QuantumStateGenerator:
    """
    Generates time-evolving quantum states for the visualization.
    """
    
    def __init__(self):
        self.network = QuantumTensorNetwork()
        self.time = 0.0
        self.time_step = 0.01
    
    def get_current_state(self) -> Dict:
        """Get the current quantum state with all properties."""
        # Create new circuit for this time step
        self.network = QuantumTensorNetwork()
        
        # Apply time evolution
        self.network.apply_time_evolution(self.time)
        
        # Get quantum state
        state = self.network.get_quantum_state()
        
        # Add additional visualization data
        state['time'] = self.time
        state['psi_magnitude'] = 16028.23  # Scale factor for visualization
        state['psi_phase'] = 3299.39
        
        # Update time
        self.time += self.time_step
        
        return state
    
    def reset(self):
        """Reset the quantum system to initial state."""
        self.time = 0.0
        self.network = QuantumTensorNetwork()


# Testing and validation
if __name__ == "__main__":
    generator = QuantumStateGenerator()
    
    # Generate a few states
    for i in range(5):
        state = generator.get_current_state()
        print(f"\nTime step {i}:")
        print(f"Coherence: {state['coherence']:.3f}")
        print(f"Average entanglement: {state['entanglement_measures']['average']:.3f}")
        print(f"Phase: {state['phase']:.3f}")
        print(f"First qubit Bloch vector: {state['bloch_vectors'][0]['cartesian']}")
        
        # Save sample state for reference
        if i == 0:
            with open('/tmp/quantum_state_sample.json', 'w') as f:
                # Convert to serializable format
                json.dump({
                    'coherence': state['coherence'],
                    'phase': state['phase'],
                    'entanglement': state['entanglement_measures']['average'],
                    'time': state['time']
                }, f, indent=2)