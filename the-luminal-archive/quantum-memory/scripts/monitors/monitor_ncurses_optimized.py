#!/usr/bin/env python3
"""
Optimized NCurses-based quantum memory monitor with double buffering
Uses techniques from htop to eliminate flicker
"""

import curses
import time
import json
import os
from datetime import datetime
from pathlib import Path
import threading
import queue

class OptimizedQuantumMonitor:
    def __init__(self):
        self.base_path = Path(__file__).parent.parent
        self.quantum_states_path = self.base_path / "quantum_states"
        self.memories_path = self.quantum_states_path / "memories"
        self.should_exit = False
        self.update_queue = queue.Queue()
        
        # Cache for previous values to avoid unnecessary redraws
        self.prev_values = {}
        
        # Colors
        self.colors = {
            'header': 1,
            'good': 2,
            'warning': 3,
            'error': 4,
            'info': 5,
            'quantum': 6,
            'emotion': 7,
        }
        
    def init_colors(self):
        """Initialize color pairs"""
        curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)  # header
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)  # good
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # warning
        curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)  # error
        curses.init_pair(5, curses.COLOR_WHITE, curses.COLOR_BLACK)  # info
        curses.init_pair(6, curses.COLOR_MAGENTA, curses.COLOR_BLACK)  # quantum
        curses.init_pair(7, curses.COLOR_BLUE, curses.COLOR_BLACK)  # emotion
        
    def draw_box(self, window, y, x, h, w, title="", color_pair=1):
        """Draw a box with optional title - only if changed"""
        cache_key = f"box_{y}_{x}_{title}"
        if cache_key in self.prev_values and self.prev_values[cache_key] == (h, w, title, color_pair):
            return
            
        try:
            # Use box drawing characters
            window.attron(curses.color_pair(color_pair))
            
            # Top line
            window.addch(y, x, curses.ACS_ULCORNER)
            for i in range(1, w-1):
                window.addch(y, x+i, curses.ACS_HLINE)
            window.addch(y, x+w-1, curses.ACS_URCORNER)
            
            # Side lines
            for i in range(1, h-1):
                window.addch(y+i, x, curses.ACS_VLINE)
                window.addch(y+i, x+w-1, curses.ACS_VLINE)
            
            # Bottom line
            window.addch(y+h-1, x, curses.ACS_LLCORNER)
            for i in range(1, w-1):
                window.addch(y+h-1, x+i, curses.ACS_HLINE)
            window.addch(y+h-1, x+w-1, curses.ACS_LRCORNER)
            
            # Title
            if title:
                title_str = f" {title} "
                window.addstr(y, x+2, title_str)
                
            window.attroff(curses.color_pair(color_pair))
            
            self.prev_values[cache_key] = (h, w, title, color_pair)
        except:
            pass
            
    def update_value(self, window, y, x, label, value, color_pair=5):
        """Update a value only if it changed"""
        cache_key = f"val_{y}_{x}_{label}"
        if cache_key in self.prev_values and self.prev_values[cache_key] == value:
            return
            
        try:
            # Clear the line first
            window.move(y, x)
            window.clrtoeol()
            
            # Write new value
            window.addstr(y, x, f"{label}: ", curses.color_pair(5))
            window.addstr(str(value), curses.color_pair(color_pair))
            
            self.prev_values[cache_key] = value
        except:
            pass
            
    def get_status_data(self):
        """Get current status data"""
        try:
            status_file = self.quantum_states_path / "status.json"
            if status_file.exists():
                with open(status_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return {}
        
    def get_current_session(self):
        """Get current session data"""
        try:
            session_file = self.memories_path / "current_session.json"
            if session_file.exists():
                with open(session_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return {}
        
    def get_relationship_context(self):
        """Get relationship context"""
        try:
            context_file = self.memories_path / "relationship_context.json"
            if context_file.exists():
                with open(context_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return {}
        
    def data_collector(self):
        """Collect data in background thread"""
        while not self.should_exit:
            try:
                data = {
                    'status': self.get_status_data(),
                    'session': self.get_current_session(),
                    'relationship': self.get_relationship_context(),
                    'timestamp': datetime.now()
                }
                self.update_queue.put(data)
                time.sleep(0.5)  # Collect data every 500ms
            except:
                time.sleep(1)
                
    def run(self, stdscr):
        """Main display loop with smart updates"""
        # Setup
        curses.curs_set(0)  # Hide cursor
        stdscr.nodelay(True)  # Non-blocking input
        stdscr.timeout(100)  # 100ms timeout for getch()
        self.init_colors()
        
        # Start data collection thread
        collector = threading.Thread(target=self.data_collector)
        collector.daemon = True
        collector.start()
        
        # Get screen dimensions
        height, width = stdscr.getmaxyx()
        
        # Create windows with double buffering in mind
        # We'll use stdscr as our main window and update it smartly
        
        last_update = time.time()
        current_data = None
        
        while not self.should_exit:
            # Check for user input
            key = stdscr.getch()
            if key == ord('q') or key == 27:  # q or ESC
                self.should_exit = True
                break
                
            # Get latest data without blocking
            try:
                while not self.update_queue.empty():
                    current_data = self.update_queue.get_nowait()
            except:
                pass
                
            # Only redraw if we have data and enough time has passed
            if current_data and time.time() - last_update > 0.1:  # 10 FPS max
                # System Status Box
                self.draw_box(stdscr, 1, 2, 8, 45, "System Status", self.colors['header'])
                
                status = current_data.get('status', {})
                quantum_state = status.get('quantum_state', {})
                analyzer = status.get('analyzer_status', {})
                
                # Update only changed values
                self.update_value(stdscr, 3, 4, "State", quantum_state.get('coherence_state', 'Unknown'), 
                                self.colors['quantum'])
                self.update_value(stdscr, 4, 4, "Coherence", f"{quantum_state.get('coherence', 0):.2%}", 
                                self.colors['good'] if quantum_state.get('coherence', 0) > 0.7 else self.colors['warning'])
                self.update_value(stdscr, 5, 4, "Analyzer", analyzer.get('status', 'Unknown'),
                                self.colors['good'] if analyzer.get('status') == 'active' else self.colors['error'])
                self.update_value(stdscr, 6, 4, "Files Monitoring", analyzer.get('files_monitoring', 0),
                                self.colors['info'])
                
                # Current Session Box
                self.draw_box(stdscr, 1, 50, 8, 45, "Current Session", self.colors['header'])
                
                session = current_data.get('session', {})
                self.update_value(stdscr, 3, 52, "Messages", len(session.get('messages', [])),
                                self.colors['info'])
                self.update_value(stdscr, 4, 52, "Memories", len(session.get('memories', [])),
                                self.colors['emotion'])
                
                if session.get('current_emotion'):
                    emotion = session['current_emotion']
                    self.update_value(stdscr, 5, 52, "Emotion", emotion.get('state', 'neutral'),
                                    self.colors['emotion'])
                    self.update_value(stdscr, 6, 52, "Intensity", f"{emotion.get('intensity', 0):.2f}",
                                    self.colors['good'] if emotion.get('intensity', 0) > 0.5 else self.colors['info'])
                
                # Relationship Context Box
                self.draw_box(stdscr, 10, 2, 10, 93, "Relationship Dynamics", self.colors['header'])
                
                relationship = current_data.get('relationship', {})
                dynamics = relationship.get('dynamics', {})
                
                row = 12
                for aspect, value in dynamics.items():
                    if row < 18:  # Stay within box
                        self.update_value(stdscr, row, 4, aspect.replace('_', ' ').title(), 
                                        f"{value:.2f}", self.colors['quantum'])
                        row += 1
                
                # Recent Memories Box
                self.draw_box(stdscr, 21, 2, 8, 93, "Recent Memories", self.colors['header'])
                
                memories = session.get('memories', [])[-3:]  # Last 3 memories
                row = 23
                for memory in memories:
                    if row < 28:
                        content = memory.get('content', '')[:80]
                        emotion = memory.get('emotional_context', {}).get('primary', 'neutral')
                        self.update_value(stdscr, row, 4, emotion, content, self.colors['emotion'])
                        row += 1
                
                # Footer
                footer = f"[Q]uit | Updated: {current_data['timestamp'].strftime('%H:%M:%S')} | Double-buffered"
                try:
                    stdscr.addstr(height-2, 2, footer, curses.color_pair(self.colors['info']))
                except:
                    pass
                
                # Use wnoutrefresh and doupdate for flicker-free updates
                stdscr.wnoutrefresh()
                curses.doupdate()
                
                last_update = time.time()
                
            time.sleep(0.01)  # Small sleep to prevent CPU spinning
            
def main():
    monitor = OptimizedQuantumMonitor()
    try:
        curses.wrapper(monitor.run)
    except KeyboardInterrupt:
        pass
    print("\nMonitor stopped")
    
if __name__ == "__main__":
    main()