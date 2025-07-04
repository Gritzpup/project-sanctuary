#!/usr/bin/env python3
"""
Enhanced Service Manager - Allows dynamic addition of services
"""

import os
import json
import curses
from pathlib import Path
from typing import Dict, List, Optional
import subprocess
import sys

class ServiceDialog:
    """Dialog for adding/editing services"""
    
    def __init__(self, stdscr, start_scripts_dir: Path):
        self.stdscr = stdscr
        self.start_scripts_dir = start_scripts_dir
        self.fields = {
            "name": "",
            "script": "",
            "description": "",
            "auto_restart": False,
            "log_file": ""
        }
        self.current_field = 0
        self.field_names = list(self.fields.keys())
        
    def find_start_scripts(self) -> List[str]:
        """Find all .sh files in start_scripts directory"""
        scripts = []
        if self.start_scripts_dir.exists():
            for script in self.start_scripts_dir.glob("*.sh"):
                scripts.append(str(script))
        return sorted(scripts)
        
    def draw_form(self):
        """Draw the service configuration form"""
        self.stdscr.clear()
        h, w = self.stdscr.getmaxyx()
        
        # Title
        title = "Add New Service"
        self.stdscr.addstr(1, (w - len(title)) // 2, title, curses.A_BOLD)
        self.stdscr.addstr(2, 0, "─" * w)
        
        # Instructions
        self.stdscr.addstr(3, 2, "Use Tab to move between fields, Enter to confirm, Esc to cancel")
        
        # Form fields
        y = 5
        for i, field in enumerate(self.field_names):
            # Highlight current field
            attr = curses.A_REVERSE if i == self.current_field else curses.A_NORMAL
            
            label = f"{field.replace('_', ' ').title():15}"
            self.stdscr.addstr(y, 4, label, curses.A_BOLD)
            
            if field == "auto_restart":
                value = "[X]" if self.fields[field] else "[ ]"
                self.stdscr.addstr(y, 20, value, attr)
                self.stdscr.addstr(y, 25, "Press space to toggle")
            elif field == "script":
                # Show dropdown of available scripts
                self.stdscr.addstr(y, 20, self.fields[field][:w-25] or "<Select script>", attr)
                if i == self.current_field:
                    self.show_script_dropdown(y + 1)
            else:
                # Text input
                value = self.fields[field] or "_" * 40
                self.stdscr.addstr(y, 20, value[:w-25], attr)
            
            y += 2
            
        # Buttons
        y = h - 4
        self.stdscr.addstr(y, 0, "─" * w)
        save_text = "[ Save Service ]"
        cancel_text = "[ Cancel ]"
        self.stdscr.addstr(y + 1, w // 2 - len(save_text) - 5, save_text)
        self.stdscr.addstr(y + 1, w // 2 + 5, cancel_text)
        
    def show_script_dropdown(self, y: int):
        """Show dropdown list of available scripts"""
        scripts = self.find_start_scripts()
        if not scripts:
            self.stdscr.addstr(y, 20, "No scripts found in start_scripts/", curses.A_DIM)
            return
            
        self.stdscr.addstr(y, 20, "Available scripts:", curses.A_DIM)
        for i, script in enumerate(scripts[:5]):  # Show max 5
            script_name = Path(script).name
            self.stdscr.addstr(y + i + 1, 22, f"• {script_name}", curses.A_DIM)
            
    def handle_input(self) -> Optional[Dict]:
        """Handle form input and return service config if saved"""
        while True:
            self.draw_form()
            self.stdscr.refresh()
            
            key = self.stdscr.getch()
            
            if key == 27:  # Escape
                return None
                
            elif key == ord('\t'):  # Tab - next field
                self.current_field = (self.current_field + 1) % len(self.field_names)
                
            elif key == curses.KEY_BTAB:  # Shift+Tab - previous field
                self.current_field = (self.current_field - 1) % len(self.field_names)
                
            elif key == ord('\n'):  # Enter
                if self.fields["name"] and (self.fields["script"] or self.fields["start_command"]):
                    return self.create_service_config()
                    
            elif key == ord(' '):  # Space
                field_name = self.field_names[self.current_field]
                if field_name == "auto_restart":
                    self.fields["auto_restart"] = not self.fields["auto_restart"]
                elif field_name == "script":
                    # Cycle through available scripts
                    scripts = self.find_start_scripts()
                    if scripts:
                        current = self.fields["script"]
                        try:
                            idx = scripts.index(current)
                            self.fields["script"] = scripts[(idx + 1) % len(scripts)]
                        except ValueError:
                            self.fields["script"] = scripts[0]
                            
            elif key >= 32 and key <= 126:  # Printable characters
                field_name = self.field_names[self.current_field]
                if field_name not in ["auto_restart", "script"]:
                    if len(self.fields[field_name]) < 100:
                        self.fields[field_name] += chr(key)
                        
            elif key == curses.KEY_BACKSPACE or key == 127:  # Backspace
                field_name = self.field_names[self.current_field]
                if field_name not in ["auto_restart", "script"]:
                    self.fields[field_name] = self.fields[field_name][:-1]
                    
    def create_service_config(self) -> Dict:
        """Create service configuration from form data"""
        config = {
            "name": self.fields["name"],
            "description": self.fields["description"] or f"Custom service: {self.fields['name']}",
            "auto_restart": self.fields["auto_restart"],
            "log_file": self.fields["log_file"] or f"/tmp/quantum_{self.fields['name']}.log"
        }
        
        if self.fields["script"]:
            # Using a start script
            config["start_command"] = f"bash {self.fields['script']}"
            config["script"] = ""
        
        return config

def add_service_to_config(service_config: Dict, config_file: Path):
    """Add a new service to the configuration file"""
    # Load existing config
    if config_file.exists():
        with open(config_file, 'r') as f:
            all_services = json.load(f)
    else:
        all_services = {}
        
    # Add new service
    service_name = service_config["name"]
    all_services[service_name] = service_config
    
    # Save updated config
    config_file.parent.mkdir(parents=True, exist_ok=True)
    with open(config_file, 'w') as f:
        json.dump(all_services, f, indent=2)
        
    return True

def scan_for_services(quantum_dir: Path) -> List[Dict]:
    """Scan for common service patterns and suggest configurations"""
    suggestions = []
    
    # Look for Python scripts that might be services
    patterns = [
        ("**/monitor*.py", "Monitor Service"),
        ("**/server*.py", "Server Service"),
        ("**/analyzer*.py", "Analyzer Service"),
        ("**/watcher*.py", "Watcher Service"),
        ("**/listener*.py", "Listener Service")
    ]
    
    for pattern, desc_template in patterns:
        for script in quantum_dir.glob(pattern):
            if "test" not in str(script).lower() and "__pycache__" not in str(script):
                name = script.stem.replace("_", "-")
                suggestions.append({
                    "name": name,
                    "script": str(script.relative_to(quantum_dir)),
                    "description": f"{desc_template}: {script.name}",
                    "suggested": True
                })
                
    return suggestions

def main():
    """Interactive service configuration manager"""
    quantum_dir = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory")
    config_file = quantum_dir / "services" / "service_config.json"
    start_scripts_dir = quantum_dir / "services" / "start_scripts"
    
    # Ensure directories exist
    start_scripts_dir.mkdir(parents=True, exist_ok=True)
    
    def run_dialog(stdscr):
        dialog = ServiceDialog(stdscr, start_scripts_dir)
        return dialog.handle_input()
        
    # Run the dialog
    result = curses.wrapper(run_dialog)
    
    if result:
        # Add to configuration
        if add_service_to_config(result, config_file):
            print(f"\n✓ Service '{result['name']}' added successfully!")
            print(f"  Configuration saved to: {config_file}")
            print(f"\nYou can now start the service using the service terminal:")
            print(f"  ./run_service_terminal.sh")
        else:
            print("\n✗ Failed to add service")
    else:
        print("\nCancelled - no service added")

if __name__ == "__main__":
    main()