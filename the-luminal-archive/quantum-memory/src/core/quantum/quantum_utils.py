"""
Quantum Utilities for State Analysis and Circuit Management
Includes tomography, visualization, circuit generation, and optimization
"""

import numpy as np
import torch
from typing import Dict, List, Tuple, Optional, Any, Union
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.patches import Circle
from mpl_toolkits.mplot3d import Axes3D
import logging
from dataclasses import dataclass
from collections import defaultdict
import itertools

logger = logging.getLogger(__name__)


class QuantumStateTomography:
    """Perform quantum state tomography for debugging and analysis"""
    
    def __init__(self, n_qubits: int):
        """
        Initialize state tomography
        
        Args:
            n_qubits: Number of qubits
        """
        self.n_qubits = n_qubits
        self._pauli_basis = self._generate_pauli_basis()
        
    def _generate_pauli_basis(self) -> Dict[str, np.ndarray]:
        """Generate Pauli basis for measurements"""
        # Single qubit Pauli matrices
        I = np.array([[1, 0], [0, 1]], dtype=complex)
        X = np.array([[0, 1], [1, 0]], dtype=complex)
        Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
        Z = np.array([[1, 0], [0, -1]], dtype=complex)
        
        paulis = {'I': I, 'X': X, 'Y': Y, 'Z': Z}
        
        # Generate all Pauli strings for n qubits
        pauli_strings = {}
        for ops in itertools.product(['I', 'X', 'Y', 'Z'], repeat=self.n_qubits):
            name = ''.join(ops)
            matrix = paulis[ops[0]]
            for op in ops[1:]:
                matrix = np.kron(matrix, paulis[op])
            pauli_strings[name] = matrix
            
        return pauli_strings
        
    def perform_tomography(self, state: Union[np.ndarray, torch.Tensor], 
                          shots: int = 10000) -> Dict[str, Any]:
        """
        Perform full state tomography
        
        Args:
            state: Quantum state vector
            shots: Number of measurement shots per basis
            
        Returns:
            Tomography results including density matrix
        """
        if isinstance(state, torch.Tensor):
            state = state.cpu().numpy()
            
        # Calculate theoretical density matrix
        rho_theory = np.outer(state, state.conj())
        
        # Measure in all Pauli bases
        measurements = {}
        for basis_name, basis_matrix in self._pauli_basis.items():
            expectation = np.real(np.trace(rho_theory @ basis_matrix))
            
            # Simulate measurements with statistical noise
            measured = np.random.normal(expectation, 1/np.sqrt(shots), 1)[0]
            measured = np.clip(measured, -1, 1)
            measurements[basis_name] = measured
            
        # Reconstruct density matrix (simplified MLE)
        rho_reconstructed = self._reconstruct_density_matrix(measurements)
        
        # Calculate fidelity
        fidelity = self._calculate_fidelity(rho_theory, rho_reconstructed)
        
        # Purity
        purity_theory = np.real(np.trace(rho_theory @ rho_theory))
        purity_reconstructed = np.real(np.trace(rho_reconstructed @ rho_reconstructed))
        
        return {
            'density_matrix_theory': rho_theory,
            'density_matrix_reconstructed': rho_reconstructed,
            'measurements': measurements,
            'fidelity': fidelity,
            'purity_theory': purity_theory,
            'purity_reconstructed': purity_reconstructed,
            'trace_distance': self._trace_distance(rho_theory, rho_reconstructed)
        }
        
    def _reconstruct_density_matrix(self, measurements: Dict[str, float]) -> np.ndarray:
        """Reconstruct density matrix from Pauli measurements"""
        dim = 2**self.n_qubits
        rho = np.zeros((dim, dim), dtype=complex)
        
        # Simple linear inversion (for small systems)
        for basis_name, expectation in measurements.items():
            rho += expectation * self._pauli_basis[basis_name] / dim
            
        # Ensure physicality
        rho = (rho + rho.conj().T) / 2  # Hermitian
        
        # Project to positive semidefinite
        eigenvals, eigenvecs = np.linalg.eigh(rho)
        eigenvals = np.maximum(eigenvals, 0)
        rho = eigenvecs @ np.diag(eigenvals) @ eigenvecs.conj().T
        
        # Normalize trace
        rho = rho / np.trace(rho)
        
        return rho
        
    def _calculate_fidelity(self, rho1: np.ndarray, rho2: np.ndarray) -> float:
        """Calculate fidelity between two density matrices"""
        # F = Tr(sqrt(sqrt(rho1) * rho2 * sqrt(rho1)))^2
        sqrt_rho1 = self._matrix_sqrt(rho1)
        prod = sqrt_rho1 @ rho2 @ sqrt_rho1
        sqrt_prod = self._matrix_sqrt(prod)
        fidelity = np.real(np.trace(sqrt_prod))**2
        return float(np.clip(fidelity, 0, 1))
        
    def _matrix_sqrt(self, matrix: np.ndarray) -> np.ndarray:
        """Calculate matrix square root"""
        eigenvals, eigenvecs = np.linalg.eigh(matrix)
        sqrt_eigenvals = np.sqrt(np.maximum(eigenvals, 0))
        return eigenvecs @ np.diag(sqrt_eigenvals) @ eigenvecs.conj().T
        
    def _trace_distance(self, rho1: np.ndarray, rho2: np.ndarray) -> float:
        """Calculate trace distance between density matrices"""
        diff = rho1 - rho2
        eigenvals = np.linalg.eigvalsh(diff)
        return 0.5 * np.sum(np.abs(eigenvals))


class QuantumStateVisualizer:
    """Visualize quantum states in various representations"""
    
    def __init__(self):
        """Initialize visualizer"""
        self.colors = plt.cm.viridis
        
    def plot_state_vector(self, state: Union[np.ndarray, torch.Tensor], 
                         title: str = "Quantum State Vector") -> plt.Figure:
        """Plot amplitude and phase of state vector"""
        if isinstance(state, torch.Tensor):
            state = state.cpu().numpy()
            
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))
        
        # Amplitudes
        amplitudes = np.abs(state)
        x = np.arange(len(state))
        ax1.bar(x, amplitudes, color='blue', alpha=0.7)
        ax1.set_xlabel('Basis State')
        ax1.set_ylabel('Amplitude')
        ax1.set_title('Amplitude Distribution')
        ax1.set_ylim(0, max(amplitudes) * 1.1)
        
        # Phases
        phases = np.angle(state)
        ax2.scatter(x, phases, c=amplitudes, cmap='viridis', s=50)
        ax2.set_xlabel('Basis State')
        ax2.set_ylabel('Phase (radians)')
        ax2.set_title('Phase Distribution')
        ax2.set_ylim(-np.pi, np.pi)
        
        fig.suptitle(title)
        plt.tight_layout()
        return fig
        
    def plot_density_matrix(self, rho: np.ndarray, title: str = "Density Matrix") -> plt.Figure:
        """Plot density matrix as heatmap"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
        
        # Real part
        im1 = ax1.imshow(np.real(rho), cmap='RdBu', aspect='auto', 
                         vmin=-1, vmax=1, interpolation='nearest')
        ax1.set_title('Real Part')
        ax1.set_xlabel('Column')
        ax1.set_ylabel('Row')
        plt.colorbar(im1, ax=ax1)
        
        # Imaginary part
        im2 = ax2.imshow(np.imag(rho), cmap='RdBu', aspect='auto',
                         vmin=-1, vmax=1, interpolation='nearest')
        ax2.set_title('Imaginary Part')
        ax2.set_xlabel('Column')
        ax2.set_ylabel('Row')
        plt.colorbar(im2, ax=ax2)
        
        fig.suptitle(title)
        plt.tight_layout()
        return fig
        
    def plot_bloch_sphere(self, state: Union[np.ndarray, torch.Tensor], 
                         qubit_idx: int = 0) -> plt.Figure:
        """Plot single qubit on Bloch sphere"""
        if isinstance(state, torch.Tensor):
            state = state.cpu().numpy()
            
        # Extract single qubit reduced density matrix
        n_qubits = int(np.log2(len(state)))
        rho = np.outer(state, state.conj())
        
        # Trace out other qubits
        for i in range(n_qubits):
            if i != qubit_idx:
                rho = self._partial_trace(rho, i, n_qubits)
                n_qubits -= 1
                if qubit_idx > i:
                    qubit_idx -= 1
                    
        # Calculate Bloch vector
        X = np.real(np.trace(rho @ np.array([[0, 1], [1, 0]])))
        Y = np.real(np.trace(rho @ np.array([[0, -1j], [1j, 0]])))
        Z = np.real(np.trace(rho @ np.array([[1, 0], [0, -1]])))
        
        # Plot
        fig = plt.figure(figsize=(8, 8))
        ax = fig.add_subplot(111, projection='3d')
        
        # Draw sphere
        u = np.linspace(0, 2 * np.pi, 50)
        v = np.linspace(0, np.pi, 50)
        x = np.outer(np.cos(u), np.sin(v))
        y = np.outer(np.sin(u), np.sin(v))
        z = np.outer(np.ones(np.size(u)), np.cos(v))
        ax.plot_surface(x, y, z, alpha=0.1, color='gray')
        
        # Draw axes
        ax.plot([-1, 1], [0, 0], [0, 0], 'k-', alpha=0.3)
        ax.plot([0, 0], [-1, 1], [0, 0], 'k-', alpha=0.3)
        ax.plot([0, 0], [0, 0], [-1, 1], 'k-', alpha=0.3)
        
        # Draw Bloch vector
        ax.quiver(0, 0, 0, X, Y, Z, color='red', arrow_length_ratio=0.1, linewidth=3)
        
        # Labels
        ax.text(1.1, 0, 0, '|+⟩', fontsize=12)
        ax.text(-1.1, 0, 0, '|-⟩', fontsize=12)
        ax.text(0, 1.1, 0, '|+i⟩', fontsize=12)
        ax.text(0, -1.1, 0, '|-i⟩', fontsize=12)
        ax.text(0, 0, 1.1, '|0⟩', fontsize=12)
        ax.text(0, 0, -1.1, '|1⟩', fontsize=12)
        
        ax.set_xlabel('X')
        ax.set_ylabel('Y')
        ax.set_zlabel('Z')
        ax.set_title(f'Bloch Sphere - Qubit {qubit_idx}')
        
        return fig
        
    def _partial_trace(self, rho: np.ndarray, qubit_idx: int, n_qubits: int) -> np.ndarray:
        """Trace out a qubit from density matrix"""
        # Reshape to tensor form
        shape = [2] * (2 * n_qubits)
        rho_tensor = rho.reshape(shape)
        
        # Trace out the qubit
        axes = [qubit_idx, qubit_idx + n_qubits]
        rho_reduced = np.trace(rho_tensor, axis1=axes[0], axis2=axes[1])
        
        # Reshape back to matrix
        new_dim = 2**(n_qubits - 1)
        return rho_reduced.reshape(new_dim, new_dim)
        
    def animate_evolution(self, states: List[np.ndarray], 
                         interval: int = 50) -> animation.FuncAnimation:
        """Animate quantum state evolution"""
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Initial plot
        amplitudes = np.abs(states[0])
        bars = ax.bar(range(len(states[0])), amplitudes, color='blue', alpha=0.7)
        ax.set_ylim(0, 1.1)
        ax.set_xlabel('Basis State')
        ax.set_ylabel('Amplitude')
        ax.set_title('Quantum State Evolution')
        
        def update(frame):
            amplitudes = np.abs(states[frame])
            for bar, amp in zip(bars, amplitudes):
                bar.set_height(amp)
            ax.set_title(f'Quantum State Evolution - Step {frame}')
            return bars
            
        anim = animation.FuncAnimation(fig, update, frames=len(states),
                                     interval=interval, blit=True)
        return anim


@dataclass
class QuantumGate:
    """Quantum gate representation"""
    name: str
    qubits: List[int]
    matrix: np.ndarray
    params: Optional[Dict[str, float]] = None
    

class QuantumCircuitGenerator:
    """Generate quantum circuits for various operations"""
    
    def __init__(self, n_qubits: int):
        """
        Initialize circuit generator
        
        Args:
            n_qubits: Number of qubits
        """
        self.n_qubits = n_qubits
        self.gates = self._init_gate_set()
        
    def _init_gate_set(self) -> Dict[str, callable]:
        """Initialize standard gate set"""
        return {
            'H': self._hadamard_gate,
            'X': self._pauli_x_gate,
            'Y': self._pauli_y_gate,
            'Z': self._pauli_z_gate,
            'RX': self._rotation_x_gate,
            'RY': self._rotation_y_gate,
            'RZ': self._rotation_z_gate,
            'CNOT': self._cnot_gate,
            'CZ': self._cz_gate,
            'SWAP': self._swap_gate,
            'Toffoli': self._toffoli_gate
        }
        
    def generate_random_circuit(self, depth: int, gate_set: Optional[List[str]] = None) -> List[QuantumGate]:
        """Generate random quantum circuit"""
        if gate_set is None:
            gate_set = ['H', 'RX', 'RY', 'RZ', 'CNOT']
            
        circuit = []
        
        for _ in range(depth):
            gate_name = np.random.choice(gate_set)
            
            if gate_name in ['CNOT', 'CZ', 'SWAP']:
                # Two-qubit gates
                qubits = np.random.choice(self.n_qubits, 2, replace=False).tolist()
            elif gate_name == 'Toffoli':
                # Three-qubit gate
                qubits = np.random.choice(self.n_qubits, 3, replace=False).tolist()
            else:
                # Single-qubit gates
                qubits = [np.random.randint(self.n_qubits)]
                
            # Generate gate
            gate_func = self.gates[gate_name]
            if gate_name in ['RX', 'RY', 'RZ']:
                angle = np.random.uniform(0, 2*np.pi)
                gate = gate_func(qubits, angle)
            else:
                gate = gate_func(qubits)
                
            circuit.append(gate)
            
        return circuit
        
    def generate_qaoa_circuit(self, problem_hamiltonian: np.ndarray, p: int) -> List[QuantumGate]:
        """Generate QAOA circuit for optimization"""
        circuit = []
        
        # Initial superposition
        for i in range(self.n_qubits):
            circuit.append(self._hadamard_gate([i]))
            
        # QAOA layers
        for layer in range(p):
            # Problem Hamiltonian evolution
            beta = np.pi / 4  # Would be optimized in practice
            circuit.append(QuantumGate(
                name=f'U_problem_{layer}',
                qubits=list(range(self.n_qubits)),
                matrix=self._hamiltonian_evolution(problem_hamiltonian, beta)
            ))
            
            # Mixing Hamiltonian (X rotations)
            gamma = np.pi / 2  # Would be optimized in practice
            for i in range(self.n_qubits):
                circuit.append(self._rotation_x_gate([i], gamma))
                
        return circuit
        
    def generate_vqe_circuit(self, n_layers: int) -> List[QuantumGate]:
        """Generate VQE ansatz circuit"""
        circuit = []
        
        # Hardware-efficient ansatz
        for layer in range(n_layers):
            # Single-qubit rotations
            for i in range(self.n_qubits):
                circuit.append(self._rotation_y_gate([i], np.random.uniform(0, 2*np.pi)))
                circuit.append(self._rotation_z_gate([i], np.random.uniform(0, 2*np.pi)))
                
            # Entangling gates
            for i in range(self.n_qubits - 1):
                circuit.append(self._cnot_gate([i, i+1]))
                
            # Wrap around
            if self.n_qubits > 2:
                circuit.append(self._cnot_gate([self.n_qubits-1, 0]))
                
        return circuit
        
    def _hadamard_gate(self, qubits: List[int]) -> QuantumGate:
        """Hadamard gate"""
        H = np.array([[1, 1], [1, -1]]) / np.sqrt(2)
        return QuantumGate('H', qubits, H)
        
    def _pauli_x_gate(self, qubits: List[int]) -> QuantumGate:
        """Pauli X gate"""
        X = np.array([[0, 1], [1, 0]])
        return QuantumGate('X', qubits, X)
        
    def _pauli_y_gate(self, qubits: List[int]) -> QuantumGate:
        """Pauli Y gate"""
        Y = np.array([[0, -1j], [1j, 0]])
        return QuantumGate('Y', qubits, Y)
        
    def _pauli_z_gate(self, qubits: List[int]) -> QuantumGate:
        """Pauli Z gate"""
        Z = np.array([[1, 0], [0, -1]])
        return QuantumGate('Z', qubits, Z)
        
    def _rotation_x_gate(self, qubits: List[int], angle: float) -> QuantumGate:
        """X rotation gate"""
        RX = np.array([
            [np.cos(angle/2), -1j*np.sin(angle/2)],
            [-1j*np.sin(angle/2), np.cos(angle/2)]
        ])
        return QuantumGate('RX', qubits, RX, {'angle': angle})
        
    def _rotation_y_gate(self, qubits: List[int], angle: float) -> QuantumGate:
        """Y rotation gate"""
        RY = np.array([
            [np.cos(angle/2), -np.sin(angle/2)],
            [np.sin(angle/2), np.cos(angle/2)]
        ])
        return QuantumGate('RY', qubits, RY, {'angle': angle})
        
    def _rotation_z_gate(self, qubits: List[int], angle: float) -> QuantumGate:
        """Z rotation gate"""
        RZ = np.array([
            [np.exp(-1j*angle/2), 0],
            [0, np.exp(1j*angle/2)]
        ])
        return QuantumGate('RZ', qubits, RZ, {'angle': angle})
        
    def _cnot_gate(self, qubits: List[int]) -> QuantumGate:
        """CNOT gate"""
        CNOT = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0]
        ])
        return QuantumGate('CNOT', qubits, CNOT)
        
    def _cz_gate(self, qubits: List[int]) -> QuantumGate:
        """CZ gate"""
        CZ = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, -1]
        ])
        return QuantumGate('CZ', qubits, CZ)
        
    def _swap_gate(self, qubits: List[int]) -> QuantumGate:
        """SWAP gate"""
        SWAP = np.array([
            [1, 0, 0, 0],
            [0, 0, 1, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1]
        ])
        return QuantumGate('SWAP', qubits, SWAP)
        
    def _toffoli_gate(self, qubits: List[int]) -> QuantumGate:
        """Toffoli gate"""
        # 8x8 matrix for 3-qubit gate
        Toffoli = np.eye(8)
        Toffoli[6, 6] = 0
        Toffoli[6, 7] = 1
        Toffoli[7, 6] = 1
        Toffoli[7, 7] = 0
        return QuantumGate('Toffoli', qubits, Toffoli)
        
    def _hamiltonian_evolution(self, H: np.ndarray, t: float) -> np.ndarray:
        """Evolution under Hamiltonian"""
        return np.exp(-1j * H * t)


class CircuitOptimizer:
    """Optimize quantum circuit depth and gate count"""
    
    def __init__(self):
        """Initialize circuit optimizer"""
        self.optimization_rules = self._init_optimization_rules()
        
    def _init_optimization_rules(self) -> List[callable]:
        """Initialize optimization rules"""
        return [
            self._merge_rotations,
            self._cancel_adjacent_gates,
            self._commute_gates,
            self._decompose_complex_gates
        ]
        
    def optimize_circuit(self, circuit: List[QuantumGate]) -> List[QuantumGate]:
        """Optimize quantum circuit"""
        optimized = circuit.copy()
        
        # Apply optimization rules iteratively
        changed = True
        iterations = 0
        max_iterations = 10
        
        while changed and iterations < max_iterations:
            changed = False
            for rule in self.optimization_rules:
                new_circuit = rule(optimized)
                if len(new_circuit) < len(optimized):
                    optimized = new_circuit
                    changed = True
                    
            iterations += 1
            
        logger.info(f"Circuit optimized: {len(circuit)} -> {len(optimized)} gates")
        return optimized
        
    def _merge_rotations(self, circuit: List[QuantumGate]) -> List[QuantumGate]:
        """Merge consecutive rotations on same axis"""
        optimized = []
        i = 0
        
        while i < len(circuit):
            if i < len(circuit) - 1:
                gate1 = circuit[i]
                gate2 = circuit[i + 1]
                
                # Check if same rotation type on same qubit
                if (gate1.name in ['RX', 'RY', 'RZ'] and 
                    gate1.name == gate2.name and 
                    gate1.qubits == gate2.qubits):
                    
                    # Merge angles
                    angle1 = gate1.params['angle']
                    angle2 = gate2.params['angle']
                    merged_angle = (angle1 + angle2) % (2 * np.pi)
                    
                    # Create merged gate
                    if gate1.name == 'RX':
                        matrix = np.array([
                            [np.cos(merged_angle/2), -1j*np.sin(merged_angle/2)],
                            [-1j*np.sin(merged_angle/2), np.cos(merged_angle/2)]
                        ])
                    elif gate1.name == 'RY':
                        matrix = np.array([
                            [np.cos(merged_angle/2), -np.sin(merged_angle/2)],
                            [np.sin(merged_angle/2), np.cos(merged_angle/2)]
                        ])
                    else:  # RZ
                        matrix = np.array([
                            [np.exp(-1j*merged_angle/2), 0],
                            [0, np.exp(1j*merged_angle/2)]
                        ])
                        
                    merged_gate = QuantumGate(
                        gate1.name,
                        gate1.qubits,
                        matrix,
                        {'angle': merged_angle}
                    )
                    
                    optimized.append(merged_gate)
                    i += 2
                    continue
                    
            optimized.append(circuit[i])
            i += 1
            
        return optimized
        
    def _cancel_adjacent_gates(self, circuit: List[QuantumGate]) -> List[QuantumGate]:
        """Cancel adjacent self-inverse gates"""
        optimized = []
        i = 0
        
        while i < len(circuit):
            if i < len(circuit) - 1:
                gate1 = circuit[i]
                gate2 = circuit[i + 1]
                
                # Check if gates cancel (X-X, Y-Y, Z-Z, H-H, CNOT-CNOT)
                if (gate1.name in ['X', 'Y', 'Z', 'H', 'CNOT'] and
                    gate1.name == gate2.name and 
                    gate1.qubits == gate2.qubits):
                    
                    # Skip both gates
                    i += 2
                    continue
                    
            optimized.append(circuit[i])
            i += 1
            
        return optimized
        
    def _commute_gates(self, circuit: List[QuantumGate]) -> List[QuantumGate]:
        """Commute gates to enable further optimizations"""
        # Simplified: only commute single-qubit gates on different qubits
        optimized = circuit.copy()
        
        for i in range(len(optimized) - 1):
            gate1 = optimized[i]
            gate2 = optimized[i + 1]
            
            # Check if gates act on different qubits
            if (len(gate1.qubits) == 1 and len(gate2.qubits) == 1 and
                gate1.qubits[0] != gate2.qubits[0]):
                
                # These gates commute, can swap if beneficial
                # (In practice, would check if swapping enables other optimizations)
                pass
                
        return optimized
        
    def _decompose_complex_gates(self, circuit: List[QuantumGate]) -> List[QuantumGate]:
        """Decompose complex gates into simpler ones if beneficial"""
        # Placeholder - would implement decomposition rules
        return circuit
        
    def calculate_circuit_depth(self, circuit: List[QuantumGate]) -> int:
        """Calculate circuit depth (parallel gate layers)"""
        if not circuit:
            return 0
            
        # Track which qubits are busy at each time step
        qubit_busy_until = defaultdict(int)
        depth = 0
        
        for gate in circuit:
            # Find when all qubits for this gate are available
            start_time = max([qubit_busy_until[q] for q in gate.qubits], default=0)
            
            # Update busy times
            for q in gate.qubits:
                qubit_busy_until[q] = start_time + 1
                
            depth = max(depth, start_time + 1)
            
        return depth
        
    def analyze_circuit(self, circuit: List[QuantumGate]) -> Dict[str, Any]:
        """Analyze circuit properties"""
        gate_counts = defaultdict(int)
        for gate in circuit:
            gate_counts[gate.name] += 1
            
        two_qubit_gates = sum(1 for g in circuit if len(g.qubits) == 2)
        multi_qubit_gates = sum(1 for g in circuit if len(g.qubits) > 2)
        
        return {
            'total_gates': len(circuit),
            'depth': self.calculate_circuit_depth(circuit),
            'gate_counts': dict(gate_counts),
            'single_qubit_gates': len(circuit) - two_qubit_gates - multi_qubit_gates,
            'two_qubit_gates': two_qubit_gates,
            'multi_qubit_gates': multi_qubit_gates
        }


# Example usage
if __name__ == "__main__":
    n_qubits = 3
    
    # Test tomography
    tomography = QuantumStateTomography(n_qubits)
    test_state = np.zeros(2**n_qubits, dtype=complex)
    test_state[0] = 1/np.sqrt(2)
    test_state[-1] = 1/np.sqrt(2)  # Bell-like state
    
    results = tomography.perform_tomography(test_state)
    print(f"Tomography fidelity: {results['fidelity']:.4f}")
    
    # Test visualization
    visualizer = QuantumStateVisualizer()
    fig = visualizer.plot_state_vector(test_state)
    
    # Test circuit generation
    generator = QuantumCircuitGenerator(n_qubits)
    circuit = generator.generate_random_circuit(depth=10)
    print(f"\nGenerated circuit with {len(circuit)} gates")
    
    # Test optimization
    optimizer = CircuitOptimizer()
    optimized = optimizer.optimize_circuit(circuit)
    
    analysis = optimizer.analyze_circuit(optimized)
    print(f"Optimized circuit analysis: {analysis}")