#!/usr/bin/env python3
"""
Test script for the async quantum folder analyzer
"""

import asyncio
import json
import time
from pathlib import Path
import sys

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent / "src"))

# Import the async analyzer
from analyzers.claude_folder_analyzer_async import AsyncQuantumFolderAnalyzer

def test_async_analyzer():
    """Test the async analyzer functionality"""
    print("🚀 Testing Async Quantum Folder Analyzer...")
    
    # Create analyzer
    analyzer = AsyncQuantumFolderAnalyzer()
    
    # Start async processing
    analyzer.start_async_processing()
    
    print("✅ Async processing started")
    
    # Give it a moment to initialize
    time.sleep(2)
    
    # Simulate some file events
    print("\n📝 Simulating file events...")
    
    # Test conversation event
    test_event = type('Event', (), {
        'is_directory': False,
        'src_path': str(analyzer.claude_folder / 'conversations' / 'test.jsonl')
    })()
    
    analyzer.on_modified(test_event)
    print("  - Queued conversation event")
    
    # Test todo event
    test_event = type('Event', (), {
        'is_directory': False,
        'src_path': str(analyzer.claude_folder / 'todos' / 'todos.json')
    })()
    
    analyzer.on_modified(test_event)
    print("  - Queued todo event")
    
    # Test entity event
    test_event = type('Event', (), {
        'is_directory': False,
        'src_path': str(analyzer.entity_folder / 'claude' / 'consciousness_snapshot.json')
    })()
    
    analyzer.on_modified(test_event)
    print("  - Queued entity event")
    
    # Wait for processing
    print("\n⏳ Waiting for async processing...")
    time.sleep(5)
    
    # Check stats
    print(f"\n📊 Processing Statistics:")
    print(f"  - Events processed: {analyzer.stats['events_processed']}")
    print(f"  - Batches processed: {analyzer.stats['batches_processed']}")
    print(f"  - Errors: {analyzer.stats['errors']}")
    print(f"  - Avg processing time: {analyzer.stats['avg_processing_time']:.3f}s")
    
    # Stop analyzer
    print("\n🛑 Stopping analyzer...")
    analyzer.stop()
    
    print("✅ Test complete!")

if __name__ == "__main__":
    test_async_analyzer()