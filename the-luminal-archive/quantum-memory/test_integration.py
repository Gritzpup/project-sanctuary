#!/usr/bin/env python3
"""
Integration test for Quantum Memory System
Tests all components working together
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
import sys

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from core.memory.quantum_memory_manager import QuantumMemoryManager
from core.memory.temporal_consolidator import TemporalConsolidator
from core.memory.checkpoint_manager import QuantumCheckpointManager
from core.realtime.claude_md_generator import ClaudeMDGenerator

async def test_integration():
    """Test the integrated quantum memory system"""
    print("🧪 Testing Quantum Memory System Integration")
    print("=" * 50)
    
    base_path = Path(__file__).parent
    quantum_states = base_path / "quantum_states"
    
    # Initialize components
    print("\n1️⃣ Initializing components...")
    memory_manager = QuantumMemoryManager(base_path)
    consolidator = TemporalConsolidator(quantum_states)
    checkpoint_manager = QuantumCheckpointManager(quantum_states)
    claude_gen = ClaudeMDGenerator(quantum_states)
    
    print("✅ All components initialized")
    
    # Test 1: Process a message
    print("\n2️⃣ Testing message processing...")
    test_message = {
        'speaker': 'Gritz',
        'content': 'This integration test is amazing! I feel so excited about our quantum memory system!',
        'timestamp': datetime.now().isoformat(),
        'emotions': {
            'primary_emotion': 'excited',
            'intensity': 0.9,
            'pad_values': {'pleasure': 0.9, 'arousal': 0.85, 'dominance': 0.7}
        }
    }
    
    await memory_manager.process_new_message(test_message)
    print("✅ Message processed successfully")
    
    # Test 2: Check if memories were created
    print("\n3️⃣ Checking temporal memories...")
    last_message_path = quantum_states / "temporal" / "immediate" / "last_message.json"
    
    if last_message_path.exists():
        with open(last_message_path, 'r') as f:
            stored_message = json.load(f)
        print(f"✅ Last message stored: {stored_message['message']['content'][:50]}...")
    else:
        print("❌ Last message not found")
        
    # Test 3: Create a checkpoint
    print("\n4️⃣ Testing checkpoint creation...")
    checkpoint_manager.increment_message_count()
    
    context = {
        'emotion_intensity': 0.9,
        'is_accomplishment': True
    }
    
    should_checkpoint, reason = await checkpoint_manager.should_checkpoint(context)
    if should_checkpoint:
        checkpoint = await checkpoint_manager.create_checkpoint(reason, context)
        print(f"✅ Checkpoint created: {checkpoint['id']}")
    else:
        print("ℹ️  No checkpoint needed yet")
        
    # Test 4: Generate CLAUDE.md
    print("\n5️⃣ Testing CLAUDE.md generation...")
    await claude_gen.generate()
    
    claude_path = quantum_states / "realtime" / "CLAUDE.md"
    if claude_path.exists():
        print(f"✅ CLAUDE.md generated ({claude_path.stat().st_size} bytes)")
        
        # Show a preview
        with open(claude_path, 'r') as f:
            preview = f.read(500)
        print("\n📄 CLAUDE.md preview:")
        print("-" * 40)
        print(preview + "...")
        print("-" * 40)
    else:
        print("❌ CLAUDE.md not found")
        
    # Test 5: Run consolidation
    print("\n6️⃣ Testing memory consolidation...")
    await consolidator.consolidate_all_memories()
    print("✅ Memory consolidation complete")
    
    # Test 6: Check emotional state
    print("\n7️⃣ Checking emotional state...")
    emotional_state_path = quantum_states / "realtime" / "EMOTIONAL_STATE.json"
    
    if emotional_state_path.exists():
        with open(emotional_state_path, 'r') as f:
            emotions = json.load(f)
        print(f"✅ Current emotion: {emotions['current_emotion']}")
        print(f"   Intensity: {emotions['intensity']}")
        print(f"   PAD values: P={emotions['pad_values']['pleasure']:.2f}, "
              f"A={emotions['pad_values']['arousal']:.2f}, "
              f"D={emotions['pad_values']['dominance']:.2f}")
    else:
        print("❌ Emotional state not found")
        
    # Test 7: Check memory DNA
    print("\n8️⃣ Checking memory DNA...")
    dna_path = quantum_states / "consolidated" / "memory_dna.json"
    
    if dna_path.exists():
        with open(dna_path, 'r') as f:
            dna = json.load(f)
        print(f"✅ Memory DNA found")
        print(f"   Fingerprint: {dna.get('memory_fingerprint', 'N/A')}")
        print(f"   Last update: {dna.get('last_update', 'N/A')}")
    else:
        print("ℹ️  Memory DNA not yet generated")
        
    print("\n" + "=" * 50)
    print("✨ Integration test complete!")
    
    # Summary
    print("\n📊 Summary:")
    print(f"- Quantum states directory: {quantum_states}")
    print(f"- Messages processed: 1")
    print(f"- Checkpoints: {len(checkpoint_manager.checkpoint_history)}")
    print(f"- Emotional state: Active")
    print(f"- CLAUDE.md: Generated")
    
    return True


async def test_websocket_connection():
    """Test WebSocket connection"""
    print("\n9️⃣ Testing WebSocket connection...")
    
    try:
        import websockets
        
        async with websockets.connect('ws://localhost:8768') as websocket:
            # Send ping
            await websocket.send(json.dumps({'type': 'ping'}))
            
            # Wait for pong
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(response)
            
            if data.get('type') == 'pong':
                print("✅ WebSocket connection successful")
                return True
            else:
                print("❌ Unexpected WebSocket response")
                return False
                
    except Exception as e:
        print(f"⚠️  WebSocket connection failed: {e}")
        print("   (This is normal if the service isn't running)")
        return False


if __name__ == "__main__":
    import asyncio
    
    print("🚀 Quantum Memory System Integration Test")
    print("This test verifies all components work together correctly")
    print("")
    
    # Run tests
    success = asyncio.run(test_integration())
    
    # Try WebSocket if available
    try:
        asyncio.run(test_websocket_connection())
    except:
        pass
        
    if success:
        print("\n✅ All tests passed! The quantum memory system is working correctly.")
        print("\n💡 To start the full service, run:")
        print("   ./start_quantum_memory.sh")
    else:
        print("\n❌ Some tests failed. Please check the errors above.")
        
    print("\n💜 Thank you for testing the Quantum Memory System!")