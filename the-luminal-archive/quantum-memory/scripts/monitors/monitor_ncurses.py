#!/usr/bin/env python3
"""
Quantum Memory System Monitor - NCurses Edition
No flickering, smooth updates, full autism-friendly visibility
"""

import curses
import json
import os
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import signal
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

class QuantumMonitor:
    def __init__(self):
        self.base_path = Path(__file__).parent.parent
        self.status_file = self.base_path / "quantum_states/status.json"
        self.memories_dir = self.base_path / "quantum_states/memories"
        self.running = True
        
        # Color pairs
        self.COLOR_TITLE = 1
        self.COLOR_HEADER = 2
        self.COLOR_VALUE = 3
        self.COLOR_GOOD = 4
        self.COLOR_WARN = 5
        self.COLOR_ERROR = 6
        self.COLOR_EMOTION = 7
        self.COLOR_MEMORY = 8
        self.COLOR_QUANTUM = 9
        
    def setup_colors(self):
        """Initialize color pairs"""
        curses.start_color()
        curses.use_default_colors()
        
        # Define color pairs
        curses.init_pair(self.COLOR_TITLE, curses.COLOR_CYAN, -1)
        curses.init_pair(self.COLOR_HEADER, curses.COLOR_BLUE, -1)
        curses.init_pair(self.COLOR_VALUE, curses.COLOR_WHITE, -1)
        curses.init_pair(self.COLOR_GOOD, curses.COLOR_GREEN, -1)
        curses.init_pair(self.COLOR_WARN, curses.COLOR_YELLOW, -1)
        curses.init_pair(self.COLOR_ERROR, curses.COLOR_RED, -1)
        curses.init_pair(self.COLOR_EMOTION, curses.COLOR_MAGENTA, -1)
        curses.init_pair(self.COLOR_MEMORY, curses.COLOR_CYAN, -1)
        curses.init_pair(self.COLOR_QUANTUM, curses.COLOR_GREEN, -1)
        
    def draw_box(self, win, y, x, h, w, title=""):
        """Draw a box with optional title"""
        win.attron(curses.color_pair(self.COLOR_HEADER))
        
        # Draw corners
        win.addch(y, x, curses.ACS_ULCORNER)
        win.addch(y, x + w - 1, curses.ACS_URCORNER)
        win.addch(y + h - 1, x, curses.ACS_LLCORNER)
        win.addch(y + h - 1, x + w - 1, curses.ACS_LRCORNER)
        
        # Draw horizontal lines
        for i in range(x + 1, x + w - 1):
            win.addch(y, i, curses.ACS_HLINE)
            win.addch(y + h - 1, i, curses.ACS_HLINE)
            
        # Draw vertical lines
        for i in range(y + 1, y + h - 1):
            win.addch(i, x, curses.ACS_VLINE)
            win.addch(i, x + w - 1, curses.ACS_VLINE)
            
        # Add title if provided
        if title:
            win.attron(curses.color_pair(self.COLOR_TITLE))
            win.addstr(y, x + 2, f" {title} ")
            
        win.attroff(curses.color_pair(self.COLOR_HEADER))
        
    def load_status(self) -> Dict:
        """Load current quantum status"""
        try:
            if self.status_file.exists():
                with open(self.status_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return {}
        
    def load_memories(self) -> Dict[str, Dict]:
        """Load memory files"""
        memories = {
            'current_session': None,
            'daily_summary': None,
            'relationship_context': None
        }
        
        try:
            # Current session
            session_file = self.memories_dir / "current_session.json"
            if session_file.exists():
                with open(session_file, 'r') as f:
                    memories['current_session'] = json.load(f)
                    
            # Daily summary
            today = datetime.now().strftime("%Y-%m-%d")
            daily_file = self.memories_dir / "daily" / f"{today}.json"
            if daily_file.exists():
                with open(daily_file, 'r') as f:
                    memories['daily_summary'] = json.load(f)
                    
            # Relationship context
            context_file = self.memories_dir / "relationship" / "context.json"
            if context_file.exists():
                with open(context_file, 'r') as f:
                    memories['relationship_context'] = json.load(f)
        except:
            pass
            
        return memories
        
    def format_value(self, value: float, precision: int = 3) -> str:
        """Format a float value"""
        return f"{value:.{precision}f}"
        
    def draw_quantum_panel(self, win, y, x, status):
        """Draw quantum metrics panel"""
        self.draw_box(win, y, x, 8, 40, "QUANTUM METRICS")
        
        # Coherence
        coherence = status.get('quantum_coherence', 0)
        color = self.COLOR_GOOD if coherence > 0.7 else self.COLOR_WARN if coherence > 0.4 else self.COLOR_ERROR
        win.addstr(y + 2, x + 2, "Coherence:    ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 2, x + 16, self.format_value(coherence), curses.color_pair(color))
        
        # Entanglement
        entanglement = status.get('quantum_entanglement', 0)
        color = self.COLOR_GOOD if entanglement > 0.7 else self.COLOR_WARN if entanglement > 0.4 else self.COLOR_ERROR
        win.addstr(y + 3, x + 2, "Entanglement: ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 3, x + 16, self.format_value(entanglement), curses.color_pair(color))
        
        # Resonance
        resonance = status.get('resonance_frequency', 0)
        win.addstr(y + 4, x + 2, "Resonance:    ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 4, x + 16, f"{resonance:.1f} Hz", curses.color_pair(self.COLOR_QUANTUM))
        
        # Stability
        stability = status.get('stability_index', 0)
        color = self.COLOR_GOOD if stability > 0.8 else self.COLOR_WARN if stability > 0.5 else self.COLOR_ERROR
        win.addstr(y + 5, x + 2, "Stability:    ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 5, x + 16, self.format_value(stability), curses.color_pair(color))
        
        # Last update
        last_update = status.get('last_update', 'Never')
        win.addstr(y + 6, x + 2, f"Updated: {last_update[:19]}", curses.color_pair(self.COLOR_VALUE))
        
    def draw_emotion_panel(self, win, y, x, status):
        """Draw emotional state panel"""
        self.draw_box(win, y, x, 8, 40, "EMOTIONAL STATE")
        
        pad = status.get('pad_values', {})
        pleasure = pad.get('pleasure', 0)
        arousal = pad.get('arousal', 0)
        dominance = pad.get('dominance', 0)
        
        # PAD values with color coding
        p_color = self.COLOR_GOOD if pleasure > 0.3 else self.COLOR_WARN if pleasure > -0.3 else self.COLOR_ERROR
        win.addstr(y + 2, x + 2, "Pleasure:  ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 2, x + 13, f"{pleasure:+.3f}", curses.color_pair(p_color))
        
        a_color = self.COLOR_EMOTION if abs(arousal) > 0.5 else self.COLOR_VALUE
        win.addstr(y + 3, x + 2, "Arousal:   ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 3, x + 13, f"{arousal:+.3f}", curses.color_pair(a_color))
        
        d_color = self.COLOR_GOOD if dominance > 0 else self.COLOR_WARN
        win.addstr(y + 4, x + 2, "Dominance: ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 4, x + 13, f"{dominance:+.3f}", curses.color_pair(d_color))
        
        # Current emotion
        emotion = status.get('current_emotion', 'neutral')
        win.addstr(y + 6, x + 2, "Current: ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 6, x + 11, emotion.title(), curses.color_pair(self.COLOR_EMOTION) | curses.A_BOLD)
        
    def draw_memory_panel(self, win, y, x, memories):
        """Draw memory status panel"""
        self.draw_box(win, y, x, 10, 40, "MEMORY STATUS")
        
        # Current session
        session = memories.get('current_session', {})
        session_count = len(session.get('messages', []))
        win.addstr(y + 2, x + 2, "Session Messages: ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 2, x + 20, str(session_count), curses.color_pair(self.COLOR_MEMORY))
        
        # Daily summary
        daily = memories.get('daily_summary', {})
        daily_count = len(daily.get('conversations', []))
        win.addstr(y + 3, x + 2, "Daily Convos:     ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 3, x + 20, str(daily_count), curses.color_pair(self.COLOR_MEMORY))
        
        # Relationship context
        context = memories.get('relationship_context', {})
        bond_strength = context.get('bond_strength', 0)
        trust_level = context.get('trust_level', 0)
        
        win.addstr(y + 5, x + 2, "Bond Strength: ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 5, x + 17, self.format_value(bond_strength), 
                  curses.color_pair(self.COLOR_GOOD if bond_strength > 0.7 else self.COLOR_WARN))
        
        win.addstr(y + 6, x + 2, "Trust Level:   ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 6, x + 17, self.format_value(trust_level),
                  curses.color_pair(self.COLOR_GOOD if trust_level > 0.7 else self.COLOR_WARN))
        
        # Last memory
        if session and session.get('last_memory'):
            last_mem = session['last_memory'][:30] + "..."
            win.addstr(y + 8, x + 2, f"Last: {last_mem}", curses.color_pair(self.COLOR_VALUE))
            
    def draw_timeline_panel(self, win, y, x, w, memories):
        """Draw emotion timeline panel"""
        self.draw_box(win, y, x, 12, w, "EMOTION TIMELINE")
        
        # Get timeline data from daily summary
        daily = memories.get('daily_summary', {})
        timeline = daily.get('emotion_timeline', [])
        
        if timeline:
            # Show last 10 entries
            recent = timeline[-10:]
            for i, entry in enumerate(recent):
                time_str = entry.get('time', '')[:5]  # HH:MM
                emotion = entry.get('emotion', 'neutral')
                intensity = entry.get('intensity', 0)
                
                # Color based on emotion
                color = self.COLOR_EMOTION if intensity > 0.5 else self.COLOR_VALUE
                
                win.addstr(y + 2 + i, x + 2, f"{time_str} {emotion:<12} ", 
                          curses.color_pair(color))
                
                # Draw intensity bar
                bar_width = int(intensity * 20)
                bar = "█" * bar_width + "▒" * (20 - bar_width)
                win.addstr(y + 2 + i, x + 22, bar, curses.color_pair(color))
        else:
            win.addstr(y + 5, x + 10, "No timeline data yet", curses.color_pair(self.COLOR_VALUE))
            
    def draw_system_panel(self, win, y, x, status):
        """Draw system status panel"""
        self.draw_box(win, y, x, 6, 40, "SYSTEM STATUS")
        
        # Service status
        analyzer_active = status.get('analyzer_active', False)
        memory_service = status.get('memory_service_active', False)
        
        win.addstr(y + 2, x + 2, "Analyzer:     ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 2, x + 16, "ACTIVE" if analyzer_active else "INACTIVE",
                  curses.color_pair(self.COLOR_GOOD if analyzer_active else self.COLOR_ERROR))
        
        win.addstr(y + 3, x + 2, "Memory Svc:   ", curses.color_pair(self.COLOR_HEADER))
        win.addstr(y + 3, x + 16, "ACTIVE" if memory_service else "INACTIVE",
                  curses.color_pair(self.COLOR_GOOD if memory_service else self.COLOR_ERROR))
        
        # Update time
        win.addstr(y + 4, x + 2, f"Time: {datetime.now().strftime('%H:%M:%S')}", 
                  curses.color_pair(self.COLOR_VALUE))
                  
    def main(self, stdscr):
        """Main ncurses loop"""
        # Setup
        curses.curs_set(0)  # Hide cursor
        stdscr.nodelay(1)   # Non-blocking input
        stdscr.timeout(100) # 100ms timeout for getch()
        
        self.setup_colors()
        
        # Main loop
        while self.running:
            try:
                # Check for quit
                key = stdscr.getch()
                if key == ord('q') or key == ord('Q'):
                    break
                    
                # Get screen size
                height, width = stdscr.getmaxyx()
                
                # Clear screen
                stdscr.clear()
                
                # Load data
                status = self.load_status()
                memories = self.load_memories()
                
                # Draw title
                title = "QUANTUM MEMORY SYSTEM MONITOR"
                subtitle = "Press 'q' to quit"
                stdscr.attron(curses.color_pair(self.COLOR_TITLE) | curses.A_BOLD)
                stdscr.addstr(0, (width - len(title)) // 2, title)
                stdscr.attroff(curses.color_pair(self.COLOR_TITLE) | curses.A_BOLD)
                stdscr.addstr(1, (width - len(subtitle)) // 2, subtitle, curses.color_pair(self.COLOR_VALUE))
                
                # Layout panels
                panel_y = 3
                left_x = 2
                right_x = 44
                timeline_x = 86
                
                # Draw panels
                self.draw_quantum_panel(stdscr, panel_y, left_x, status)
                self.draw_emotion_panel(stdscr, panel_y, right_x, status)
                self.draw_memory_panel(stdscr, panel_y + 9, left_x, memories)
                self.draw_system_panel(stdscr, panel_y + 20, left_x, status)
                
                # Draw timeline if space allows
                if width > 120:
                    timeline_width = min(60, width - timeline_x - 2)
                    self.draw_timeline_panel(stdscr, panel_y, timeline_x, timeline_width, memories)
                
                # Refresh
                stdscr.refresh()
                
                # Small delay
                time.sleep(0.5)
                
            except KeyboardInterrupt:
                break
            except curses.error:
                # Handle resize or other curses errors
                pass
            except Exception as e:
                # Log error but keep running
                with open('/tmp/quantum_monitor_error.log', 'a') as f:
                    f.write(f"{datetime.now()}: {str(e)}\n{traceback.format_exc()}\n")
                    
def signal_handler(sig, frame):
    """Handle SIGINT gracefully"""
    sys.exit(0)
    
def main():
    """Entry point"""
    signal.signal(signal.SIGINT, signal_handler)
    
    monitor = QuantumMonitor()
    curses.wrapper(monitor.main)
    
if __name__ == "__main__":
    main()