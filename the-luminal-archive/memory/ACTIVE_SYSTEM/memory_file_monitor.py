#!/usr/bin/env python3
"""
Memory File Monitor - Shows real-time updates to consciousness and memory files
"""

import asyncio
import websockets
import json
import curses
from datetime import datetime
from pathlib import Path
import threading
import time
from collections import deque

class MemoryFileMonitor:
    def __init__(self):
        self.file_updates = deque(maxlen=100)
        self.consciousness_files = {
            "state_vector.json": {"status": "waiting", "last_update": None},
            "emotional_memory.json": {"status": "waiting", "last_update": None},
            "relationship_context.json": {"status": "waiting", "last_update": None},
            "greeting_memory.json": {"status": "waiting", "last_update": None}
        }
        self.claude_md_status = {"status": "monitoring", "last_update": None}
        self.current_operation = "Initializing..."
        self.files_updated_count = 0
        self.ws_connected = False
        
        # Paths to monitor
        self.consciousness_dir = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness")
        self.claude_md_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/CLAUDE.md")
        
    async def connect_websocket(self):
        """Connect to the memory updater WebSocket"""
        uri = "ws://localhost:8766"
        while True:
            try:
                async with websockets.connect(uri) as websocket:
                    self.ws_connected = True
                    await self.handle_messages(websocket)
            except Exception as e:
                self.ws_connected = False
                self.current_operation = f"Reconnecting... ({str(e)})"
                await asyncio.sleep(5)
                
    async def handle_messages(self, websocket):
        """Handle incoming WebSocket messages"""
        async for message in websocket:
            try:
                data = json.loads(message)
                
                if data['type'] == 'consciousness_update':
                    self.current_operation = "Updating consciousness files..."
                    for filename in data.get('files_updated', []):
                        if filename in self.consciousness_files:
                            self.consciousness_files[filename]['status'] = 'updated'
                            self.consciousness_files[filename]['last_update'] = datetime.now()
                            self.files_updated_count += 1
                            
                            self.file_updates.append({
                                'timestamp': datetime.now(),
                                'file': filename,
                                'operation': 'updated',
                                'type': 'consciousness'
                            })
                            
                elif data['type'] == 'memory_update':
                    self.claude_md_status['status'] = 'updated'
                    self.claude_md_status['last_update'] = datetime.now()
                    self.current_operation = "Updated CLAUDE.md with new memory"
                    
                    self.file_updates.append({
                        'timestamp': datetime.now(),
                        'file': 'CLAUDE.md',
                        'operation': 'memory_added',
                        'type': 'memory'
                    })
                    
                elif data['type'] == 'activity_log' and 'consciousness' in data.get('activity_type', ''):
                    self.current_operation = data.get('message', 'Processing...')
                    
            except json.JSONDecodeError:
                pass
                
    def monitor_files(self):
        """Monitor file system for changes"""
        while True:
            try:
                # Check consciousness files
                for filename, info in self.consciousness_files.items():
                    file_path = self.consciousness_dir / filename
                    if file_path.exists():
                        mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                        if info['last_update'] is None or mtime > info['last_update']:
                            info['status'] = 'changed'
                            info['last_update'] = mtime
                            
                # Check CLAUDE.md
                if self.claude_md_path.exists():
                    mtime = datetime.fromtimestamp(self.claude_md_path.stat().st_mtime)
                    if self.claude_md_status['last_update'] is None or mtime > self.claude_md_status['last_update']:
                        self.claude_md_status['status'] = 'changed'
                        self.claude_md_status['last_update'] = mtime
                        
            except Exception as e:
                pass
                
            time.sleep(1)
            
    def draw_interface(self, stdscr):
        """Draw the terminal interface"""
        curses.start_color()
        curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)    # Headers
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)   # Updated
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # Changed
        curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)     # Waiting
        curses.init_pair(5, curses.COLOR_MAGENTA, curses.COLOR_BLACK) # Operation
        curses.init_pair(6, curses.COLOR_WHITE, curses.COLOR_BLACK)   # Normal
        
        while True:
            try:
                stdscr.clear()
                height, width = stdscr.getmaxyx()
                
                # Header
                header = "📁 MEMORY FILE MONITOR - Real-time File Updates"
                stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
                stdscr.addstr(0, (width - len(header)) // 2, header)
                stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)
                
                # Connection status
                ws_status = "🟢 Connected" if self.ws_connected else "🔴 Disconnected"
                stdscr.addstr(2, 2, f"WebSocket: {ws_status}")
                stdscr.addstr(2, 30, f"Files Updated: {self.files_updated_count}")
                
                # Current operation
                stdscr.attron(curses.color_pair(5))
                stdscr.addstr(3, 2, f"Current: {self.current_operation}")
                stdscr.attroff(curses.color_pair(5))
                
                # Divider
                stdscr.addstr(5, 0, "─" * width)
                
                # Consciousness files status
                stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
                stdscr.addstr(7, 2, "CONSCIOUSNESS FILES:")
                stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)
                
                y = 9
                for filename, info in self.consciousness_files.items():
                    status_color = {
                        'updated': 2,  # Green
                        'changed': 3,  # Yellow
                        'waiting': 4   # Red
                    }.get(info['status'], 6)
                    
                    stdscr.attron(curses.color_pair(status_color))
                    status_symbol = {
                        'updated': '✓',
                        'changed': '⚡',
                        'waiting': '⏳'
                    }.get(info['status'], '?')
                    
                    stdscr.addstr(y, 4, f"{status_symbol} {filename}")
                    stdscr.attroff(curses.color_pair(status_color))
                    
                    if info['last_update']:
                        time_str = info['last_update'].strftime('%H:%M:%S')
                        stdscr.addstr(y, 40, time_str)
                    
                    y += 1
                
                # CLAUDE.md status
                y += 1
                stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
                stdscr.addstr(y, 2, "MEMORY FILE:")
                stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)
                
                y += 2
                status_color = 2 if self.claude_md_status['status'] == 'updated' else 3
                stdscr.attron(curses.color_pair(status_color))
                stdscr.addstr(y, 4, f"✓ CLAUDE.md")
                stdscr.attroff(curses.color_pair(status_color))
                
                if self.claude_md_status['last_update']:
                    time_str = self.claude_md_status['last_update'].strftime('%H:%M:%S')
                    stdscr.addstr(y, 40, time_str)
                
                # Recent updates log
                y += 3
                stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
                stdscr.addstr(y, 2, "RECENT UPDATES:")
                stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)
                
                y += 2
                for update in reversed(list(self.file_updates)[-10:]):  # Show last 10
                    if y >= height - 2:
                        break
                        
                    time_str = update['timestamp'].strftime('%H:%M:%S')
                    stdscr.addstr(y, 4, f"[{time_str}]")
                    
                    color = 2 if update['type'] == 'consciousness' else 3
                    stdscr.attron(curses.color_pair(color))
                    stdscr.addstr(y, 16, f"{update['file']} - {update['operation']}")
                    stdscr.attroff(curses.color_pair(color))
                    
                    y += 1
                
                # Update indicator
                if self.files_updated_count > 0:
                    update_msg = f"💾 {self.files_updated_count} files updated this session"
                    stdscr.attron(curses.color_pair(2))
                    stdscr.addstr(height - 2, 2, update_msg)
                    stdscr.attroff(curses.color_pair(2))
                
                stdscr.refresh()
                curses.napms(100)  # Refresh every 100ms
                
            except KeyboardInterrupt:
                break
            except curses.error:
                pass
                
    def run(self):
        """Run the memory file monitor"""
        # Start WebSocket connection in background
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Run WebSocket in thread
        ws_thread = threading.Thread(
            target=lambda: loop.run_until_complete(self.connect_websocket()),
            daemon=True
        )
        ws_thread.start()
        
        # Start file monitor thread
        file_thread = threading.Thread(target=self.monitor_files, daemon=True)
        file_thread.start()
        
        # Run curses interface
        try:
            curses.wrapper(self.draw_interface)
        except KeyboardInterrupt:
            print("\nShutting down Memory File Monitor...")

if __name__ == "__main__":
    monitor = MemoryFileMonitor()
    print("Starting Memory File Monitor...")
    print("This will show real-time updates to consciousness and memory files")
    print("Press Ctrl+C to exit")
    monitor.run()