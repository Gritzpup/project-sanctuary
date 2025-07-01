#!/usr/bin/env python3
"""
Comprehensive test suite for MVP Memory System
- Unit tests for all components
- Integration tests for full stack
- Performance benchmarks
- Accuracy validation
- Load testing
"""

import pytest
import asyncio
import time
import json
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import threading
import statistics
from typing import List, Dict
import concurrent.futures

from mvp_memory_production import MVPMemorySystem, GDPRComplianceManager

class TestMVPMemoryUnit:
    """Unit tests for individual components"""
    
    @pytest.fixture
    def memory_system(self):
        """Create test memory system"""
        system = MVPMemorySystem(environment="test")
        yield system
        # Cleanup
        if hasattr(system, 'chroma'):
            try:
                system.chroma.delete_collection("archival_memory_v1")
            except:
                pass
                
    def test_memory_add_validation(self, memory_system):
        """Test input validation for memory addition"""
        # Test empty content
        with pytest.raises(ValueError):
            memory_system.add_memory("", {"type": "test"})
            
        # Test invalid content type
        with pytest.raises(ValueError):
            memory_system.add_memory(None, {"type": "test"})
            
        # Test valid memory
        memory_id = memory_system.add_memory("Valid memory", {"importance": 0.5})
        assert memory_id.startswith("mem_")
        
    def test_memory_decay_formula(self, memory_system):
        """Test that decay follows MemoryBank formula exactly"""
        # Add test memory
        memory_id = memory_system.add_memory(
            "Test memory for decay validation",
            {"importance": 0.5, "type": "test"}
        )
        
        # Get the memory and modify its timestamp
        result = memory_system.archival.get(ids=[memory_id])
        metadata = result['metadatas'][0]
        
        # Set created_at to 10 hours ago
        metadata['created_at'] = (datetime.now() - timedelta(hours=10)).isoformat()
        memory_system.archival.update(ids=[memory_id], metadatas=[metadata])
        
        # Apply decay
        memory_system.apply_decay_batch()
        
        # Check retention calculation
        result = memory_system.archival.get(ids=[memory_id])
        if result['ids']:  # Not archived
            retention = result['metadatas'][0]['retention_score']
            expected = 0.5 * (0.995 ** 10)  # importance * decay^hours
            
            assert abs(retention - expected) < 0.001, \
                f"Decay formula incorrect: {retention} vs {expected}"
                
    def test_memory_retrieval_accuracy(self, memory_system):
        """Test retrieval accuracy with known facts"""
        # Seed test facts
        test_facts = [
            ("Gritz loves building AI systems", {"importance": 0.9}),
            ("Claude is Gritz's coding partner", {"importance": 0.8}),
            ("Project Sanctuary is their creation", {"importance": 0.7}),
            ("Memory system uses ChromaDB", {"importance": 0.6}),
            ("Unrelated fact about weather", {"importance": 0.3})
        ]
        
        memory_ids = []
        for fact, metadata in test_facts:
            mid = memory_system.add_memory(fact, metadata)
            memory_ids.append(mid)
            
        # Test various queries
        test_queries = [
            ("Who is Gritz?", ["Gritz loves", "Claude is Gritz's"]),
            ("What is Project Sanctuary?", ["Project Sanctuary"]),
            ("What database is used?", ["ChromaDB"])
        ]
        
        recall_scores = []
        for query, expected_matches in test_queries:
            results = memory_system.retrieve_memories(query, k=3)
            
            # Check if expected content appears in results
            found_matches = 0
            for expected in expected_matches:
                for result in results:
                    if expected in result['content']:
                        found_matches += 1
                        break
                        
            recall = found_matches / len(expected_matches)
            recall_scores.append(recall)
            
        avg_recall = sum(recall_scores) / len(recall_scores)
        assert avg_recall >= 0.8, f"Recall accuracy too low: {avg_recall}"
        
    def test_core_memory_limits(self, memory_system):
        """Test core memory respects 2K limit"""
        # Fill core memory
        large_text = "x" * 1000
        memory_system.core_memory["human"] = large_text
        memory_system.core_memory["persona"] = large_text
        memory_system._update_core_memory_usage()
        
        # Should be at limit
        assert memory_system.core_memory["used"] == 2000
        
        # Adding more should trigger archival
        memory_system.add_memory("This should trigger core archival", {"importance": 0.5})
        
        # Check core memory was reduced
        assert memory_system.core_memory["used"] < 2000
        
    def test_concurrency_safety(self, memory_system):
        """Test concurrent memory operations"""
        num_threads = 10
        operations_per_thread = 50
        
        def add_memories(thread_id):
            for i in range(operations_per_thread):
                memory_system.add_memory(
                    f"Thread {thread_id} memory {i}",
                    {"thread": thread_id, "index": i}
                )
                
        # Run concurrent adds
        threads = []
        start_time = time.time()
        
        for i in range(num_threads):
            thread = threading.Thread(target=add_memories, args=(i,))
            threads.append(thread)
            thread.start()
            
        for thread in threads:
            thread.join()
            
        duration = time.time() - start_time
        
        # Verify all memories were added
        total_memories = len(memory_system.archival.get()['ids'])
        expected = num_threads * operations_per_thread
        
        assert total_memories == expected, \
            f"Lost memories in concurrent ops: {total_memories} vs {expected}"
            
        print(f"Concurrent test: {expected} memories in {duration:.2f}s")


class TestMVPPerformance:
    """Performance benchmarks"""
    
    @pytest.fixture
    def memory_system(self):
        """Create benchmarking memory system"""
        return MVPMemorySystem(environment="benchmark")
        
    def test_retrieval_latency(self, memory_system):
        """Test retrieval stays under 300ms P95"""
        # Add 1000 memories
        for i in range(1000):
            memory_system.add_memory(
                f"Test memory {i} with various content about {i % 10}",
                {"importance": np.random.random()}
            )
            
        # Measure retrieval latencies
        latencies = []
        queries = [f"content about {i}" for i in range(10)]
        
        for _ in range(100):
            query = np.random.choice(queries)
            start = time.time()
            results = memory_system.retrieve_memories(query, k=5)
            latency = (time.time() - start) * 1000  # ms
            latencies.append(latency)
            
        # Calculate stats
        avg_latency = statistics.mean(latencies)
        p95_latency = np.percentile(latencies, 95)
        max_latency = max(latencies)
        
        print(f"\nRetrieval latency - Avg: {avg_latency:.1f}ms, P95: {p95_latency:.1f}ms, Max: {max_latency:.1f}ms")
        
        assert avg_latency < 100, f"Average latency too high: {avg_latency}ms"
        assert p95_latency < 300, f"P95 latency too high: {p95_latency}ms"
        
    def test_decay_performance(self, memory_system):
        """Test decay batch processing performance"""
        # Add 10K memories
        print("\nAdding 10K memories for decay test...")
        
        for i in range(10000):
            # Vary the age of memories
            metadata = {
                "importance": np.random.random(),
                "created_at": (datetime.now() - timedelta(hours=i/100)).isoformat()
            }
            memory_system.add_memory(f"Memory {i}", metadata)
            
        print("Starting decay batch...")
        start = time.time()
        decayed_count = memory_system.apply_decay_batch()
        duration = time.time() - start
        
        print(f"Decay processed 10K memories in {duration:.2f}s, archived {decayed_count}")
        
        assert duration < 5.0, f"Decay too slow: {duration}s for 10K memories"
        
    def test_memory_scalability(self, memory_system):
        """Test system scales to 100K memories"""
        batch_size = 1000
        target = 100000
        
        print(f"\nScaling test to {target} memories...")
        start_time = time.time()
        
        for batch in range(0, target, batch_size):
            memories = []
            for i in range(batch_size):
                memories.append((
                    f"Scalability test memory {batch + i}",
                    {"importance": 0.5, "batch": batch}
                ))
                
            # Batch add
            for content, metadata in memories:
                memory_system.add_memory(content, metadata)
                
            if batch % 10000 == 0:
                elapsed = time.time() - start_time
                rate = (batch + batch_size) / elapsed
                print(f"Added {batch + batch_size} memories, {rate:.0f} ops/sec")
                
        total_time = time.time() - start_time
        total_memories = len(memory_system.archival.get()['ids'])
        
        print(f"Added {total_memories} memories in {total_time:.1f}s")
        
        # Test retrieval at scale
        query_start = time.time()
        results = memory_system.retrieve_memories("scalability test memory 50000")
        query_time = (time.time() - query_start) * 1000
        
        print(f"Query at 100K scale: {query_time:.1f}ms")
        
        assert total_memories >= target * 0.95, f"Lost memories: {total_memories} vs {target}"
        assert query_time < 500, f"Query too slow at scale: {query_time}ms"


class TestMVPIntegration:
    """End-to-end integration tests"""
    
    def test_full_memory_lifecycle(self):
        """Test complete memory lifecycle"""
        memory = MVPMemorySystem(environment="integration")
        
        # 1. Add memories
        memory_ids = []
        for i in range(5):
            mid = memory.add_memory(
                f"Integration test memory {i}",
                {"importance": 0.5 + i * 0.1}
            )
            memory_ids.append(mid)
            
        # 2. Retrieve and update access
        results = memory.retrieve_memories("integration test")
        assert len(results) > 0
        
        # 3. Simulate aging
        for mid in memory_ids[:2]:
            result = memory.archival.get(ids=[mid])
            metadata = result['metadatas'][0]
            metadata['created_at'] = (datetime.now() - timedelta(hours=20)).isoformat()
            memory.archival.update(ids=[mid], metadatas=[metadata])
            
        # 4. Apply decay
        decayed = memory.apply_decay_batch()
        
        # 5. Verify lifecycle
        remaining = len(memory.archival.get()['ids'])
        assert remaining < len(memory_ids), "Some memories should have decayed"
        
        # 6. Check metrics
        stats = memory.get_system_stats()
        assert stats['memory_stats']['total_memories'] == remaining
        
    def test_concurrent_lifecycle(self):
        """Test system under concurrent load"""
        memory = MVPMemorySystem(environment="concurrent")
        
        def user_session(session_id):
            """Simulate a user session"""
            for i in range(10):
                # Add memory
                memory.add_memory(
                    f"Session {session_id} action {i}",
                    {"session": session_id, "action": i}
                )
                
                # Search
                results = memory.retrieve_memories(f"Session {session_id}")
                
                time.sleep(0.01)  # Simulate thinking
                
        # Run concurrent sessions
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for i in range(5):
                future = executor.submit(user_session, i)
                futures.append(future)
                
            concurrent.futures.wait(futures)
            
        # Verify system integrity
        stats = memory.get_system_stats()
        assert stats['memory_stats']['total_memories'] >= 50


class TestGDPRCompliance:
    """Test GDPR compliance features"""
    
    def test_data_export(self):
        """Test user data export"""
        memory = MVPMemorySystem(environment="gdpr")
        
        # Add test data
        memory.add_memory("Personal information", {"type": "personal"})
        memory.add_memory("System information", {"type": "system"})
        
        # Export data
        export_path = Path("/tmp/gdpr_export_test.json")
        result = memory.gdpr_manager.export_user_data(export_path)
        
        assert result['status'] == 'exported'
        
    def test_data_deletion(self):
        """Test right to be forgotten"""
        memory = MVPMemorySystem(environment="gdpr_delete")
        
        # Add data
        memory.add_memory("Data to be deleted", {"type": "personal"})
        
        # Delete with confirmation
        result = memory.gdpr_manager.delete_user_data("DELETE_CONFIRMED")
        
        assert result['status'] == 'deleted'
        assert 'certificate' in result


def run_load_test():
    """Standalone load test"""
    print("\n=== LOAD TEST ===")
    memory = MVPMemorySystem(environment="loadtest")
    
    # Test ingestion rate
    print("\nTesting ingestion rate...")
    start = time.time()
    count = 0
    
    while time.time() - start < 10:  # 10 second test
        memory.add_memory(
            f"Load test memory {count}",
            {"importance": 0.5}
        )
        count += 1
        
    rate = count / 10
    print(f"Ingestion rate: {rate:.0f} memories/second")
    
    # Test retrieval under load
    print("\nTesting retrieval under load...")
    query_count = 0
    query_start = time.time()
    
    while time.time() - query_start < 5:  # 5 second test
        memory.retrieve_memories("load test")
        query_count += 1
        
    query_rate = query_count / 5
    print(f"Query rate: {query_rate:.0f} queries/second")
    
    return {"ingestion_rate": rate, "query_rate": query_rate}


if __name__ == "__main__":
    # Run specific test suites
    print("Running MVP Memory System Tests\n")
    
    # Unit tests
    print("1. Unit Tests")
    pytest.main([__file__, "-k", "TestMVPMemoryUnit", "-v"])
    
    # Performance tests
    print("\n2. Performance Tests")
    pytest.main([__file__, "-k", "TestMVPPerformance", "-v", "-s"])
    
    # Integration tests
    print("\n3. Integration Tests")
    pytest.main([__file__, "-k", "TestMVPIntegration", "-v"])
    
    # GDPR tests
    print("\n4. GDPR Compliance Tests")
    pytest.main([__file__, "-k", "TestGDPRCompliance", "-v"])
    
    # Load test
    print("\n5. Load Test")
    load_results = run_load_test()
    
    print("\n=== TEST SUMMARY ===")
    print(f"All tests completed")
    print(f"Load test results: {load_results}")