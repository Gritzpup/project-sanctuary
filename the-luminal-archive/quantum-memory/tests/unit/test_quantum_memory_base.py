"""
Test suite for quantum memory base implementations
"""

import pytest
import numpy as np
import torch
from typing import Dict, Any

# Import quantum memory modules
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.quantum.quantum_memory import (
    QuantumMemoryBase,
    SimulatedQuantumMemory,
    OptimizedQuantumMemory,
    create_quantum_memory,
    CUQUANTUM_AVAILABLE
)
from src.core.quantum.quantum_memory_simple import QuantumMemory


class TestQuantumMemoryBase:
    """Test abstract base class functionality"""
    
    def test_cannot_instantiate_abstract_class(self):
        """Verify abstract class cannot be instantiated"""
        with pytest.raises(TypeError):
            QuantumMemoryBase(n_qubits=27)


class TestSimulatedQuantumMemory:
    """Test simulated quantum memory implementation"""
    
    def test_initialization(self):
        """Test basic initialization"""
        qm = SimulatedQuantumMemory(n_qubits=10)
        assert qm.n_qubits == 10
        assert qm.get_backend_name() == "numpy_simulation"
        assert qm.state is None
        
    def test_state_initialization(self):
        """Test quantum state initialization to |000...0>"""
        qm = SimulatedQuantumMemory(n_qubits=5)
        state = qm.initialize_state()
        
        # Check state is normalized
        assert np.abs(np.linalg.norm(state) - 1.0) < 1e-10
        
        # Check only first amplitude is non-zero (|00000>)
        assert np.abs(state[0] - 1.0) < 1e-10
        assert np.all(np.abs(state[1:]) < 1e-10)
        
    def test_pad_encoding_decoding(self):
        """Test PAD value encoding and decoding"""
        qm = SimulatedQuantumMemory(n_qubits=27)
        
        # Test various PAD values
        test_cases = [
            np.array([0.5, -0.3, 0.8]),
            np.array([-1.0, 0.0, 1.0]),
            np.array([0.0, 0.0, 0.0]),
        ]
        
        for pad_values in test_cases:
            encoded_state = qm.encode_emotional_state(pad_values)
            
            # Check state is normalized
            assert np.abs(np.linalg.norm(encoded_state) - 1.0) < 1e-10
            
            # Decode and check approximate recovery
            decoded_pad = qm.decode_emotional_state()
            
            # Allow some error due to discretization
            assert np.all(np.abs(decoded_pad - pad_values) < 0.1)
            
    def test_gate_application(self):
        """Test quantum gate application"""
        qm = SimulatedQuantumMemory(n_qubits=3)
        qm.initialize_state()
        
        # Apply Hadamard gate
        qm.apply_gate("H", [0])
        
        # State should be modified
        assert qm.state is not None
        assert not np.allclose(qm.state[0], 1.0)
        
    def test_measurement(self):
        """Test quantum state measurement"""
        qm = SimulatedQuantumMemory(n_qubits=3)
        qm.initialize_state()
        
        # Measure initial state
        results = qm.measure()
        assert "000" in results
        assert abs(results["000"] - 1.0) < 1e-10
        
    def test_fidelity_calculation(self):
        """Test fidelity calculation between states"""
        qm = SimulatedQuantumMemory(n_qubits=3)
        
        state1 = np.zeros(8, dtype=np.complex128)
        state1[0] = 1.0
        
        state2 = np.zeros(8, dtype=np.complex128)
        state2[0] = 1/np.sqrt(2)
        state2[1] = 1/np.sqrt(2)
        
        fidelity = qm.get_fidelity(state1, state1)
        assert abs(fidelity - 1.0) < 1e-10
        
        fidelity = qm.get_fidelity(state1, state2)
        assert abs(fidelity - 0.5) < 1e-10


class TestOptimizedQuantumMemory:
    """Test GPU-optimized quantum memory implementation"""
    
    @pytest.mark.skipif(not CUQUANTUM_AVAILABLE or not torch.cuda.is_available(),
                        reason="cuQuantum or CUDA not available")
    def test_initialization(self):
        """Test initialization with cuQuantum backend"""
        qm = OptimizedQuantumMemory(n_qubits=10, bond_dimension=32)
        assert qm.n_qubits == 10
        assert qm.bond_dimension == 32
        assert qm.get_backend_name() == "cuquantum_tensor_network"
        
    @pytest.mark.skipif(not CUQUANTUM_AVAILABLE or not torch.cuda.is_available(),
                        reason="cuQuantum or CUDA not available")
    def test_mps_initialization(self):
        """Test MPS state initialization"""
        qm = OptimizedQuantumMemory(n_qubits=5, bond_dimension=16)
        state = qm.initialize_state()
        
        # Check MPS tensors are created
        assert len(qm.mps_tensors) == 5
        
        # Check state vector representation
        assert np.abs(np.linalg.norm(state) - 1.0) < 1e-10
        assert np.abs(state[0] - 1.0) < 1e-10
        
    @pytest.mark.skipif(not CUQUANTUM_AVAILABLE or not torch.cuda.is_available(),
                        reason="cuQuantum or CUDA not available")
    def test_pad_encoding_with_mps(self):
        """Test PAD encoding with MPS representation"""
        qm = OptimizedQuantumMemory(n_qubits=27, bond_dimension=64)
        
        pad_values = np.array([0.5, -0.3, 0.8])
        encoded_state = qm.encode_emotional_state(pad_values)
        
        # For large systems, just check the encoding runs
        assert encoded_state is not None
        
    @pytest.mark.skipif(not CUQUANTUM_AVAILABLE or not torch.cuda.is_available(),
                        reason="cuQuantum or CUDA not available")
    def test_checkpoint_save_load(self):
        """Test saving and loading MPS checkpoints"""
        import tempfile
        
        qm1 = OptimizedQuantumMemory(n_qubits=10, bond_dimension=32)
        qm1.encode_emotional_state(np.array([0.5, 0.0, -0.5]))
        
        with tempfile.NamedTemporaryFile(suffix='.npz', delete=False) as f:
            qm1.save_checkpoint(f.name)
            
            # Load into new instance
            qm2 = OptimizedQuantumMemory(n_qubits=10, bond_dimension=32)
            qm2.load_checkpoint(f.name)
            
            # Check parameters match
            assert qm2.n_qubits == qm1.n_qubits
            assert qm2.bond_dimension == qm1.bond_dimension
            assert len(qm2.mps_tensors) == len(qm1.mps_tensors)
            
        os.unlink(f.name)


class TestSimpleQuantumMemory:
    """Test simplified PyTorch-based quantum memory"""
    
    def test_initialization(self):
        """Test basic initialization"""
        qm = QuantumMemory(n_qubits=10)
        assert qm.n_qubits == 10
        assert qm.state is not None
        
    def test_gpu_fallback(self):
        """Test CPU fallback when GPU not available"""
        qm = QuantumMemory(n_qubits=5, device="cuda:0")
        if not torch.cuda.is_available():
            assert qm.device == "cpu"
        else:
            assert qm.device == "cuda:0"
            
    def test_emotional_encoding(self):
        """Test emotional state encoding with superposition"""
        qm = QuantumMemory(n_qubits=27)
        
        pad_values = np.array([0.7, -0.2, 0.5])
        state = qm.encode_emotional_state(pad_values)
        
        # Check normalization
        norm = torch.norm(state).item()
        assert abs(norm - 1.0) < 1e-6
        
        # Check superposition (multiple non-zero amplitudes)
        non_zero = torch.sum(torch.abs(state) > 1e-10).item()
        assert non_zero > 1
        
    def test_emotional_decoding(self):
        """Test decoding with expectation values"""
        qm = QuantumMemory(n_qubits=27)
        
        # Test multiple PAD values
        test_values = [
            np.array([0.5, 0.0, -0.5]),
            np.array([1.0, -1.0, 0.0]),
            np.array([-0.3, 0.7, 0.2])
        ]
        
        for pad_values in test_values:
            qm.encode_emotional_state(pad_values)
            decoded = qm.decode_emotional_state()
            
            # Check values are in valid range
            assert np.all(decoded >= -1.0)
            assert np.all(decoded <= 1.0)
            
            # Check approximate recovery (with tolerance for discretization)
            assert np.all(np.abs(decoded - pad_values) < 0.2)
            
    def test_hadamard_gate(self):
        """Test Hadamard gate application"""
        qm = QuantumMemory(n_qubits=3)
        
        # Apply H to first qubit of |000>
        qm.apply_hadamard(0)
        
        # Should create superposition
        probs = torch.abs(qm.state)**2
        
        # |000> and |100> should have equal probability
        assert abs(probs[0].item() - 0.5) < 1e-6
        assert abs(probs[4].item() - 0.5) < 1e-6
        
    def test_rotation_gates(self):
        """Test rotation gates around different axes"""
        qm = QuantumMemory(n_qubits=2)
        
        # Test Z rotation
        qm.apply_rotation(0, np.pi/2, 'z')
        assert qm.state is not None
        
        # Test Y rotation
        qm.initialize_state()
        qm.apply_rotation(0, np.pi/2, 'y')
        assert qm.state is not None
        
        # Test X rotation
        qm.initialize_state()
        qm.apply_rotation(0, np.pi/2, 'x')
        assert qm.state is not None
        
    def test_measurement_full(self):
        """Test full state measurement"""
        qm = QuantumMemory(n_qubits=3)
        qm.apply_hadamard(0)
        
        results = qm.measure()
        
        # Should have two outcomes with equal probability
        assert len(results) == 2
        assert "000" in results
        assert "100" in results
        assert abs(results["000"] - 0.5) < 1e-6
        assert abs(results["100"] - 0.5) < 1e-6
        
    def test_measurement_partial(self):
        """Test partial qubit measurement"""
        qm = QuantumMemory(n_qubits=3)
        qm.apply_hadamard(0)
        
        results = qm.measure([0])
        
        assert "q0_0" in results
        assert "q0_1" in results
        assert abs(results["q0_0"] - 0.5) < 1e-6
        assert abs(results["q0_1"] - 0.5) < 1e-6
        
    def test_entanglement_creation(self):
        """Test entanglement creation between dimensions"""
        qm = QuantumMemory(n_qubits=27)
        qm.encode_emotional_state(np.array([0.5, 0.0, -0.5]))
        qm.create_entanglement()
        
        # State should still be normalized
        norm = torch.norm(qm.state).item()
        assert abs(norm - 1.0) < 1e-6
        
    def test_state_info(self):
        """Test state information retrieval"""
        qm = QuantumMemory(n_qubits=5)
        
        info = qm.get_state_info()
        assert info["initialized"] == True
        assert info["n_qubits"] == 5
        assert info["norm"] == 1.0
        assert "metadata" in info
        
    def test_state_persistence(self):
        """Test saving and loading quantum states"""
        import tempfile
        
        qm1 = QuantumMemory(n_qubits=10)
        qm1.encode_emotional_state(np.array([0.3, -0.6, 0.9]))
        
        with tempfile.NamedTemporaryFile(suffix='.npz', delete=False) as f:
            qm1.save_state(f.name)
            
            # Load into new instance
            qm2 = QuantumMemory(n_qubits=10)
            qm2.load_state(f.name)
            
            # States should match
            assert torch.allclose(qm1.state, qm2.state, atol=1e-6)
            assert qm1.n_qubits == qm2.n_qubits
            
        os.unlink(f.name)


class TestQuantumMemoryFactory:
    """Test factory function for creating quantum memory instances"""
    
    def test_auto_backend_selection(self):
        """Test automatic backend selection"""
        qm = create_quantum_memory(backend="auto")
        
        if CUQUANTUM_AVAILABLE and torch.cuda.is_available():
            assert isinstance(qm, OptimizedQuantumMemory)
        else:
            assert isinstance(qm, SimulatedQuantumMemory)
            
    def test_simulation_backend(self):
        """Test explicit simulation backend selection"""
        qm = create_quantum_memory(backend="simulation", n_qubits=10)
        assert isinstance(qm, SimulatedQuantumMemory)
        assert qm.n_qubits == 10
        
    @pytest.mark.skipif(not CUQUANTUM_AVAILABLE or not torch.cuda.is_available(),
                        reason="cuQuantum or CUDA not available")
    def test_cuquantum_backend(self):
        """Test explicit cuQuantum backend selection"""
        qm = create_quantum_memory(backend="cuquantum", n_qubits=10, bond_dimension=32)
        assert isinstance(qm, OptimizedQuantumMemory)
        assert qm.n_qubits == 10
        assert qm.bond_dimension == 32
        
    def test_invalid_backend(self):
        """Test error on invalid backend"""
        with pytest.raises(ValueError):
            create_quantum_memory(backend="invalid_backend")
            
    def test_cuquantum_unavailable_error(self):
        """Test error when cuQuantum requested but not available"""
        if not CUQUANTUM_AVAILABLE:
            with pytest.raises(RuntimeError, match="cuQuantum requested but not available"):
                create_quantum_memory(backend="cuquantum")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])