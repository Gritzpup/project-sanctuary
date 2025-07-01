#!/usr/bin/env python3
"""
Standalone script to regenerate CLAUDE.md without dependencies
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the parent directory to Python path
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

# Import directly, bypassing __init__.py
import importlib.util

# Load the module directly
spec = importlib.util.spec_from_file_location(
    "claude_md_generator",
    current_dir / "src" / "core" / "realtime" / "claude_md_generator.py"
)
claude_md_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(claude_md_module)

ClaudeMDGenerator = claude_md_module.ClaudeMDGenerator

async def main():
    print("📝 Regenerating CLAUDE.md (standalone mode)...")
    
    quantum_states = current_dir / "quantum_states"
    
    generator = ClaudeMDGenerator(quantum_states)
    await generator.generate()
    
    print("✅ CLAUDE.md has been updated!")
    print(f"📍 Location: {generator.output_path}")

if __name__ == "__main__":
    asyncio.run(main())