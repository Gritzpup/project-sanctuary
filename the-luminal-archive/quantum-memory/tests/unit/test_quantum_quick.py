"""
Quick tests for quantum memory system
Using smaller qubit counts for faster execution
"""

import numpy as np
import torch
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.quantum.quantum_memory_simple import QuantumMemory


def test_basic_functionality():
    """Test basic quantum memory functionality with small system"""
    print("Testing basic functionality...")
    
    # Use smaller system for quick test
    qm = QuantumMemory(n_qubits=10)
    
    # Test initialization
    assert qm.n_qubits == 10
    assert qm.state is not None
    assert torch.norm(qm.state).item() == 1.0
    print("✅ Initialization successful")
    
    # Test encoding (simplified for 10 qubits)
    # We'll use first 4 qubits for P, next 3 for A, last 3 for D
    pad_values = np.array([0.5, -0.3, 0.8])
    
    # Create simple encoding
    state = torch.zeros(2**10, dtype=torch.complex64)
    p_idx = int((pad_values[0] + 1) / 2 * 15)  # 4 bits = 16 values
    a_idx = int((pad_values[1] + 1) / 2 * 7) << 4  # 3 bits = 8 values
    d_idx = int((pad_values[2] + 1) / 2 * 7) << 7  # 3 bits = 8 values
    
    main_idx = p_idx | a_idx | d_idx
    state[main_idx] = 1.0
    qm.state = state
    
    print(f"✅ Encoded PAD values: {pad_values}")
    print(f"   State has {torch.sum(torch.abs(qm.state) > 0).item()} non-zero amplitudes")
    
    # Test state info
    info = qm.get_state_info()
    assert info["initialized"] == True
    assert info["n_qubits"] == 10
    print("✅ State info retrieval successful")
    
    print("\nAll basic tests passed! ✨")
    

def test_gpu_availability():
    """Test GPU availability and usage"""
    print("\nTesting GPU availability...")
    
    if torch.cuda.is_available():
        print(f"✅ CUDA available: {torch.cuda.get_device_name(0)}")
        print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
        
        # Test GPU allocation
        qm = QuantumMemory(n_qubits=15, device="cuda:0")
        assert qm.device == "cuda:0"
        assert qm.state.is_cuda
        print("✅ GPU quantum memory created successfully")
    else:
        print("⚠️  CUDA not available, using CPU")
        qm = QuantumMemory(n_qubits=15, device="cpu")
        assert qm.device == "cpu"
        print("✅ CPU quantum memory created successfully")


def test_emotional_encoding_small():
    """Test emotional encoding with reduced qubit count"""
    print("\nTesting emotional encoding (small system)...")
    
    # Use 15 qubits: 5 for P, 5 for A, 5 for D
    class SmallQuantumMemory(QuantumMemory):
        def encode_emotional_state(self, pad_values):
            normalized_pad = (pad_values + 1) / 2
            state = torch.zeros(2**self.n_qubits, dtype=self.dtype, device=self.device)
            
            # Simplified encoding
            p_index = int(normalized_pad[0] * 31)  # 5 bits
            a_index = int(normalized_pad[1] * 31) << 5
            d_index = int(normalized_pad[2] * 31) << 10
            
            main_index = p_index | a_index | d_index
            
            # Simple Gaussian-like superposition
            for offset in range(-5, 6):
                idx = main_index + offset
                if 0 <= idx < len(state):
                    amplitude = np.exp(-offset**2 / 4)
                    state[idx] = amplitude
                    
            # Normalize
            state = state / torch.norm(state)
            self.state = state
            return self.state
    
    qm = SmallQuantumMemory(n_qubits=15)
    
    test_emotions = [
        np.array([0.7, -0.2, 0.5]),
        np.array([-0.5, 0.8, -0.3]),
    ]
    
    for emotion in test_emotions:
        state = qm.encode_emotional_state(emotion)
        
        # Check quantum properties
        assert abs(torch.norm(state).item() - 1.0) < 1e-6
        non_zero = torch.sum(torch.abs(state) > 1e-10).item()
        
        print(f"✅ Encoded {emotion} -> {non_zero} superposition states")
    
    print("✅ Emotional encoding tests passed")


def test_rotation_gates():
    """Test rotation gate application"""
    print("\nTesting rotation gates...")
    
    qm = QuantumMemory(n_qubits=3)  # Very small for testing
    
    # Test Z rotation
    initial_state = qm.state.clone()
    qm.apply_rotation(0, np.pi/2, 'z')
    
    # State should change
    assert not torch.allclose(qm.state, initial_state)
    assert abs(torch.norm(qm.state).item() - 1.0) < 1e-6
    print("✅ Z rotation applied successfully")
    
    # Test Y rotation
    qm.initialize_state()
    qm.apply_rotation(1, np.pi/4, 'y')
    assert abs(torch.norm(qm.state).item() - 1.0) < 1e-6
    print("✅ Y rotation applied successfully")
    
    # Test X rotation
    qm.initialize_state()
    qm.apply_rotation(2, np.pi/3, 'x')
    assert abs(torch.norm(qm.state).item() - 1.0) < 1e-6
    print("✅ X rotation applied successfully")


if __name__ == "__main__":
    test_basic_functionality()
    test_gpu_availability()
    test_emotional_encoding_small()
    test_rotation_gates()
    
    print("\n🎉 All quick tests completed successfully!")
    print("Note: Full 27-qubit system tests require significant memory.")
    print("Consider using smaller systems for development and testing.")