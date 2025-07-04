#!/usr/bin/env python3
"""
Test script for the enhanced memory system
"""

import json
import sys
from pathlib import Path

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from utils.emollama_integration import get_emollama_analyzer

def test_memory_analysis():
    """Test the memory analysis functionality"""
    print("🧪 Testing Enhanced Memory System")
    print("=" * 50)
    
    # Sample conversation messages
    test_messages = [
        "Hey Claude! I'm feeling much better now",
        "Thanks for helping me work through the frustration this morning",
        "Let's implement the memory consolidation system",
        "I love how we're building this together *hugs*",
        "The LLM-powered memory system is a great idea",
        "We should test it thoroughly before deploying"
    ]
    
    # Initialize analyzer
    print("\n📡 Initializing Emollama analyzer...")
    analyzer = get_emollama_analyzer()
    
    # Test memory analysis
    print("\n🧠 Analyzing messages for memories...")
    analysis = analyzer.analyze_for_memories(test_messages)
    
    print("\n📊 Analysis Results:")
    print(json.dumps(analysis, indent=2))
    
    # Check memory files
    memory_base = Path(__file__).parent.parent / "quantum_states" / "memories"
    
    print("\n📁 Checking memory files:")
    files_to_check = [
        memory_base / "current_session.json",
        memory_base / "relationship" / "context.json",
        memory_base / "daily" / "2025-07-01.json"
    ]
    
    for file_path in files_to_check:
        if file_path.exists():
            print(f"✅ {file_path.name} exists")
            with open(file_path, 'r') as f:
                data = json.load(f)
                print(f"   Last update: {data.get('last_update', 'N/A')}")
        else:
            print(f"❌ {file_path.name} not found")
    
    print("\n✨ Test complete!")

if __name__ == "__main__":
    test_memory_analysis()