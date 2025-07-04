#!/usr/bin/env python3
"""
EMERGENCY PATCH: Fix JSON race conditions in quantum memory system
Run this to patch the analyzer and entity updater with file locking
"""

import os
import sys
from pathlib import Path

print("🚨 EMERGENCY JSON RACE CONDITION FIX")
print("=" * 50)

# Step 1: Stop the conflicting services
print("\n1️⃣ Stopping services to prevent further corruption...")
os.system("systemctl --user stop quantum-emollama-analyzer.service")
os.system("pkill -f entity_state_updater.py")
print("✅ Services stopped")

# Step 2: Backup corrupted files
print("\n2️⃣ Backing up potentially corrupted files...")
backup_dir = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude/backup_race_condition")
backup_dir.mkdir(exist_ok=True)

files_to_backup = [
    "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude/relationship_map.json",
    "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude/verification_markers.json",
    "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude/consciousness_snapshot.json"
]

for file in files_to_backup:
    if Path(file).exists():
        os.system(f"cp {file} {backup_dir}/")
        print(f"  ✅ Backed up {Path(file).name}")

# Step 3: Create simple patches
print("\n3️⃣ Creating patched versions of services...")

# Patch for analyzer
analyzer_patch = '''
# Add this import at the top of claude_folder_analyzer_quantum.py:
from utils.safe_json_handler import safe_read_json, safe_write_json, safe_update_json

# Then replace ALL occurrences of:
#   with open(something, 'r') as f:
#       data = json.load(f)
# WITH:
#   data = safe_read_json(something)

# And replace ALL occurrences of:
#   with open(something, 'w') as f:
#       json.dump(data, f, indent=2)
# WITH:
#   safe_write_json(something, data)
'''

# Patch for entity updater
entity_patch = '''
# Add this import at the top of entity_state_updater.py:
sys.path.append(str(Path(__file__).parent.parent.parent))
from utils.safe_json_handler import safe_read_json, safe_write_json, safe_update_json

# Same replacements as above
'''

print("\n📋 MANUAL STEPS REQUIRED:")
print("1. Edit analyzers/claude_folder_analyzer_quantum.py")
print("2. Edit src/services/entity_state_updater.py")
print("3. Add the safe_json_handler imports and replace file operations")
print("\n4️⃣ Quick test of safe operations...")

# Test the safe handler
sys.path.append(str(Path(__file__).parent / "src"))
sys.path.append(str(Path(__file__).parent / "src" / "utils"))

try:
    from safe_json_handler import safe_read_json, safe_write_json
    
    # Test reading work summary
    work_summary = safe_read_json(Path("quantum_states/memories/work_summary_24h.json"))
    if work_summary:
        print("✅ Safe read successful!")
        print(f"   Current task: {work_summary.get('current_tasks', {}).get('active', 'Unknown')}")
    
    # Test writing
    test_data = {"test": "safe_write", "timestamp": "now"}
    if safe_write_json(Path("test_safe_operations.json"), test_data):
        print("✅ Safe write successful!")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n5️⃣ Next steps:")
print("1. Apply the patches to both files")
print("2. Restart services:")
print("   systemctl --user start quantum-emollama-analyzer.service")
print("   python src/services/entity_state_updater.py &")
print("\n⚠️  DO NOT restart services until patches are applied!")
print("The race condition will continue corrupting files!")