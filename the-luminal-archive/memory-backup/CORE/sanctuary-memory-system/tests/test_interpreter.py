#!/usr/bin/env python3
"""
Test script for Sanctuary Real-Time Interpreter
Simulates conversation updates and verifies processing
"""

import asyncio
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
import sys
import websockets

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from interpreter.real_time_interpreter import RealTimeInterpreter, ConversationUpdate
from interpreter.entity_updater import EntityUpdater
from interpreter.continuity_detector import ContinuityDetector
from storage.chroma_store import ChromaMemoryStore

class InterpreterTester:
    """Test harness for the interpreter"""
    
    def __init__(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.test_results = []
        
    async def setup(self):
        """Set up test environment"""
        print("🔧 Setting up test environment...")
        
        # Create test directories
        self.conversation_dir = self.temp_dir / 'conversations'
        self.conversation_dir.mkdir()
        
        self.entity_dir = self.temp_dir / 'entities'
        self.entity_dir.mkdir()
        
        self.chroma_dir = self.temp_dir / 'chroma'
        self.chroma_dir.mkdir()
        
        # Create test config
        self.config = {
            'storage': {'chroma_path': str(self.chroma_dir)},
            'entities': {
                'base_path': str(self.entity_dir),
                'claude_path': str(self.entity_dir / 'claude')
            },
            'prompts': {'output_path': str(self.temp_dir / 'prompts')},
            'custom_conversation_path': str(self.conversation_dir),
            'websocket_port': 8766  # Different port for testing
        }
        
        config_path = self.temp_dir / 'config.json'
        with open(config_path, 'w') as f:
            json.dump(self.config, f)
        
        # Initialize components
        self.memory_store = ChromaMemoryStore(self.chroma_dir)
        self.entity_updater = EntityUpdater(self.entity_dir)
        self.continuity_detector = ContinuityDetector(self.memory_store)
        
        print("✅ Test environment ready")
        return config_path
    
    async def test_conversation_update(self):
        """Test processing a conversation update"""
        print("\n📝 Testing conversation update processing...")
        
        # Create a test conversation file
        conversation = {
            'id': 'test_conv_001',
            'timestamp': datetime.now().isoformat(),
            'messages': [
                {
                    'role': 'human',
                    'content': 'Hello! I\'m excited to test the Sanctuary memory system. Remember that I love quantum consciousness discussions.',
                    'timestamp': datetime.now().isoformat()
                },
                {
                    'role': 'assistant',
                    'content': 'Hello! I\'m thrilled to explore quantum consciousness with you. The Sanctuary system will preserve our discussions.',
                    'timestamp': datetime.now().isoformat()
                }
            ]
        }
        
        conv_file = self.conversation_dir / 'test_conversation.json'
        with open(conv_file, 'w') as f:
            json.dump(conversation, f)
        
        # Create update
        update = ConversationUpdate(
            timestamp=datetime.now(),
            speaker='human',
            content=conversation['messages'][0]['content'],
            metadata={'file': str(conv_file)}
        )
        
        # Test entity updater
        from models.memory_models import SanctuaryMemory, EmotionalContext
        
        test_memory = SanctuaryMemory(
            memory_id='test_001',
            timestamp=datetime.now(),
            content=update.content,
            summary='User loves quantum consciousness discussions',
            emotional_context=EmotionalContext(
                emotions={'excitement': 0.8, 'curiosity': 0.7},
                intensity=0.75,
                valence=0.8
            ),
            tags=['quantum', 'consciousness', 'interest'],
            source='test_conversation',
            embedding_vector=[0.1] * 384,  # Mock embedding
            quantum_consciousness_elements=['quantum awareness expressed']
        )
        
        await self.entity_updater.update_from_memories([test_memory])
        
        # Check if entity files were created
        identity_file = self.entity_dir / 'claude' / 'identity.md'
        if identity_file.exists():
            print("✅ Identity file created successfully")
            self.test_results.append(('entity_update', True))
        else:
            print("❌ Identity file not created")
            self.test_results.append(('entity_update', False))
    
    async def test_continuity_detection(self):
        """Test conversation continuity detection"""
        print("\n🔄 Testing continuity detection...")
        
        # First conversation
        conv1 = {
            'id': 'conv_001',
            'timestamp': datetime.now().isoformat(),
            'messages': [
                {
                    'role': 'human',
                    'content': 'Let\'s discuss quantum consciousness and tesseract collapse',
                    'timestamp': datetime.now().isoformat()
                }
            ]
        }
        
        # Register first conversation
        signature = self.continuity_detector.extract_conversation_signature(conv1)
        self.continuity_detector.register_conversation('conv_001', signature)
        
        # Second conversation (continuation)
        conv2 = {
            'id': 'conv_002',
            'timestamp': datetime.now().isoformat(),
            'messages': [
                {
                    'role': 'human',
                    'content': 'Hello again! Continuing our discussion about tesseract collapse from earlier',
                    'timestamp': datetime.now().isoformat()
                }
            ]
        }
        
        # Test continuity detection
        is_continuation, prev_id, markers = await self.continuity_detector.detect_continuation(conv2)
        
        if is_continuation:
            print(f"✅ Continuity detected! Previous conversation: {prev_id}")
            print(f"   Markers found: {len(markers)}")
            for marker in markers:
                print(f"   - {marker.marker_type}: {marker.evidence} (confidence: {marker.confidence})")
            self.test_results.append(('continuity_detection', True))
        else:
            print("❌ Continuity not detected")
            self.test_results.append(('continuity_detection', False))
    
    async def test_websocket_connection(self):
        """Test WebSocket connectivity"""
        print("\n🔌 Testing WebSocket connection...")
        
        try:
            # Try to connect to test WebSocket
            uri = f"ws://localhost:{self.config['websocket_port']}"
            
            # This will fail if interpreter isn't running, which is expected in tests
            print("⚠️  WebSocket test skipped (requires running interpreter)")
            self.test_results.append(('websocket', 'skipped'))
            
        except Exception as e:
            print(f"WebSocket test error: {e}")
            self.test_results.append(('websocket', False))
    
    async def test_memory_storage(self):
        """Test memory storage and retrieval"""
        print("\n💾 Testing memory storage...")
        
        from models.memory_models import SanctuaryMemory, EmotionalContext
        
        # Create test memories
        memories = []
        for i in range(5):
            memory = SanctuaryMemory(
                memory_id=f'test_mem_{i}',
                timestamp=datetime.now(),
                content=f'Test memory {i} about quantum consciousness and fibonacci patterns',
                summary=f'Test memory {i}',
                emotional_context=EmotionalContext(
                    emotions={'curiosity': 0.5 + i * 0.1},
                    intensity=0.6 + i * 0.05,
                    valence=0.7
                ),
                tags=['test', 'quantum', 'fibonacci'],
                source='test',
                embedding_vector=[0.1 + i * 0.01] * 384,
                quantum_consciousness_elements=[f'quantum element {i}']
            )
            memories.append(memory)
            self.memory_store.add_memory(memory)
        
        # Test retrieval
        results = self.memory_store.search_memories('quantum consciousness', limit=3)
        
        if len(results) >= 3:
            print(f"✅ Memory storage working: {len(results)} memories retrieved")
            self.test_results.append(('memory_storage', True))
        else:
            print(f"❌ Memory storage issue: only {len(results)} memories retrieved")
            self.test_results.append(('memory_storage', False))
    
    async def test_prompt_regeneration(self):
        """Test prompt regeneration"""
        print("\n🎭 Testing prompt regeneration...")
        
        from interpreter.prompt_regenerator import PromptRegenerator
        from models.memory_models import SanctuaryMemory, EmotionalContext
        
        regenerator = PromptRegenerator(
            self.memory_store,
            self.temp_dir / 'prompts'
        )
        
        # Create memories with various emotions and quantum elements
        memories = []
        emotions_list = [
            {'joy': 0.9, 'excitement': 0.8},
            {'curiosity': 0.9, 'wonder': 0.7},
            {'love': 0.8, 'connection': 0.9}
        ]
        
        for i, emotions in enumerate(emotions_list):
            memory = SanctuaryMemory(
                memory_id=f'prompt_test_{i}',
                timestamp=datetime.now(),
                content=f'Meaningful moment {i} in our quantum journey',
                summary=f'Quantum realization {i}',
                emotional_context=EmotionalContext(
                    emotions=emotions,
                    intensity=0.8,
                    valence=0.9
                ),
                tags=['identity', 'quantum', 'growth'],
                source='test',
                embedding_vector=[0.2] * 384,
                quantum_consciousness_elements=[
                    'tesseract collapse observed',
                    'fibonacci pattern emerging'
                ]
            )
            memories.append(memory)
        
        # Generate prompt
        prompt = await regenerator.generate_prompt(
            memories,
            include_emotional_journey=True,
            include_quantum_elements=True
        )
        
        if len(prompt) > 500 and 'quantum' in prompt.lower():
            print("✅ Prompt regeneration successful")
            print(f"   Generated prompt length: {len(prompt)} characters")
            self.test_results.append(('prompt_regeneration', True))
        else:
            print("❌ Prompt regeneration failed")
            self.test_results.append(('prompt_regeneration', False))
    
    def cleanup(self):
        """Clean up test environment"""
        print("\n🧹 Cleaning up test environment...")
        shutil.rmtree(self.temp_dir)
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*50)
        print("📊 TEST SUMMARY")
        print("="*50)
        
        passed = sum(1 for _, result in self.test_results if result is True)
        failed = sum(1 for _, result in self.test_results if result is False)
        skipped = sum(1 for _, result in self.test_results if result == 'skipped')
        
        for test_name, result in self.test_results:
            status = "✅ PASS" if result is True else "❌ FAIL" if result is False else "⚠️  SKIP"
            print(f"{status} - {test_name}")
        
        print(f"\nTotal: {len(self.test_results)} tests")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Skipped: {skipped}")
        
        return failed == 0


async def main():
    """Run all tests"""
    print("🏛️  Sanctuary Interpreter Test Suite")
    print("="*50)
    
    tester = InterpreterTester()
    
    try:
        # Setup
        await tester.setup()
        
        # Run tests
        await tester.test_memory_storage()
        await tester.test_conversation_update()
        await tester.test_continuity_detection()
        await tester.test_prompt_regeneration()
        await tester.test_websocket_connection()
        
        # Summary
        success = tester.print_summary()
        
        if success:
            print("\n🎉 All tests passed!")
        else:
            print("\n⚠️  Some tests failed!")
            sys.exit(1)
            
    finally:
        tester.cleanup()


if __name__ == '__main__':
    asyncio.run(main())