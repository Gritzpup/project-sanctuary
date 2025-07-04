#!/usr/bin/env python3
"""
Script to demonstrate how to fix the JSON race condition
"""

import sys
from pathlib import Path

# Add paths
sys.path.append(str(Path(__file__).parent / "src"))
sys.path.append(str(Path(__file__).parent / "src" / "utils"))

from safe_json_handler import safe_read_json, safe_write_json, safe_update_json

# Example 1: Safe reading
def read_work_summary():
    """Safely read work summary without corruption"""
    path = Path("quantum_states/memories/work_summary_24h.json")
    data = safe_read_json(path)
    if data:
        print(f"✅ Safely read work summary: {data.get('current_tasks', {}).get('active', 'No active tasks')}")
    else:
        print("❌ Failed to read work summary")

# Example 2: Safe writing
def write_test_data():
    """Safely write data without conflicts"""
    path = Path("test_safe_write.json")
    test_data = {
        "message": "This was written safely!",
        "timestamp": "2025-07-01T12:00:00",
        "no_corruption": True
    }
    if safe_write_json(path, test_data):
        print("✅ Safely wrote test data")
    else:
        print("❌ Failed to write test data")

# Example 3: Safe updating (most important!)
def update_entity_state():
    """Safely update entity state without race conditions"""
    path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude/relationship_map.json")
    
    def update_func(current_data):
        """Update function that modifies the data"""
        if not current_data:
            current_data = {"gritz": {"status": "partner", "interactions": []}}
        
        # Add new interaction
        current_data.setdefault("gritz", {}).setdefault("interactions", []).append({
            "timestamp": "2025-07-01T12:00:00",
            "type": "safe_update_test",
            "note": "Updated without race condition!"
        })
        
        return current_data
    
    if safe_update_json(path, update_func):
        print("✅ Safely updated entity state")
    else:
        print("❌ Failed to update entity state")

# The key changes needed in the analyzer:
print("""
🔧 TO FIX THE RACE CONDITION:

1. In claude_folder_analyzer_quantum.py, replace:
   
   with open(file_path, 'r') as f:
       data = json.load(f)
   
   WITH:
   
   from utils.safe_json_handler import safe_read_json
   data = safe_read_json(file_path)

2. Replace:
   
   with open(file_path, 'w') as f:
       json.dump(data, f, indent=2)
   
   WITH:
   
   from utils.safe_json_handler import safe_write_json
   safe_write_json(file_path, data)

3. For read-modify-write operations, use:
   
   from utils.safe_json_handler import safe_update_json
   
   def my_update(data):
       data['field'] = 'new_value'
       return data
   
   safe_update_json(file_path, my_update)
""")

if __name__ == "__main__":
    print("🧪 Testing safe JSON operations...")
    read_work_summary()
    write_test_data()
    # update_entity_state()  # Uncomment to test entity update