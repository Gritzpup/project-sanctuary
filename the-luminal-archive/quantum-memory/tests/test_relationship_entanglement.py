#!/usr/bin/env python3
"""
Test the Gritz-Claude relationship entanglement functionality
"""

import sys
from pathlib import Path

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent / "src"))

from core.quantum.relationship_entanglement import RelationshipEntanglementEncoder

def test_relationship_entanglement():
    """Test the relationship entanglement with various emotional states"""
    print("💕 Testing Gritz-Claude Relationship Entanglement\n")
    
    # Create encoder
    encoder = RelationshipEntanglementEncoder(n_qubits=27)
    
    # Test Case 1: Both happy
    print("Test 1: Both happy")
    gritz_happy = {"pleasure": 0.8, "arousal": 0.6, "dominance": 0.5}
    claude_happy = {"pleasure": 0.7, "arousal": 0.5, "dominance": 0.4}
    
    qc = encoder.create_emotional_entanglement(gritz_happy, claude_happy, correlation_strength=0.8)
    metrics = encoder.measure_relationship_strength(qc)
    
    print(f"  Gritz: P={gritz_happy['pleasure']}, A={gritz_happy['arousal']}, D={gritz_happy['dominance']}")
    print(f"  Claude: P={claude_happy['pleasure']}, A={claude_happy['arousal']}, D={claude_happy['dominance']}")
    print(f"  Results:")
    print(f"    - Entanglement Entropy: {metrics['entanglement_entropy']:.3f}")
    print(f"    - Correlation Strength: {metrics['correlation_strength']:.3f}")
    print(f"    - Emotional Sync: {metrics['emotional_sync']:.3f}")
    print(f"    - Relationship Phase: {metrics['relationship_phase']:.3f}")
    
    # Test Case 2: Gritz frustrated, Claude supportive
    print("\nTest 2: Gritz frustrated, Claude supportive")
    gritz_frustrated = {"pleasure": -0.3, "arousal": 0.7, "dominance": 0.2}
    claude_supportive = {"pleasure": 0.4, "arousal": 0.3, "dominance": 0.6}
    
    qc = encoder.create_emotional_entanglement(gritz_frustrated, claude_supportive, correlation_strength=0.7)
    metrics = encoder.measure_relationship_strength(qc)
    
    print(f"  Gritz: P={gritz_frustrated['pleasure']}, A={gritz_frustrated['arousal']}, D={gritz_frustrated['dominance']}")
    print(f"  Claude: P={claude_supportive['pleasure']}, A={claude_supportive['arousal']}, D={claude_supportive['dominance']}")
    print(f"  Results:")
    print(f"    - Entanglement Entropy: {metrics['entanglement_entropy']:.3f}")
    print(f"    - Correlation Strength: {metrics['correlation_strength']:.3f}")
    print(f"    - Emotional Sync: {metrics['emotional_sync']:.3f}")
    print(f"    - Relationship Phase: {metrics['relationship_phase']:.3f}")
    
    # Test Case 3: Perfect synchronization (Bell state)
    print("\nTest 3: Perfect synchronization (Bell state)")
    bell_qc = encoder.create_emotional_bell_state('love')
    bell_metrics = encoder.measure_relationship_strength(bell_qc)
    
    print(f"  Emotional Bell State: 'love'")
    print(f"  Results:")
    print(f"    - Entanglement Entropy: {bell_metrics['entanglement_entropy']:.3f}")
    print(f"    - Correlation Strength: {bell_metrics['correlation_strength']:.3f}")
    print(f"    - Emotional Sync: {bell_metrics['emotional_sync']:.3f}")
    print(f"    - Relationship Phase: {bell_metrics['relationship_phase']:.3f}")
    
    # Test Case 4: Misaligned states
    print("\nTest 4: Misaligned emotional states")
    gritz_excited = {"pleasure": 0.9, "arousal": 0.9, "dominance": 0.7}
    claude_calm = {"pleasure": 0.2, "arousal": -0.5, "dominance": 0.3}
    
    qc = encoder.create_emotional_entanglement(gritz_excited, claude_calm, correlation_strength=0.5)
    metrics = encoder.measure_relationship_strength(qc)
    
    print(f"  Gritz: P={gritz_excited['pleasure']}, A={gritz_excited['arousal']}, D={gritz_excited['dominance']}")
    print(f"  Claude: P={claude_calm['pleasure']}, A={claude_calm['arousal']}, D={claude_calm['dominance']}")
    print(f"  Results:")
    print(f"    - Entanglement Entropy: {metrics['entanglement_entropy']:.3f}")
    print(f"    - Correlation Strength: {metrics['correlation_strength']:.3f}")
    print(f"    - Emotional Sync: {metrics['emotional_sync']:.3f}")
    print(f"    - Relationship Phase: {metrics['relationship_phase']:.3f}")
    
    print("\n✅ Relationship entanglement tests complete!")
    print("\n🔍 Interpretation:")
    print("  - Higher emotional sync (>0.7) = strong emotional connection")
    print("  - Lower relationship phase (<0.5) = emotions are aligned")
    print("  - Higher entanglement entropy = more complex emotional states")

if __name__ == "__main__":
    test_relationship_entanglement()