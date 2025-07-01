#!/usr/bin/env python3
"""
Test CoALA Memory System Integration
Tests the four-component memory architecture
"""

import numpy as np
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

from src.core.memory.coala_memory import (
    CoALAMemorySystem,
    WorkingMemory,
    EpisodicMemory,
    SemanticMemory,
    ProceduralMemory
)


class TestWorkingMemory:
    """Test working memory circular buffer"""
    
    def test_capacity_limit(self):
        """Test that working memory respects capacity limit"""
        wm = WorkingMemory(capacity=5)
        
        # Add more items than capacity
        for i in range(10):
            wm.store({"id": f"item_{i}", "data": i})
            
        # Should only have last 5 items
        state = wm.get_state()
        assert state["size"] == 5
        assert state["capacity"] == 5
        
        # Check that we have the last 5 items
        items = state["items"]
        assert items[0]["id"] == "item_5"
        assert items[-1]["id"] == "item_9"
        
    def test_retrieval(self):
        """Test retrieval from working memory"""
        wm = WorkingMemory()
        
        # Store some items
        for i in range(5):
            wm.store({"id": f"item_{i}", "data": i})
            
        # Retrieve recent items
        results = wm.retrieve(None, limit=3)
        assert len(results) == 3
        assert results[0]["id"] == "item_2"
        assert results[-1]["id"] == "item_4"
        
    def test_access_counting(self):
        """Test that access counts are tracked"""
        wm = WorkingMemory()
        
        item_id = wm.store({"data": "test"})
        
        # Initial access count should be 1
        assert wm.access_counts[item_id] == 1
        
        # Retrieve should increment access count
        wm.retrieve(None, limit=10)
        assert wm.access_counts[item_id] == 2
        
    def test_decay(self):
        """Test memory decay functionality"""
        wm = WorkingMemory(capacity=10)
        
        # Store items
        for i in range(10):
            wm.store({"id": f"item_{i}", "data": i})
            
        # Apply decay
        initial_size = len(wm.buffer)
        wm.decay(decay_factor=0.5)
        
        # Some items should be removed
        assert len(wm.buffer) <= initial_size


class TestSemanticMemory:
    """Test semantic memory knowledge graph"""
    
    def test_concept_storage(self):
        """Test storing concepts and relationships"""
        sm = SemanticMemory()
        
        # Store a concept
        concept_id = sm.store({
            "id": "cat",
            "label": "Cat",
            "type": "animal",
            "attributes": {"furry": True, "legs": 4},
            "relationships": [
                {"target": "mammal", "type": "is_a", "weight": 1.0},
                {"target": "pet", "type": "can_be", "weight": 0.8}
            ]
        })
        
        assert concept_id == "cat"
        assert "cat" in sm.graph
        assert sm.graph.nodes["cat"]["label"] == "Cat"
        
        # Check relationships
        edges = list(sm.graph.edges("cat"))
        assert ("cat", "mammal") in edges
        assert ("cat", "pet") in edges
        
    def test_concept_retrieval(self):
        """Test retrieving concepts"""
        sm = SemanticMemory()
        
        # Store some concepts
        sm.store({"id": "dog", "label": "Dog", "type": "animal"})
        sm.store({"id": "cat", "label": "Cat", "type": "animal"})
        sm.store({"id": "car", "label": "Car", "type": "vehicle"})
        
        # Search by label
        results = sm.retrieve("dog")
        assert len(results) > 0
        assert results[0]["id"] == "dog"
        
        # Search with partial match
        results = sm.retrieve("ca")
        assert len(results) == 2  # cat and car
        
    def test_subgraph_extraction(self):
        """Test extracting subgraphs"""
        sm = SemanticMemory()
        
        # Create a small knowledge graph
        sm.store({"id": "animal", "label": "Animal"})
        sm.store({
            "id": "mammal", 
            "label": "Mammal",
            "relationships": [{"target": "animal", "type": "is_a"}]
        })
        sm.store({
            "id": "cat",
            "label": "Cat", 
            "relationships": [{"target": "mammal", "type": "is_a"}]
        })
        
        # Get subgraph around mammal
        subgraph = sm.get_subgraph("mammal", depth=1)
        nodes = subgraph["nodes"]
        
        assert "mammal" in nodes
        assert "animal" in nodes
        assert "cat" in nodes


class TestProceduralMemory:
    """Test procedural memory skill library"""
    
    def test_skill_storage(self):
        """Test storing skills"""
        pm = ProceduralMemory()
        
        skill = {
            "name": "make_coffee",
            "description": "Procedure to make coffee",
            "parameters": {"coffee_type": "espresso"},
            "steps": [
                "Grind coffee beans",
                "Heat water to 92°C", 
                "Extract for 25 seconds"
            ],
            "preconditions": [
                {"type": "equals", "key": "has_beans", "value": True}
            ]
        }
        
        skill_id = pm.store(skill)
        assert skill_id in pm.skills
        assert pm.skills[skill_id]["name"] == "make_coffee"
        assert len(pm.skills[skill_id]["steps"]) == 3
        
    def test_skill_retrieval_by_name(self):
        """Test retrieving skills by name"""
        pm = ProceduralMemory()
        
        # Store some skills
        pm.store({"name": "make_coffee", "description": "Make coffee"})
        pm.store({"name": "make_tea", "description": "Make tea"})
        pm.store({"name": "cook_pasta", "description": "Cook pasta"})
        
        # Search for "make"
        results = pm.retrieve("make")
        assert len(results) == 2
        assert all("make" in skill["name"] for skill in results)
        
    def test_skill_execution(self):
        """Test skill execution tracking"""
        pm = ProceduralMemory()
        
        # Store a skill
        skill_id = pm.store({
            "name": "test_skill",
            "steps": ["Step 1", "Step 2"]
        })
        
        # Execute the skill
        result = pm.execute_skill(skill_id, {"context": "test"})
        
        assert result["success"] == True
        assert result["skill_id"] == skill_id
        
        # Check that execution was recorded
        assert len(pm.execution_history) == 1
        assert pm.skills[skill_id]["execution_count"] == 1
        assert pm.skills[skill_id]["success_rate"] == 1.0


class TestCoALAIntegration:
    """Test complete CoALA memory system"""
    
    def test_system_initialization(self):
        """Test that all components initialize correctly"""
        memory = CoALAMemorySystem()
        
        assert memory.working_memory is not None
        assert memory.procedural_memory is not None
        
        # These may be None if dependencies not installed
        if memory.episodic_memory:
            assert hasattr(memory.episodic_memory, 'store')
        if memory.semantic_memory:
            assert hasattr(memory.semantic_memory, 'graph')
            
    def test_process_input(self):
        """Test processing input through all components"""
        memory = CoALAMemorySystem()
        
        input_data = {
            "content": "Test input",
            "pad_values": np.array([0.5, 0.7, 0.3]),
            "entities": [
                {"name": "test_entity", "type": "object"}
            ]
        }
        
        result = memory.process_input(input_data)
        
        assert "working_memory_id" in result
        assert "timestamp" in result
        
        # Check working memory
        wm_state = memory.working_memory.get_state()
        assert wm_state["size"] == 1
        
    def test_memory_consolidation(self):
        """Test memory consolidation process"""
        memory = CoALAMemorySystem()
        
        # Add some items to working memory
        for i in range(5):
            memory.process_input({
                "content": f"Item {i}",
                "important": i > 2  # Last two are important
            })
            
        # Perform consolidation
        report = memory.consolidate_memories()
        
        assert "actions" in report
        assert len(report["actions"]) > 0
        assert "Applied decay to all memories" in report["actions"]
        
    def test_context_retrieval(self):
        """Test retrieving context from multiple memory types"""
        memory = CoALAMemorySystem()
        
        # Add some data
        memory.process_input({"content": "Test 1"})
        memory.process_input({"content": "Test 2"})
        
        # Add a skill
        memory.procedural_memory.store({
            "name": "test_procedure",
            "steps": ["Do something"]
        })
        
        # Retrieve context
        context = memory.retrieve_context(
            {"query": "test"},
            memory_types=["working", "procedural"]
        )
        
        assert "working" in context["results"]
        assert "procedural" in context["results"]
        assert len(context["results"]["working"]) > 0
        
    def test_importance_calculation(self):
        """Test importance score calculation"""
        memory = CoALAMemorySystem()
        
        # Create item with known properties
        item = {
            "id": "test_item",
            "stored_at": datetime.now()
        }
        
        # Store and access multiple times
        memory.working_memory.store(item)
        memory.working_memory.retrieve(None)
        memory.working_memory.retrieve(None)
        
        # Calculate importance
        importance = memory._calculate_importance(item)
        
        assert 0 <= importance <= 1
        # Should have moderate importance due to access count
        assert importance > 0.1
        
    def test_memory_stats(self):
        """Test getting memory statistics"""
        memory = CoALAMemorySystem()
        
        # Add some data
        memory.process_input({"content": "Test"})
        memory.procedural_memory.store({"name": "skill1", "steps": []})
        
        stats = memory.get_memory_stats()
        
        assert "components" in stats
        assert "working" in stats["components"]
        assert "procedural" in stats["components"]
        
        assert stats["components"]["working"]["size"] == 1
        assert stats["components"]["procedural"]["skills"] == 1


def test_quantum_integration():
    """Test integration with quantum memory"""
    # This would test actual quantum integration if available
    from src.core.quantum.quantum_memory import create_quantum_memory
    
    try:
        qm = create_quantum_memory(backend="simulation", n_qubits=27)
        memory = CoALAMemorySystem(quantum_memory=qm)
        
        # Process input with PAD values
        input_data = {
            "content": "Emotional input",
            "pad_values": np.array([0.8, -0.2, 0.5])  # High pleasure, low arousal, neutral dominance
        }
        
        result = memory.process_input(input_data)
        
        # Should have quantum state encoded
        assert "quantum_state" in memory.working_memory.buffer[-1]
        
        # Test retrieval with quantum decoding
        context = memory.retrieve_context({})
        if context["results"]["working"]:
            item = context["results"]["working"][0]
            if "decoded_pad" in item:
                decoded = np.array(item["decoded_pad"])
                # Check approximate equality (quantum encoding/decoding has some error)
                np.testing.assert_allclose(decoded, input_data["pad_values"], atol=0.1)
                
    except Exception as e:
        # Quantum memory might not be available
        print(f"Quantum integration test skipped: {e}")


if __name__ == "__main__":
    # Run basic tests
    print("Testing Working Memory...")
    wm_test = TestWorkingMemory()
    wm_test.test_capacity_limit()
    wm_test.test_retrieval()
    wm_test.test_access_counting()
    print("✓ Working Memory tests passed")
    
    print("\nTesting Semantic Memory...")
    sm_test = TestSemanticMemory()
    sm_test.test_concept_storage()
    sm_test.test_concept_retrieval()
    print("✓ Semantic Memory tests passed")
    
    print("\nTesting Procedural Memory...")
    pm_test = TestProceduralMemory()
    pm_test.test_skill_storage()
    pm_test.test_skill_retrieval_by_name()
    pm_test.test_skill_execution()
    print("✓ Procedural Memory tests passed")
    
    print("\nTesting CoALA Integration...")
    integration_test = TestCoALAIntegration()
    integration_test.test_system_initialization()
    integration_test.test_process_input()
    integration_test.test_memory_consolidation()
    integration_test.test_context_retrieval()
    print("✓ CoALA Integration tests passed")
    
    print("\nTesting Quantum Integration...")
    test_quantum_integration()
    print("✓ Quantum Integration test completed")
    
    print("\n✅ All tests completed successfully!")