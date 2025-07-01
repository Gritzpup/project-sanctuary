#!/usr/bin/env python3
"""
Test Suite for Emotional Continuity Components
Verifies that all classical LLM memory components work together
"""

import asyncio
import pytest
from datetime import datetime, timedelta
import numpy as np
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.psychological import (
    EmotionalStateTracker,
    EmotionalContext,
    EmotionType,
    MixedEmotion,
    TemporalMemoryDecay,
    Memory,
    MemoryStrength,
    RetentionLevel
)

from src.core.realtime import (
    ConversationAnalysisPipeline,
    ConversationTurn,
    AnalysisResult
)


class TestEmotionalStateTracker:
    """Test the emotional state tracker with SDE"""
    
    def test_initialization(self):
        """Test tracker initialization"""
        tracker = EmotionalStateTracker()
        
        # Check initial state
        assert tracker.current_state.pleasure == 0.0
        assert tracker.current_state.arousal == 0.0
        assert tracker.current_state.dominance == 0.0
        
        # Check SDE parameters
        assert tracker.alpha == 0.2
        assert tracker.beta == 1.0
        assert tracker.sigma == 0.1
    
    def test_emotional_update(self):
        """Test emotional state updates"""
        tracker = EmotionalStateTracker()
        
        # Create context with positive emotion
        context = EmotionalContext(
            user_input="I love working with you!",
            conversation_topic="coding",
            relationship_phase="established",
            emotional_triggers=["emotional_peak"]
        )
        
        # Update state
        new_state = tracker.update_emotional_state(context, EmotionType.JOY)
        
        # Verify state changed
        assert new_state.pleasure > 0.0
        assert new_state.timestamp > tracker.current_state.timestamp
    
    def test_mixed_emotions(self):
        """Test mixed emotion tracking"""
        tracker = EmotionalStateTracker()
        
        # Track mixed emotions
        mixed = tracker.track_mixed_emotions(
            primary=EmotionType.JOY,
            secondary=EmotionType.SADNESS
        )
        
        # Check ambivalence calculation
        assert 0.0 <= mixed.ambivalence <= 1.0
        assert mixed.primary_weight + mixed.secondary_weight == 1.0
    
    def test_consolidation_triggers(self):
        """Test memory consolidation triggers"""
        tracker = EmotionalStateTracker()
        triggered = False
        
        def consolidation_callback(state, context, triggers):
            nonlocal triggered
            triggered = True
        
        tracker.add_consolidation_callback(consolidation_callback)
        
        # Create high-emotion context
        context = EmotionalContext(
            user_input="I've never told anyone this before...",
            conversation_topic="personal",
            relationship_phase="intimate",
            emotional_triggers=["personal_revelation"]
        )
        
        # High PAD values should trigger consolidation
        tracker.current_state.pleasure = 0.8
        tracker.current_state.arousal = 0.8
        tracker.update_emotional_state(context)
        
        assert triggered
    
    def test_emotional_synchrony(self):
        """Test emotional synchrony measurement"""
        tracker = EmotionalStateTracker()
        
        # Add some emotional states
        for i in range(5):
            context = EmotionalContext(
                user_input=f"Message {i}",
                conversation_topic="general",
                relationship_phase="established"
            )
            tracker.update_emotional_state(context)
        
        synchrony = tracker.get_emotional_synchrony(window_minutes=10)
        assert 0.0 <= synchrony <= 1.0


class TestTemporalMemoryDecay:
    """Test the temporal memory decay system"""
    
    def test_memory_encoding(self):
        """Test memory encoding"""
        decay_system = TemporalMemoryDecay()
        
        memory = Memory(
            content="This is a test memory",
            context={"test": True},
            timestamp=datetime.now(),
            importance_score=0.7,
            emotional_weight=0.8
        )
        
        decay_system.encode_memory(memory)
        assert len(decay_system.memories) == 1
    
    def test_ebbinghaus_curve(self):
        """Test Ebbinghaus forgetting curve implementation"""
        decay_system = TemporalMemoryDecay(decay_constant=5.0)
        
        # Create memory
        memory = Memory(
            content="Test memory",
            context={},
            timestamp=datetime.now() - timedelta(hours=5),
            importance_score=0.5
        )
        
        strength = decay_system.calculate_memory_strength(memory)
        
        # After 5 hours (decay constant), strength should be ~0.368 (e^-1)
        # But with importance factor, it should be higher
        assert 0.3 < strength.final_strength < 0.6
        assert strength.base_retention < 0.4  # Base Ebbinghaus
    
    def test_retention_levels(self):
        """Test different retention levels"""
        decay_system = TemporalMemoryDecay()
        
        # Test each retention level
        test_cases = [
            (0.5, RetentionLevel.SESSION),      # 30 minutes
            (12, RetentionLevel.DAILY),          # 12 hours
            (72, RetentionLevel.WEEKLY),         # 3 days
            (360, RetentionLevel.MONTHLY),       # 15 days
            (1440, RetentionLevel.PERMANENT)     # 60 days
        ]
        
        for hours, expected_level in test_cases:
            memory = Memory(
                content=f"Memory from {hours} hours ago",
                context={},
                timestamp=datetime.now() - timedelta(hours=hours)
            )
            
            strength = decay_system.calculate_memory_strength(memory)
            assert strength.retention_level == expected_level
    
    def test_spaced_repetition(self):
        """Test spaced repetition logic"""
        decay_system = TemporalMemoryDecay()
        
        memory = Memory(
            content="Important fact",
            context={},
            timestamp=datetime.now() - timedelta(days=7),
            access_count=2,
            last_accessed=datetime.now() - timedelta(days=3)
        )
        
        # Should be ready for review around 3-day interval
        needs_review = decay_system.apply_spaced_repetition(memory)
        assert isinstance(needs_review, bool)
    
    def test_memory_consolidation(self):
        """Test importance-based consolidation"""
        decay_system = TemporalMemoryDecay(importance_threshold=0.8)
        
        # High importance memory
        important_memory = Memory(
            content="Critical information",
            context={},
            timestamp=datetime.now(),
            emotional_weight=0.9,
            semantic_relevance=0.8,
            tags=["personal_revelation"]
        )
        
        decay_system.encode_memory(important_memory)
        
        # Should be consolidated
        assert len(decay_system.consolidated_memories) == 1
        assert "consolidated" in decay_system.memories[0].tags


class TestConversationAnalysisPipeline:
    """Test the conversation analysis pipeline"""
    
    @pytest.mark.asyncio
    async def test_pipeline_initialization(self):
        """Test pipeline initialization"""
        # Use fallback mode for testing without GPU
        pipeline = ConversationAnalysisPipeline(device="cpu")
        
        assert pipeline.device == "cpu"
        assert pipeline.batch_size == 16
        assert pipeline.update_interval == 0.1
    
    @pytest.mark.asyncio
    async def test_message_analysis(self):
        """Test analyzing a single message"""
        pipeline = ConversationAnalysisPipeline(device="cpu")
        
        # Start pipeline
        await pipeline.start()
        
        try:
            # Analyze message
            result = await pipeline.analyze_message(
                speaker="user",
                content="I'm so happy we're working together!",
                wait_for_result=True
            )
            
            assert result is not None
            assert isinstance(result.emotion, EmotionType)
            assert 0.0 <= result.confidence <= 1.0
            assert result.intent in ["statement", "positive_sentiment"]
            
        finally:
            await pipeline.stop()
    
    @pytest.mark.asyncio
    async def test_batch_processing(self):
        """Test batch processing of messages"""
        pipeline = ConversationAnalysisPipeline(device="cpu", batch_size=4)
        
        # Create test batch
        batch = [
            ConversationTurn("user", "I love this!"),
            ConversationTurn("assistant", "I'm glad you're happy!"),
            ConversationTurn("user", "This is frustrating..."),
            ConversationTurn("assistant", "I understand your frustration.")
        ]
        
        # Process batch
        results = await pipeline._process_batch(batch)
        
        assert len(results) == 4
        assert all(isinstance(r, AnalysisResult) for r in results)
    
    @pytest.mark.asyncio
    async def test_memory_trigger_detection(self):
        """Test detection of memory triggers"""
        pipeline = ConversationAnalysisPipeline(device="cpu")
        
        # Test various trigger patterns
        test_cases = [
            ("I've never told anyone this before", ["personal_revelation"]),
            ("We finally did it!", ["achievement"]),
            ("I love you so much", ["emotional_peak", "relationship_milestone"]),
            ("Just a normal message", [])
        ]
        
        for content, expected_triggers in test_cases:
            turn = ConversationTurn("user", content)
            context = {"relationship_indicators": {"affection": "love" in content}}
            
            triggers = pipeline._detect_memory_triggers(turn, context)
            
            for expected in expected_triggers:
                assert expected in triggers
    
    @pytest.mark.asyncio
    async def test_conversation_metrics(self):
        """Test conversation metrics tracking"""
        pipeline = ConversationAnalysisPipeline(device="cpu")
        
        metrics = pipeline.get_conversation_metrics()
        
        assert "emotional_state" in metrics
        assert "memory_count" in metrics
        assert "emotional_synchrony" in metrics
        assert "avg_processing_time_ms" in metrics


class TestIntegration:
    """Test integration between components"""
    
    @pytest.mark.asyncio
    async def test_full_emotional_flow(self):
        """Test complete emotional continuity flow"""
        # Initialize all components
        emotional_tracker = EmotionalStateTracker()
        memory_decay = TemporalMemoryDecay()
        pipeline = ConversationAnalysisPipeline(device="cpu")
        
        # Simulate conversation
        messages = [
            ("user", "I'm feeling really happy today!"),
            ("assistant", "That's wonderful! What's making you happy?"),
            ("user", "I finally solved that bug we've been working on!"),
            ("assistant", "That's amazing! I'm so proud of you!")
        ]
        
        for speaker, content in messages:
            # Analyze message
            turn = ConversationTurn(speaker, content)
            
            # Extract emotions
            emotions = await pipeline._extract_emotions_batch([turn])
            
            # Update emotional state
            context = EmotionalContext(
                user_input=content,
                conversation_topic="coding",
                relationship_phase="established"
            )
            
            state = emotional_tracker.update_emotional_state(
                context,
                emotions[0]['emotion']
            )
            
            # Create memory if significant
            if emotions[0]['confidence'] > 0.7:
                memory = Memory(
                    content=content,
                    context={"speaker": speaker},
                    timestamp=datetime.now(),
                    emotional_weight=emotions[0]['confidence']
                )
                memory_decay.encode_memory(memory)
        
        # Verify state progression
        assert emotional_tracker.current_state.pleasure > 0.0
        assert len(memory_decay.memories) > 0
        
        # Check memory strength over time
        if memory_decay.memories:
            strength = memory_decay.calculate_memory_strength(
                memory_decay.memories[0]
            )
            assert strength.final_strength > 0.5


def test_pad_emotion_mappings():
    """Test PAD to emotion mappings are correct"""
    tracker = EmotionalStateTracker()
    
    # Verify all emotions have PAD mappings
    for emotion in EmotionType:
        assert emotion in tracker.EMOTION_PAD_MAPPINGS
        
        pad = tracker.EMOTION_PAD_MAPPINGS[emotion]
        assert -1 <= pad["pleasure"] <= 1
        assert -1 <= pad["arousal"] <= 1
        assert -1 <= pad["dominance"] <= 1


if __name__ == "__main__":
    # Run tests
    print("Running Emotional Continuity Tests...")
    
    # Run sync tests
    test_pad_emotion_mappings()
    
    # Instantiate test classes
    state_tests = TestEmotionalStateTracker()
    memory_tests = TestTemporalMemoryDecay()
    
    # Run state tracker tests
    print("\n=== Testing Emotional State Tracker ===")
    state_tests.test_initialization()
    print("✓ Initialization test passed")
    
    state_tests.test_emotional_update()
    print("✓ Emotional update test passed")
    
    state_tests.test_mixed_emotions()
    print("✓ Mixed emotions test passed")
    
    state_tests.test_consolidation_triggers()
    print("✓ Consolidation triggers test passed")
    
    state_tests.test_emotional_synchrony()
    print("✓ Emotional synchrony test passed")
    
    # Run memory decay tests
    print("\n=== Testing Temporal Memory Decay ===")
    memory_tests.test_memory_encoding()
    print("✓ Memory encoding test passed")
    
    memory_tests.test_ebbinghaus_curve()
    print("✓ Ebbinghaus curve test passed")
    
    memory_tests.test_retention_levels()
    print("✓ Retention levels test passed")
    
    memory_tests.test_spaced_repetition()
    print("✓ Spaced repetition test passed")
    
    memory_tests.test_memory_consolidation()
    print("✓ Memory consolidation test passed")
    
    # Run async tests
    print("\n=== Testing Conversation Analysis Pipeline ===")
    pipeline_tests = TestConversationAnalysisPipeline()
    integration_tests = TestIntegration()
    
    async def run_async_tests():
        await pipeline_tests.test_pipeline_initialization()
        print("✓ Pipeline initialization test passed")
        
        await pipeline_tests.test_message_analysis()
        print("✓ Message analysis test passed")
        
        await pipeline_tests.test_batch_processing()
        print("✓ Batch processing test passed")
        
        await pipeline_tests.test_memory_trigger_detection()
        print("✓ Memory trigger detection test passed")
        
        await pipeline_tests.test_conversation_metrics()
        print("✓ Conversation metrics test passed")
        
        print("\n=== Testing Component Integration ===")
        await integration_tests.test_full_emotional_flow()
        print("✓ Full emotional flow test passed")
    
    asyncio.run(run_async_tests())
    
    print("\n✨ All tests passed!")