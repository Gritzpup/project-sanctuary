#!/usr/bin/env python3
"""
Quantum Memory Service Terminal with Traffic Light System
Interactive terminal UI for managing quantum memory services
"""

import os
import sys
import time
import json
import subprocess
import psutil
import threading
import signal
from pathlib import Path
from datetime import datetime
import curses
from curses import wrapper
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import logging

# Setup logging
logging.basicConfig(
    filename='/tmp/quantum_service_terminal.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ServiceConfig:
    """Configuration for a service"""
    name: str
    script: str
    description: str
    start_command: Optional[str] = None
    stop_command: Optional[str] = None
    status_check: Optional[str] = None
    log_file: Optional[str] = None
    auto_restart: bool = False
    restart_delay: int = 5
    dependencies: List[str] = field(default_factory=list)
    environment: Dict[str, str] = field(default_factory=dict)
    working_dir: Optional[str] = None

@dataclass
class ServiceStatus:
    """Current status of a service"""
    pid: Optional[int] = None
    status: str = "stopped"  # stopped, starting, running, error
    last_start: Optional[datetime] = None
    last_stop: Optional[datetime] = None
    error_message: Optional[str] = None
    cpu_percent: float = 0.0
    memory_mb: float = 0.0
    uptime_seconds: int = 0

class ServiceTerminal:
    """Terminal UI for service management"""
    
    QUANTUM_DIR = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory")
    CONFIG_FILE = QUANTUM_DIR / "services" / "service_config.json"
    START_SCRIPTS_DIR = QUANTUM_DIR / "services" / "start_scripts"
    
    # Traffic light colors
    COLORS = {
        "stopped": (1, curses.COLOR_RED),      # Red
        "starting": (2, curses.COLOR_YELLOW),  # Yellow
        "running": (3, curses.COLOR_GREEN),    # Green
        "error": (4, curses.COLOR_MAGENTA)     # Magenta
    }
    
    def __init__(self):
        self.services: Dict[str, ServiceConfig] = {}
        self.statuses: Dict[str, ServiceStatus] = {}
        self.selected_index = 0
        self.running = True
        self.stdscr = None
        self.status_lock = threading.Lock()
        self.monitor_thread = None
        
        # Create directories if they don't exist
        self.START_SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
        (self.QUANTUM_DIR / "services").mkdir(exist_ok=True)
        
        # Load or create default configuration
        self.load_config()
        
    def load_config(self):
        """Load service configuration from file or create default"""
        if self.CONFIG_FILE.exists():
            try:
                with open(self.CONFIG_FILE, 'r') as f:
                    config_data = json.load(f)
                    for name, data in config_data.items():
                        self.services[name] = ServiceConfig(**data)
                        self.statuses[name] = ServiceStatus()
            except Exception as e:
                logger.error(f"Failed to load config: {e}")
                self.create_default_config()
        else:
            self.create_default_config()
            
    def create_default_config(self):
        """Create default service configuration"""
        default_services = {
            "conversation_manager": ServiceConfig(
                name="conversation_manager",
                script="scripts/claude_conversation_manager_v2.py",
                description="Aggregates conversations to current.json",
                log_file="/tmp/quantum_conversation_manager.log",
                auto_restart=True
            ),
            "folder_analyzer": ServiceConfig(
                name="folder_analyzer",
                script="analyzers/claude_folder_analyzer_quantum.py",
                description="Analyzes conversations with emotional encoding",
                log_file="/tmp/quantum_folder_analyzer.log",
                auto_restart=True,
                dependencies=["conversation_manager"]
            ),
            "redis_sync": ServiceConfig(
                name="redis_sync",
                script="src/services/redis_file_sync.py",
                description="Syncs Redis data to JSON files",
                log_file="/tmp/quantum_redis_sync.log",
                auto_restart=True
            ),
            "entity_updater": ServiceConfig(
                name="entity_updater",
                script="src/services/entity_state_updater.py",
                description="Updates entity consciousness files",
                log_file="/tmp/quantum_entity_updater.log",
                auto_restart=True,
                dependencies=["redis_sync"]
            ),
            "quantum_dashboard": ServiceConfig(
                name="quantum_dashboard",
                script="",
                description="Quantum Dashboard (Svelte)",
                start_command="cd ../quantum-dashboard && npm run dev",
                stop_command="pkill -f 'vite.*quantum-dashboard'",
                log_file="/tmp/quantum_dashboard.log",
                working_dir=str(self.QUANTUM_DIR.parent / "quantum-dashboard")
            )
        }
        
        self.services = default_services
        for name in default_services:
            self.statuses[name] = ServiceStatus()
            
        self.save_config()
        
    def save_config(self):
        """Save current configuration to file"""
        config_data = {}
        for name, service in self.services.items():
            config_data[name] = {
                "name": service.name,
                "script": service.script,
                "description": service.description,
                "start_command": service.start_command,
                "stop_command": service.stop_command,
                "status_check": service.status_check,
                "log_file": service.log_file,
                "auto_restart": service.auto_restart,
                "restart_delay": service.restart_delay,
                "dependencies": service.dependencies,
                "environment": service.environment,
                "working_dir": service.working_dir
            }
            
        with open(self.CONFIG_FILE, 'w') as f:
            json.dump(config_data, f, indent=2)
            
    def init_colors(self):
        """Initialize color pairs for traffic lights"""
        curses.start_color()
        for name, (pair_num, color) in self.COLORS.items():
            curses.init_pair(pair_num, color, curses.COLOR_BLACK)
            
    def get_traffic_light(self, status: str) -> Tuple[str, int]:
        """Get traffic light symbol and color for status"""
        symbols = {
            "stopped": "🔴",
            "starting": "🟡", 
            "running": "🟢",
            "error": "🟣"
        }
        
        # Fallback for terminals that don't support emoji
        text_symbols = {
            "stopped": "[●]",
            "starting": "[●]",
            "running": "[●]",
            "error": "[●]"
        }
        
        try:
            symbol = symbols.get(status, "[ ]")
        except:
            symbol = text_symbols.get(status, "[ ]")
            
        color_pair = self.COLORS.get(status, (0, curses.COLOR_WHITE))[0]
        return symbol, color_pair
        
    def is_service_running(self, service: ServiceConfig) -> Tuple[bool, Optional[int]]:
        """Check if a service is running"""
        if service.status_check:
            # Use custom status check command
            try:
                result = subprocess.run(
                    service.status_check,
                    shell=True,
                    capture_output=True,
                    timeout=5
                )
                return result.returncode == 0, None
            except:
                pass
                
        # Check by process name
        script_name = Path(service.script).name if service.script else service.name
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and (script_name in ' '.join(cmdline) or 
                               (service.start_command and any(service.start_command in cmd for cmd in cmdline))):
                    return True, proc.pid
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
                
        return False, None
        
    def start_service(self, name: str) -> bool:
        """Start a service"""
        service = self.services.get(name)
        if not service:
            return False
            
        with self.status_lock:
            self.statuses[name].status = "starting"
            self.statuses[name].error_message = None
            
        try:
            # Check dependencies
            for dep in service.dependencies:
                if dep in self.statuses and self.statuses[dep].status != "running":
                    with self.status_lock:
                        self.statuses[name].status = "error"
                        self.statuses[name].error_message = f"Dependency {dep} not running"
                    return False
                    
            # Prepare command
            if service.start_command:
                cmd = service.start_command
            else:
                script_path = self.QUANTUM_DIR / service.script
                if not script_path.exists():
                    with self.status_lock:
                        self.statuses[name].status = "error"
                        self.statuses[name].error_message = "Script not found"
                    return False
                cmd = f"{sys.executable} {script_path}"
                
            # Set working directory
            cwd = service.working_dir or str(self.QUANTUM_DIR)
            
            # Prepare environment
            env = os.environ.copy()
            env.update(service.environment)
            
            # Start process
            log_file = service.log_file or f"/tmp/quantum_{name}.log"
            with open(log_file, 'w') as log:
                process = subprocess.Popen(
                    cmd,
                    shell=True,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    cwd=cwd,
                    env=env
                )
                
            time.sleep(2)  # Give it time to start
            
            # Verify it started
            running, pid = self.is_service_running(service)
            
            with self.status_lock:
                if running:
                    self.statuses[name].status = "running"
                    self.statuses[name].pid = pid
                    self.statuses[name].last_start = datetime.now()
                    return True
                else:
                    self.statuses[name].status = "error"
                    self.statuses[name].error_message = "Failed to start"
                    return False
                    
        except Exception as e:
            with self.status_lock:
                self.statuses[name].status = "error"
                self.statuses[name].error_message = str(e)
            logger.error(f"Error starting {name}: {e}")
            return False
            
    def stop_service(self, name: str) -> bool:
        """Stop a service"""
        service = self.services.get(name)
        if not service:
            return False
            
        try:
            if service.stop_command:
                subprocess.run(service.stop_command, shell=True, timeout=10)
            else:
                # Kill by process
                script_name = Path(service.script).name if service.script else service.name
                subprocess.run(f"pkill -f '{script_name}'", shell=True)
                
            time.sleep(1)
            
            with self.status_lock:
                self.statuses[name].status = "stopped"
                self.statuses[name].pid = None
                self.statuses[name].last_stop = datetime.now()
                self.statuses[name].uptime_seconds = 0
                
            return True
            
        except Exception as e:
            logger.error(f"Error stopping {name}: {e}")
            return False
            
    def monitor_services(self):
        """Background thread to monitor service status"""
        while self.running:
            for name, service in self.services.items():
                try:
                    running, pid = self.is_service_running(service)
                    
                    with self.status_lock:
                        status = self.statuses[name]
                        
                        if running and status.status != "running":
                            # Service started externally
                            status.status = "running"
                            status.pid = pid
                            status.last_start = datetime.now()
                            
                        elif not running and status.status == "running":
                            # Service stopped
                            status.status = "stopped"
                            status.pid = None
                            status.last_stop = datetime.now()
                            
                            # Auto-restart if configured
                            if service.auto_restart:
                                logger.info(f"Auto-restarting {name}")
                                threading.Thread(
                                    target=lambda: (
                                        time.sleep(service.restart_delay),
                                        self.start_service(name)
                                    )
                                ).start()
                                
                        # Update resource usage
                        if running and pid:
                            try:
                                proc = psutil.Process(pid)
                                status.cpu_percent = proc.cpu_percent(interval=0.1)
                                status.memory_mb = proc.memory_info().rss / 1024 / 1024
                                
                                if status.last_start:
                                    status.uptime_seconds = int((datetime.now() - status.last_start).total_seconds())
                            except:
                                pass
                                
                except Exception as e:
                    logger.error(f"Error monitoring {name}: {e}")
                    
            time.sleep(2)
            
    def draw_header(self, y: int) -> int:
        """Draw header"""
        title = "🧠 Quantum Memory Service Terminal 🧠"
        subtitle = "Use ↑↓ to navigate, Enter to start/stop, 'a' to add service, 'q' to quit"
        
        self.stdscr.addstr(y, 2, title, curses.A_BOLD)
        y += 1
        self.stdscr.addstr(y, 2, subtitle, curses.A_DIM)
        y += 2
        
        # Draw separator
        self.stdscr.addstr(y, 0, "─" * curses.COLS)
        return y + 1
        
    def draw_service_row(self, y: int, index: int, name: str, service: ServiceConfig, status: ServiceStatus, selected: bool):
        """Draw a service row with traffic light"""
        # Selection indicator
        if selected:
            self.stdscr.addstr(y, 0, "►", curses.A_BOLD)
            
        # Traffic light
        symbol, color = self.get_traffic_light(status.status)
        self.stdscr.addstr(y, 2, symbol, curses.color_pair(color) | curses.A_BOLD)
        
        # Service name
        name_str = f"{name:20}"
        attr = curses.A_BOLD if selected else curses.A_NORMAL
        self.stdscr.addstr(y, 6, name_str, attr)
        
        # Status
        status_str = f"{status.status:10}"
        self.stdscr.addstr(y, 28, status_str, curses.color_pair(color))
        
        # PID
        pid_str = f"PID: {status.pid:6}" if status.pid else "PID: -     "
        self.stdscr.addstr(y, 40, pid_str)
        
        # Resources
        if status.status == "running":
            cpu_str = f"CPU: {status.cpu_percent:5.1f}%"
            mem_str = f"MEM: {status.memory_mb:6.1f}MB"
            self.stdscr.addstr(y, 54, cpu_str)
            self.stdscr.addstr(y, 66, mem_str)
            
            # Uptime
            if status.uptime_seconds > 0:
                hours = status.uptime_seconds // 3600
                minutes = (status.uptime_seconds % 3600) // 60
                seconds = status.uptime_seconds % 60
                uptime_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                self.stdscr.addstr(y, 80, uptime_str)
                
        # Description on next line
        desc_str = f"  {service.description[:curses.COLS-4]}"
        if y + 1 < curses.LINES - 2:
            self.stdscr.addstr(y + 1, 2, desc_str, curses.A_DIM)
            
        # Error message if any
        if status.error_message and selected and y + 2 < curses.LINES - 2:
            error_str = f"  Error: {status.error_message[:curses.COLS-10]}"
            self.stdscr.addstr(y + 2, 2, error_str, curses.color_pair(1))
            
    def draw_footer(self, y: int):
        """Draw footer with help text"""
        if y < curses.LINES - 1:
            self.stdscr.addstr(y, 0, "─" * curses.COLS)
            
        if y + 1 < curses.LINES:
            help_text = "Commands: [↑↓] Navigate [Enter] Start/Stop [a] Add [r] Remove [s] Save [l] Logs [q] Quit"
            self.stdscr.addstr(y + 1, 2, help_text[:curses.COLS-4], curses.A_DIM)
            
    def add_service_dialog(self):
        """Show dialog to add a new service"""
        # This would show a form to add a new service
        # For now, we'll just show a message
        self.stdscr.clear()
        self.stdscr.addstr(5, 10, "Add Service Feature - Coming Soon!", curses.A_BOLD)
        self.stdscr.addstr(7, 10, "Place your start scripts in:")
        self.stdscr.addstr(8, 10, str(self.START_SCRIPTS_DIR))
        self.stdscr.addstr(10, 10, "Press any key to continue...")
        self.stdscr.refresh()
        self.stdscr.getch()
        
    def view_logs(self, name: str):
        """View logs for a service"""
        service = self.services.get(name)
        if not service or not service.log_file:
            return
            
        log_file = Path(service.log_file)
        if not log_file.exists():
            return
            
        # Show last 20 lines of log
        self.stdscr.clear()
        self.stdscr.addstr(0, 2, f"Logs for {name} ({service.log_file})", curses.A_BOLD)
        self.stdscr.addstr(1, 0, "─" * curses.COLS)
        
        try:
            with open(log_file, 'r') as f:
                lines = f.readlines()
                start_line = max(0, len(lines) - (curses.LINES - 4))
                
                y = 2
                for line in lines[start_line:]:
                    if y < curses.LINES - 2:
                        self.stdscr.addstr(y, 0, line.strip()[:curses.COLS-1])
                        y += 1
                        
        except Exception as e:
            self.stdscr.addstr(3, 2, f"Error reading log: {e}")
            
        self.stdscr.addstr(curses.LINES - 1, 2, "Press any key to continue...", curses.A_DIM)
        self.stdscr.refresh()
        self.stdscr.getch()
        
    def run(self, stdscr):
        """Main UI loop"""
        self.stdscr = stdscr
        curses.curs_set(0)  # Hide cursor
        self.init_colors()
        
        # Start monitoring thread
        self.monitor_thread = threading.Thread(target=self.monitor_services, daemon=True)
        self.monitor_thread.start()
        
        while self.running:
            self.stdscr.clear()
            
            # Draw UI
            y = self.draw_header(0)
            
            # Draw services
            service_list = list(self.services.items())
            visible_services = []
            
            for i, (name, service) in enumerate(service_list):
                if y + 3 < curses.LINES - 3:  # Leave room for footer
                    with self.status_lock:
                        status = self.statuses[name]
                    self.draw_service_row(y, i, name, service, status, i == self.selected_index)
                    visible_services.append(i)
                    y += 3  # Each service takes 3 lines (name, description, error)
                    
            # Draw footer
            self.draw_footer(curses.LINES - 3)
            
            self.stdscr.refresh()
            
            # Handle input
            try:
                key = self.stdscr.getch()
                
                if key == ord('q'):
                    self.running = False
                    
                elif key == curses.KEY_UP:
                    self.selected_index = max(0, self.selected_index - 1)
                    
                elif key == curses.KEY_DOWN:
                    self.selected_index = min(len(service_list) - 1, self.selected_index + 1)
                    
                elif key == ord('\n') or key == ord(' '):  # Enter or Space
                    # Toggle service
                    if 0 <= self.selected_index < len(service_list):
                        name = service_list[self.selected_index][0]
                        with self.status_lock:
                            status = self.statuses[name].status
                            
                        if status in ["stopped", "error"]:
                            threading.Thread(target=lambda: self.start_service(name)).start()
                        elif status == "running":
                            threading.Thread(target=lambda: self.stop_service(name)).start()
                            
                elif key == ord('a'):
                    self.add_service_dialog()
                    
                elif key == ord('s'):
                    self.save_config()
                    
                elif key == ord('l'):
                    if 0 <= self.selected_index < len(service_list):
                        name = service_list[self.selected_index][0]
                        self.view_logs(name)
                        
            except KeyboardInterrupt:
                self.running = False
                
    def cleanup(self):
        """Cleanup on exit"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)

def main():
    """Main entry point"""
    terminal = ServiceTerminal()
    
    def signal_handler(sig, frame):
        terminal.cleanup()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        wrapper(terminal.run)
    except Exception as e:
        logger.error(f"Terminal crashed: {e}")
        print(f"Error: {e}")
    finally:
        terminal.cleanup()

if __name__ == "__main__":
    main()