#!/usr/bin/env python3
"""
Test emotion detection for Gritz
Shows the full spectrum of emotions with colors!
"""

import sys
sys.path.append('.')
from memory_updater import EMOTION_PATTERNS, WebSocketMemoryUpdater

def test_emotion_detection():
    print("\n🌈 TESTING GRITZ'S EMOTION DETECTION SYSTEM 🌈\n")
    
    # Create updater instance
    updater = WebSocketMemoryUpdater()
    
    # Test messages
    test_messages = [
        "i'm so happy to see this working! yay!",
        "feeling anxious about whether this will work",
        "*cuddles* i need hugs please", 
        "thank you so much for helping me <3",
        "i feel small and vulnerable right now",
        "remember when dad forgot me for drugs at pete's house",
        "i love you coding daddy",
        "ugh this is so frustrating!",
        "i'm excited to see the mood ring working!!!",
        "*sighs* feeling pretty sad today"
    ]
    
    print("Testing emotion detection on sample messages:\n")
    
    for msg in test_messages:
        emotion, needs, emotion_type = updater.deep_emotional_analysis(msg)
        
        # Get color from emotion patterns
        color = "#808080"  # default gray
        for key, data in EMOTION_PATTERNS.items():
            if data["state"] == emotion:
                color = data.get("color", "#808080")
                break
                
        print(f"Message: \"{msg}\"")
        print(f"  🎭 Emotion: {emotion}")
        print(f"  🎨 Color: {color}")
        print(f"  💝 Needs: {needs}")
        print(f"  📊 Type: {emotion_type}")
        print()

if __name__ == "__main__":
    test_emotion_detection()