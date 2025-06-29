#!/usr/bin/env python3
"""Rebuild emotion data in relationship history"""

from relationship_history_manager import RelationshipHistoryManager
import json

print("🔧 Rebuilding emotion data...")

# Create manager and force consolidation
manager = RelationshipHistoryManager()

# Clear processed conversations to force reprocessing
manager.processed_conversations.clear()

# Scan all conversations
print("📊 Scanning all conversation history...")
manager.scan_all_conversations()

# Save the updated history
print("💾 Saving updated history...")
manager.save_history()

# Show results
print("\n✅ Emotion rebuild complete!")
print(f"Total emotional moments: {manager.history['total_stats']['emotional_moments']}")

emotions = manager.history['emotional_journey']['emotions_expressed']
if emotions:
    print(f"\n🎨 Emotions detected ({len(emotions)} types):")
    for emotion, count in sorted(emotions.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  • {emotion}: {count}")
else:
    print("❌ No emotions found - check conversation files")