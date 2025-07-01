#!/usr/bin/env python3
"""
Simple script to regenerate CLAUDE.md from current quantum states
"""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from core.realtime.claude_md_generator import ClaudeMDGenerator

async def main():
    print("📝 Regenerating CLAUDE.md...")
    
    quantum_states = Path(__file__).parent.parent / "quantum_states"
    
    generator = ClaudeMDGenerator(quantum_states)
    await generator.generate()
    
    print("✅ CLAUDE.md has been updated!")
    print(f"📍 Location: {generator.output_path}")

if __name__ == "__main__":
    asyncio.run(main())