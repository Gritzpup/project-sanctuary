"""
CoALA (Cognitive Architecture for Language Agents) Memory System
Implements four-component memory architecture with quantum integration
"""

from typing import Dict, List, Any, Optional, Tuple
from collections import deque
from datetime import datetime
import numpy as np
import logging
import json
from abc import ABC, abstractmethod

# Optional imports
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False

logger = logging.getLogger(__name__)


class MemoryComponent(ABC):
    """Abstract base class for memory components"""
    
    @abstractmethod
    def store(self, item: Dict[str, Any]) -> str:
        """Store an item in memory"""
        pass
    
    @abstractmethod
    def retrieve(self, query: Any, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve items from memory"""
        pass
    
    @abstractmethod
    def update(self, item_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing item"""
        pass
    
    @abstractmethod
    def decay(self, decay_factor: float = 0.95) -> None:
        """Apply decay to memory items"""
        pass


class WorkingMemory(MemoryComponent):
    """Circular buffer for immediate context (size=128)"""
    
    def __init__(self, capacity: int = 128):
        self.capacity = capacity
        self.buffer = deque(maxlen=capacity)
        self.access_counts = {}
        self.last_access = {}
        
    def store(self, item: Dict[str, Any]) -> str:
        """Add item to working memory"""
        item_id = item.get("id", str(datetime.now().timestamp()))
        item["stored_at"] = datetime.now()
        item["id"] = item_id
        
        self.buffer.append(item)
        self.access_counts[item_id] = 1
        self.last_access[item_id] = datetime.now()
        
        logger.debug(f"Stored item {item_id} in working memory")
        return item_id
    
    def retrieve(self, query: Any, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve most recent/relevant items"""
        # Simple implementation: return most recent items
        # In practice, could use query for filtering
        results = list(self.buffer)[-limit:]
        
        # Update access counts
        for item in results:
            item_id = item["id"]
            self.access_counts[item_id] = self.access_counts.get(item_id, 0) + 1
            self.last_access[item_id] = datetime.now()
            
        return results
    
    def update(self, item_id: str, updates: Dict[str, Any]) -> bool:
        """Update item in working memory"""
        for i, item in enumerate(self.buffer):
            if item.get("id") == item_id:
                self.buffer[i].update(updates)
                return True
        return False
    
    def decay(self, decay_factor: float = 0.95) -> None:
        """Remove least accessed items"""
        # Calculate importance scores
        current_time = datetime.now()
        importance_scores = {}
        
        for item in self.buffer:
            item_id = item["id"]
            access_count = self.access_counts.get(item_id, 1)
            time_since_access = (current_time - self.last_access.get(item_id, current_time)).total_seconds()
            
            # Importance = access_count * exp(-time_decay)
            importance = access_count * np.exp(-time_since_access / 3600)  # 1 hour decay
            importance_scores[item_id] = importance
        
        # Remove items with lowest importance if at capacity
        if len(self.buffer) >= self.capacity:
            sorted_items = sorted(importance_scores.items(), key=lambda x: x[1])
            to_remove = sorted_items[:len(self.buffer) // 10]  # Remove bottom 10%
            
            for item_id, _ in to_remove:
                self.buffer = deque([item for item in self.buffer if item.get("id") != item_id], 
                                   maxlen=self.capacity)
                
    def get_state(self) -> Dict[str, Any]:
        """Get current state of working memory"""
        return {
            "size": len(self.buffer),
            "capacity": self.capacity,
            "items": list(self.buffer),
            "access_counts": self.access_counts,
            "utilization": len(self.buffer) / self.capacity
        }


class EpisodicMemory(MemoryComponent):
    """Vector database for experience storage (ChromaDB)"""
    
    def __init__(self, collection_name: str = "episodic_memory", dim: int = 768):
        if not CHROMADB_AVAILABLE:
            raise ImportError("ChromaDB not available. Install with: pip install chromadb")
            
        self.dim = dim
        self.client = chromadb.Client(Settings(anonymized_telemetry=False))
        self.collection = self.client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
    def store(self, item: Dict[str, Any]) -> str:
        """Store episode with embedding"""
        item_id = item.get("id", str(datetime.now().timestamp()))
        
        # Extract or generate embedding
        embedding = item.get("embedding")
        if embedding is None:
            # Generate random embedding for demo (in practice, use actual embeddings)
            embedding = np.random.randn(self.dim).tolist()
            
        metadata = {
            "timestamp": str(item.get("timestamp", datetime.now())),
            "type": item.get("type", "episode"),
            "importance": float(item.get("importance", 0.5))
        }
        
        # Store text content if available
        document = item.get("content", json.dumps(item))
        
        self.collection.add(
            embeddings=[embedding],
            documents=[document],
            metadatas=[metadata],
            ids=[item_id]
        )
        
        logger.debug(f"Stored episode {item_id} in episodic memory")
        return item_id
    
    def retrieve(self, query: Any, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve similar episodes"""
        if isinstance(query, dict) and "embedding" in query:
            query_embedding = query["embedding"]
        else:
            # Generate random query embedding for demo
            query_embedding = np.random.randn(self.dim).tolist()
            
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=limit
        )
        
        episodes = []
        for i in range(len(results["ids"][0])):
            episode = {
                "id": results["ids"][0][i],
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i] if "distances" in results else None
            }
            episodes.append(episode)
            
        return episodes
    
    def update(self, item_id: str, updates: Dict[str, Any]) -> bool:
        """Update episode metadata"""
        try:
            # Get existing item
            existing = self.collection.get(ids=[item_id])
            if not existing["ids"]:
                return False
                
            # Update metadata
            metadata = existing["metadatas"][0]
            metadata.update(updates.get("metadata", {}))
            
            # Update in collection
            self.collection.update(
                ids=[item_id],
                metadatas=[metadata]
            )
            return True
        except Exception as e:
            logger.error(f"Failed to update episode {item_id}: {e}")
            return False
    
    def decay(self, decay_factor: float = 0.95) -> None:
        """Apply temporal decay to importance scores"""
        # Get all items
        all_items = self.collection.get()
        
        for i, item_id in enumerate(all_items["ids"]):
            metadata = all_items["metadatas"][i]
            
            # Apply decay to importance
            current_importance = float(metadata.get("importance", 0.5))
            new_importance = current_importance * decay_factor
            
            # Update metadata
            metadata["importance"] = new_importance
            self.collection.update(
                ids=[item_id],
                metadatas=[metadata]
            )


class SemanticMemory(MemoryComponent):
    """Knowledge graph for conceptual relationships"""
    
    def __init__(self):
        if not NETWORKX_AVAILABLE:
            raise ImportError("NetworkX not available. Install with: pip install networkx")
            
        self.graph = nx.DiGraph()
        self.concept_embeddings = {}
        
    def store(self, item: Dict[str, Any]) -> str:
        """Store concept and relationships"""
        concept_id = item.get("id", str(datetime.now().timestamp()))
        
        # Add node
        self.graph.add_node(
            concept_id,
            label=item.get("label", concept_id),
            type=item.get("type", "concept"),
            attributes=item.get("attributes", {}),
            created_at=datetime.now()
        )
        
        # Add relationships
        for rel in item.get("relationships", []):
            target = rel.get("target")
            rel_type = rel.get("type", "related_to")
            weight = rel.get("weight", 1.0)
            
            if target:
                self.graph.add_edge(concept_id, target, 
                                   type=rel_type, weight=weight)
        
        # Store embedding if provided
        if "embedding" in item:
            self.concept_embeddings[concept_id] = item["embedding"]
            
        logger.debug(f"Stored concept {concept_id} in semantic memory")
        return concept_id
    
    def retrieve(self, query: Any, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve related concepts"""
        if isinstance(query, str):
            # Find concepts by label similarity
            results = []
            for node_id, data in self.graph.nodes(data=True):
                if query.lower() in data.get("label", "").lower():
                    results.append({
                        "id": node_id,
                        "data": data,
                        "neighbors": list(self.graph.neighbors(node_id))
                    })
            return results[:limit]
            
        elif isinstance(query, dict):
            # Find by embedding similarity if available
            if "embedding" in query and self.concept_embeddings:
                query_emb = np.array(query["embedding"])
                similarities = []
                
                for concept_id, emb in self.concept_embeddings.items():
                    similarity = np.dot(query_emb, np.array(emb))
                    similarities.append((concept_id, similarity))
                    
                # Sort by similarity
                similarities.sort(key=lambda x: x[1], reverse=True)
                
                results = []
                for concept_id, sim in similarities[:limit]:
                    data = self.graph.nodes[concept_id]
                    results.append({
                        "id": concept_id,
                        "data": data,
                        "similarity": sim,
                        "neighbors": list(self.graph.neighbors(concept_id))
                    })
                return results
                
        return []
    
    def update(self, item_id: str, updates: Dict[str, Any]) -> bool:
        """Update concept attributes"""
        if item_id not in self.graph:
            return False
            
        # Update node attributes
        for key, value in updates.items():
            self.graph.nodes[item_id][key] = value
            
        return True
    
    def decay(self, decay_factor: float = 0.95) -> None:
        """Decay edge weights"""
        for u, v, data in self.graph.edges(data=True):
            current_weight = data.get("weight", 1.0)
            new_weight = current_weight * decay_factor
            self.graph[u][v]["weight"] = new_weight
            
            # Remove very weak edges
            if new_weight < 0.01:
                self.graph.remove_edge(u, v)
    
    def get_subgraph(self, node_id: str, depth: int = 2) -> Dict[str, Any]:
        """Get subgraph around a concept"""
        if node_id not in self.graph:
            return {}
            
        # Get nodes within depth
        subgraph_nodes = {node_id}
        current_layer = {node_id}
        
        for _ in range(depth):
            next_layer = set()
            for node in current_layer:
                next_layer.update(self.graph.successors(node))
                next_layer.update(self.graph.predecessors(node))
            subgraph_nodes.update(next_layer)
            current_layer = next_layer
            
        # Create subgraph
        subgraph = self.graph.subgraph(subgraph_nodes)
        
        return {
            "nodes": dict(subgraph.nodes(data=True)),
            "edges": [(u, v, d) for u, v, d in subgraph.edges(data=True)]
        }


class ProceduralMemory(MemoryComponent):
    """Skill library for learned procedures"""
    
    def __init__(self):
        self.skills = {}
        self.execution_history = []
        
    def store(self, item: Dict[str, Any]) -> str:
        """Store a learned skill/procedure"""
        skill_id = item.get("id", str(datetime.now().timestamp()))
        
        skill = {
            "id": skill_id,
            "name": item.get("name", f"skill_{skill_id}"),
            "description": item.get("description", ""),
            "parameters": item.get("parameters", {}),
            "steps": item.get("steps", []),
            "preconditions": item.get("preconditions", []),
            "postconditions": item.get("postconditions", []),
            "success_rate": 0.0,
            "execution_count": 0,
            "created_at": datetime.now()
        }
        
        self.skills[skill_id] = skill
        logger.debug(f"Stored skill {skill_id} in procedural memory")
        return skill_id
    
    def retrieve(self, query: Any, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve applicable skills"""
        if isinstance(query, str):
            # Search by name/description
            results = []
            for skill_id, skill in self.skills.items():
                if (query.lower() in skill["name"].lower() or 
                    query.lower() in skill["description"].lower()):
                    results.append(skill)
                    
            # Sort by success rate
            results.sort(key=lambda x: x["success_rate"], reverse=True)
            return results[:limit]
            
        elif isinstance(query, dict):
            # Find skills matching preconditions
            context = query.get("context", {})
            results = []
            
            for skill_id, skill in self.skills.items():
                # Check if all preconditions are met
                preconditions_met = True
                for condition in skill["preconditions"]:
                    if not self._check_condition(condition, context):
                        preconditions_met = False
                        break
                        
                if preconditions_met:
                    results.append(skill)
                    
            # Sort by success rate and execution count
            results.sort(key=lambda x: (x["success_rate"], x["execution_count"]), 
                        reverse=True)
            return results[:limit]
            
        return []
    
    def update(self, item_id: str, updates: Dict[str, Any]) -> bool:
        """Update skill information"""
        if item_id not in self.skills:
            return False
            
        self.skills[item_id].update(updates)
        return True
    
    def decay(self, decay_factor: float = 0.95) -> None:
        """Decay success rates for unused skills"""
        current_time = datetime.now()
        
        for skill_id, skill in self.skills.items():
            # Find last execution
            last_execution = None
            for execution in reversed(self.execution_history):
                if execution["skill_id"] == skill_id:
                    last_execution = execution["timestamp"]
                    break
                    
            if last_execution:
                time_since_use = (current_time - last_execution).total_seconds() / 86400  # Days
                if time_since_use > 7:  # If not used in a week
                    skill["success_rate"] *= decay_factor
    
    def execute_skill(self, skill_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a skill and record outcome"""
        if skill_id not in self.skills:
            return {"success": False, "error": "Skill not found"}
            
        skill = self.skills[skill_id]
        
        # Record execution
        execution = {
            "skill_id": skill_id,
            "timestamp": datetime.now(),
            "context": context,
            "success": False,
            "result": None
        }
        
        # Execute steps (simplified)
        try:
            result = {"outputs": {}}
            for step in skill["steps"]:
                # In practice, this would execute actual operations
                logger.debug(f"Executing step: {step}")
                
            execution["success"] = True
            execution["result"] = result
            
            # Update skill statistics
            skill["execution_count"] += 1
            skill["success_rate"] = (skill["success_rate"] * (skill["execution_count"] - 1) + 1.0) / skill["execution_count"]
            
        except Exception as e:
            execution["error"] = str(e)
            skill["execution_count"] += 1
            skill["success_rate"] = (skill["success_rate"] * (skill["execution_count"] - 1)) / skill["execution_count"]
            
        self.execution_history.append(execution)
        return execution
    
    def _check_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if a condition is satisfied"""
        # Simplified condition checking
        cond_type = condition.get("type", "equals")
        key = condition.get("key")
        value = condition.get("value")
        
        if key not in context:
            return False
            
        if cond_type == "equals":
            return context[key] == value
        elif cond_type == "greater_than":
            return context[key] > value
        elif cond_type == "less_than":
            return context[key] < value
        elif cond_type == "contains":
            return value in context[key]
            
        return False


class CoALAMemorySystem:
    """
    Complete CoALA memory system with four components
    Integrates with quantum memory for emotional state encoding
    """
    
    def __init__(self, quantum_memory=None):
        self.working_memory = WorkingMemory(capacity=128)
        self.episodic_memory = EpisodicMemory() if CHROMADB_AVAILABLE else None
        self.semantic_memory = SemanticMemory() if NETWORKX_AVAILABLE else None
        self.procedural_memory = ProceduralMemory()
        self.quantum_memory = quantum_memory
        
        # Consolidation parameters
        self.lambda_relevance = 0.7
        self.lambda_temporal = 0.3
        
        logger.info("Initialized CoALA memory system with four components")
        
    def process_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input through all memory components"""
        results = {
            "timestamp": datetime.now(),
            "input": input_data
        }
        
        # 1. Store in working memory
        working_id = self.working_memory.store(input_data)
        results["working_memory_id"] = working_id
        
        # 2. Extract emotional state if quantum memory available
        if self.quantum_memory and "pad_values" in input_data:
            quantum_state = self.quantum_memory.encode_emotional_state(
                input_data["pad_values"]
            )
            input_data["quantum_state"] = quantum_state.tolist()
            
        # 3. Check for episodic relevance
        if self.episodic_memory and self._should_store_episode(input_data):
            episode_id = self.episodic_memory.store(input_data)
            results["episode_id"] = episode_id
            
        # 4. Extract concepts for semantic memory
        if self.semantic_memory:
            concepts = self._extract_concepts(input_data)
            for concept in concepts:
                self.semantic_memory.store(concept)
            results["concepts_extracted"] = len(concepts)
            
        # 5. Check for procedural learning
        if self._should_learn_procedure(input_data):
            skill = self._extract_skill(input_data)
            if skill:
                skill_id = self.procedural_memory.store(skill)
                results["skill_learned"] = skill_id
                
        return results
    
    def retrieve_context(self, query: Dict[str, Any], 
                        memory_types: List[str] = None) -> Dict[str, Any]:
        """Retrieve relevant context from specified memory types"""
        if memory_types is None:
            memory_types = ["working", "episodic", "semantic", "procedural"]
            
        context = {
            "query": query,
            "timestamp": datetime.now(),
            "results": {}
        }
        
        # Retrieve from each memory type
        if "working" in memory_types:
            context["results"]["working"] = self.working_memory.retrieve(query)
            
        if "episodic" in memory_types and self.episodic_memory:
            context["results"]["episodic"] = self.episodic_memory.retrieve(query)
            
        if "semantic" in memory_types and self.semantic_memory:
            context["results"]["semantic"] = self.semantic_memory.retrieve(query)
            
        if "procedural" in memory_types:
            context["results"]["procedural"] = self.procedural_memory.retrieve(query)
            
        # Decode quantum states if present
        if self.quantum_memory:
            for memory_type, results in context["results"].items():
                for item in results:
                    if "quantum_state" in item:
                        pad_values = self.quantum_memory.decode_emotional_state(
                            np.array(item["quantum_state"])
                        )
                        item["decoded_pad"] = pad_values.tolist()
                        
        return context
    
    def consolidate_memories(self) -> Dict[str, Any]:
        """Perform memory consolidation across all components"""
        consolidation_report = {
            "timestamp": datetime.now(),
            "actions": []
        }
        
        # 1. Apply decay
        self.working_memory.decay()
        if self.episodic_memory:
            self.episodic_memory.decay()
        if self.semantic_memory:
            self.semantic_memory.decay()
        self.procedural_memory.decay()
        consolidation_report["actions"].append("Applied decay to all memories")
        
        # 2. Transfer important items from working to episodic
        if self.episodic_memory:
            working_state = self.working_memory.get_state()
            for item in working_state["items"]:
                importance = self._calculate_importance(item)
                if importance > 0.7:  # Threshold for episodic storage
                    item["importance"] = importance
                    self.episodic_memory.store(item)
                    consolidation_report["actions"].append(
                        f"Transferred item {item['id']} to episodic memory"
                    )
                    
        # 3. Update semantic relationships based on co-occurrence
        if self.semantic_memory:
            self._update_semantic_relationships()
            consolidation_report["actions"].append("Updated semantic relationships")
            
        # 4. Consolidate procedural knowledge
        self._consolidate_procedures()
        consolidation_report["actions"].append("Consolidated procedural knowledge")
        
        return consolidation_report
    
    def _calculate_importance(self, item: Dict[str, Any]) -> float:
        """Calculate importance score for memory consolidation"""
        # Relevance score (based on access count)
        access_count = self.working_memory.access_counts.get(item["id"], 1)
        relevance = min(access_count / 10.0, 1.0)  # Normalize to [0, 1]
        
        # Temporal score (based on recency)
        if "stored_at" in item:
            age_seconds = (datetime.now() - item["stored_at"]).total_seconds()
            recency = np.exp(-age_seconds / 3600)  # 1 hour decay
        else:
            recency = 0.5
            
        # Combined importance
        importance = (self.lambda_relevance * relevance + 
                     self.lambda_temporal * recency)
        
        return importance
    
    def _should_store_episode(self, input_data: Dict[str, Any]) -> bool:
        """Determine if input should be stored as episode"""
        # Store if has high emotional intensity
        if "pad_values" in input_data:
            pad = input_data["pad_values"]
            intensity = np.linalg.norm(pad)
            return intensity > 0.5
            
        # Store if marked as important
        return input_data.get("important", False)
    
    def _extract_concepts(self, input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract semantic concepts from input"""
        concepts = []
        
        # Simplified concept extraction
        if "entities" in input_data:
            for entity in input_data["entities"]:
                concept = {
                    "id": entity.get("id", entity["name"]),
                    "label": entity["name"],
                    "type": entity.get("type", "entity"),
                    "attributes": entity.get("attributes", {}),
                    "relationships": entity.get("relationships", [])
                }
                concepts.append(concept)
                
        return concepts
    
    def _should_learn_procedure(self, input_data: Dict[str, Any]) -> bool:
        """Determine if input contains learnable procedure"""
        return input_data.get("type") == "procedure" or "steps" in input_data
    
    def _extract_skill(self, input_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract skill definition from input"""
        if "steps" not in input_data:
            return None
            
        skill = {
            "name": input_data.get("name", "unnamed_skill"),
            "description": input_data.get("description", ""),
            "parameters": input_data.get("parameters", {}),
            "steps": input_data["steps"],
            "preconditions": input_data.get("preconditions", []),
            "postconditions": input_data.get("postconditions", [])
        }
        
        return skill
    
    def _update_semantic_relationships(self) -> None:
        """Update relationships based on co-occurrence in working memory"""
        if not self.semantic_memory:
            return
            
        # Analyze co-occurring concepts in working memory
        working_items = self.working_memory.get_state()["items"]
        concept_pairs = []
        
        for i in range(len(working_items) - 1):
            item1 = working_items[i]
            item2 = working_items[i + 1]
            
            # Extract concept IDs
            concepts1 = item1.get("concepts", [])
            concepts2 = item2.get("concepts", [])
            
            for c1 in concepts1:
                for c2 in concepts2:
                    concept_pairs.append((c1, c2))
                    
        # Update graph edges
        for c1, c2 in concept_pairs:
            if (self.semantic_memory.graph.has_node(c1) and 
                self.semantic_memory.graph.has_node(c2)):
                if self.semantic_memory.graph.has_edge(c1, c2):
                    # Strengthen existing edge
                    current_weight = self.semantic_memory.graph[c1][c2]["weight"]
                    self.semantic_memory.graph[c1][c2]["weight"] = min(current_weight + 0.1, 1.0)
                else:
                    # Create new edge
                    self.semantic_memory.graph.add_edge(c1, c2, 
                                                       type="co_occurs_with", 
                                                       weight=0.1)
    
    def _consolidate_procedures(self) -> None:
        """Consolidate and optimize procedural knowledge"""
        # Analyze execution history to identify patterns
        recent_executions = self.procedural_memory.execution_history[-100:]
        
        # Group by skill and analyze success patterns
        skill_patterns = {}
        for execution in recent_executions:
            skill_id = execution["skill_id"]
            if skill_id not in skill_patterns:
                skill_patterns[skill_id] = {
                    "successes": 0,
                    "failures": 0,
                    "contexts": []
                }
                
            if execution["success"]:
                skill_patterns[skill_id]["successes"] += 1
            else:
                skill_patterns[skill_id]["failures"] += 1
                
            skill_patterns[skill_id]["contexts"].append(execution["context"])
            
        # Update skills based on patterns
        for skill_id, pattern in skill_patterns.items():
            if skill_id in self.procedural_memory.skills:
                success_rate = pattern["successes"] / (pattern["successes"] + pattern["failures"])
                self.procedural_memory.update(skill_id, {"success_rate": success_rate})
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get statistics about all memory components"""
        stats = {
            "timestamp": datetime.now(),
            "components": {}
        }
        
        # Working memory stats
        working_state = self.working_memory.get_state()
        stats["components"]["working"] = {
            "size": working_state["size"],
            "capacity": working_state["capacity"],
            "utilization": working_state["utilization"]
        }
        
        # Episodic memory stats
        if self.episodic_memory:
            stats["components"]["episodic"] = {
                "size": self.episodic_memory.collection.count()
            }
            
        # Semantic memory stats
        if self.semantic_memory:
            stats["components"]["semantic"] = {
                "nodes": self.semantic_memory.graph.number_of_nodes(),
                "edges": self.semantic_memory.graph.number_of_edges()
            }
            
        # Procedural memory stats
        stats["components"]["procedural"] = {
            "skills": len(self.procedural_memory.skills),
            "executions": len(self.procedural_memory.execution_history)
        }
        
        return stats