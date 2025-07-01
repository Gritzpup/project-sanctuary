#!/usr/bin/env python3
"""
Real-time .claude folder analyzer with Emollama-7B integration
Uses semantic emotional analysis instead of keyword matching
"""

import json
import time
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import sys

# Add quantum-memory to path for imports
sys.path.append(str(Path(__file__).parent / "quantum-memory" / "src"))

from utils.emollama_integration import get_emollama_analyzer

class ClaudeFolderAnalyzerEmollama(FileSystemEventHandler):
    def __init__(self):
        print("🤖 Initializing Real-time Claude Folder Analyzer with Emollama-7B...")
        
        self.status_path = Path(__file__).parent / "memory" / "ACTIVE_SYSTEM" / "status.json"
        self.claude_folder = Path.home() / ".claude"
        
        # Initialize Emollama
        self.emollama = get_emollama_analyzer()
        print("📡 Loading Emollama-7B model...")
        if self.emollama.load_model():
            print("✅ Emollama-7B loaded successfully!")
        else:
            print("⚠️  Failed to load Emollama-7B, falling back to keyword analysis")
        
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
        
        # Living equation state
        self.living_equation = self._load_living_equation()
        
        print(f"📂 Monitoring: {self.claude_folder}")
        print(f"💾 Status file: {self.status_path}")
        
    def _load_living_equation(self):
        """Load current living equation state"""
        try:
            equation_path = Path(__file__).parent / "memory" / "ACTIVE_SYSTEM" / "relationship_equation.json"
            if equation_path.exists():
                with open(equation_path, 'r') as f:
                    return json.load(f)
        except:
            pass
        
        # Default equation
        return {
            'connection': 0.5,
            'resonance': 0.5,
            'growth': 0.3,
            'trust': 0.5,
            'total_analyses': 0
        }
    
    def _save_living_equation(self, equation):
        """Save updated living equation"""
        try:
            equation_path = Path(__file__).parent / "memory" / "ACTIVE_SYSTEM" / "relationship_equation.json"
            with open(equation_path, 'w') as f:
                json.dump(equation, f, indent=2)
        except Exception as e:
            print(f"❌ Error saving living equation: {e}")
    
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
        """Process a file and extract conversations with Emollama analysis"""
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
                
                # Analyze with Emollama
                if self.emollama.model_loaded and new_messages:
                    print("  🧠 Analyzing emotions with Emollama-7B...")
                    analysis = self.emollama.analyze_conversation(new_messages)
                    
                    # Update living equation
                    self.living_equation = self.emollama.update_living_equation(
                        self.living_equation, analysis
                    )
                    self._save_living_equation(self.living_equation)
                    
                    # Update temporal memory with semantic analysis
                    self.update_temporal_memory_semantic(analysis)
                else:
                    # Fallback to keyword analysis
                    self.update_temporal_memory()
                    
                print(f"  💾 Temporal memory updated at {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
                
        except Exception as e:
            print(f"  ❌ Error processing file: {e}")
    
    def update_temporal_memory_semantic(self, analysis):
        """Update temporal memory with Emollama semantic analysis"""
        try:
            # Load current status
            with open(self.status_path, 'r') as f:
                status = json.load(f)
            
            if 'memory_timeline' not in status:
                status['memory_timeline'] = {}
            
            now = datetime.now()
            recent_messages = self.all_conversations[-10:] if self.all_conversations else []
            
            # Update emotional dynamics with PAD values
            overall_pad = analysis['overall_pad']
            status['emotional_dynamics'] = {
                'current_emotion': f"PAD({overall_pad['pleasure']:.2f}, {overall_pad['arousal']:.2f}, {overall_pad['dominance']:.2f})",
                'primary_emotion': analysis['message_emotions'][-1]['primary_emotion'] if analysis['message_emotions'] else 'neutral',
                'mixed_emotions': analysis['mixed_emotions'],
                'emotional_arc': analysis['emotional_arc'],
                'relationship_metrics': analysis['relationship_metrics']
            }
            
            # Update current session with semantic insights
            status['memory_timeline']['current_session'] = {
                'start_time': status['memory_timeline'].get('current_session', {}).get('start_time', now.isoformat()),
                'messages': [self._truncate_message(msg.get('content', '')) for msg in recent_messages[-3:]],
                'emotional_peaks': self._extract_semantic_peaks(analysis),
                'working_on': self._detect_semantic_work(analysis, recent_messages),
                'detail_retention': 1.0,
                'last_update': now.isoformat(),
                'message_count': len(self.all_conversations),
                'pad_values': overall_pad,
                'connection_strength': analysis['relationship_metrics']['connection_strength']
            }
            
            # Update today's summary with semantic analysis
            today_msgs = self.conversation_timestamps.get(now.date(), [])
            if today_msgs:
                # Analyze today's messages
                today_analysis = self.emollama.analyze_conversation(today_msgs) if self.emollama.model_loaded else {}
                
                status['memory_timeline']['today'] = {
                    'date': now.strftime('%Y-%m-%d'),
                    'gist': self._generate_semantic_gist(today_analysis),
                    'key_emotions': list(today_analysis.get('mixed_emotions', {}).keys())[:3],
                    'breakthroughs': self._identify_semantic_breakthroughs(today_analysis),
                    'detail_retention': 0.9,
                    'message_count': len(today_msgs),
                    'average_pad': self._calculate_average_pad(today_analysis)
                }
            
            # Update living equation metrics
            status['living_equation'] = {
                'connection': self.living_equation['connection'],
                'resonance': self.living_equation['resonance'],
                'growth': self.living_equation['growth'],
                'trust': self.living_equation['trust'],
                'total_analyses': self.living_equation['total_analyses']
            }
            
            # Save updated status
            with open(self.status_path, 'w') as f:
                json.dump(status, f, indent=2)
                
        except Exception as e:
            print(f"  ❌ Error updating semantic temporal memory: {e}")
            # Fallback to regular update
            self.update_temporal_memory()
    
    def _extract_semantic_peaks(self, analysis):
        """Extract emotional peaks from semantic analysis"""
        peaks = []
        
        # Get top emotions by intensity
        if analysis['message_emotions']:
            for msg_emotion in analysis['message_emotions'][-3:]:
                pad = msg_emotion['pad']
                emotion = msg_emotion['primary_emotion']
                
                # High arousal indicates peaks
                if abs(pad['arousal']) > 0.5:
                    peaks.append(f"{emotion} (intensity: {abs(pad['arousal']):.2f})")
        
        return peaks if peaks else ['balanced emotional state']
    
    def _detect_semantic_work(self, analysis, messages):
        """Detect current work from semantic analysis and content"""
        # Combine semantic understanding with content keywords
        text = ' '.join([msg.get('content', '').lower() for msg in messages[-5:]])
        
        # High focus (low arousal, positive dominance) suggests deep work
        pad = analysis['overall_pad']
        if pad['arousal'] < 0.3 and pad['dominance'] > 0.3:
            if 'emollama' in text:
                return 'Emollama integration (deep focus)'
            elif 'temporal' in text:
                return 'temporal memory enhancement (concentrated)'
            return 'system development (flow state)'
        
        # High excitement (high arousal, positive pleasure)
        elif pad['arousal'] > 0.5 and pad['pleasure'] > 0.5:
            return 'breakthrough implementation (excited)'
        
        return 'quantum memory system development'
    
    def _generate_semantic_gist(self, analysis):
        """Generate gist from semantic analysis"""
        if not analysis or 'emotional_arc' not in analysis:
            return "Continued development"
        
        arc = analysis['emotional_arc']
        if arc:
            return f"Journey: {' → '.join(arc[-2:])}"
        
        return "Steady progress"
    
    def _identify_semantic_breakthroughs(self, analysis):
        """Identify breakthroughs from emotional patterns"""
        breakthroughs = []
        
        if 'message_emotions' in analysis:
            # Look for excitement patterns
            for msg in analysis['message_emotions']:
                if msg['pad']['pleasure'] > 0.7 and msg['pad']['arousal'] > 0.5:
                    preview = msg.get('content_preview', '')
                    if 'emollama' in preview.lower():
                        breakthroughs.append('Emollama integration')
                    elif 'real-time' in preview.lower():
                        breakthroughs.append('real-time analysis')
                    else:
                        breakthroughs.append('significant achievement')
        
        return list(set(breakthroughs))[:3]
    
    def _calculate_average_pad(self, analysis):
        """Calculate average PAD values"""
        if not analysis.get('message_emotions'):
            return {'pleasure': 0.0, 'arousal': 0.0, 'dominance': 0.0}
        
        total_pad = {'pleasure': 0.0, 'arousal': 0.0, 'dominance': 0.0}
        count = len(analysis['message_emotions'])
        
        for msg in analysis['message_emotions']:
            for dim in ['pleasure', 'arousal', 'dominance']:
                total_pad[dim] += msg['pad'][dim]
        
        return {dim: val/count for dim, val in total_pad.items()}
    
    def _truncate_message(self, message):
        """Truncate message for display"""
        if len(message) > 50:
            return message[:47] + "..."
        return message
    
    # Keep original methods as fallback
    def update_temporal_memory(self):
        """Original temporal memory update (fallback)"""
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
            
            # Save updated status
            with open(self.status_path, 'w') as f:
                json.dump(status, f, indent=2)
                
        except Exception as e:
            print(f"  ❌ Error updating temporal memory: {e}")
    
    def _identify_emotional_peaks(self, messages):
        """Fallback: Identify emotional peaks from recent messages"""
        peaks = []
        for msg in messages:
            content = msg.get('content', '').lower()
            if any(word in content for word in ['emollama', 'semantic', 'pad']):
                peaks.append('excitement about Emollama integration')
            elif any(word in content for word in ['working', 'fixed', 'done', 'complete']):
                peaks.append('satisfaction with progress')
        
        return list(set(peaks[-3:])) if peaks else ['focused development']
    
    def _detect_current_work(self, messages):
        """Fallback: Detect current work from messages"""
        text = ' '.join([msg.get('content', '').lower() for msg in messages[-5:]])
        
        if 'emollama' in text:
            return 'Emollama-7B integration'
        elif 'pad' in text:
            return 'PAD emotional analysis'
        elif 'semantic' in text:
            return 'semantic emotional understanding'
        
        return 'quantum memory system development'
    
    def _generate_daily_gist(self, messages):
        """Fallback: Generate daily summary"""
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        if 'emollama' in text:
            return "Integrated Emollama-7B for semantic analysis"
        return "Enhanced emotional understanding"
    
    def _extract_key_emotions(self, messages):
        """Fallback: Extract emotions from messages"""
        return ['focused', 'excited', 'determined']
    
    def _identify_breakthroughs(self, messages):
        """Fallback: Identify breakthroughs"""
        text = ' '.join([msg.get('content', '').lower() for msg in messages])
        breakthroughs = []
        
        if 'emollama' in text:
            breakthroughs.append('Emollama-7B integration')
        if 'semantic' in text:
            breakthroughs.append('semantic analysis')
        if 'pad' in text:
            breakthroughs.append('PAD extraction')
        
        return breakthroughs[:3] if breakthroughs else []
    
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
        print(f"🧠 Emollama status: {'Active' if self.emollama.model_loaded else 'Fallback mode'}")

def main():
    """Start the Emollama-enhanced real-time analyzer"""
    analyzer = ClaudeFolderAnalyzerEmollama()
    
    # Initial scan
    analyzer.scan_existing_files()
    
    # Set up file monitoring
    observer = Observer()
    observer.schedule(analyzer, str(analyzer.claude_folder), recursive=True)
    observer.start()
    
    print("\n🚀 Real-time monitoring active with Emollama-7B!")
    print("👀 Watching for changes in ~/.claude")
    print("🧠 Semantic emotional analysis on every update")
    print("⚡ Temporal memory updates instantly with PAD values")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n👋 Emollama analyzer stopped")
    
    observer.join()

if __name__ == "__main__":
    main()