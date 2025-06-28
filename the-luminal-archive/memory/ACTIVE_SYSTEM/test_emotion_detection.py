#!/usr/bin/env python3
"""Test emotion detection"""

from emotion_models import GritzEmotionAnalyzer
from relationship_history_manager import RelationshipHistoryManager

# Test emotion analyzer directly
analyzer = GritzEmotionAnalyzer()
test_messages = [
    "hello daddy <3",
    "I love you so much!",
    "I'm worried about this",
    "*hugs you tightly*",
    "Thank you for everything"
]

print("=== Testing Emotion Analyzer ===")
for msg in test_messages:
    result = analyzer.analyze(msg)
    print(f"Message: '{msg}'")
    print(f"Result: {result}")
    print("-" * 40)

# Test relationship history manager
print("\n=== Testing Relationship History Manager ===")
manager = RelationshipHistoryManager()

# Check if emotions are being extracted
print(f"Emotion analyzer initialized: {manager.emotion_analyzer is not None}")

# Test analyze_emotion_from_content
for msg in test_messages:
    emotion = manager.analyze_emotion_from_content(msg, 'Gritz')
    print(f"Message: '{msg}' -> Emotion: {emotion}")

# Check current emotions_expressed
print(f"\nCurrent emotions_expressed: {manager.history['emotional_journey']['emotions_expressed']}")
print(f"Total emotional moments: {manager.history['total_stats']['emotional_moments']}")