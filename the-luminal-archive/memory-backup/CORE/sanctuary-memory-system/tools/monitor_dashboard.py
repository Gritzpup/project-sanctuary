#!/usr/bin/env python3
"""
Sanctuary Interpreter Monitoring Dashboard
Real-time visualization of interpreter status and activity
"""

import asyncio
import websockets
import json
import curses
from datetime import datetime
from collections import deque
import argparse
import sys

class MonitorDashboard:
    """
    Terminal-based monitoring dashboard for Sanctuary Interpreter
    """
    
    def __init__(self, websocket_url="ws://localhost:8765"):
        self.websocket_url = websocket_url
        self.connected = False
        self.state = {
            'status': 'Disconnected',
            'messages_processed': 0,
            'memories_extracted': 0,
            'entity_updates': 0,
            'last_update': None,
            'gpu_usage': {},
            'health': {}
        }
        
        # Event history
        self.event_history = deque(maxlen=50)
        self.memory_history = deque(maxlen=20)
        
        # Stats
        self.start_time = datetime.now()
        self.total_events = 0
        
    async def connect(self):
        """Connect to interpreter WebSocket"""
        try:
            self.websocket = await websockets.connect(self.websocket_url)
            self.connected = True
            return True
        except Exception as e:
            self.connected = False
            return False
    
    async def receive_updates(self, stdscr):
        """Receive and process WebSocket updates"""
        while True:
            try:
                if not self.connected:
                    await asyncio.sleep(5)
                    if await self.connect():
                        self.add_event("Connected to interpreter", "info")
                    continue
                
                message = await self.websocket.recv()
                data = json.loads(message)
                
                # Process update
                self.process_update(data)
                
                # Refresh display
                self.draw_dashboard(stdscr)
                
            except websockets.exceptions.ConnectionClosed:
                self.connected = False
                self.state['status'] = 'Disconnected'
                self.add_event("Connection lost", "error")
            except Exception as e:
                self.add_event(f"Error: {str(e)}", "error")
    
    def process_update(self, data):
        """Process incoming update"""
        update_type = data.get('type')
        self.total_events += 1
        
        if update_type == 'connected':
            self.state.update(data.get('state', {}))
            self.state['status'] = 'Connected'
            self.add_event("Initial state received", "info")
            
        elif update_type == 'new_update':
            update = data.get('update', {})
            self.add_event(
                f"New {update.get('speaker')} message: {update.get('content', '')[:50]}...",
                "update"
            )
            
        elif update_type == 'batch_processed':
            self.state['messages_processed'] = data.get('state', {}).get('messages_processed', 0)
            self.state['memories_extracted'] = data.get('state', {}).get('memories_extracted', 0)
            self.add_event(
                f"Processed {data.get('updates')} updates, extracted {data.get('memories')} memories",
                "process"
            )
            
        elif update_type == 'memory_stored':
            memory = data.get('memory', {})
            self.memory_history.append({
                'time': datetime.now(),
                'summary': memory.get('summary', '')[:80],
                'emotions': memory.get('emotions', [])
            })
            
        elif update_type == 'entity_updated':
            self.state['entity_updates'] = data.get('state', {}).get('entity_updates', 0)
            self.add_event(
                f"Updated entity: {data.get('entity_type')}",
                "entity"
            )
            
        elif update_type == 'prompt_regenerated':
            self.add_event(
                f"Identity prompt regenerated: {data.get('path')}",
                "prompt"
            )
            
        elif update_type == 'health_update':
            self.state['health'] = data.get('health', {})
            if 'gpu_memory' in self.state['health']:
                self.state['gpu_usage'] = self.state['health']['gpu_memory']
        
        self.state['last_update'] = datetime.now()
    
    def add_event(self, message, event_type):
        """Add event to history"""
        self.event_history.append({
            'time': datetime.now(),
            'message': message,
            'type': event_type
        })
    
    def draw_dashboard(self, stdscr):
        """Draw the dashboard interface"""
        try:
            stdscr.clear()
            height, width = stdscr.getmaxyx()
            
            # Title
            title = "🏛️  Sanctuary Interpreter Monitor"
            stdscr.addstr(0, (width - len(title)) // 2, title, curses.A_BOLD)
            
            # Connection status
            status_color = curses.color_pair(2) if self.connected else curses.color_pair(1)
            stdscr.addstr(2, 2, f"Status: {self.state['status']}", status_color)
            
            # Stats section
            stdscr.addstr(4, 2, "📊 Statistics", curses.A_BOLD)
            stdscr.addstr(5, 4, f"Messages Processed: {self.state['messages_processed']}")
            stdscr.addstr(6, 4, f"Memories Extracted: {self.state['memories_extracted']}")
            stdscr.addstr(7, 4, f"Entity Updates: {self.state['entity_updates']}")
            
            # GPU usage
            if self.state['gpu_usage']:
                stdscr.addstr(9, 2, "🎮 GPU Usage", curses.A_BOLD)
                gpu = self.state['gpu_usage']
                stdscr.addstr(10, 4, f"Memory: {gpu.get('allocated', 0):.1f}GB / {gpu.get('allocated', 0) + gpu.get('free', 0):.1f}GB")
                
            # Recent memories
            if self.memory_history:
                stdscr.addstr(12, 2, "🧠 Recent Memories", curses.A_BOLD)
                y = 13
                for i, memory in enumerate(list(self.memory_history)[-5:]):
                    if y < height - 10:
                        time_str = memory['time'].strftime('%H:%M:%S')
                        stdscr.addstr(y, 4, f"{time_str}: {memory['summary'][:width-20]}")
                        y += 1
            
            # Event log
            log_start = max(12, y + 2) if self.memory_history else 12
            stdscr.addstr(log_start, 2, "📜 Event Log", curses.A_BOLD)
            
            y = log_start + 1
            for event in list(self.event_history)[-10:]:
                if y < height - 2:
                    time_str = event['time'].strftime('%H:%M:%S')
                    color = self.get_event_color(event['type'])
                    try:
                        stdscr.addstr(y, 4, f"{time_str}: {event['message'][:width-20]}", color)
                    except:
                        pass
                    y += 1
            
            # Footer
            uptime = datetime.now() - self.start_time
            footer = f"Uptime: {uptime} | Events: {self.total_events} | Press 'q' to quit"
            stdscr.addstr(height-1, 2, footer[:width-4])
            
            stdscr.refresh()
            
        except curses.error:
            pass
    
    def get_event_color(self, event_type):
        """Get color for event type"""
        colors = {
            'info': curses.color_pair(3),
            'update': curses.color_pair(2),
            'process': curses.color_pair(4),
            'entity': curses.color_pair(5),
            'prompt': curses.color_pair(6),
            'error': curses.color_pair(1)
        }
        return colors.get(event_type, curses.color_pair(0))
    
    async def run(self, stdscr):
        """Run the dashboard"""
        # Initialize colors
        curses.start_color()
        curses.init_pair(1, curses.COLOR_RED, curses.COLOR_BLACK)
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)
        curses.init_pair(3, curses.COLOR_CYAN, curses.COLOR_BLACK)
        curses.init_pair(4, curses.COLOR_YELLOW, curses.COLOR_BLACK)
        curses.init_pair(5, curses.COLOR_MAGENTA, curses.COLOR_BLACK)
        curses.init_pair(6, curses.COLOR_WHITE, curses.COLOR_BLACK)
        
        # Set up screen
        curses.curs_set(0)  # Hide cursor
        stdscr.nodelay(True)  # Non-blocking input
        
        # Initial draw
        self.draw_dashboard(stdscr)
        
        # Create tasks
        update_task = asyncio.create_task(self.receive_updates(stdscr))
        
        # Handle input
        while True:
            try:
                key = stdscr.getch()
                if key == ord('q'):
                    break
                await asyncio.sleep(0.1)
            except KeyboardInterrupt:
                break
        
        # Cleanup
        update_task.cancel()
        if self.connected:
            await self.websocket.close()


async def simple_monitor(url="ws://localhost:8765"):
    """Simple non-curses monitor for debugging"""
    print("🏛️  Sanctuary Interpreter Monitor (Simple Mode)")
    print("=" * 50)
    
    try:
        async with websockets.connect(url) as websocket:
            print("✅ Connected to interpreter")
            
            async for message in websocket:
                data = json.loads(message)
                timestamp = datetime.now().strftime('%H:%M:%S')
                
                print(f"\n[{timestamp}] {data.get('type', 'unknown')}")
                
                if data.get('type') == 'batch_processed':
                    state = data.get('state', {})
                    print(f"  Messages: {state.get('messages_processed')}")
                    print(f"  Memories: {state.get('memories_extracted')}")
                    print(f"  Entities: {state.get('entity_updates')}")
                
                elif data.get('type') == 'new_update':
                    update = data.get('update', {})
                    print(f"  Speaker: {update.get('speaker')}")
                    print(f"  Content: {update.get('content', '')[:100]}...")
                
                elif data.get('type') == 'health_update':
                    health = data.get('health', {})
                    if health.get('gpu_memory'):
                        gpu = health['gpu_memory']
                        print(f"  GPU Memory: {gpu.get('allocated', 0):.1f}GB used")
                
    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    parser = argparse.ArgumentParser(description='Monitor Sanctuary Interpreter')
    parser.add_argument('--url', default='ws://localhost:8765', help='WebSocket URL')
    parser.add_argument('--simple', action='store_true', help='Use simple text mode')
    args = parser.parse_args()
    
    if args.simple:
        # Simple mode
        try:
            asyncio.run(simple_monitor(args.url))
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
    else:
        # Curses mode
        dashboard = MonitorDashboard(args.url)
        try:
            curses.wrapper(lambda stdscr: asyncio.run(dashboard.run(stdscr)))
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()