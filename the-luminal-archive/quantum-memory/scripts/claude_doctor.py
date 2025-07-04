#!/usr/bin/env python3
"""
Claude Doctor - Comprehensive health check for quantum memory system
"""

import os
import sys
import json
import redis
import psutil
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class ClaudeDoctor:
    def __init__(self):
        self.issues = []
        self.warnings = []
        self.successes = []
        self.quantum_dir = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory")
        
    def check_services(self):
        """Check if all required services are running"""
        logger.info("🔍 Checking Services...")
        
        required_services = {
            "claude_conversation_manager_v2.py": "Conversation aggregator",
            "claude_folder_analyzer_quantum.py": "Quantum analyzer", 
            "redis_file_sync.py": "Redis to file sync",
            "entity_state_updater.py": "Entity state updater"
        }
        
        running_services = {}
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = ' '.join(proc.info.get('cmdline', []))
                for service, desc in required_services.items():
                    if service in cmdline:
                        if service not in running_services:
                            running_services[service] = []
                        running_services[service].append(proc.pid)
            except:
                pass
                
        for service, desc in required_services.items():
            if service in running_services:
                pids = running_services[service]
                if len(pids) == 1:
                    self.successes.append(f"✓ {desc} running (PID: {pids[0]})")
                else:
                    self.issues.append(f"❌ Multiple {desc} instances: {pids}")
            else:
                self.issues.append(f"❌ {desc} NOT RUNNING")
                
    def check_redis(self):
        """Check Redis connectivity and data"""
        logger.info("\n🔍 Checking Redis...")
        
        try:
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            r.ping()
            self.successes.append("✓ Redis connection OK")
            
            # Check key types
            keys_to_check = {
                "claude:messages:sorted": "zset",
                "claude:messages:data": "hash",
                "quantum:memory:work_summary": "hash",
                "quantum:memory:current_session": "hash"
            }
            
            for key, expected_type in keys_to_check.items():
                key_type = r.type(key)
                if key_type == expected_type:
                    self.successes.append(f"✓ {key} is correct type ({expected_type})")
                elif key_type == 'none':
                    self.warnings.append(f"⚠️  {key} does not exist")
                else:
                    self.issues.append(f"❌ {key} wrong type: {key_type} (expected {expected_type})")
                    
            # Check message count
            msg_count = r.zcard("claude:messages:sorted")
            self.successes.append(f"✓ Redis has {msg_count} messages")
            
        except Exception as e:
            self.issues.append(f"❌ Redis error: {e}")
            
    def check_files(self):
        """Check important files"""
        logger.info("\n🔍 Checking Files...")
        
        files_to_check = [
            ("quantum_states/conversations/current.json", 1440),  # Updated in last day
            ("quantum_states/memories/work_summary_24h.json", 60),  # Updated in last hour
            ("CLAUDE.md", 60),  # Updated in last hour
            ("quantum_states/memories/current_session.json", 1440)  # Updated in last day
        ]
        
        for file_path, max_age_minutes in files_to_check:
            full_path = self.quantum_dir / file_path
            if full_path.exists():
                # Check modification time
                mtime = datetime.fromtimestamp(full_path.stat().st_mtime)
                age = datetime.now() - mtime
                
                if age < timedelta(minutes=max_age_minutes):
                    self.successes.append(f"✓ {file_path} (updated {int(age.total_seconds()/60)}m ago)")
                else:
                    self.warnings.append(f"⚠️  {file_path} is stale (updated {int(age.total_seconds()/60)}m ago)")
                    
                # Check file size
                size = full_path.stat().st_size
                if size == 0:
                    self.issues.append(f"❌ {file_path} is empty!")
                elif file_path == "quantum_states/conversations/current.json" and size > 1_000_000:
                    self.warnings.append(f"⚠️  current.json is large: {size/1024/1024:.1f}MB")
            else:
                self.issues.append(f"❌ {file_path} does not exist!")
                
    def check_current_json(self):
        """Analyze current.json structure"""
        logger.info("\n🔍 Checking current.json...")
        
        try:
            current_json = self.quantum_dir / "quantum_states/conversations/current.json"
            with open(current_json) as f:
                data = json.load(f)
                
            # Check metadata
            if 'metadata' in data:
                meta = data['metadata']
                self.successes.append(f"✓ Total messages: {meta.get('total_messages', 0)}")
                self.successes.append(f"✓ Max messages setting: {meta.get('max_messages', 'unknown')}")
                
                # Check timestamps
                if 'newest_timestamp' in meta and 'oldest_timestamp' in meta:
                    try:
                        newest = datetime.fromisoformat(meta['newest_timestamp'].replace('Z', '+00:00'))
                        oldest = datetime.fromisoformat(meta['oldest_timestamp'].replace('Z', '+00:00'))
                        span = newest - oldest
                        self.successes.append(f"✓ Time span: {span}")
                    except:
                        self.warnings.append("⚠️  Could not parse timestamps")
                        
            # Check messages
            if 'messages' in data:
                msg_count = len(data['messages'])
                if msg_count != data['metadata'].get('total_messages', msg_count):
                    self.issues.append(f"❌ Message count mismatch: {msg_count} vs {data['metadata'].get('total_messages')}")
                    
                # Check for recent messages
                if msg_count > 0:
                    latest_msg = data['messages'][0]
                    if 'timestamp' in latest_msg:
                        try:
                            ts = datetime.fromisoformat(latest_msg['timestamp'].replace('Z', '+00:00'))
                            age = datetime.now(ts.tzinfo) - ts
                            if age < timedelta(minutes=5):
                                self.successes.append(f"✓ Latest message is {int(age.total_seconds())}s old")
                            else:
                                self.warnings.append(f"⚠️  Latest message is {int(age.total_seconds()/60)}m old")
                        except:
                            pass
                            
        except Exception as e:
            self.issues.append(f"❌ Error reading current.json: {e}")
            
    def check_logs(self):
        """Check service logs for errors"""
        logger.info("\n🔍 Checking Logs...")
        
        log_files = [
            "/tmp/quantum_conversation_manager.log",
            "/tmp/quantum_folder_analyzer.log",
            "/tmp/quantum_redis_sync.log",
            "/tmp/quantum_entity_updater.log"
        ]
        
        for log_file in log_files:
            if Path(log_file).exists():
                try:
                    # Check last 100 lines for errors
                    result = subprocess.run(
                        f"tail -100 {log_file} | grep -i error | tail -5",
                        shell=True, capture_output=True, text=True
                    )
                    if result.stdout:
                        self.warnings.append(f"⚠️  Recent errors in {Path(log_file).name}:")
                        for line in result.stdout.strip().split('\n'):
                            self.warnings.append(f"    {line[:80]}...")
                except:
                    pass
                    
    def run_diagnosis(self):
        """Run all health checks"""
        logger.info("🏥 Claude Doctor - Quantum Memory Health Check")
        logger.info("=" * 60)
        
        self.check_services()
        self.check_redis()
        self.check_files()
        self.check_current_json()
        self.check_logs()
        
        # Summary
        logger.info("\n📊 Summary:")
        logger.info(f"✅ Successes: {len(self.successes)}")
        logger.info(f"⚠️  Warnings: {len(self.warnings)}")
        logger.info(f"❌ Issues: {len(self.issues)}")
        
        if self.issues:
            logger.info("\n🚨 Critical Issues:")
            for issue in self.issues:
                logger.info(f"  {issue}")
                
        if self.warnings:
            logger.info("\n⚠️  Warnings:")
            for warning in self.warnings:
                logger.info(f"  {warning}")
                
        if not self.issues:
            logger.info("\n✅ System is healthy!")
        else:
            logger.info("\n💊 Prescription:")
            logger.info("  Run: python3 scripts/quantum_service_manager.py restart")
            
        return len(self.issues) == 0

if __name__ == "__main__":
    doctor = ClaudeDoctor()
    healthy = doctor.run_diagnosis()