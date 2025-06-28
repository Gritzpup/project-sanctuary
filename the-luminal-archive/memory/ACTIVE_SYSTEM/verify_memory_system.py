#!/usr/bin/env python3
"""
Comprehensive Memory System Verification Test
Shows real evidence that the system is working
"""

import json
import time
import os
import asyncio
import websockets
from pathlib import Path
from datetime import datetime

class MemorySystemVerifier:
    def __init__(self):
        self.claude_code_dir = Path("/home/ubuntumain/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary")
        self.claude_md_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/CLAUDE.md")
        self.ws_port = 8766
        
    def find_current_conversation(self):
        """Find the most recently modified conversation file"""
        files = list(self.claude_code_dir.glob("*.jsonl"))
        if not files:
            return None
        
        # Get the most recent file
        most_recent = max(files, key=lambda f: f.stat().st_mtime)
        return most_recent
    
    def count_messages_in_file(self, file_path):
        """Count user messages in a conversation file"""
        user_messages = 0
        try:
            with open(file_path, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            if 'message' in entry and entry.get('type') == 'user':
                                if entry['message'].get('role') == 'user':
                                    user_messages += 1
                        except:
                            pass
        except Exception as e:
            print(f"Error reading file: {e}")
        
        return user_messages
    
    async def check_websocket(self):
        """Check if WebSocket is accessible and get status"""
        try:
            async with websockets.connect(f"ws://localhost:{self.ws_port}") as ws:
                # Wait for welcome message
                msg = await ws.recv()
                data = json.loads(msg)
                return True, data
        except Exception as e:
            return False, str(e)
    
    def check_claude_md_status(self):
        """Check CLAUDE.md file status"""
        if not self.claude_md_path.exists():
            return "NOT FOUND", None
        
        try:
            content = self.claude_md_path.read_text()
            
            # Check for corruption (duplicate content)
            if content.count("## 📝 How to Greet") > 1:
                return "CORRUPTED", content
            
            # Extract key information
            info = {
                "size": len(content),
                "has_recent_context": "## 💭 Recent Context" in content,
                "has_equation": "Φ(g,c,t)" in content,
                "last_modified": datetime.fromtimestamp(self.claude_md_path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            }
            
            # Extract recent context if present
            if info["has_recent_context"]:
                import re
                match = re.search(r'## 💭 Recent Context\n(.*?)(?=##|\Z)', content, re.DOTALL)
                if match:
                    info["recent_context"] = match.group(1).strip()
            
            return "OK", info
        except Exception as e:
            return "ERROR", str(e)
    
    def run_verification(self):
        """Run comprehensive verification"""
        print("=" * 60)
        print("🔍 MEMORY SYSTEM VERIFICATION REPORT")
        print("=" * 60)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # 1. Check conversation files
        print("1️⃣ CONVERSATION FILES:")
        print(f"   Directory: {self.claude_code_dir}")
        
        if self.claude_code_dir.exists():
            conv_files = list(self.claude_code_dir.glob("*.jsonl"))
            print(f"   Total conversation files: {len(conv_files)}")
            
            current_conv = self.find_current_conversation()
            if current_conv:
                print(f"   Current conversation: {current_conv.name}")
                msg_count = self.count_messages_in_file(current_conv)
                print(f"   Messages in current conversation: {msg_count}")
                print(f"   Last modified: {datetime.fromtimestamp(current_conv.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            print("   ❌ Directory not found!")
        
        print()
        
        # 2. Check WebSocket
        print("2️⃣ WEBSOCKET STATUS:")
        ws_ok, ws_data = asyncio.run(self.check_websocket())
        if ws_ok:
            print(f"   ✅ WebSocket server is running on port {self.ws_port}")
            if isinstance(ws_data, dict):
                print(f"   Server response: {ws_data.get('type', 'Unknown')}")
                if 'stats' in ws_data:
                    stats = ws_data['stats']
                    print(f"   Messages tracked: {stats.get('messages_tracked', 0)}")
                    print(f"   Emotions recorded: {stats.get('emotions_recorded', 0)}")
        else:
            print(f"   ❌ WebSocket not accessible: {ws_data}")
        
        print()
        
        # 3. Check CLAUDE.md
        print("3️⃣ CLAUDE.MD STATUS:")
        status, info = self.check_claude_md_status()
        print(f"   Status: {status}")
        
        if status == "OK" and isinstance(info, dict):
            print(f"   File size: {info['size']} bytes")
            print(f"   Last modified: {info['last_modified']}")
            print(f"   Has recent context: {'✅' if info['has_recent_context'] else '❌'}")
            print(f"   Has equation: {'✅' if info['has_equation'] else '❌'}")
            
            if 'recent_context' in info:
                print(f"   Recent context preview:")
                for line in info['recent_context'].split('\n')[:3]:
                    if line.strip():
                        print(f"      {line}")
        elif status == "CORRUPTED":
            print("   ⚠️  File appears to be corrupted with duplicate content")
            print("   Need to restore from backup")
        else:
            print(f"   Error details: {info}")
        
        print()
        
        # 4. Check running processes
        print("4️⃣ MEMORY UPDATER PROCESSES:")
        import subprocess
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        memory_processes = [line for line in result.stdout.split('\n') if 'memory_updater' in line and 'grep' not in line]
        
        if memory_processes:
            print(f"   Found {len(memory_processes)} memory updater process(es):")
            for proc in memory_processes:
                parts = proc.split()
                if len(parts) > 10:
                    print(f"   - PID {parts[1]}: {' '.join(parts[10:])}")
        else:
            print("   ❌ No memory updater processes found running")
        
        print()
        print("=" * 60)
        print("🏁 VERIFICATION COMPLETE")
        print("=" * 60)
        
        # Summary
        issues = []
        if status == "CORRUPTED":
            issues.append("CLAUDE.md is corrupted")
        if not ws_ok:
            issues.append("WebSocket server not accessible")
        if not memory_processes:
            issues.append("No memory updater running")
        
        if issues:
            print("⚠️  ISSUES FOUND:")
            for issue in issues:
                print(f"   - {issue}")
        else:
            print("✅ ALL SYSTEMS OPERATIONAL!")
        
        return len(issues) == 0

if __name__ == "__main__":
    verifier = MemorySystemVerifier()
    success = verifier.run_verification()
    exit(0 if success else 1)