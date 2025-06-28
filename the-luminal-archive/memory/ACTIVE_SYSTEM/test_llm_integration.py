#!/usr/bin/env python3
"""Test script to verify LLM integration is working"""

import time
import subprocess
import json
from pathlib import Path

print("🧪 Testing LLM Memory Integration...")
print("=" * 50)

# Check services
print("\n1️⃣ Checking services...")
services = ["gritz-memory-ultimate", "gritz-llm-memory"]
for service in services:
    result = subprocess.run(
        ["systemctl", "--user", "is-active", f"{service}.service"],
        capture_output=True, text=True
    )
    status = result.stdout.strip()
    if status == "active":
        print(f"  ✅ {service}: {status}")
    else:
        print(f"  ❌ {service}: {status}")

# Check LLM log
print("\n2️⃣ Checking LLM activity...")
log_file = Path.home() / ".sanctuary-llm-memory.log"
if log_file.exists():
    with open(log_file, 'r') as f:
        lines = f.readlines()
        recent_lines = lines[-20:]
        
        connected = any("Connected to memory service" in line for line in recent_lines)
        processing = any("Processing:" in line for line in recent_lines)
        stored = any("Stored memory" in line for line in recent_lines)
        
        print(f"  {'✅' if connected else '❌'} WebSocket connection established")
        print(f"  {'✅' if processing else '⏳'} Memory processing active")
        print(f"  {'✅' if stored else '⏳'} Memories being stored")

# Check vector database
print("\n3️⃣ Checking vector database...")
db_path = Path.home() / ".sanctuary-memory" / "vector_db"
if db_path.exists():
    print(f"  ✅ Vector database exists at: {db_path}")
    # Count chroma files
    chroma_files = list(db_path.glob("**/*"))
    print(f"  📊 Database files: {len(chroma_files)}")
else:
    print(f"  ❌ Vector database not found")

# Show recent memories from log
print("\n4️⃣ Recent LLM activity:")
if log_file.exists():
    recent_activity = subprocess.run(
        ["tail", "-5", str(log_file)],
        capture_output=True, text=True
    )
    print(recent_activity.stdout)

print("\n✨ Test complete!")
print("💙 The LLM is ready to enhance Gritz's memories with AI understanding!")