#!/usr/bin/env python3
"""
Test script to debug why emollama is returning template placeholders
"""

import sys
import os
from pathlib import Path

# Add paths for imports
sys.path.append(str(Path(__file__).parent))
sys.path.append(str(Path(__file__).parent / "src"))
sys.path.append(str(Path(__file__).parent / "src" / "utils"))

print("🧪 Testing Emollama Analysis Fix...")
print("=" * 60)

# Import emollama
try:
    from emollama_integration import EmollamaAnalyzer
    print("✅ Emollama module imported")
except Exception as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

# Initialize analyzer
print("\n🔧 Initializing Emollama analyzer...")
analyzer = EmollamaAnalyzer()

# Load model
print("📡 Loading model...")
if analyzer.load_model():
    print("✅ Model loaded successfully")
else:
    print("❌ Failed to load model")
    sys.exit(1)

# Test messages
test_messages = [
    "Hey Claude, I'm working on fixing the quantum memory system",
    "The analyzer is returning template placeholders instead of real analysis",
    "We need to fix the emollama integration to return actual work context"
]

# Test todos
test_todos = [
    {"content": "Fix emollama analysis", "status": "in_progress"},
    {"content": "Update work summary generation", "status": "pending"},
    {"content": "Test quantum improvements", "status": "completed"}
]

print("\n🧠 Testing analyze_for_memories_and_work...")
print(f"Messages: {test_messages}")
print(f"Todos: {[t['content'] for t in test_todos]}")

try:
    result = analyzer.analyze_for_memories_and_work(test_messages, test_todos)
    
    print("\n📊 Analysis Result:")
    print("-" * 60)
    
    # Check key fields
    print(f"Current Work: {result.get('current_work', 'MISSING')}")
    print(f"Completed Tasks: {result.get('completed_tasks', 'MISSING')}")
    print(f"Blockers: {result.get('blockers', 'MISSING')}")
    print(f"Next Steps: {result.get('next_steps', 'MISSING')}")
    
    # Check if we got placeholders
    if result.get('current_work') == "(exactly what they're doing right now)":
        print("\n❌ ERROR: Got template placeholder instead of real analysis!")
        print("The model is returning the JSON template without filling it in.")
        
        # Let's try a simpler prompt
        print("\n🔧 Testing with simpler prompt...")
        simple_result = analyzer._enhanced_basic_analysis(test_messages, test_todos)
        print(f"Simple analysis current_work: {simple_result.get('current_work')}")
        
    else:
        print("\n✅ Got real analysis!")
        
    # Full result
    print("\n📝 Full Result:")
    import json
    print(json.dumps(result, indent=2))
    
except Exception as e:
    print(f"\n❌ Error during analysis: {e}")
    import traceback
    traceback.print_exc()

print("\n✨ Test complete!")