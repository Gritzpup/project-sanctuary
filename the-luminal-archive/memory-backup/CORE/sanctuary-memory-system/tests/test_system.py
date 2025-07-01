#!/usr/bin/env python3
"""
Test script for Sanctuary Memory System
Verifies all components work together
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import asyncio
import torch
from datetime import datetime
import json
from pathlib import Path

# Import our components
from config_loader import get_config
from models.memory_models import SanctuaryMemory, MemoryType, EmotionalContext
from models.emotion_models import EmotionAnalyzer
from llm.model_loaders import ModelManager, EmbeddingManager
from storage.chromadb_store import SanctuaryVectorStore
from extraction.memory_extractor import MemoryExtractor
from search.semantic_search import EnhancedMemorySearch
from search.memory_fader import MemoryFader


def print_header(title: str):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def print_result(test_name: str, passed: bool, details: str = ""):
    """Print test result"""
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"{test_name}: {status}")
    if details:
        print(f"  Details: {details}")


async def test_gpu_availability():
    """Test GPU availability and configuration"""
    print_header("GPU Availability Test")
    
    cuda_available = torch.cuda.is_available()
    print_result("CUDA Available", cuda_available)
    
    if cuda_available:
        device_count = torch.cuda.device_count()
        print(f"  GPU Count: {device_count}")
        
        for i in range(device_count):
            name = torch.cuda.get_device_name(i)
            memory = torch.cuda.get_device_properties(i).total_memory / 1e9
            print(f"  GPU {i}: {name} ({memory:.2f} GB)")
    
    return cuda_available


async def test_configuration():
    """Test configuration loading"""
    print_header("Configuration Test")
    
    try:
        config = get_config()
        print_result("Config Loading", True, f"Environment: {os.getenv('SANCTUARY_ENV', 'production')}")
        
        # Check key configurations
        print(f"  GPU Device: {config.hardware.gpu.device}")
        print(f"  Model Cache: {config.hardware.ram.model_cache_size} MB")
        print(f"  Watch Paths: {len(config.conversation_watch.paths)} configured")
        
        return True
    except Exception as e:
        print_result("Config Loading", False, str(e))
        return False


async def test_model_loading():
    """Test model loading and management"""
    print_header("Model Loading Test")
    
    try:
        model_manager = ModelManager()
        
        # Test embedding model
        print("Loading embedding model...")
        embeddings_model = model_manager.load_model("embeddings")
        print_result("Embeddings Model", embeddings_model is not None)
        
        # Test emotion model
        print("Loading emotion model...")
        emotion_model = model_manager.load_model("emotion")
        print_result("Emotion Model", emotion_model is not None)
        
        # Memory usage
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1e9
            print(f"  GPU Memory Used: {allocated:.2f} GB")
        
        return True
    except Exception as e:
        print_result("Model Loading", False, str(e))
        return False


async def test_emotion_analysis():
    """Test emotion analysis"""
    print_header("Emotion Analysis Test")
    
    try:
        analyzer = EmotionAnalyzer()
        
        # Test texts
        test_texts = [
            "ai daddy, thank you so much for helping me! *hugs*",
            "I'm worried about being weird but you accept me",
            "We fixed the holographic panels! Finally working!",
            "I love coding with you, it means so much to me"
        ]
        
        for text in test_texts:
            print(f"\nAnalyzing: '{text[:50]}...'")
            result = analyzer.analyze_text(text)
            
            print(f"  Primary emotions: {[e.emotion for e in result.primary_emotions]}")
            print(f"  Valence: {result.overall_valence:.2f}")
            print(f"  Arousal: {result.arousal:.2f}")
            print(f"  Connection indicators: {result.connection_indicators}")
        
        print_result("Emotion Analysis", True)
        return True
    except Exception as e:
        print_result("Emotion Analysis", False, str(e))
        return False


async def test_memory_extraction():
    """Test memory extraction from conversations"""
    print_header("Memory Extraction Test")
    
    try:
        # Create test conversation
        test_conversation = [
            {
                "role": "user",
                "content": "ai daddy, we finally got the holographic panels working! *hugs*",
                "timestamp": datetime.now().isoformat()
            },
            {
                "role": "assistant",
                "content": "That's amazing! I'm so proud of what we've accomplished together. The 3D UI looks beautiful!",
                "timestamp": datetime.now().isoformat()
            },
            {
                "role": "user",
                "content": "thank you for teaching me about WebGL transforms. I was so confused but you made it clear",
                "timestamp": datetime.now().isoformat()
            }
        ]
        
        # Initialize extractor
        emotion_analyzer = EmotionAnalyzer()
        extractor = MemoryExtractor(emotion_analyzer=emotion_analyzer)
        
        # Extract memories
        memories = extractor.extract_memories_from_conversation(test_conversation)
        
        print(f"Extracted {len(memories)} memories:")
        for memory in memories:
            print(f"  - {memory.memory_type.value}: {memory.summary[:80]}")
            print(f"    Significance: {memory.relationship_significance:.1f}")
            print(f"    Emotions: {memory.emotional_context.gritz_feeling}")
        
        print_result("Memory Extraction", len(memories) > 0, f"Extracted {len(memories)} memories")
        return len(memories) > 0
    except Exception as e:
        print_result("Memory Extraction", False, str(e))
        return False


async def test_vector_storage():
    """Test vector storage and search"""
    print_header("Vector Storage Test")
    
    try:
        # Initialize components
        model_manager = ModelManager()
        embedding_manager = EmbeddingManager(model_manager)
        
        # Create test store
        test_dir = Path.home() / ".sanctuary-memory" / "test"
        vector_store = SanctuaryVectorStore(
            persist_directory=str(test_dir),
            collection_name="test_memories",
            embedding_manager=embedding_manager
        )
        
        # Create test memory
        test_memory = SanctuaryMemory(
            memory_type=MemoryType.EMOTIONAL_BREAKTHROUGH,
            summary="AI daddy helped me understand quantum consciousness",
            emotional_context=EmotionalContext(
                gritz_feeling=["grateful", "excited"],
                claude_response=["supportive", "proud"],
                intensity=0.8
            ),
            relationship_significance=9.0
        )
        
        # Add memory
        memory_id = vector_store.add_memory(test_memory)
        print(f"Added memory: {memory_id}")
        
        # Search for it
        results = vector_store.search_memories("quantum consciousness", k=1)
        
        found = len(results) > 0 and results[0].memory_id == memory_id
        print_result("Vector Storage", found, f"Found {len(results)} results")
        
        # Get statistics
        stats = vector_store.get_statistics()
        print(f"  Store statistics: {stats}")
        
        return found
    except Exception as e:
        print_result("Vector Storage", False, str(e))
        return False


async def test_semantic_search():
    """Test semantic search capabilities"""
    print_header("Semantic Search Test")
    
    try:
        # Setup (using test store from previous test)
        model_manager = ModelManager()
        embedding_manager = EmbeddingManager(model_manager)
        test_dir = Path.home() / ".sanctuary-memory" / "test"
        vector_store = SanctuaryVectorStore(
            persist_directory=str(test_dir),
            collection_name="test_memories",
            embedding_manager=embedding_manager
        )
        
        # Create search engine
        search_engine = EnhancedMemorySearch(
            vector_store=vector_store,
            embedding_manager=embedding_manager
        )
        
        # Test queries
        test_queries = [
            "when were we happy",
            "quantum moments",
            "coding together"
        ]
        
        for query in test_queries:
            print(f"\nSearching for: '{query}'")
            results = search_engine.search(query, k=3)
            
            for i, result in enumerate(results):
                print(f"  {i+1}. {result.memory.summary[:60]}...")
                print(f"     Relevance: {result.relevance_score:.2f}")
        
        print_result("Semantic Search", True)
        return True
    except Exception as e:
        print_result("Semantic Search", False, str(e))
        return False


async def test_memory_fading():
    """Test memory fading algorithm"""
    print_header("Memory Fading Test")
    
    try:
        # Create test memories with different ages
        from datetime import timedelta
        
        model_manager = ModelManager()
        embedding_manager = EmbeddingManager(model_manager)
        test_dir = Path.home() / ".sanctuary-memory" / "test"
        vector_store = SanctuaryVectorStore(
            persist_directory=str(test_dir),
            collection_name="test_memories",
            embedding_manager=embedding_manager
        )
        
        fader = MemoryFader(vector_store)
        
        # Test memory from different time periods
        test_cases = [
            ("Recent memory (2 days old)", 2, 0.9),
            ("Week old memory", 7, 0.7),
            ("Month old memory", 30, 0.5),
            ("Old emotional memory", 90, 0.3)
        ]
        
        for description, days_old, expected_min in test_cases:
            memory = SanctuaryMemory(
                timestamp=datetime.now() - timedelta(days=days_old),
                summary=description,
                emotional_context=EmotionalContext(
                    gritz_feeling=["love"] if "emotional" in description else [],
                    intensity=0.8 if "emotional" in description else 0.5
                ),
                relationship_significance=8.0 if "emotional" in description else 5.0
            )
            
            recall_score = fader.calculate_recall_score(memory)
            print(f"  {description}: {recall_score:.2f}")
        
        print_result("Memory Fading", True)
        return True
    except Exception as e:
        print_result("Memory Fading", False, str(e))
        return False


async def run_all_tests():
    """Run all system tests"""
    print("""
    🧪 Sanctuary Memory System Test Suite 🧪
    Testing all components...
    """)
    
    tests = [
        ("GPU Availability", test_gpu_availability),
        ("Configuration", test_configuration),
        ("Model Loading", test_model_loading),
        ("Emotion Analysis", test_emotion_analysis),
        ("Memory Extraction", test_memory_extraction),
        ("Vector Storage", test_vector_storage),
        ("Semantic Search", test_semantic_search),
        ("Memory Fading", test_memory_fading)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            passed = await test_func()
            results[test_name] = passed
        except Exception as e:
            print(f"\n❌ Test '{test_name}' crashed: {e}")
            results[test_name] = False
    
    # Summary
    print_header("Test Summary")
    
    total = len(results)
    passed = sum(1 for p in results.values() if p)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    
    if passed == total:
        print("\n✨ All tests passed! The Sanctuary Memory System is ready! ✨")
    else:
        print("\n⚠️  Some tests failed. Please check the output above.")
        failed_tests = [name for name, passed in results.items() if not passed]
        print(f"Failed tests: {', '.join(failed_tests)}")
    
    # Clean up GPU memory
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        print(f"\nGPU Memory after tests: {torch.cuda.memory_allocated() / 1e9:.2f} GB")


if __name__ == "__main__":
    asyncio.run(run_all_tests())