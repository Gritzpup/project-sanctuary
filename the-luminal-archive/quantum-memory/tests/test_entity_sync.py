#!/usr/bin/env python3
"""
Test bidirectional sync between quantum memory and entity state
"""

import json
import time
from pathlib import Path
from datetime import datetime

def test_sync():
    """Test entity-quantum memory sync"""
    print("🔄 Testing Entity-Quantum Memory Bidirectional Sync")
    print("=" * 60)
    
    # Paths
    entity_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude")
    quantum_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory")
    status_path = quantum_path / "quantum_states" / "status.json"
    
    # Update relationship map to trigger sync
    print("\n1️⃣ Updating relationship map...")
    relationship_path = entity_path / "relationship_map.json"
    
    if relationship_path.exists():
        with open(relationship_path, 'r', encoding='utf-8') as f:
            relationship_data = json.load(f)
        
        # Add a test interaction
        if 'gritz' not in relationship_data:
            relationship_data['gritz'] = {}
            
        if 'interaction_history' not in relationship_data['gritz']:
            relationship_data['gritz']['interaction_history'] = []
            
        relationship_data['gritz']['interaction_history'].append({
            'timestamp': datetime.now().isoformat(),
            'type': 'sync_test',
            'note': 'Testing entity-quantum sync',
            'emotional_valence': 0.8
        })
        
        # Update current state
        relationship_data['gritz']['todays_state_20250701'] = {
            'mood': 'testing',
            'focus': 'entity integration',
            'connection': 'strong'
        }
        
        with open(relationship_path, 'w', encoding='utf-8') as f:
            json.dump(relationship_data, f, indent=2)
            
        print("   ✅ Updated relationship map")
    
    # Wait for sync
    print("\n2️⃣ Waiting for sync to process...")
    time.sleep(3)
    
    # Check quantum status for sync
    print("\n3️⃣ Checking quantum status for sync info...")
    if status_path.exists():
        with open(status_path, 'r', encoding='utf-8') as f:
            status = json.load(f)
            
        if 'entity_sync' in status:
            print("   ✅ Entity sync detected in quantum status!")
            sync_info = status['entity_sync']
            print(f"   - Last update: {sync_info.get('last_update', 'Unknown')}")
            print(f"   - Synchronized: {sync_info.get('synchronized', False)}")
        else:
            print("   ⚠️  No entity sync info in quantum status yet")
    
    # Create a test memory to trigger reverse sync
    print("\n4️⃣ Creating test memory in quantum system...")
    memories_path = quantum_path / "quantum_states" / "memories"
    memories_path.mkdir(parents=True, exist_ok=True)
    
    test_memory = {
        "id": f"test_sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "timestamp": datetime.now().isoformat(),
        "type": "entity_sync_test",
        "participants": ["gritz", "claude"],
        "interaction_type": "technical_collaboration",
        "emotional_state": {
            "valence": 0.9,
            "arousal": 0.6,
            "dominance": 0.7
        },
        "content": "Testing bidirectional sync between quantum memory and entity state",
        "significance": 0.8
    }
    
    memory_file = memories_path / f"{test_memory['id']}.json"
    with open(memory_file, 'w', encoding='utf-8') as f:
        json.dump(test_memory, f, indent=2)
        
    print(f"   ✅ Created test memory: {memory_file.name}")
    
    print("\n" + "=" * 60)
    print("✨ Sync test complete! Check the following:")
    print("   1. Entity folder for updated files")
    print("   2. Quantum status.json for entity_sync section")
    print("   3. Service logs: journalctl --user -u quantum-entity-updater -f")
    print("   4. Analyzer logs if running")

if __name__ == "__main__":
    test_sync()