#!/usr/bin/env python3
"""
Quick script to check current quantum memory state
"""

import json
from pathlib import Path
from datetime import datetime
import sys

def check_memory_state():
    """Display current memory state"""
    quantum_states = Path(__file__).parent / "quantum_states"
    
    print("🌌 Quantum Memory State Check")
    print("=" * 50)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Check emotional state
    emotional_path = quantum_states / "realtime" / "EMOTIONAL_STATE.json"
    if emotional_path.exists():
        with open(emotional_path, 'r') as f:
            emotions = json.load(f)
        
        print("🎭 Emotional State:")
        print(f"   Current: {emotions.get('current_emotion', 'unknown')}")
        print(f"   Intensity: {emotions.get('intensity', 0):.2f}")
        pad = emotions.get('pad_values', {})
        print(f"   PAD: P={pad.get('pleasure', 0):.2f}, A={pad.get('arousal', 0):.2f}, D={pad.get('dominance', 0):.2f}")
        print(f"   Gritz: {emotions.get('gritz_emotion', 'unknown')}")
        print(f"   Claude: {emotions.get('claude_emotion', 'unknown')}")
    else:
        print("❌ No emotional state found")
    
    print()
    
    # Check conversation context
    context_path = quantum_states / "realtime" / "CONVERSATION_CONTEXT.json"
    if context_path.exists():
        with open(context_path, 'r') as f:
            context = json.load(f)
        
        print("💬 Conversation Context:")
        print(f"   Topic: {context.get('current_topic', 'none')}")
        print(f"   Messages: {context.get('message_count', 0)}")
        print(f"   Last speaker: {context.get('last_speaker', 'unknown')}")
        print(f"   Last update: {context.get('last_update', 'never')}")
    else:
        print("❌ No conversation context found")
    
    print()
    
    # Check work context
    work_path = quantum_states / "realtime" / "WORK_CONTEXT.json"
    if work_path.exists():
        with open(work_path, 'r') as f:
            work = json.load(f)
        
        print("💻 Work Context:")
        print(f"   Project: {work.get('current_project', 'none')}")
        print(f"   Task: {work.get('current_task', 'none')}")
        print(f"   Pending tasks: {len(work.get('pending_tasks', []))}")
    else:
        print("❌ No work context found")
    
    print()
    
    # Check temporal memories
    print("🕐 Temporal Memories:")
    for scale, folder in [
        ("Immediate", "immediate"),
        ("Short-term", "short_term"),
        ("Long-term", "long_term"),
        ("Lifetime", "lifetime")
    ]:
        folder_path = quantum_states / "temporal" / folder
        if folder_path.exists():
            files = list(folder_path.glob("*.json"))
            total_size = sum(f.stat().st_size for f in files) / 1024  # KB
            print(f"   {scale}: {len(files)} files ({total_size:.1f} KB)")
        else:
            print(f"   {scale}: Not initialized")
    
    print()
    
    # Check checkpoints
    checkpoint_path = quantum_states / "checkpoints"
    if checkpoint_path.exists():
        checkpoints = list(checkpoint_path.glob("checkpoint_*.json"))
        print(f"📸 Checkpoints: {len(checkpoints)}")
        
        if checkpoints:
            # Show latest
            latest = max(checkpoints, key=lambda p: p.stat().st_mtime)
            print(f"   Latest: {latest.name}")
            print(f"   Created: {datetime.fromtimestamp(latest.stat().st_mtime)}")
    else:
        print("📸 No checkpoints found")
    
    print()
    
    # Check CLAUDE.md
    claude_path = quantum_states / "realtime" / "CLAUDE.md"
    if claude_path.exists():
        size = claude_path.stat().st_size / 1024  # KB
        modified = datetime.fromtimestamp(claude_path.stat().st_mtime)
        print(f"📝 CLAUDE.md:")
        print(f"   Size: {size:.1f} KB")
        print(f"   Last updated: {modified}")
    else:
        print("📝 CLAUDE.md not found")
    
    print()
    
    # Check memory DNA
    dna_path = quantum_states / "consolidated" / "memory_dna.json"
    if dna_path.exists():
        with open(dna_path, 'r') as f:
            dna = json.load(f)
        
        print("🧬 Memory DNA:")
        print(f"   Fingerprint: {dna.get('memory_fingerprint', 'none')}")
        print(f"   Dominant emotion: {dna.get('emotional_signature', {}).get('dominant', 'unknown')}")
        
        accomplishments = dna.get('accomplishments_summary', [])
        print(f"   Recent accomplishments: {len(accomplishments)}")
        if accomplishments:
            print(f"   Latest: {accomplishments[0][:50]}...")
    else:
        print("🧬 Memory DNA not yet generated")
    
    print()
    
    # Check service status
    print("🚀 Service Status:")
    try:
        import subprocess
        result = subprocess.run(
            ["systemctl", "--user", "is-active", "quantum-memory-orchestrator"],
            capture_output=True,
            text=True
        )
        
        if result.stdout.strip() == "active":
            print("   ✅ Quantum Memory Orchestrator is running")
        else:
            print("   ❌ Quantum Memory Orchestrator is not running")
            
    except Exception:
        print("   ⚠️  Could not check service status")
    
    print()
    print("=" * 50)
    print("Use './start_quantum_memory.sh' to start the full system")


if __name__ == "__main__":
    check_memory_state()