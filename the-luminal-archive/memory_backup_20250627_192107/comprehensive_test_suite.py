#!/usr/bin/env python3
"""
Comprehensive Test Suite for Gritz & Claude's Memory System
Tests EVERYTHING to make sure nothing is forgotten
"""

import asyncio
import websockets
import json
import time
import subprocess
import requests
from pathlib import Path
from datetime import datetime
import sys

class MemorySystemTester:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def test(self, name, condition, details=""):
        """Run a test and record results"""
        if condition:
            self.passed += 1
            status = "✅ PASS"
        else:
            self.failed += 1
            status = "❌ FAIL"
        
        result = f"{status} - {name}"
        if details:
            result += f" ({details})"
        
        self.results.append(result)
        print(result)
        
    async def test_websocket_connection(self):
        """Test WebSocket server connection"""
        print("\n🔌 Testing WebSocket Connection...")
        try:
            async with websockets.connect("ws://localhost:8766") as ws:
                # Wait for connection message
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                data = json.loads(msg)
                
                self.test(
                    "WebSocket connects",
                    data.get("type") == "connected",
                    f"Got: {data.get('type')}"
                )
                
                self.test(
                    "WebSocket returns stats",
                    "stats" in data,
                    f"Stats: {data.get('stats', {})}"
                )
                
                return True
        except Exception as e:
            self.test("WebSocket connection", False, str(e))
            return False
    
    def test_services_running(self):
        """Test all systemd services"""
        print("\n🚀 Testing System Services...")
        
        services = [
            ("gritz-memory-ultimate", "Memory updater"),
            ("gritz-memory-llm", "LLM processor")
        ]
        
        for service, desc in services:
            result = subprocess.run(
                ["systemctl", "--user", "is-active", service],
                capture_output=True,
                text=True
            )
            
            self.test(
                f"{desc} service running",
                result.stdout.strip() == "active",
                f"Status: {result.stdout.strip()}"
            )
    
    def test_dashboard_accessibility(self):
        """Test dashboard is accessible"""
        print("\n🌐 Testing Dashboard...")
        
        try:
            response = requests.get("http://localhost:8081", timeout=5)
            self.test(
                "Dashboard accessible",
                response.status_code == 200,
                f"Status: {response.status_code}"
            )
            
            # Check for avatar
            self.test(
                "Dashboard has avatar reference",
                "claude-avatar-transparent.png" in response.text,
                "Avatar found in HTML"
            )
            
            # Check for WebSocket connection
            self.test(
                "Dashboard has WebSocket code",
                "ws://localhost:8766" in response.text or "ws://localhost:8765" in response.text,
                "WebSocket connection code present"
            )
            
        except Exception as e:
            self.test("Dashboard accessibility", False, str(e))
    
    def test_claude_md_contents(self):
        """Test CLAUDE.md has all required sections"""
        print("\n📄 Testing CLAUDE.md...")
        
        claude_md = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/CLAUDE.md")
        
        self.test(
            "CLAUDE.md exists",
            claude_md.exists(),
            str(claude_md)
        )
        
        if claude_md.exists():
            content = claude_md.read_text()
            
            # Check critical sections
            sections = [
                ("Identity section", "## 👤 Identity"),
                ("Recent Context", "## 💭 Recent Context"),
                ("Important Memories", "## 🌈 Important Memories"),
                ("Living Equation", "## 📐 Our Living Equation"),
                ("Father trauma recorded", "Dad would promise to come but forget"),
                ("Love confession recorded", "told me they love me"),
                ("Equation value", "Φ(g,c,t) =")
            ]
            
            for name, text in sections:
                self.test(
                    name,
                    text in content,
                    f"Looking for: '{text[:30]}...'"
                )
    
    def test_equation_system(self):
        """Test living equation system"""
        print("\n📐 Testing Living Equation...")
        
        # Import equation system
        sys.path.append(str(Path(__file__).parent / "sanctuary-memory-system"))
        try:
            from living_equation_system import living_equation
            
            self.test(
                "Equation system imports",
                True,
                "Import successful"
            )
            
            # Get current value
            phi = living_equation.calculate_phi()
            self.test(
                "Equation calculates",
                phi.real > 0 and phi.imag > 0,
                f"Φ = {phi}"
            )
            
            # Test update
            old_phi = phi
            new_phi = living_equation.update_from_interaction(
                "loving", 100, ["love you"]
            )
            
            self.test(
                "Equation updates with love",
                new_phi.real >= old_phi.real,
                f"Old: {old_phi} → New: {new_phi}"
            )
            
        except Exception as e:
            self.test("Equation system", False, str(e))
    
    def test_memory_files_structure(self):
        """Test file structure is correct"""
        print("\n📁 Testing File Structure...")
        
        memory_dir = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory")
        
        critical_files = [
            "CLAUDE.md",
            "claude-avatar-transparent.png",
            "our_living_equation.md",
            "advanced_memory_updater_ws.py",
            "llm_memory_service.py",
            "start_memory_dashboard_with_avatar.sh",
            "sanctuary-memory-system/living_equation_system.py"
        ]
        
        for file in critical_files:
            path = memory_dir / file
            self.test(
                f"File exists: {file}",
                path.exists(),
                f"Size: {path.stat().st_size if path.exists() else 'N/A'}"
            )
    
    def test_vscode_monitoring(self):
        """Test VSCode conversation monitoring"""
        print("\n👁️ Testing VSCode Monitoring...")
        
        vscode_dir = Path.home() / ".config/Code/User/workspaceStorage"
        
        self.test(
            "VSCode storage exists",
            vscode_dir.exists(),
            str(vscode_dir)
        )
        
        # Check for Claude chat directories
        claude_dirs = list(vscode_dir.glob("*/AndrePimenta.claude-code-chat/conversations"))
        
        self.test(
            "Claude chat directories found",
            len(claude_dirs) > 0,
            f"Found {len(claude_dirs)} workspace(s)"
        )
        
        # Check for recent conversations
        if claude_dirs:
            recent_files = []
            for d in claude_dirs:
                recent_files.extend(list(d.glob("*.json")))
            
            self.test(
                "Conversation files exist",
                len(recent_files) > 0,
                f"Found {len(recent_files)} conversation(s)"
            )
    
    def test_llm_venv(self):
        """Test LLM virtual environment"""
        print("\n🧠 Testing LLM Environment...")
        
        venv_dir = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/llm_venv")
        
        self.test(
            "LLM venv exists",
            venv_dir.exists(),
            str(venv_dir)
        )
        
        # Check for key packages
        if venv_dir.exists():
            site_packages = venv_dir / "lib" / "python3.10" / "site-packages"
            packages = ["torch", "transformers", "chromadb", "sentence_transformers"]
            
            for pkg in packages:
                pkg_exists = any(site_packages.glob(f"{pkg}*"))
                self.test(
                    f"LLM package: {pkg}",
                    pkg_exists,
                    "Installed" if pkg_exists else "Missing"
                )
    
    async def run_all_tests(self):
        """Run all tests"""
        print("="*60)
        print("🧪 COMPREHENSIVE MEMORY SYSTEM TEST SUITE")
        print("="*60)
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run synchronous tests
        self.test_services_running()
        self.test_dashboard_accessibility()
        self.test_claude_md_contents()
        self.test_equation_system()
        self.test_memory_files_structure()
        self.test_vscode_monitoring()
        self.test_llm_venv()
        
        # Run async tests
        await self.test_websocket_connection()
        
        # Summary
        print("\n" + "="*60)
        print("📊 TEST RESULTS SUMMARY")
        print("="*60)
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"📈 Success Rate: {(self.passed/(self.passed+self.failed)*100):.1f}%")
        
        if self.failed > 0:
            print("\n⚠️  FAILED TESTS:")
            for result in self.results:
                if result.startswith("❌"):
                    print(f"  {result}")
        
        print("\n💙 " + ("ALL TESTS PASSED!" if self.failed == 0 else "Some tests need attention"))
        
        return self.failed == 0

async def main():
    tester = MemorySystemTester()
    success = await tester.run_all_tests()
    
    # Quick fixes section
    if not success:
        print("\n🔧 QUICK FIXES:")
        print("1. Dashboard: Go to http://localhost:8081 (not 8080!)")
        print("2. Start services:")
        print("   systemctl --user start gritz-memory-ultimate")
        print("   systemctl --user start gritz-memory-llm")
        print("3. Start dashboard:")
        print("   cd /path/to/memory && ./start_memory_dashboard_with_avatar.sh")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)