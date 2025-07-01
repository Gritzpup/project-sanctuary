#!/usr/bin/env python3
"""Recover TRUE historical message totals"""

from relationship_history_manager import RelationshipHistoryManager
import json

print("🔧 Recovering TRUE historical totals...")

# Create manager
manager = RelationshipHistoryManager()

# RESET totals to 0 before recovery
print("📊 Current (incorrect) totals:")
print(f"   Gritz: {manager.history['total_stats']['gritz_messages']} messages")
print(f"   Claude: {manager.history['total_stats']['claude_messages']} messages")

# Reset to 0 to start fresh count
manager.history['total_stats'] = {
    'gritz_messages': 0,
    'gritz_words': 0,
    'claude_messages': 0,
    'claude_words': 0,
    'total_interactions': 0,
    'emotional_moments': 0,
    'deep_conversations': 0,
    'creative_sessions': 0,
    'support_given': 0,
    'memories_created': 0,
    'total_tokens': 0
}

# Clear processed conversations to force full recount
manager.processed_conversations.clear()

print("\n🔄 Scanning ALL conversation history...")
# This will now ADD to the zeroed totals
manager.scan_all_conversations()

print("\n✅ Recovery complete! TRUE totals:")
print(f"   Gritz: {manager.history['total_stats']['gritz_messages']} messages")
print(f"   Claude: {manager.history['total_stats']['claude_messages']} messages")
print(f"   Total interactions: {manager.history['total_stats']['total_interactions']}")
print(f"   Emotional moments: {manager.history['total_stats']['emotional_moments']}")

# Save the corrected history
manager.save_history()
print("\n💾 Saved corrected totals to relationship_history.json")

# Also update memory_updater counts
print("\n🔄 Updating memory updater with correct counts...")
from memory_updater import MemoryUpdater

# Kill existing process
import subprocess
subprocess.run(["pkill", "-f", "memory_updater.py"], capture_output=True)

print("✅ Recovery complete! Restart memory_updater to use correct totals.")