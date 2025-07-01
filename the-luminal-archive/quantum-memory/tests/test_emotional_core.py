#!/usr/bin/env python3
"""
Simple test of emotional continuity core components
Tests without external dependencies
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta
import math

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Test imports work
try:
    from src.psychological.emotional_state_tracker import (
        EmotionalStateTracker,
        EmotionalContext,
        EmotionType,
        MixedEmotion
    )
    print("✓ EmotionalStateTracker imports successful")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)

try:
    from src.psychological.temporal_memory_decay import (
        TemporalMemoryDecay,
        Memory,
        RetentionLevel
    )
    print("✓ TemporalMemoryDecay imports successful")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)


def test_emotional_state_tracker():
    """Test basic EmotionalStateTracker functionality"""
    print("\n=== Testing EmotionalStateTracker ===")
    
    # Initialize tracker
    tracker = EmotionalStateTracker()
    print(f"Initial state: P={tracker.current_state.pleasure}, A={tracker.current_state.arousal}, D={tracker.current_state.dominance}")
    
    # Test emotion update
    context = EmotionalContext(
        user_input="I'm so happy to be working with you!",
        conversation_topic="coding",
        relationship_phase="established",
        emotional_triggers=["emotional_peak"]
    )
    
    new_state = tracker.update_emotional_state(context, EmotionType.JOY)
    print(f"After update: P={new_state.pleasure:.3f}, A={new_state.arousal:.3f}, D={new_state.dominance:.3f}")
    
    # Test mixed emotions
    mixed = tracker.track_mixed_emotions(EmotionType.JOY, EmotionType.ANTICIPATION)
    print(f"Mixed emotion - Primary: {mixed.primary.value}, Secondary: {mixed.secondary.value}, Ambivalence: {mixed.ambivalence:.3f}")
    
    # Test PAD mappings
    print("\nPAD Mappings:")
    for emotion in [EmotionType.JOY, EmotionType.LOVE, EmotionType.FEAR]:
        pad = tracker.EMOTION_PAD_MAPPINGS[emotion]
        print(f"  {emotion.value}: P={pad['pleasure']}, A={pad['arousal']}, D={pad['dominance']}")
    
    return True


def test_temporal_memory_decay():
    """Test basic TemporalMemoryDecay functionality"""
    print("\n=== Testing TemporalMemoryDecay ===")
    
    # Initialize system
    decay = TemporalMemoryDecay(decay_constant=5.0)
    
    # Create and encode memory
    memory = Memory(
        content="This is an important conversation milestone",
        context={"type": "milestone"},
        timestamp=datetime.now(),
        importance_score=0.8,
        emotional_weight=0.9,
        tags=["relationship_milestone"]
    )
    
    decay.encode_memory(memory)
    print(f"Encoded memory with importance: {memory.importance_score}")
    
    # Test memory strength calculation
    strength = decay.calculate_memory_strength(memory)
    print(f"Initial strength: {strength.final_strength:.3f}")
    
    # Simulate time passing
    old_memory = Memory(
        content="Old memory",
        context={},
        timestamp=datetime.now() - timedelta(hours=10),
        importance_score=0.5
    )
    
    old_strength = decay.calculate_memory_strength(old_memory)
    print(f"10-hour old memory strength: {old_strength.final_strength:.3f}")
    print(f"Retention level: {old_strength.retention_level.value}")
    
    # Test Ebbinghaus curve
    print("\nEbbinghaus Curve Test:")
    for hours in [0, 1, 5, 10, 24]:
        t = hours
        retention = math.exp(-t / decay.decay_constant)
        print(f"  {hours}h: {retention:.3f}")
    
    return True


def test_stochastic_differential_equation():
    """Test SDE implementation in emotion dynamics"""
    print("\n=== Testing Stochastic Differential Equations ===")
    
    tracker = EmotionalStateTracker(
        mean_reversion_rate=0.2,
        input_sensitivity=1.0,
        emotional_volatility=0.1
    )
    
    # Run multiple updates to see SDE in action
    print("Running 5 updates with same input to see stochastic variation:")
    
    context = EmotionalContext(
        user_input="Normal conversation",
        conversation_topic="general",
        relationship_phase="established"
    )
    
    states = []
    for i in range(5):
        state = tracker.update_emotional_state(context, EmotionType.NEUTRAL)
        states.append(state)
        print(f"  Update {i+1}: P={state.pleasure:.4f}, A={state.arousal:.4f}, D={state.dominance:.4f}")
    
    # Calculate variance to confirm stochastic nature
    pleasure_values = [s.pleasure for s in states]
    if len(set(pleasure_values)) > 1:
        print("✓ Stochastic variation confirmed")
    else:
        print("✗ No stochastic variation detected")
    
    return True


def test_memory_triggers():
    """Test memory consolidation triggers"""
    print("\n=== Testing Memory Consolidation Triggers ===")
    
    tracker = EmotionalStateTracker()
    triggers_found = []
    
    def consolidation_callback(state, context, triggers):
        triggers_found.extend(triggers)
    
    tracker.add_consolidation_callback(consolidation_callback)
    
    # Test personal revelation
    context1 = EmotionalContext(
        user_input="I've never told anyone this secret before",
        conversation_topic="personal",
        relationship_phase="intimate"
    )
    
    tracker.update_emotional_state(context1)
    print(f"Personal revelation triggers: {triggers_found}")
    
    # Test emotional peak
    triggers_found.clear()
    tracker.current_state.pleasure = 0.9
    tracker.current_state.arousal = 0.8
    
    context2 = EmotionalContext(
        user_input="This is amazing!",
        conversation_topic="achievement",
        relationship_phase="established"
    )
    
    tracker.update_emotional_state(context2)
    print(f"Emotional peak triggers: {triggers_found}")
    
    return True


def main():
    """Run all tests"""
    print("Testing Emotional Continuity Core Components")
    print("=" * 50)
    
    tests = [
        test_emotional_state_tracker,
        test_temporal_memory_decay,
        test_stochastic_differential_equation,
        test_memory_triggers
    ]
    
    passed = 0
    for test in tests:
        try:
            if test():
                passed += 1
                print(f"✓ {test.__name__} passed\n")
        except Exception as e:
            print(f"✗ {test.__name__} failed: {e}\n")
    
    print("=" * 50)
    print(f"Tests passed: {passed}/{len(tests)}")
    
    if passed == len(tests):
        print("✨ All core tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())