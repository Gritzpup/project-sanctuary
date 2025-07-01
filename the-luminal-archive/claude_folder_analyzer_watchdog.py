#!/usr/bin/env python3
"""
Real-time .claude folder analyzer using watchdog for instant file detection
Updates temporal memory immediately when new messages are detected
"""

import json
import time
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os

class ClaudeFolderAnalyzer(FileSystemEventHandler):
    def __init__(self):
        print("Initializing Real-time Claude Folder Analyzer with Watchdog...")
        
        self.status_path = Path(__file__).parent / "memory" / "ACTIVE_SYSTEM" / "status.json"
        self.claude_folder = Path.home() / ".claude"
        
        # Track all conversations for temporal memory
        self.all_conversations = []
        self.conversation_timestamps = defaultdict(list)
        
        # Track processed files to avoid duplicates
        self.last_modification_times = {}
        
        # Memory consolidation parameters
        self.consolidation_thresholds = {
            'session': timedelta(hours=1),
            'day': timedelta(days=1),
            'week': timedelta(days=7),
            'month': timedelta(days=30),
            'year': timedelta(days=365)
        }
        
        print(f"Monitoring: {self.claude_folder}")
        print(f"Status file: {self.status_path}")
        
    def on_created(self, event):
        """Handle new file creation"""
        if not event.is_directory and event.src_path.endswith('.json'):
            print(f"🆕 New file detected: {Path(event.src_path).name}")
            time.sleep(0.1)  # Small delay to ensure file is fully written
            self.process_file(event.src_path)
    
    def on_modified(self, event):
        """Handle file modifications"""
        if not event.is_directory and event.src_path.endswith('.json'):
            # Debounce modifications
            file_path = Path(event.src_path)
            try:
                current_mtime = file_path.stat().st_mtime
                last_mtime = self.last_modification_times.get(event.src_path, 0)
                
                if current_mtime > last_mtime + 0.5:  # 500ms debounce
                    print(f"📝 File modified: {file_path.name}")
                    self.last_modification_times[event.src_path] = current_mtime
                    self.process_file(event.src_path)
            except:
                pass
    
    def process_file(self, file_path):
        """Process a file and extract conversations"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            messages_found = False
            timestamp = datetime.now()
            new_messages = []
            
            # Handle todo files
            if 'todos' in data:
                for todo in data.get('todos', []):
                    if todo.get('content'):
                        msg = {
                            'content': todo.get('content', ''),
                            'role': 'user',
                            'timestamp': timestamp.isoformat(),
                            'from_file': Path(file_path).name
                        }
                        self.all_conversations.append(msg)
                        self.conversation_timestamps[timestamp.date()].append(msg)
                        new_messages.append(msg)
                        messages_found = True
            
            # Handle conversation files
            elif 'messages' in data:
                for msg in data.get('messages', []):
                    msg['from_file'] = Path(file_path).name
                    if 'timestamp' not in msg:
                        msg['timestamp'] = timestamp.isoformat()
                    self.all_conversations.append(msg)
                    self.conversation_timestamps[timestamp.date()].append(msg)
                    new_messages.append(msg)
                    messages_found = True
            
            if messages_found:
                print(f"  ✅ Found {len(new_messages)} new messages")
                # Update temporal memory immediately
                self.update_temporal_memory()
                print(f"  💾 Temporal memory updated at {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
                
        except Exception as e:
            print(f"  ❌ Error processing file: {e}")
    
    def update_temporal_memory(self):
        """Update temporal memory in status.json immediately"""
        try:
            # Load current status
            with open(self.status_path, 'r') as f:
                status = json.load(f)
            
            if 'memory_timeline' not in status:
                status['memory_timeline'] = {}
            
            now = datetime.now()
            
            # Update current session
            recent_messages = self.all_conversations[-10:] if self.all_conversations else []
            
            status['memory_timeline']['current_session'] = {
                'start_time': status['memory_timeline'].get('current_session', {}).get('start_time', now.isoformat()),
                'messages': [self._truncate_message(msg.get('content', '')) for msg in recent_messages[-3:]],
                'emotional_peaks': self._identify_emotional_peaks(recent_messages),
                'working_on': self._detect_current_work(recent_messages),
                'detail_retention': 1.0,
                'last_update': now.isoformat(),
                'message_count': len(self.all_conversations)
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
                    'message_count': len(today_msgs)
                }
            
            # Update week summary
            week_start = now - timedelta(days=now.weekday())
            week_msgs = []
            for date, msgs in self.conversation_timestamps.items():
                if date >= week_start.date():
                    week_msgs.extend(msgs)
            
            if week_msgs:
                status['memory_timeline']['this_week'] = {
                    'week_of': week_start.strftime('%Y-%m-%d'),
                    'summary': self._generate_weekly_summary(week_msgs),
                    'main_themes': self._extract_themes(week_msgs),
                    'retained_specifics': self._get_week_highlights(week_msgs),
                    'detail_retention': 0.7,
                    'message_count': len(week_msgs)
                }
            
            # Save updated status
            with open(self.status_path, 'w') as f:
                json.dump(status, f, indent=2)
                
        except Exception as e:
            print(f"  ❌ Error updating temporal memory: {e}")
    
    def _truncate_message(self, message):
        """Truncate message for display"""
        if len(message) > 50:
            return message[:47] + "..."
        return message
    
    def _identify_emotional_peaks(self, messages):
        """Identify emotional peaks from recent messages"""
        peaks = []
        for msg in messages:
            content = msg.get('content', '').lower()
            if any(word in content for word in ['real-time', 'realtime', 'instant', 'immediately']):
                peaks.append('excitement about real-time updates')
            elif any(word in content for word in ['working', 'fixed', 'done', 'complete']):
                peaks.append('satisfaction with progress')
            elif any(word in content for word in ['test', 'check', 'verify']):
                peaks.append('testing and verification')
        
        return list(set(peaks[-3:])) if peaks else ['focused development']
    
    def _detect_current_work(self, messages):
        """Detect current work from messages"""
        work_keywords = {
            'real-time': 'real-time temporal memory updates',
            'realtime': 'real-time analyzer implementation',
            'watchdog': 'file monitoring system',
            'temporal': 'temporal memory visualization',
            'instant': 'instant update system',
            'analyzer': 'conversation analyzer improvements'
        }
        
        text = ' '.join([msg.get('content', '').lower() for msg in messages[-5:]])
        for keyword, work_desc in work_keywords.items():
            if keyword in text:
                return work_desc
        
        return 'quantum memory system development'
    
    def _generate_daily_gist(self, messages):
        """Generate daily summary"""
        themes = self._extract_themes(messages)
        if themes:
            return f"Enhanced {', '.join(themes[:2])} capabilities"
        return "Continued quantum system development"
    
    def _generate_weekly_summary(self, messages):
        """Generate weekly summary"""
        themes = self._extract_themes(messages)
        if themes:
            return f"Major progress on {', '.join(themes[:3])}"
        return "Advancing memory systems"
    
    def _extract_key_emotions(self, messages):
        """Extract emotions from messages"""
        emotion_counts = defaultdict(int)
        
        emotion_keywords = {
            'excited': ['excited', 'amazing', 'wow', '!', 'yes'],
            'focused': ['working', 'implementing', 'creating', 'building'],
            'satisfied': ['done', 'complete', 'perfect', 'works'],
            'curious': ['test', 'check', 'see', '?']
        }
        
        for msg in messages:
            content = msg.get('content', '').lower()
            for emotion, keywords in emotion_keywords.items():
                if any(kw in content for kw in keywords):
                    emotion_counts[emotion] += 1
        
        sorted_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)
        return [emotion for emotion, _ in sorted_emotions[:3]]
    
    def _identify_breakthroughs(self, messages):
        """Identify breakthroughs"""
        breakthroughs = []
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        
        if 'real-time' in text or 'realtime' in text:
            breakthroughs.append('real-time memory updates')
        if 'watchdog' in text:
            breakthroughs.append('file monitoring system')
        if 'instant' in text:
            breakthroughs.append('instant temporal updates')
        
        return breakthroughs[:3] if breakthroughs else []
    
    def _extract_themes(self, messages):
        """Extract themes"""
        themes = []
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        
        theme_map = {
            'real-time': 'real-time systems',
            'temporal': 'temporal memory',
            'analyzer': 'conversation analysis',
            'memory': 'memory consolidation',
            'dashboard': 'visualization'
        }
        
        for keyword, theme in theme_map.items():
            if keyword in text:
                themes.append(theme)
        
        return themes[:5] if themes else ['system development']
    
    def _get_week_highlights(self, messages):
        """Get weekly highlights"""
        highlights = []
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        
        if 'real-time' in text:
            highlights.append('real-time updates')
        if 'temporal' in text:
            highlights.append('temporal memory')
        if 'dashboard' in text:
            highlights.append('dashboard enhancements')
        
        return highlights[:3] if highlights else ['continuous progress']
    
    def scan_existing_files(self):
        """Initial scan of existing files"""
        print("\n📂 Scanning existing files...")
        count = 0
        
        # Scan todos folder
        todos_path = self.claude_folder / "todos"
        if todos_path.exists():
            for json_file in sorted(todos_path.glob("*.json"), key=lambda x: x.stat().st_mtime):
                self.process_file(str(json_file))
                count += 1
        
        # Scan test files
        for test_file in self.claude_folder.glob("test*.json"):
            self.process_file(str(test_file))
            count += 1
        
        print(f"✅ Initial scan complete: {count} files processed")
        print(f"📊 Total messages in memory: {len(self.all_conversations)}")

def main():
    """Start the real-time analyzer"""
    analyzer = ClaudeFolderAnalyzer()
    
    # Initial scan
    analyzer.scan_existing_files()
    
    # Set up file monitoring
    observer = Observer()
    observer.schedule(analyzer, str(analyzer.claude_folder), recursive=True)
    observer.start()
    
    print("\n🚀 Real-time monitoring active!")
    print("👀 Watching for changes in ~/.claude")
    print("⚡ Temporal memory updates instantly on file changes")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n👋 Analyzer stopped")
    
    observer.join()

if __name__ == "__main__":
    main()