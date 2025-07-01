#!/usr/bin/env python3
"""
Real-time .claude folder analyzer with Emollama-7B integration
Quantum version - uses quantum-memory folder structure
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
sys.path.append(str(Path(__file__).parent.parent / "src"))

from utils.emollama_integration import get_emollama_analyzer

class ClaudeFolderAnalyzerQuantum(FileSystemEventHandler):
    def __init__(self):
        print("🤖 Initializing Quantum Claude Folder Analyzer with Emollama-7B...")
        
        # Use quantum-memory structure
        self.quantum_base = Path(__file__).parent.parent
        self.status_path = self.quantum_base / "quantum_states" / "status.json"
        self.claude_folder = Path.home() / ".claude"
        
        # Create quantum_states directory if it doesn't exist
        self.status_path.parent.mkdir(parents=True, exist_ok=True)
        
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
        
        # Initialize status if doesn't exist
        if not self.status_path.exists():
            self._initialize_status()
        
        print(f"✅ Monitoring: {self.claude_folder}")
        print(f"📊 Status file: {self.status_path}")
        
    def _initialize_status(self):
        """Initialize status.json with quantum structure"""
        initial_status = {
            "quantum_state": "initialized",
            "entanglement_level": 0.0,
            "emotional_dynamics": {
                "current_emotion": "PAD(0.5, 0.5, 0.5)",
                "primary_emotion": "neutral",
                "mixed_emotions": {},
                "quantum_superposition": []
            },
            "real_time_tracking": {
                "current_session_start": datetime.now().isoformat(),
                "current_session_messages": 0,
                "llm_status": "running",
                "llm_pid": os.getpid(),
                "last_analysis": datetime.now().isoformat()
            },
            "quantum_metrics": {
                "coherence": 1.0,
                "decoherence_rate": 0.0,
                "measurement_count": 0,
                "superposition_states": 0
            },
            "memory_timeline": {
                "current_session": {
                    "start_time": datetime.now().isoformat(),
                    "messages": [],
                    "emotional_peaks": [],
                    "working_on": "quantum emotional analysis",
                    "detail_retention": 1.0
                }
            }
        }
        
        with open(self.status_path, 'w') as f:
            json.dump(initial_status, f, indent=2)
        print(f"✅ Initialized quantum status at {self.status_path}")
    
    def start_monitoring(self):
        """Start monitoring the .claude folder"""
        observer = Observer()
        observer.schedule(self, str(self.claude_folder), recursive=True)
        observer.start()
        
        print("🔍 Monitoring started. Press Ctrl+C to stop.")
        print("📍 Quantum states will be saved to:", self.status_path)
        
        try:
            while True:
                time.sleep(10)
                # Periodic quantum state update
                self._update_quantum_state()
        except KeyboardInterrupt:
            observer.stop()
            print("\n✅ Monitoring stopped.")
        observer.join()
    
    def _update_quantum_state(self):
        """Update quantum coherence and decoherence metrics"""
        try:
            if self.status_path.exists():
                with open(self.status_path, 'r') as f:
                    status = json.load(f)
                
                # Update quantum metrics
                if 'quantum_metrics' in status:
                    status['quantum_metrics']['measurement_count'] += 1
                    status['quantum_metrics']['coherence'] *= 0.99  # Slight decoherence
                    status['quantum_metrics']['decoherence_rate'] = 1 - status['quantum_metrics']['coherence']
                
                # Update last analysis time
                if 'real_time_tracking' in status:
                    status['real_time_tracking']['last_analysis'] = datetime.now().isoformat()
                
                with open(self.status_path, 'w') as f:
                    json.dump(status, f, indent=2)
                    
        except Exception as e:
            print(f"⚠️  Error updating quantum state: {e}")
    
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
            
        # Only process .jsonl files
        if not event.src_path.endswith('.jsonl'):
            return
        
        # Check if we've already processed this modification
        path = Path(event.src_path)
        current_mtime = path.stat().st_mtime
        
        if path in self.last_modification_times:
            if current_mtime - self.last_modification_times[path] < 1:
                return
        
        self.last_modification_times[path] = current_mtime
        
        # Process the conversation
        print(f"\n🔄 File modified: {path.name}")
        self._analyze_conversation_file(path)
    
    def _analyze_conversation_file(self, file_path):
        """Analyze a conversation file with Emollama"""
        try:
            with open(file_path, 'r') as f:
                lines = f.readlines()
            
            # Get recent messages
            recent_messages = []
            for line in lines[-20:]:  # Last 20 messages
                try:
                    data = json.loads(line.strip())
                    if data.get('type') == 'message':
                        content = data.get('content', '')
                        if content:
                            recent_messages.append(content)
                except:
                    pass
            
            if recent_messages:
                print(f"   🧠 Analyzing {len(recent_messages)} messages with Emollama...")
                
                # Analyze emotions
                emotions = self.emollama.analyze_emotions(' '.join(recent_messages))
                
                # Update quantum status
                self._update_status_with_emotions(emotions)
                
                print(f"   ✅ Analysis complete: {emotions.get('primary_emotion', 'unknown')}")
        
        except Exception as e:
            print(f"   ⚠️  Error analyzing file: {e}")
    
    def _update_status_with_emotions(self, emotions):
        """Update status.json with quantum emotional analysis"""
        try:
            if self.status_path.exists():
                with open(self.status_path, 'r') as f:
                    status = json.load(f)
            else:
                self._initialize_status()
                with open(self.status_path, 'r') as f:
                    status = json.load(f)
            
            # Update emotional dynamics
            if 'emotional_dynamics' in status and emotions:
                pad = emotions.get('pad_values', {'pleasure': 0.5, 'arousal': 0.5, 'dominance': 0.5})
                status['emotional_dynamics']['current_emotion'] = f"PAD({pad['pleasure']:.2f}, {pad['arousal']:.2f}, {pad['dominance']:.2f})"
                status['emotional_dynamics']['primary_emotion'] = emotions.get('primary_emotion', 'unknown')
                
                # Update mixed emotions if present
                if 'mixed_emotions' in emotions:
                    status['emotional_dynamics']['mixed_emotions'] = emotions['mixed_emotions']
                
                # Add quantum superposition states
                if 'emotional_probabilities' in emotions:
                    status['emotional_dynamics']['quantum_superposition'] = [
                        {"emotion": k, "amplitude": v} 
                        for k, v in emotions['emotional_probabilities'].items()
                    ]
            
            # Update session info
            if 'real_time_tracking' in status:
                status['real_time_tracking']['current_session_messages'] += 1
            
            # Save updated status
            with open(self.status_path, 'w') as f:
                json.dump(status, f, indent=2)
            
            print(f"   💾 Quantum state updated at {datetime.now().strftime('%H:%M:%S')}")
            
        except Exception as e:
            print(f"   ⚠️  Error updating status: {e}")

if __name__ == "__main__":
    analyzer = ClaudeFolderAnalyzerQuantum()
    analyzer.start_monitoring()