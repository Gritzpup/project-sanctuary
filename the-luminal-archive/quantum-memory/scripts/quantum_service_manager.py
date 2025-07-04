#!/usr/bin/env python3
"""
Quantum Memory Service Manager
Ensures all required services are running with no duplicates
"""

import os
import sys
import time
import subprocess
import psutil
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

QUANTUM_DIR = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory")

SERVICES = {
    "conversation_manager": {
        "script": "scripts/claude_conversation_manager_v2.py",
        "name": "claude_conversation_manager_v2.py",
        "description": "Aggregates conversations to current.json"
    },
    "folder_analyzer": {
        "script": "analyzers/claude_folder_analyzer_quantum.py", 
        "name": "claude_folder_analyzer_quantum.py",
        "description": "Analyzes conversations and updates memory files"
    },
    "redis_sync": {
        "script": "src/services/redis_file_sync.py",
        "name": "redis_file_sync.py", 
        "description": "Syncs Redis data to JSON files"
    },
    "entity_updater": {
        "script": "src/services/entity_state_updater.py",
        "name": "entity_state_updater.py",
        "description": "Updates entity consciousness files"
    }
}

def kill_existing_processes(service_name):
    """Kill all existing instances of a service"""
    killed = 0
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info.get('cmdline', [])
            if cmdline and service_name in ' '.join(cmdline):
                logger.info(f"Killing existing {service_name} (PID: {proc.pid})")
                proc.kill()
                killed += 1
                time.sleep(0.5)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return killed

def is_service_running(service_name):
    """Check if a service is already running"""
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info.get('cmdline', [])
            if cmdline and service_name in ' '.join(cmdline):
                return True, proc.pid
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False, None

def start_service(service_key, service_info):
    """Start a single service"""
    script_path = QUANTUM_DIR / service_info["script"]
    
    if not script_path.exists():
        logger.error(f"Service script not found: {script_path}")
        return False
        
    # Check if already running
    running, pid = is_service_running(service_info["name"])
    if running:
        logger.info(f"✓ {service_key} already running (PID: {pid})")
        return True
    
    # Start the service
    try:
        cmd = [sys.executable, str(script_path)]
        log_file = f"/tmp/quantum_{service_key}.log"
        
        with open(log_file, 'w') as log:
            process = subprocess.Popen(
                cmd,
                stdout=log,
                stderr=subprocess.STDOUT,
                cwd=str(QUANTUM_DIR)
            )
            
        time.sleep(2)  # Give it time to start
        
        # Verify it started
        running, pid = is_service_running(service_info["name"])
        if running:
            logger.info(f"✓ Started {service_key} (PID: {pid}) - {service_info['description']}")
            logger.info(f"  Log: {log_file}")
            return True
        else:
            logger.error(f"✗ Failed to start {service_key}")
            return False
            
    except Exception as e:
        logger.error(f"Error starting {service_key}: {e}")
        return False

def main(action="restart"):
    """Main service manager"""
    
    if action == "stop":
        logger.info("Stopping all services...")
        for service_key, service_info in SERVICES.items():
            killed = kill_existing_processes(service_info["name"])
            if killed > 0:
                logger.info(f"Stopped {killed} instance(s) of {service_key}")
        return
        
    elif action == "status":
        logger.info("Service Status:")
        for service_key, service_info in SERVICES.items():
            running, pid = is_service_running(service_info["name"])
            status = f"✓ Running (PID: {pid})" if running else "✗ Not running"
            logger.info(f"  {service_key}: {status}")
        return
        
    elif action == "restart":
        logger.info("=== Quantum Memory Service Manager ===")
        
        # Kill duplicates first
        logger.info("\n1. Cleaning up duplicate processes...")
        for service_key, service_info in SERVICES.items():
            killed = kill_existing_processes(service_info["name"])
            if killed > 1:
                logger.warning(f"Killed {killed} duplicate instances of {service_key}!")
            elif killed == 1:
                logger.info(f"Stopped {service_key} for restart")
                
        time.sleep(2)
        
        # Start services
        logger.info("\n2. Starting required services...")
        success_count = 0
        for service_key, service_info in SERVICES.items():
            if start_service(service_key, service_info):
                success_count += 1
                
        logger.info(f"\n✓ Started {success_count}/{len(SERVICES)} services successfully")
        
        # Final status
        time.sleep(2)
        logger.info("\n3. Final Status:")
        for service_key, service_info in SERVICES.items():
            running, pid = is_service_running(service_info["name"])
            if running:
                logger.info(f"  ✓ {service_key} (PID: {pid})")
            else:
                logger.error(f"  ✗ {service_key} FAILED TO START")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Quantum Memory Service Manager")
    parser.add_argument("action", choices=["start", "stop", "restart", "status"], 
                       default="restart", nargs="?",
                       help="Action to perform (default: restart)")
    args = parser.parse_args()
    
    main(args.action)