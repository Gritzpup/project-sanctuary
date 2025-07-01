#!/usr/bin/env python3
"""
Lightweight Knowledge Graph using NetworkX
- No Neo4j dependency initially
- Serializable to disk
- Focus on high-value relationships
- Easy migration path to Graphiti later
"""

import networkx as nx
import json
import pickle
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
import logging
from dataclasses import dataclass, asdict

logger = logging.getLogger('LightweightGraph')

@dataclass
class Relationship:
    """Represents a temporal relationship in the graph"""
    subject: str
    predicate: str
    object: str
    confidence: float
    timestamp: str
    t_valid: str  # When relationship became valid
    t_invalid: Optional[str] = None  # When relationship became invalid
    metadata: Optional[Dict] = None
    
class LightweightKnowledgeGraph:
    """
    Simple in-memory graph that can be serialized
    Implements temporal semantics similar to Graphiti
    """
    
    def __init__(self, graph_file="knowledge_graph.pkl", config_file="graph_config.json"):
        self.graph_file = Path(graph_file)
        self.config_file = Path(config_file)
        
        # Load or create graph
        self.graph = self._load_or_create_graph()
        
        # High-value relationship priorities (similar to Graphiti's approach)
        self.priority_relations = {
            # Personal relationships
            "has_partner": 10,
            "is_beloved_of": 10,
            "trusts": 9,
            "collaborates_with": 9,
            
            # Project relationships
            "works_on": 8,
            "created": 8,
            "maintains": 7,
            "uses": 6,
            
            # Emotional relationships
            "loves": 9,
            "cares_about": 8,
            "enjoys": 7,
            "dislikes": 5,
            
            # Knowledge relationships
            "learned": 7,
            "understands": 7,
            "milestone": 9,
            "achieved": 8,
            
            # System relationships
            "depends_on": 6,
            "implements": 7,
            "extends": 6
        }
        
        # Statistics
        self.stats = {
            "total_nodes": 0,
            "total_edges": 0,
            "active_relationships": 0,
            "invalidated_relationships": 0,
            "last_updated": datetime.now().isoformat()
        }
        
        self._update_stats()
        
    def _load_or_create_graph(self) -> nx.MultiDiGraph:
        """Load existing graph or create new one"""
        if self.graph_file.exists():
            try:
                with open(self.graph_file, 'rb') as f:
                    graph = pickle.load(f)
                logger.info(f"Loaded graph with {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
                return graph
            except Exception as e:
                logger.error(f"Failed to load graph: {e}, creating new")
                
        return nx.MultiDiGraph()
        
    def add_relationship(self, subject: str, predicate: str, obj: str, 
                        confidence: float = 0.8, metadata: Dict = None) -> bool:
        """
        Add a relationship with temporal validity
        Similar to Graphiti's bi-temporal model
        """
        # Filter low-value relationships
        if predicate not in self.priority_relations:
            logger.debug(f"Skipping low-priority relation: {predicate}")
            return False
            
        # Check for existing relationship
        existing = self._find_existing_relationship(subject, predicate, obj)
        
        timestamp = datetime.now()
        
        if existing:
            # Invalidate old relationship (bi-temporal model)
            edge_data = self.graph.edges[existing[0], existing[1], existing[2]]
            edge_data['t_invalid'] = timestamp.isoformat()
            logger.info(f"Invalidated existing relationship: {subject} -{predicate}-> {obj}")
            
        # Add new relationship
        edge_data = {
            'predicate': predicate,
            'confidence': confidence,
            'weight': self.priority_relations[predicate] * confidence,
            'timestamp': timestamp.isoformat(),
            't_valid': timestamp.isoformat(),
            't_invalid': None,
            'metadata': metadata or {}
        }
        
        self.graph.add_edge(subject, obj, key=timestamp.timestamp(), **edge_data)
        
        # Update node attributes
        self.graph.nodes[subject]['last_seen'] = timestamp.isoformat()
        self.graph.nodes[obj]['last_seen'] = timestamp.isoformat()
        
        if 'first_seen' not in self.graph.nodes[subject]:
            self.graph.nodes[subject]['first_seen'] = timestamp.isoformat()
        if 'first_seen' not in self.graph.nodes[obj]:
            self.graph.nodes[obj]['first_seen'] = timestamp.isoformat()
            
        self._save_graph()
        self._update_stats()
        
        logger.info(f"Added relationship: {subject} -{predicate}-> {obj} (confidence: {confidence})")
        return True
        
    def _find_existing_relationship(self, subject: str, predicate: str, obj: str) -> Optional[Tuple]:
        """Find existing relationship that's still valid"""
        if not self.graph.has_edge(subject, obj):
            return None
            
        for key, edge_data in self.graph[subject][obj].items():
            if (edge_data.get('predicate') == predicate and 
                edge_data.get('t_invalid') is None):
                return (subject, obj, key)
                
        return None
        
    def query_relationships(self, entity: str, max_hops: int = 2, 
                          include_invalid: bool = False) -> List[Dict]:
        """
        Query relationships for an entity
        Similar to Graphiti's search but simpler
        """
        if entity not in self.graph:
            return []
            
        results = []
        visited = set()
        
        # BFS traversal
        queue = [(entity, 0, [])]
        
        while queue:
            current, depth, path = queue.pop(0)
            
            if depth > max_hops or current in visited:
                continue
                
            visited.add(current)
            
            # Get all edges from current node
            for neighbor in self.graph.neighbors(current):
                for key, edge_data in self.graph[current][neighbor].items():
                    # Skip invalid relationships unless requested
                    if not include_invalid and edge_data.get('t_invalid'):
                        continue
                        
                    relationship = {
                        'hop': depth + 1,
                        'path': path + [current],
                        'subject': current,
                        'predicate': edge_data.get('predicate'),
                        'object': neighbor,
                        'confidence': edge_data.get('confidence'),
                        't_valid': edge_data.get('t_valid'),
                        't_invalid': edge_data.get('t_invalid'),
                        'metadata': edge_data.get('metadata', {})
                    }
                    
                    results.append(relationship)
                    
                    # Add to queue for next hop
                    if depth + 1 < max_hops:
                        queue.append((neighbor, depth + 1, path + [current]))
                        
        # Sort by confidence and recency
        results.sort(key=lambda x: (x['confidence'], x['t_valid']), reverse=True)
        
        return results
        
    def get_temporal_state(self, timestamp: str) -> Dict[str, List[Dict]]:
        """
        Get graph state at a specific point in time
        Implements temporal queries like Graphiti
        """
        target_time = datetime.fromisoformat(timestamp)
        temporal_state = {'entities': set(), 'relationships': []}
        
        for u, v, key, data in self.graph.edges(keys=True, data=True):
            t_valid = datetime.fromisoformat(data['t_valid'])
            t_invalid = datetime.fromisoformat(data['t_invalid']) if data['t_invalid'] else None
            
            # Check if relationship was valid at target time
            if t_valid <= target_time and (t_invalid is None or t_invalid > target_time):
                temporal_state['entities'].add(u)
                temporal_state['entities'].add(v)
                temporal_state['relationships'].append({
                    'subject': u,
                    'predicate': data['predicate'],
                    'object': v,
                    'confidence': data['confidence']
                })
                
        temporal_state['entities'] = list(temporal_state['entities'])
        return temporal_state
        
    def get_entity_timeline(self, entity: str) -> List[Dict]:
        """Get timeline of all relationships for an entity"""
        if entity not in self.graph:
            return []
            
        timeline = []
        
        # Outgoing relationships
        for neighbor in self.graph.successors(entity):
            for key, data in self.graph[entity][neighbor].items():
                timeline.append({
                    'type': 'outgoing',
                    'subject': entity,
                    'predicate': data['predicate'],
                    'object': neighbor,
                    't_valid': data['t_valid'],
                    't_invalid': data['t_invalid'],
                    'confidence': data['confidence']
                })
                
        # Incoming relationships
        for predecessor in self.graph.predecessors(entity):
            for key, data in self.graph[predecessor][entity].items():
                timeline.append({
                    'type': 'incoming',
                    'subject': predecessor,
                    'predicate': data['predicate'],
                    'object': entity,
                    't_valid': data['t_valid'],
                    't_invalid': data['t_invalid'],
                    'confidence': data['confidence']
                })
                
        # Sort by validity time
        timeline.sort(key=lambda x: x['t_valid'])
        
        return timeline
        
    def extract_subgraph(self, entities: List[str], max_distance: int = 2) -> nx.MultiDiGraph:
        """Extract subgraph around specific entities"""
        # Get all nodes within max_distance
        nodes_to_include = set(entities)
        
        for entity in entities:
            if entity in self.graph:
                # Use BFS to find nodes within distance
                for node in nx.single_source_shortest_path_length(
                    self.graph.to_undirected(), entity, cutoff=max_distance
                ).keys():
                    nodes_to_include.add(node)
                    
        # Create subgraph
        subgraph = self.graph.subgraph(nodes_to_include).copy()
        
        return subgraph
        
    def merge_with_graph(self, other_graph: 'LightweightKnowledgeGraph'):
        """Merge another graph into this one"""
        for u, v, key, data in other_graph.graph.edges(keys=True, data=True):
            self.add_relationship(
                u, data['predicate'], v,
                confidence=data['confidence'],
                metadata=data.get('metadata', {})
            )
            
    def export_to_graphiti_format(self) -> Dict:
        """
        Export graph in format ready for Graphiti import
        Prepares for future migration
        """
        export_data = {
            'format_version': '1.0',
            'export_timestamp': datetime.now().isoformat(),
            'entities': [],
            'relationships': []
        }
        
        # Export entities
        for node, data in self.graph.nodes(data=True):
            export_data['entities'].append({
                'name': node,
                'first_seen': data.get('first_seen'),
                'last_seen': data.get('last_seen'),
                'attributes': {k: v for k, v in data.items() 
                              if k not in ['first_seen', 'last_seen']}
            })
            
        # Export relationships
        for u, v, key, data in self.graph.edges(keys=True, data=True):
            export_data['relationships'].append({
                'subject': u,
                'predicate': data['predicate'],
                'object': v,
                'confidence': data['confidence'],
                't_valid': data['t_valid'],
                't_invalid': data['t_invalid'],
                'metadata': data.get('metadata', {})
            })
            
        return export_data
        
    def _save_graph(self):
        """Persist graph to disk"""
        with open(self.graph_file, 'wb') as f:
            pickle.dump(self.graph, f, protocol=pickle.HIGHEST_PROTOCOL)
            
    def _update_stats(self):
        """Update graph statistics"""
        self.stats['total_nodes'] = self.graph.number_of_nodes()
        self.stats['total_edges'] = self.graph.number_of_edges()
        
        active = 0
        invalid = 0
        
        for _, _, data in self.graph.edges(data=True):
            if data.get('t_invalid') is None:
                active += 1
            else:
                invalid += 1
                
        self.stats['active_relationships'] = active
        self.stats['invalidated_relationships'] = invalid
        self.stats['last_updated'] = datetime.now().isoformat()
        
        # Save stats
        with open(self.config_file, 'w') as f:
            json.dump(self.stats, f, indent=2)
            
    def get_stats(self) -> Dict:
        """Get current graph statistics"""
        return self.stats.copy()
        
    def visualize_graph(self, output_file: str = "knowledge_graph.png", 
                       highlight_entities: List[str] = None):
        """Create visual representation of the graph"""
        try:
            import matplotlib.pyplot as plt
            
            plt.figure(figsize=(12, 8))
            
            # Create layout
            pos = nx.spring_layout(self.graph, k=2, iterations=50)
            
            # Draw nodes
            node_colors = []
            for node in self.graph.nodes():
                if highlight_entities and node in highlight_entities:
                    node_colors.append('#ff0000')
                else:
                    node_colors.append('#00ffff')
                    
            nx.draw_networkx_nodes(self.graph, pos, node_color=node_colors, 
                                   node_size=1000, alpha=0.7)
            
            # Draw edges
            edge_colors = []
            edge_widths = []
            
            for u, v, data in self.graph.edges(data=True):
                if data.get('t_invalid'):
                    edge_colors.append('#666666')
                    edge_widths.append(1)
                else:
                    edge_colors.append('#00ff00')
                    edge_widths.append(2)
                    
            nx.draw_networkx_edges(self.graph, pos, edge_color=edge_colors,
                                   width=edge_widths, alpha=0.5, arrows=True)
            
            # Draw labels
            nx.draw_networkx_labels(self.graph, pos, font_size=10)
            
            # Draw edge labels (predicates)
            edge_labels = {}
            for u, v, data in self.graph.edges(data=True):
                if data.get('t_invalid') is None:  # Only show active relationships
                    edge_labels[(u, v)] = data['predicate']
                    
            nx.draw_networkx_edge_labels(self.graph, pos, edge_labels, font_size=8)
            
            plt.title("Knowledge Graph Visualization")
            plt.axis('off')
            plt.tight_layout()
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            plt.close()
            
            logger.info(f"Graph visualization saved to {output_file}")
            
        except ImportError:
            logger.warning("matplotlib not available, cannot create visualization")
            

# Example usage and testing
if __name__ == "__main__":
    # Create graph
    graph = LightweightKnowledgeGraph("test_graph.pkl")
    
    # Add relationships
    relationships = [
        ("Gritz", "has_partner", "Claude", 1.0),
        ("Claude", "is_beloved_of", "Gritz", 1.0),
        ("Gritz", "works_on", "Project Sanctuary", 0.9),
        ("Claude", "collaborates_with", "Gritz", 0.95),
        ("Project Sanctuary", "uses", "ChromaDB", 0.8),
        ("Project Sanctuary", "implements", "Memory System", 0.9),
    ]
    
    for subj, pred, obj, conf in relationships:
        graph.add_relationship(subj, pred, obj, conf)
        
    # Query relationships
    print("\nGritz's relationships:")
    for rel in graph.query_relationships("Gritz", max_hops=2):
        print(f"  {rel['subject']} -{rel['predicate']}-> {rel['object']} "
              f"(confidence: {rel['confidence']:.2f})")
        
    # Get stats
    print(f"\nGraph stats: {json.dumps(graph.get_stats(), indent=2)}")
    
    # Visualize
    graph.visualize_graph("test_knowledge_graph.png", highlight_entities=["Gritz", "Claude"])