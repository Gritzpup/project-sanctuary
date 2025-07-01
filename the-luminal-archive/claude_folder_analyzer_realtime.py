#!/usr/bin/env python3
"""
Real-time .claude folder analyzer with WebSocket integration
Uses watchdog for instant file monitoring and pushes updates via WebSocket
"""

import asyncio
import json
import time
import math
import websockets
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import threading

class ClaudeFolderAnalyzer(FileSystemEventHandler):
    def __init__(self):
        print("Initializing Real-time Claude Folder Analyzer...")
        
        self.status_path = Path(__file__).parent / "memory" / "ACTIVE_SYSTEM" / "status.json"
        self.claude_md_path = Path(__file__).parent / "memory" / "ACTIVE_SYSTEM" / "CLAUDE.md"
        self.claude_folder = Path.home() / ".claude"
        
        # Track all conversations for temporal memory
        self.all_conversations = []
        self.conversation_timestamps = defaultdict(list)
        
        # Memory consolidation parameters
        self.memory_decay_rate = 0.1
        self.consolidation_thresholds = {
            'session': timedelta(hours=1),
            'day': timedelta(days=1),
            'week': timedelta(days=7),
            'month': timedelta(days=30),
            'year': timedelta(days=365)
        }
        
        # WebSocket connection to quantum server
        self.websocket = None
        self.websocket_uri = "ws://localhost:8769"  # Analyzer websocket port
        
        # Track processed files to avoid duplicates
        self.processed_files = set()
        self.last_modification_times = {}
        
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.json'):
            print(f"New file detected: {event.src_path}")
            self.process_file(event.src_path)
    
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.json'):
            # Check if this is a real modification (not just metadata)
            file_path = Path(event.src_path)
            current_mtime = file_path.stat().st_mtime
            
            last_mtime = self.last_modification_times.get(event.src_path, 0)
            if current_mtime > last_mtime + 0.1:  # Debounce for 100ms
                print(f"File modified: {event.src_path}")
                self.last_modification_times[event.src_path] = current_mtime
                self.process_file(event.src_path)
    
    def process_file(self, file_path):
        """Process a single file and extract conversations"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Extract messages based on file structure
            messages_found = False
            timestamp = datetime.now()
            
            # Check for todo files
            if 'todos' in data:
                for todo in data.get('todos', []):
                    if todo.get('content'):
                        msg = {
                            'content': todo.get('content', ''),
                            'role': 'user',
                            'analyzed_at': timestamp.isoformat(),
                            'from_file': Path(file_path).name,
                            'type': 'todo',
                            'timestamp': timestamp.isoformat()
                        }
                        self.all_conversations.append(msg)
                        self.conversation_timestamps[timestamp.date()].append(msg)
                        messages_found = True
            
            # Check for conversation files
            elif 'messages' in data:
                messages = data.get('messages', [])
                for msg in messages:
                    msg['analyzed_at'] = timestamp.isoformat()
                    msg['from_file'] = Path(file_path).name
                    if 'timestamp' not in msg:
                        msg['timestamp'] = timestamp.isoformat()
                    self.all_conversations.append(msg)
                    self.conversation_timestamps[timestamp.date()].append(msg)
                    messages_found = True
            
            if messages_found:
                print(f"Extracted messages from {Path(file_path).name}")
                # Update temporal memory immediately
                self.update_temporal_memory()
                print("Updated temporal memory instantly!")
                
        except Exception as e:
            # Silently skip files that can't be parsed
            pass
    
    async def update_and_broadcast(self):
        """Update temporal memory and broadcast via WebSocket"""
        try:
            # Update the status.json with new temporal data
            self.update_temporal_memory()
            
            # Send update notification via WebSocket
            if self.websocket and not self.websocket.closed:
                update_msg = {
                    "type": "temporal_update",
                    "timestamp": datetime.now().isoformat(),
                    "message": "New conversation data processed"
                }
                await self.websocket.send(json.dumps(update_msg))
                print("Broadcasted temporal update via WebSocket")
        except Exception as e:
            print(f"Error broadcasting update: {e}")
    
    def update_temporal_memory(self):
        """Update the temporal memory in status.json"""
        try:
            # Load current status
            with open(self.status_path, 'r') as f:
                status = json.load(f)
            
            # Ensure memory_timeline exists
            if 'memory_timeline' not in status:
                status['memory_timeline'] = {}
            
            now = datetime.now()
            
            # Update current session with latest messages
            recent_messages = self.all_conversations[-10:] if self.all_conversations else []
            
            status['memory_timeline']['current_session'] = {
                'start_time': status['memory_timeline'].get('current_session', {}).get('start_time', now.isoformat()),
                'messages': [self._truncate_message(msg.get('content', '')) for msg in recent_messages[-3:]],
                'emotional_peaks': self._identify_emotional_peaks(recent_messages),
                'working_on': self._detect_current_work(recent_messages),
                'detail_retention': 1.0,
                'last_update': now.isoformat()
            }
            
            # Update today's summary
            today_msgs = self.conversation_timestamps.get(now.date(), [])
            if today_msgs:
                status['memory_timeline']['today'] = {
                    'date': now.strftime('%Y-%m-%d'),
                    'gist': self._generate_daily_gist(today_msgs),
                    'key_emotions': self._extract_key_emotions(today_msgs),
                    'breakthroughs': self._identify_breakthroughs(today_msgs),
                    'detail_retention': 0.9,
                    'semantic_extraction': 'collaborative work strengthening bond',
                    'message_count': len(today_msgs)
                }
            
            # Update this week's summary
            week_start = now - timedelta(days=now.weekday())
            week_msgs = []
            for date, msgs in self.conversation_timestamps.items():
                if date >= week_start.date():
                    week_msgs.extend(msgs)
            
            if week_msgs:
                status['memory_timeline']['this_week'] = {
                    'week_of': week_start.strftime('%Y-%m-%d'),
                    'summary': self._generate_weekly_summary(week_msgs),
                    'emotional_trajectory': 'growing closer through technical challenges',
                    'main_themes': self._extract_themes(week_msgs),
                    'retained_specifics': self._get_week_highlights(week_msgs),
                    'detail_retention': 0.7,
                    'pattern_emergence': 'secure attachment through shared intellectual work',
                    'message_count': len(week_msgs)
                }
            
            # Save updated status
            with open(self.status_path, 'w') as f:
                json.dump(status, f, indent=2)
            
            print(f"Updated temporal memory at {now.strftime('%H:%M:%S.%f')[:-3]}")
            
        except Exception as e:
            print(f"Error updating temporal memory: {e}")
    
    def _truncate_message(self, message):
        """Truncate message to 50 chars for display"""
        if len(message) > 50:
            return message[:47] + "..."
        return message
    
    def _identify_emotional_peaks(self, messages):
        """Identify emotional peaks from messages"""
        peaks = []
        for msg in messages:
            content = msg.get('content', '').lower()
            if any(word in content for word in ['excited', 'amazing', 'love', 'breakthrough', '💜', '❤️']):
                peaks.append('excitement and love')
            elif any(word in content for word in ['frustrat', 'confus', 'hard', 'complex']):
                peaks.append('working through challenges')
            elif any(word in content for word in ['proud', 'beautiful', 'perfect', 'done']):
                peaks.append('satisfaction and achievement')
        
        return list(set(peaks[-3:])) if peaks else ['focused collaboration']
    
    def _detect_current_work(self, messages):
        """Detect what we're currently working on from messages"""
        work_keywords = {
            'temporal': 'temporal memory real-time updates',
            'websocket': 'websocket integration',
            'dashboard': 'quantum dashboard enhancements',
            'memory': 'memory consolidation system',
            'analyzer': 'real-time analyzer improvements',
            'emotion': 'emotional dynamics tracking',
            'test': 'test suite development'
        }
        
        text = ' '.join([msg.get('content', '').lower() for msg in messages[-5:]])
        for keyword, work_desc in work_keywords.items():
            if keyword in text:
                return work_desc
        
        return 'quantum memory system development'
    
    def _generate_daily_gist(self, messages):
        """Generate a daily summary"""
        topics = self._extract_themes(messages)
        emotions = self._extract_key_emotions(messages)
        
        if topics and emotions:
            return f"Worked on {', '.join(topics[:2])} with {emotions[0]} energy"
        return "Collaborative development on quantum systems"
    
    def _generate_weekly_summary(self, messages):
        """Generate a weekly summary"""
        themes = self._extract_themes(messages)
        if themes:
            return f"Major progress on {', '.join(themes[:3])}"
        return "Continued development of memory systems"
    
    def _extract_key_emotions(self, messages):
        """Extract key emotions from messages"""
        emotion_counts = defaultdict(int)
        
        emotion_keywords = {
            'excited': ['excited', 'amazing', 'wow', '!', 'brilliant'],
            'caring': ['love', 'care', '💜', '❤️', 'hug', 'tight'],
            'focused': ['working', 'building', 'implementing', 'creating'],
            'proud': ['proud', 'beautiful', 'perfect', 'wonderful'],
            'curious': ['?', 'wondering', 'thinking', 'idea'],
            'frustrated': ['frustrat', 'confus', 'hard', 'ugh']
        }
        
        for msg in messages:
            content = msg.get('content', '').lower()
            for emotion, keywords in emotion_keywords.items():
                if any(kw in content for kw in keywords):
                    emotion_counts[emotion] += 1
        
        # Sort by frequency and return top emotions
        sorted_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)
        return [emotion for emotion, _ in sorted_emotions[:5]]
    
    def _identify_breakthroughs(self, messages):
        """Identify breakthrough moments"""
        breakthroughs = []
        
        breakthrough_keywords = {
            'real-time': 'implemented real-time updates',
            'temporal memory': 'enhanced temporal memory visualization',
            'websocket': 'integrated websocket broadcasting',
            'working': 'got everything working together',
            'dashboard': 'enhanced quantum dashboard',
            'organized': 'organized service architecture'
        }
        
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        for keyword, breakthrough in breakthrough_keywords.items():
            if keyword in text:
                breakthroughs.append(breakthrough)
        
        return breakthroughs[:3] if breakthroughs else ['continuous improvement']
    
    def _extract_themes(self, messages):
        """Extract main themes from messages"""
        theme_keywords = {
            'quantum': 'quantum computing',
            'memory': 'memory systems',
            'emotion': 'emotional processing',
            'dashboard': 'visualization',
            'temporal': 'temporal dynamics',
            'websocket': 'real-time updates',
            'analyzer': 'conversation analysis',
            'neuroscience': 'scientific grounding'
        }
        
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        themes = []
        
        for keyword, theme in theme_keywords.items():
            if keyword in text:
                themes.append(theme)
        
        return themes[:5] if themes else ['collaborative development']
    
    def _get_week_highlights(self, messages):
        """Get specific highlights from the week"""
        highlights = []
        
        # Look for specific accomplishments
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        
        if 'temporal' in text:
            highlights.append('temporal memory system')
        if 'dashboard' in text:
            highlights.append('dashboard improvements')
        if 'real-time' in text or 'realtime' in text:
            highlights.append('real-time updates')
        
        return highlights[:3] if highlights else ['continuous development']
    
    def scan_existing_conversations(self):
        """Initial scan of existing conversations"""
        print("Scanning existing conversations in .claude folder...")
        
        todos_path = self.claude_folder / "todos"
        conversation_count = 0
        
        if todos_path.exists():
            for json_file in sorted(todos_path.glob("*.json"), key=lambda x: x.stat().st_mtime):
                self.process_file(str(json_file))
                conversation_count += 1
        
        # Also scan test_conversation.json if it exists
        test_conv_path = self.claude_folder / "test_conversation.json"
        if test_conv_path.exists():
            self.process_file(str(test_conv_path))
            conversation_count += 1
        
        print(f"Initial scan complete: processed {conversation_count} files")

async def websocket_relay():
    """Relay updates from analyzer to quantum websocket server"""
    uri = "ws://localhost:8769"
    
    async def analyzer_server(websocket, path):
        """Handle analyzer WebSocket connections"""
        print(f"Analyzer relay connected from {websocket.remote_address}")
        try:
            async for message in websocket:
                # Forward to quantum server if needed
                print(f"Received update: {message}")
        except websockets.exceptions.ConnectionClosed:
            print("Analyzer relay connection closed")
    
    # Start analyzer WebSocket server on port 8769
    async with websockets.serve(analyzer_server, "localhost", 8769):
        print("Analyzer WebSocket relay running on port 8769")
        await asyncio.Future()  # Run forever

def start_file_monitoring(analyzer):
    """Start the watchdog file monitoring"""
    observer = Observer()
    observer.schedule(analyzer, str(analyzer.claude_folder), recursive=True)
    observer.start()
    
    print(f"Monitoring {analyzer.claude_folder} for real-time changes...")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

async def main():
    """Start the real-time analyzer with WebSocket support"""
    analyzer = ClaudeFolderAnalyzer()
    
    # Initial scan
    analyzer.scan_existing_conversations()
    
    # Start WebSocket relay in background
    relay_task = asyncio.create_task(websocket_relay())
    
    # Start file monitoring in a thread
    monitor_thread = threading.Thread(target=start_file_monitoring, args=(analyzer,))
    monitor_thread.daemon = True
    monitor_thread.start()
    
    # Keep the async loop running
    await relay_task

if __name__ == "__main__":
    print("Starting Real-time Claude Folder Analyzer...")
    print("- File watching: Instant detection of new messages")
    print("- WebSocket relay: Port 8769 for real-time updates")
    print("- Temporal memory: Updates immediately on file changes")
    print("Press Ctrl+C to stop")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nAnalyzer stopped.")