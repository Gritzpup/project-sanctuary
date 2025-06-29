#!/usr/bin/env python3
"""
Quick test to verify Phase 1 components are working
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

async def test_imports():
    """Test that all imports work"""
    print("Testing Phase 1 imports...")
    
    try:
        # Core imports
        from core import (
            EmotionalBaselineManager,
            RelationshipPhaseTracker,
            SemanticDeduplicator,
            MemoryHealthMonitor,
            QuantumEmotionalEncoder
        )
        print("✅ Core imports successful")
        
        # Base classes
        from core.base import BaseComponent, BaseMemoryComponent
        print("✅ Base classes imported")
        
        # Services
        from services.websocket import QuantumMemoryWebSocketServer
        print("✅ WebSocket server imported")
        
        # Utils
        from utils.checkpoint import ClaudeFolderSync, StateManager
        print("✅ Checkpoint utils imported")
        
        # Main
        from main import QuantumMemorySystem
        print("✅ Main system imported")
        
        print("\n🎉 All Phase 1 imports successful!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False


async def test_basic_functionality():
    """Test basic component functionality"""
    print("\nTesting basic functionality...")
    
    try:
        from core.psychological.emotional_baseline import EmotionalBaselineManager
        from core.psychological.phase_detection import RelationshipPhaseTracker
        
        # Test emotional baseline
        emotional = EmotionalBaselineManager()
        state = emotional.update_state({
            "content": "Hello! I'm excited to test this!",
            "speaker": "Gritz"
        })
        print(f"✅ Emotional state: {state}")
        
        # Test phase tracker
        phase_tracker = RelationshipPhaseTracker()
        phase_info = phase_tracker.analyze_interaction(
            "Gritz",
            "I love working on this with you!",
            state
        )
        print(f"✅ Relationship phase: {phase_info['phase']} (confidence: {phase_info['confidence']:.2f})")
        
        print("\n🎉 Basic functionality tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Functionality test error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_websocket():
    """Test WebSocket server startup"""
    print("\nTesting WebSocket server...")
    
    try:
        from services.websocket import QuantumMemoryWebSocketServer
        
        server = QuantumMemoryWebSocketServer(port=8766)  # Different port for testing
        
        # Start server
        await server.start()
        print("✅ WebSocket server started")
        
        # Test broadcast
        await server.broadcast_emotional_update({
            "pleasure": 0.7,
            "arousal": 0.6,
            "dominance": 0.5
        })
        print("✅ Broadcast test successful")
        
        # Stop server
        await server.stop()
        print("✅ WebSocket server stopped cleanly")
        
        return True
        
    except Exception as e:
        print(f"❌ WebSocket test error: {e}")
        return False


async def main():
    """Run all tests"""
    print("=== Phase 1 Component Tests ===\n")
    
    results = []
    
    # Run tests
    results.append(await test_imports())
    results.append(await test_basic_functionality())
    results.append(await test_websocket())
    
    # Summary
    print("\n=== Test Summary ===")
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"✅ All tests passed! ({passed}/{total})")
        print("\n🚀 Phase 1 is ready to launch!")
        print("Run: ./scripts/start_quantum_memory.sh")
    else:
        print(f"⚠️  Some tests failed ({passed}/{total})")
        print("Please check the errors above")
        

if __name__ == "__main__":
    asyncio.run(main())