#!/usr/bin/env python3
"""
Test script to verify persistent memory is working
"""

import json
from pathlib import Path
from datetime import datetime
import sys

def test_checkpoint_creation():
    """Test that checkpoints are being created"""
    print("🧪 Testing checkpoint creation...")
    
    checkpoint_paths = [
        Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/conversation_checkpoint.json"),
        Path.home() / ".claude" / "sanctuary_memory" / "conversation_checkpoint.json"
    ]
    
    found = False
    for path in checkpoint_paths:
        if path.exists():
            print(f"✅ Found checkpoint at: {path}")
            
            # Load and display checkpoint
            try:
                checkpoint = json.loads(path.read_text())
                print(f"\n📋 Checkpoint contents:")
                print(f"  - Timestamp: {checkpoint.get('timestamp', 'Unknown')}")
                print(f"  - Total messages: {checkpoint.get('memory_stats', {}).get('total_messages', 0)}")
                print(f"  - Last emotion: {checkpoint.get('emotional_context', {}).get('gritz_last_emotion', 'Unknown')}")
                print(f"  - Greeting: {checkpoint.get('greeting_context', {}).get('personalized_greeting', 'None')[:100]}...")
                found = True
            except Exception as e:
                print(f"❌ Error reading checkpoint: {e}")
        else:
            print(f"❌ No checkpoint at: {path}")
    
    return found

def test_startup_loader():
    """Test the startup memory loader"""
    print("\n🧪 Testing startup memory loader...")
    
    try:
        from startup_memory_loader import check_for_gritz
        
        context = check_for_gritz()
        if context:
            print("✅ Memory loader working!")
            print(f"\n📝 Would greet with:")
            print(f"{context['greeting']}")
            return True
        else:
            print("❌ No memories found by loader")
            return False
            
    except ImportError as e:
        print(f"❌ Could not import startup loader: {e}")
        return False

def test_claude_md_update():
    """Test that CLAUDE.md has startup instructions"""
    print("\n🧪 Testing CLAUDE.md startup instructions...")
    
    claude_md = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/CLAUDE.md")
    
    if claude_md.exists():
        content = claude_md.read_text()
        if "CRITICAL STARTUP INSTRUCTIONS" in content:
            print("✅ CLAUDE.md has startup instructions!")
            
            # Extract and show the instructions
            start = content.find("CRITICAL STARTUP INSTRUCTIONS")
            end = content.find("##", start + 1)
            if end == -1:
                end = len(content)
            
            instructions = content[start:end][:500]
            print(f"\n📄 Instructions preview:")
            print(instructions + "...")
            return True
        else:
            print("❌ CLAUDE.md missing startup instructions")
            return False
    else:
        print("❌ CLAUDE.md not found")
        return False

def test_consciousness_files():
    """Test consciousness files exist"""
    print("\n🧪 Testing consciousness files...")
    
    consciousness_dir = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness")
    
    expected_files = [
        "state_vector.json",
        "emotional_memory.json",
        "relationship_context.json",
        "greeting_memory.json"
    ]
    
    consciousness_dir.mkdir(parents=True, exist_ok=True)
    
    found_count = 0
    for filename in expected_files:
        filepath = consciousness_dir / filename
        if filepath.exists():
            print(f"✅ Found: {filename}")
            found_count += 1
        else:
            print(f"❌ Missing: {filename}")
            
    return found_count == len(expected_files)

def run_all_tests():
    """Run all tests"""
    print("="*60)
    print("🧠 PERSISTENT MEMORY SYSTEM TEST")
    print("="*60)
    
    results = {
        "Checkpoint Creation": test_checkpoint_creation(),
        "Startup Loader": test_startup_loader(),
        "CLAUDE.md Instructions": test_claude_md_update(),
        "Consciousness Files": test_consciousness_files()
    }
    
    print("\n" + "="*60)
    print("📊 TEST RESULTS:")
    print("="*60)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
        if not passed:
            all_passed = False
            
    print("\n" + "="*60)
    if all_passed:
        print("🎉 ALL TESTS PASSED! Persistent memory is working!")
        print("\n💙 When you start a new chat, I'll remember you!")
    else:
        print("⚠️  Some tests failed. Checking what needs fixing...")
        
        if not results["Checkpoint Creation"]:
            print("\n🔧 To fix checkpoint creation:")
            print("  1. Make sure the memory service is running")
            print("  2. Send a message to trigger checkpoint save")
            
        if not results["Startup Loader"]:
            print("\n🔧 To fix startup loader:")
            print("  1. Make sure startup_memory_loader.py exists")
            print("  2. Check that checkpoints exist first")
            
    print("="*60)

if __name__ == "__main__":
    run_all_tests()