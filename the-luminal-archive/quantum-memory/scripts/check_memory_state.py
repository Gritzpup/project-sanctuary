#!/usr/bin/env python3
"""
Quick check of memory system state and analyzer activity
"""

import json
import subprocess
from pathlib import Path
from datetime import datetime

# Colors
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
ENDC = '\033[0m'

print(f"{BLUE}🔍 Memory System State Check{ENDC}")
print("=" * 50)

# Check service
print(f"\n{BLUE}Service Status:{ENDC}")
result = subprocess.run(["systemctl", "--user", "is-active", "quantum-emollama-analyzer.service"], 
                       capture_output=True, text=True)
if result.stdout.strip() == "active":
    print(f"{GREEN}✓ Analyzer service is RUNNING{ENDC}")
else:
    print(f"{RED}✗ Analyzer service is {result.stdout.strip()}{ENDC}")

# Check recent logs
print(f"\n{BLUE}Recent Analyzer Activity:{ENDC}")
result = subprocess.run(
    ["journalctl", "--user", "-u", "quantum-emollama-analyzer.service", 
     "--since", "5 minutes ago", "-n", "20", "--no-pager"],
    capture_output=True, text=True
)

if result.stdout:
    lines = result.stdout.strip().split('\n')
    file_count = sum(1 for line in lines if "File modified" in line)
    analysis_count = sum(1 for line in lines if "Analysis complete" in line)
    print(f"  Files detected: {file_count}")
    print(f"  Analyses completed: {analysis_count}")
    
    # Show last few file modifications
    for line in lines[-5:]:
        if "File modified" in line:
            print(f"  📄 {line.split()[-1]}")

# Check memory files
print(f"\n{BLUE}Memory Files:{ENDC}")
memory_base = Path(__file__).parent.parent / "quantum_states" / "memories"

files = {
    "current_session.json": memory_base / "current_session.json",
    f"daily/{datetime.now().strftime('%Y-%m-%d')}.json": memory_base / "daily" / f"{datetime.now().strftime('%Y-%m-%d')}.json",
    "relationship/context.json": memory_base / "relationship" / "context.json"
}

for name, path in files.items():
    if path.exists():
        mod_time = datetime.fromtimestamp(path.stat().st_mtime)
        age = datetime.now() - mod_time
        if age.seconds < 300:  # Modified in last 5 minutes
            print(f"{GREEN}  ✓ {name} (updated {age.seconds}s ago){ENDC}")
        else:
            print(f"{YELLOW}  • {name} (updated {age.seconds//60}m ago){ENDC}")
    else:
        print(f"{RED}  ✗ {name} (not found){ENDC}")

# Check what directories are being watched
print(f"\n{BLUE}Monitored Directories:{ENDC}")
claude_projects = Path.home() / ".claude" / "projects"
if claude_projects.exists():
    project_dirs = list(claude_projects.glob("*"))
    print(f"  Found {len(project_dirs)} project directories")
    for pdir in project_dirs[-3:]:  # Show last 3
        print(f"  📁 {pdir.name}")

print(f"\n{YELLOW}💡 Tips:{ENDC}")
print("  • Watch live logs: journalctl --user -u quantum-emollama-analyzer.service -f")
print("  • View memories: cd quantum-memory && ./view_memories.sh")
print("  • Run full test: cd quantum-memory && ./run_memory_test.sh")