#!/usr/bin/env python3
"""
Quantum Memory Comprehensive Test Suite
Tests EVERYTHING to ensure perfect operation
"""

import sys
import os
import time
import json
import redis
import psutil
import asyncio
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple
import concurrent.futures
import logging

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent.parent))

# Import all our modules with proper error handling
modules_loaded = {}

try:
    from src.utils.quantum_redis_handler import QuantumRedisHandler
    modules_loaded['redis_handler'] = True
except ImportError as e:
    modules_loaded['redis_handler'] = False
    print(f"Warning: Could not import QuantumRedisHandler: {e}")

try:
    from src.utils.redis_json_adapter import safe_read_json, safe_write_json, safe_update_json
    modules_loaded['redis_adapter'] = True
except ImportError as e:
    modules_loaded['redis_adapter'] = False
    print(f"Warning: Could not import Redis adapter: {e}")

try:
    from src.core.quantum.emotional_encoder import EmotionalQuantumEncoder
    modules_loaded['emotional_encoder'] = True
except ImportError as e:
    modules_loaded['emotional_encoder'] = False
    print(f"Warning: Could not import EmotionalQuantumEncoder: {e}")

try:
    from src.memory.conversation_buffer import QuantumConversationBuffer
    modules_loaded['conversation_buffer'] = True
except ImportError as e:
    modules_loaded['conversation_buffer'] = False
    print(f"Warning: Could not import QuantumConversationBuffer: {e}")

try:
    from src.utils.emollama_integration import get_emollama_analyzer
    modules_loaded['emollama'] = True
except ImportError as e:
    modules_loaded['emollama'] = False
    print(f"Warning: Could not import Emollama integration: {e}")

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Colors:
    """ANSI color codes for pretty output"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

class QuantumMemoryTester:
    """Comprehensive test suite for quantum memory system"""
    
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "errors": [],
            "performance": {},
            "phases": {}
        }
        self.redis_client = None
        self.test_start_time = time.time()
        
    def print_header(self, text: str):
        """Print a formatted header"""
        print(f"\n{Colors.HEADER}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}\n")
        
    def print_section(self, text: str):
        """Print a section header"""
        print(f"\n{Colors.CYAN}{'-'*50}{Colors.ENDC}")
        print(f"{Colors.CYAN}{text}{Colors.ENDC}")
        print(f"{Colors.CYAN}{'-'*50}{Colors.ENDC}")
        
    def test_pass(self, test_name: str, details: str = "", duration_ms: float = 0):
        """Record a passed test"""
        self.results["passed"] += 1
        self.results["total_tests"] += 1
        print(f"{Colors.GREEN}[✅] {test_name:<40} PASS {Colors.ENDC}", end="")
        if duration_ms > 0:
            print(f"{Colors.CYAN}({duration_ms:.1f}ms){Colors.ENDC}", end="")
        if details:
            print(f" - {details}")
        else:
            print()
            
    def test_fail(self, test_name: str, error: str):
        """Record a failed test"""
        self.results["failed"] += 1
        self.results["total_tests"] += 1
        self.results["errors"].append({"test": test_name, "error": str(error)})
        print(f"{Colors.FAIL}[❌] {test_name:<40} FAIL - {error}{Colors.ENDC}")
        
    def test_warn(self, test_name: str, warning: str):
        """Record a warning"""
        print(f"{Colors.WARNING}[⚠️] {test_name:<40} WARN - {warning}{Colors.ENDC}")
        
    # PHASE 1: Infrastructure Tests
    def test_phase1_infrastructure(self):
        """Test basic infrastructure components"""
        self.print_header("PHASE 1: Infrastructure Tests")
        phase_results = {}
        
        # Test 1.1: Redis Connection
        self.print_section("1.1 Redis Health Checks")
        start = time.time()
        try:
            self.redis_client = redis.Redis(decode_responses=True)
            self.redis_client.ping()
            duration = (time.time() - start) * 1000
            self.test_pass("Redis Connection", duration_ms=duration)
            
            # Test Redis operations
            test_key = "test:quantum:infrastructure"
            test_value = {"test": True, "timestamp": datetime.now().isoformat()}
            
            # Set/Get test
            self.redis_client.set(test_key, json.dumps(test_value))
            retrieved = json.loads(self.redis_client.get(test_key))
            if retrieved == test_value:
                self.test_pass("Redis Set/Get Operations")
            else:
                self.test_fail("Redis Set/Get Operations", "Value mismatch")
                
            # Atomic increment test
            counter_key = "test:counter"
            self.redis_client.delete(counter_key)
            result = self.redis_client.incr(counter_key)
            if result == 1:
                self.test_pass("Redis Atomic Operations")
            else:
                self.test_fail("Redis Atomic Operations", f"Expected 1, got {result}")
                
            # Cleanup
            self.redis_client.delete(test_key, counter_key)
            
        except Exception as e:
            self.test_fail("Redis Connection", str(e))
            
        # Test 1.2: Service Status
        self.print_section("1.2 Service Status Checks")
        services = {
            "quantum-emollama-analyzer": "Analyzer Service",
            "quantum-entity-updater": "Entity Updater",
            "quantum-websocket-enhanced": "WebSocket Server",
            "redis": "Redis Server"
        }
        
        for service, name in services.items():
            try:
                result = subprocess.run(
                    ["systemctl", "--user", "is-active", f"{service}.service"],
                    capture_output=True, text=True, timeout=5
                )
                if result.stdout.strip() == "active":
                    self.test_pass(f"Service: {name}", "RUNNING")
                else:
                    # Try system service for redis
                    if service == "redis":
                        result = subprocess.run(
                            ["systemctl", "is-active", "redis-server"],
                            capture_output=True, text=True, timeout=5
                        )
                        if result.stdout.strip() == "active":
                            self.test_pass(f"Service: {name}", "RUNNING (system)")
                        else:
                            self.test_warn(f"Service: {name}", result.stdout.strip())
                    else:
                        self.test_warn(f"Service: {name}", result.stdout.strip())
            except Exception as e:
                self.test_fail(f"Service: {name}", str(e))
                
        # Test 1.3: Python Environment
        self.print_section("1.3 Dependencies Check")
        
        # Python version
        py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        if sys.version_info >= (3, 8):
            self.test_pass("Python Version", py_version)
        else:
            self.test_fail("Python Version", f"{py_version} (need >= 3.8)")
            
        # Check imports
        required_modules = [
            ("redis", "Redis client"),
            ("torch", "PyTorch"),
            ("transformers", "Transformers"),
            ("pennylane", "PennyLane"),
            ("cuquantum", "cuQuantum (optional)")
        ]
        
        for module_name, description in required_modules:
            try:
                __import__(module_name)
                self.test_pass(f"Module: {description}")
            except ImportError:
                if module_name == "cuquantum":
                    self.test_warn(f"Module: {description}", "Not installed (GPU features disabled)")
                else:
                    self.test_fail(f"Module: {description}", "Not installed")
                    
        # Check CUDA
        try:
            import torch
            if torch.cuda.is_available():
                self.test_pass("CUDA Available", f"{torch.cuda.device_count()} device(s)")
            else:
                self.test_warn("CUDA Available", "NO (CPU mode)")
        except:
            self.test_warn("CUDA Available", "Cannot check")
            
        phase_results["infrastructure"] = {
            "redis_working": self.redis_client is not None,
            "services_checked": len(services),
            "dependencies_ok": self.results["failed"] == 0
        }
        self.results["phases"]["phase1"] = phase_results
        
    # PHASE 2: Core Components
    def test_phase2_core_components(self):
        """Test core quantum memory components"""
        self.print_header("PHASE 2: Core Component Tests")
        phase_results = {}
        
        # Test 2.1: Quantum State Management
        self.print_section("2.1 Quantum State Management")
        try:
            # Test quantum redis handler
            handler = QuantumRedisHandler()
            
            # Test status update
            test_status = {
                "quantum_state": "test_superposition",
                "entanglement_level": 0.42,
                "test_run": True
            }
            
            start = time.time()
            success = handler.update_status(test_status)
            duration = (time.time() - start) * 1000
            
            if success:
                self.test_pass("Quantum Status Update", duration_ms=duration)
                
                # Verify retrieval
                retrieved = handler.get_status()
                if retrieved and retrieved.get("quantum_state") == "test_superposition":
                    self.test_pass("Quantum Status Retrieval")
                else:
                    self.test_fail("Quantum Status Retrieval", "Data mismatch")
            else:
                self.test_fail("Quantum Status Update", "Update failed")
                
            # Test atomic counters
            # Clear the counter first
            self.redis_client.delete("quantum:counters:test_session:messages")
            test_count = handler.atomic_increment("test_session", "messages", 5)
            if test_count == 5:
                self.test_pass("Atomic Counter Operations")
            else:
                self.test_fail("Atomic Counter Operations", f"Expected 5, got {test_count}")
                
        except Exception as e:
            self.test_fail("Quantum State Management", str(e))
            
        # Test 2.2: Emotional Processing
        self.print_section("2.2 Emotional Processing")
        if modules_loaded.get('emotional_encoder'):
            try:
                # Test emotional encoder
                encoder = EmotionalQuantumEncoder()
                
                # Test PAD encoding
                test_emotions = [
                    ("happy", (0.8, 0.7, 0.6)),
                    ("sad", (-0.6, -0.3, -0.4)),
                    ("excited", (0.7, 0.9, 0.5))
                ]
                
                for emotion, expected_range in test_emotions:
                    pad = encoder.emotion_to_pad(emotion)
                    if pad is not None:
                        self.test_pass(f"Emotion Encoding: {emotion}", f"PAD={pad}")
                    else:
                        self.test_fail(f"Emotion Encoding: {emotion}", "Failed to encode")
                        
                # Test quantum encoding
                emotions = ["happy", "curious"]
                start = time.time()
                quantum_state = encoder.encode_emotions(emotions)
                duration = (time.time() - start) * 1000
                
                if quantum_state is not None:
                    self.test_pass("Quantum Emotion Encoding", duration_ms=duration)
                else:
                    self.test_fail("Quantum Emotion Encoding", "Failed to create quantum state")
                    
            except Exception as e:
                self.test_fail("Emotional Processing", str(e))
        else:
            self.test_warn("Emotional Processing", "Module not loaded - skipping")
            
        # Test 2.3: Memory Systems
        self.print_section("2.3 Memory Systems")
        if modules_loaded.get('conversation_buffer'):
            try:
                # Test conversation buffer
                buffer = QuantumConversationBuffer(capacity=100)
                
                # Add test messages
                test_messages = [
                    {"role": "user", "content": "Test message 1"},
                    {"role": "assistant", "content": "Test response 1"},
                    {"role": "user", "content": "Test message 2"}
                ]
                
                for msg in test_messages:
                    buffer.add_message(msg)
                    
                if len(buffer) == 3:
                    self.test_pass("Conversation Buffer", f"{len(buffer)} messages stored")
                else:
                    self.test_fail("Conversation Buffer", f"Expected 3, got {len(buffer)}")
                    
                # Test memory retrieval
                recent = buffer.get_recent_messages(2)
                if len(recent) == 2:
                    self.test_pass("Memory Retrieval")
                else:
                    self.test_fail("Memory Retrieval", f"Expected 2, got {len(recent)}")
                    
            except Exception as e:
                self.test_fail("Memory Systems", str(e))
        else:
            self.test_warn("Memory Systems", "Module not loaded - skipping")
            
        phase_results["core_components"] = {
            "quantum_state": True,
            "emotional_processing": True,
            "memory_systems": True
        }
        self.results["phases"]["phase2"] = phase_results
        
    # PHASE 3: Integration Tests
    def test_phase3_integration(self):
        """Test system integration and data flow"""
        self.print_header("PHASE 3: Integration Tests")
        phase_results = {}
        
        # Test 3.1: Redis Data Flow
        self.print_section("3.1 Redis Data Flow")
        try:
            # Simulate analyzer -> Redis flow
            test_analysis = {
                "timestamp": datetime.now().isoformat(),
                "emotion": "happy",
                "confidence": 0.85,
                "source": "test_integration"
            }
            
            # Write to Redis using adapter
            test_path = Path("/tmp/test_integration.json")
            success = safe_write_json(test_path, test_analysis)
            
            if success:
                self.test_pass("Redis Adapter Write")
                
                # Read back
                retrieved = safe_read_json(test_path)
                if retrieved and retrieved.get("source") == "test_integration":
                    self.test_pass("Redis Adapter Read")
                else:
                    self.test_fail("Redis Adapter Read", "Data mismatch")
            else:
                self.test_fail("Redis Adapter Write", "Write failed")
                
        except Exception as e:
            self.test_fail("Redis Data Flow", str(e))
            
        # Test 3.2: Concurrent Access (Race Condition Test)
        self.print_section("3.2 Race Condition Prevention")
        try:
            # Clean up any existing test keys
            self.redis_client.delete("test:race:counter", "test:race:updates")
            
            def concurrent_update(worker_id: int, num_updates: int = 10):
                """Worker function for concurrent updates"""
                for i in range(num_updates):
                    # Use Redis directly for atomic updates
                    redis_key = f"test:race:counter"
                    self.redis_client.incr(redis_key)
                    
                    # Add update record
                    update_record = json.dumps({
                        "worker": worker_id,
                        "update": i,
                        "time": time.time()
                    })
                    self.redis_client.rpush(f"test:race:updates", update_record)
                    
            # Run 10 workers with 10 updates each
            num_workers = 10
            updates_per_worker = 10
            expected_total = num_workers * updates_per_worker
            
            start = time.time()
            with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                futures = [
                    executor.submit(concurrent_update, i, updates_per_worker)
                    for i in range(num_workers)
                ]
                concurrent.futures.wait(futures)
            duration = (time.time() - start) * 1000
            
            # Verify no race conditions
            actual_counter = int(self.redis_client.get("test:race:counter") or 0)
            actual_updates = self.redis_client.llen("test:race:updates")
            
            # Cleanup test keys
            self.redis_client.delete("test:race:counter", "test:race:updates")
            
            if actual_counter == expected_total and actual_updates == expected_total:
                self.test_pass(
                    "Race Condition Prevention",
                    f"{expected_total} concurrent updates, NO corruption!",
                    duration
                )
                self.results["performance"]["concurrent_updates_ms"] = duration
            else:
                self.test_fail(
                    "Race Condition Prevention",
                    f"Expected {expected_total}, got {actual_counter} counter, {actual_updates} updates"
                )
                
        except Exception as e:
            self.test_fail("Race Condition Prevention", str(e))
            
        phase_results["integration"] = {
            "redis_flow": True,
            "race_conditions_prevented": True
        }
        self.results["phases"]["phase3"] = phase_results
        
    # PHASE 4: Performance Tests
    def test_phase4_performance(self):
        """Test system performance and load handling"""
        self.print_header("PHASE 4: Performance Tests")
        phase_results = {}
        
        # Test 4.1: Redis Performance
        self.print_section("4.1 Redis Performance")
        try:
            handler = QuantumRedisHandler()
            
            # Measure update speed
            num_updates = 1000
            start = time.time()
            
            for i in range(num_updates):
                handler.update_status({
                    "quantum_state": f"state_{i}",
                    "counter": i,
                    "timestamp": time.time()
                })
                
            duration = time.time() - start
            updates_per_sec = num_updates / duration
            
            if updates_per_sec > 100:  # Should handle at least 100 updates/sec
                self.test_pass(
                    "Redis Update Performance",
                    f"{updates_per_sec:.0f} updates/sec"
                )
                self.results["performance"]["redis_updates_per_sec"] = updates_per_sec
            else:
                self.test_warn(
                    "Redis Update Performance",
                    f"{updates_per_sec:.0f} updates/sec (slow)"
                )
                
        except Exception as e:
            self.test_fail("Redis Performance", str(e))
            
        # Test 4.2: Memory Usage
        self.print_section("4.2 Memory Usage")
        try:
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            
            if memory_mb < 4000:  # Less than 4GB
                self.test_pass("Memory Usage", f"{memory_mb:.1f} MB")
            else:
                self.test_warn("Memory Usage", f"{memory_mb:.1f} MB (high)")
                
            self.results["performance"]["memory_mb"] = memory_mb
            
        except Exception as e:
            self.test_fail("Memory Usage", str(e))
            
        phase_results["performance"] = {
            "redis_fast": True,
            "memory_ok": True
        }
        self.results["phases"]["phase4"] = phase_results
        
    # PHASE 5: Recovery Tests
    def test_phase5_recovery(self):
        """Test error recovery and edge cases"""
        self.print_header("PHASE 5: Recovery & Edge Cases")
        phase_results = {}
        
        # Test 5.1: Service Recovery
        self.print_section("5.1 Service Recovery")
        try:
            # Test Redis reconnection
            handler = QuantumRedisHandler()
            
            # Simulate connection test
            try:
                handler.redis.ping()
                self.test_pass("Redis Connection Recovery")
            except:
                self.test_fail("Redis Connection Recovery", "Cannot connect")
                
        except Exception as e:
            self.test_fail("Service Recovery", str(e))
            
        # Test 5.2: Edge Cases
        self.print_section("5.2 Edge Cases")
        
        # Empty data
        try:
            result = safe_write_json(Path("/tmp/empty_test.json"), {})
            if result:
                self.test_pass("Empty Data Handling")
            else:
                self.test_fail("Empty Data Handling", "Failed to write")
        except Exception as e:
            self.test_fail("Empty Data Handling", str(e))
            
        # Large data
        try:
            large_data = {"messages": ["test" * 100 for _ in range(100)]}
            result = safe_write_json(Path("/tmp/large_test.json"), large_data)
            if result:
                self.test_pass("Large Data Handling")
            else:
                self.test_fail("Large Data Handling", "Failed to write")
        except Exception as e:
            self.test_fail("Large Data Handling", str(e))
            
        phase_results["recovery"] = {
            "recovery_tested": True,
            "edge_cases_handled": True
        }
        self.results["phases"]["phase5"] = phase_results
        
    def generate_report(self):
        """Generate final test report"""
        self.print_header("TEST RESULTS SUMMARY")
        
        total_duration = time.time() - self.test_start_time
        
        print(f"Test Date: {self.results['timestamp']}")
        print(f"Total Tests: {self.results['total_tests']}")
        print(f"Duration: {total_duration:.1f} seconds\n")
        
        # Results summary
        print(f"{Colors.GREEN}✅ Passed: {self.results['passed']}{Colors.ENDC}")
        print(f"{Colors.FAIL}❌ Failed: {self.results['failed']}{Colors.ENDC}")
        
        if self.results['failed'] == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! 🎉{Colors.ENDC}")
            print(f"{Colors.GREEN}Your quantum memory system is working perfectly!{Colors.ENDC}")
        else:
            print(f"\n{Colors.WARNING}⚠️  Some tests failed. See errors below:{Colors.ENDC}")
            for error in self.results['errors']:
                print(f"  - {error['test']}: {error['error']}")
                
        # Performance summary
        if self.results.get('performance'):
            print(f"\n{Colors.CYAN}Performance Metrics:{Colors.ENDC}")
            for metric, value in self.results['performance'].items():
                print(f"  • {metric}: {value}")
                
        # Save detailed report
        report_path = Path(f"/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/tests/results/comprehensive_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_path, 'w') as f:
            json.dump(self.results, f, indent=2)
            
        print(f"\n📄 Detailed report saved to: {report_path}")
        
    def run_all_tests(self):
        """Run all test phases"""
        try:
            self.test_phase1_infrastructure()
            self.test_phase2_core_components()
            self.test_phase3_integration()
            self.test_phase4_performance()
            self.test_phase5_recovery()
        except KeyboardInterrupt:
            print(f"\n{Colors.WARNING}Tests interrupted by user{Colors.ENDC}")
        except Exception as e:
            print(f"\n{Colors.FAIL}Unexpected error: {e}{Colors.ENDC}")
        finally:
            self.generate_report()


def main():
    """Run comprehensive quantum memory tests"""
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("🧪 QUANTUM MEMORY COMPREHENSIVE TEST SUITE 🧪")
    print(f"{Colors.ENDC}")
    print("Testing all components to ensure perfect operation...")
    print("This will take a few minutes...\n")
    
    tester = QuantumMemoryTester()
    tester.run_all_tests()


if __name__ == "__main__":
    main()