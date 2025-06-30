"""
Integration tests for quantum memory system
Focus on core emotional encoding/decoding functionality
"""

import pytest
import numpy as np
import torch
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.quantum.quantum_memory_simple import QuantumMemory


class TestQuantumMemoryIntegration:
    """Integration tests for quantum memory emotional encoding"""
    
    def test_emotional_state_round_trip(self):
        """Test encoding and decoding emotional states"""
        qm = QuantumMemory(n_qubits=27)
        
        # Test various emotional states
        test_emotions = [
            # [Pleasure, Arousal, Dominance]
            np.array([0.8, 0.6, 0.4]),   # Happy, excited, confident
            np.array([-0.7, -0.5, -0.8]), # Sad, calm, submissive  
            np.array([0.0, 0.9, 0.7]),    # Neutral pleasure, very aroused, dominant
            np.array([0.5, -0.3, 0.0]),   # Pleased, relaxed, neutral dominance
        ]
        
        for emotion in test_emotions:
            # Encode
            state = qm.encode_emotional_state(emotion)
            
            # Verify quantum state properties
            assert torch.is_complex(state)
            assert abs(torch.norm(state).item() - 1.0) < 1e-6
            
            # Decode
            decoded = qm.decode_emotional_state()
            
            # Check bounds
            assert np.all(decoded >= -1.0)
            assert np.all(decoded <= 1.0)
            
            # Check approximate recovery (allowing for quantization error)
            error = np.abs(decoded - emotion)
            assert np.all(error < 0.2), f"Encoding error too large: {error}"
            
    def test_state_persistence(self):
        """Test saving and loading emotional states"""
        import tempfile
        
        qm = QuantumMemory(n_qubits=27)
        
        # Create a complex emotional state
        emotion = np.array([0.65, -0.42, 0.88])
        qm.encode_emotional_state(emotion)
        
        # Save state
        with tempfile.NamedTemporaryFile(suffix='.npz', delete=False) as f:
            qm.save_state(f.name)
            saved_state = qm.state.clone()
            
            # Create new instance and load
            qm2 = QuantumMemory(n_qubits=27)
            qm2.load_state(f.name)
            
            # Verify states match
            assert torch.allclose(saved_state, qm2.state, atol=1e-6)
            
            # Verify emotional decoding matches
            decoded1 = qm.decode_emotional_state()
            decoded2 = qm2.decode_emotional_state()
            assert np.allclose(decoded1, decoded2, atol=1e-6)
            
        os.unlink(f.name)
        
    def test_emotional_transitions(self):
        """Test smooth transitions between emotional states"""
        qm = QuantumMemory(n_qubits=27)
        
        # Start with happy state
        happy = np.array([0.8, 0.3, 0.5])
        qm.encode_emotional_state(happy)
        state1 = qm.state.clone()
        
        # Transition to sad state
        sad = np.array([-0.8, -0.4, -0.3])
        qm.encode_emotional_state(sad)
        state2 = qm.state.clone()
        
        # States should be different
        fidelity = qm.get_fidelity(state1, state2)
        assert fidelity < 0.9  # Low overlap between different emotions
        
    def test_superposition_properties(self):
        """Test that encoding creates proper superposition"""
        qm = QuantumMemory(n_qubits=27)
        
        # Encode a moderate emotional state
        emotion = np.array([0.5, 0.0, -0.5])
        state = qm.encode_emotional_state(emotion)
        
        # Check superposition (multiple non-zero amplitudes)
        non_zero_count = torch.sum(torch.abs(state) > 1e-10).item()
        assert non_zero_count > 10, "Should have superposition over multiple basis states"
        
        # Check normalization
        assert abs(torch.norm(state).item() - 1.0) < 1e-6
        
    def test_extreme_emotional_values(self):
        """Test encoding of extreme emotional values"""
        qm = QuantumMemory(n_qubits=27)
        
        extreme_emotions = [
            np.array([1.0, 1.0, 1.0]),    # Maximum all dimensions
            np.array([-1.0, -1.0, -1.0]), # Minimum all dimensions
            np.array([1.0, -1.0, 0.0]),   # Mixed extremes
        ]
        
        for emotion in extreme_emotions:
            state = qm.encode_emotional_state(emotion)
            decoded = qm.decode_emotional_state()
            
            # Should handle extremes gracefully
            assert np.all(decoded >= -1.0)
            assert np.all(decoded <= 1.0)
            
            # Reasonable recovery even at extremes
            error = np.abs(decoded - emotion)
            assert np.all(error < 0.3)
            
    def test_device_compatibility(self):
        """Test CPU/GPU compatibility"""
        # Test on CPU
        qm_cpu = QuantumMemory(n_qubits=10, device="cpu")
        assert qm_cpu.device == "cpu"
        
        emotion = np.array([0.3, -0.2, 0.7])
        state_cpu = qm_cpu.encode_emotional_state(emotion)
        
        # If GPU available, test on GPU
        if torch.cuda.is_available():
            qm_gpu = QuantumMemory(n_qubits=10, device="cuda:0")
            assert qm_gpu.device == "cuda:0"
            
            state_gpu = qm_gpu.encode_emotional_state(emotion)
            
            # Results should be similar
            state_gpu_cpu = state_gpu.cpu()
            assert torch.allclose(state_cpu, state_gpu_cpu, atol=1e-5)
            
    def test_quantum_properties_preservation(self):
        """Test that quantum properties are preserved during operations"""
        qm = QuantumMemory(n_qubits=27)
        
        # Encode emotional state
        emotion = np.array([0.4, 0.6, -0.2])
        qm.encode_emotional_state(emotion)
        
        # Apply some rotations
        qm.apply_rotation(5, np.pi/4, 'z')
        qm.apply_rotation(15, np.pi/3, 'y')
        qm.apply_rotation(25, np.pi/6, 'x')
        
        # State should still be normalized
        norm = torch.norm(qm.state).item()
        assert abs(norm - 1.0) < 1e-6
        
        # Should still decode to valid emotional values
        decoded = qm.decode_emotional_state()
        assert np.all(decoded >= -1.0)
        assert np.all(decoded <= 1.0)
        
    def test_measurement_statistics(self):
        """Test measurement gives consistent statistics"""
        qm = QuantumMemory(n_qubits=3)  # Small system for full measurement
        
        # Create equal superposition
        qm.state = torch.ones(2**3, dtype=torch.complex64) / np.sqrt(8)
        
        results = qm.measure()
        
        # Should have 8 outcomes
        assert len(results) == 8
        
        # All should have equal probability (approximately)
        for bitstring, prob in results.items():
            assert abs(prob - 1/8) < 1e-6
            
        # Probabilities should sum to 1
        total_prob = sum(results.values())
        assert abs(total_prob - 1.0) < 1e-6


if __name__ == "__main__":
    pytest.main([__file__, "-v"])