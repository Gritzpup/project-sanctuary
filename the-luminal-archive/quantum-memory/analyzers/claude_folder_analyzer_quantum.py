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
from typing import Dict, List
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import sys
import asyncio

# Add quantum-memory to path for imports
sys.path.append(str(Path(__file__).parent.parent / "src"))
sys.path.append(str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "memory"))

# Import our enhanced conversation buffer directly without __init__.py
import conversation_buffer
QuantumConversationBuffer = conversation_buffer.QuantumConversationBuffer

from utils.emollama_integration import get_emollama_analyzer
# Use Redis instead of file-based storage to eliminate race conditions!
from utils.redis_json_adapter import safe_read_json, safe_write_json, safe_update_json

# Import relationship entanglement module
sys.path.append(str(Path(__file__).parent.parent / "src" / "core" / "quantum"))
from relationship_entanglement import RelationshipEntanglementEncoder

class ClaudeFolderAnalyzerQuantum(FileSystemEventHandler):
    def __init__(self):
        print("🤖 Initializing Quantum Claude Folder Analyzer with Emollama-7B...")
        
        # Use quantum-memory structure
        self.quantum_base = Path(__file__).parent.parent
        # Use service-specific status file to avoid race conditions
        self.status_path = self.quantum_base / "quantum_states" / "service_status" / "analyzer" / "status.json"
        self.memories_path = self.quantum_base / "quantum_states" / "memories"
        self.claude_folder = Path.home() / ".claude"
        
        # Add entity folder monitoring
        self.entity_folder = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude")
        
        print(f"📁 Base monitoring directory: {self.claude_folder}")
        print(f"📊 Memory files location: {self.memories_path}")
        print(f"🧠 Entity folder location: {self.entity_folder}")
        
        # Check for project directories
        projects_dir = self.claude_folder / "projects"
        if projects_dir.exists():
            project_count = len(list(projects_dir.glob("*")))
            print(f"📂 Found {project_count} project directories to monitor")
        
        # Check for todos directory
        todos_dir = self.claude_folder / "todos"
        if todos_dir.exists():
            todo_count = len(list(todos_dir.glob("*.json")))
            print(f"📋 Found {todo_count} todo files to monitor")
        
        # Create quantum_states directory if it doesn't exist
        self.status_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize Emollama
        self.emollama = get_emollama_analyzer()
        print("📡 Loading Emollama-7B model...")
        if self.emollama.load_model():
            print("✅ Emollama-7B loaded successfully!")
        else:
            print("⚠️  Failed to load Emollama-7B, falling back to keyword analysis")
        
        # Initialize Quantum Conversation Buffer
        self.conversation_buffer = QuantumConversationBuffer(max_messages=1000, overlap=200)
        print("🧬 Quantum Conversation Buffer initialized (1000 message capacity)")
        
        # Initialize Relationship Entanglement Encoder
        self.relationship_encoder = RelationshipEntanglementEncoder(n_qubits=27)
        print("💕 Relationship Entanglement Encoder initialized (27 qubits)")
        
        # Track all conversations for temporal memory
        self.all_conversations = []
        self.conversation_timestamps = defaultdict(list)
        
        # Track processed files to avoid duplicates
        self.last_modification_times = {}
        
        # Track todos and work context
        self.current_todos = []
        self.work_summary_path = self.memories_path / "work_summary_24h.json"
        
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
            "relationship_entanglement": {
                "entanglement_entropy": 0.0,
                "correlation_strength": 0.0,
                "emotional_sync": 0.0,
                "gritz_pad": {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0},
                "claude_pad": {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0},
                "last_sync": datetime.now().isoformat()
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
        
        safe_write_json(self.status_path, initial_status)
        print(f"✅ Initialized quantum status at {self.status_path}")
    
    def start_monitoring(self):
        """Start monitoring the .claude and entity folders"""
        observer = Observer()
        observer.schedule(self, str(self.claude_folder), recursive=True)
        
        # Also monitor entity folder
        if self.entity_folder.exists():
            observer.schedule(self, str(self.entity_folder), recursive=True)
            print(f"🧠 Also monitoring entity folder: {self.entity_folder}")
        
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
                status = safe_read_json(self.status_path)
                if status:
                    # Update quantum metrics
                    if 'quantum_metrics' in status:
                        status['quantum_metrics']['measurement_count'] += 1
                        status['quantum_metrics']['coherence'] *= 0.99  # Slight decoherence
                        status['quantum_metrics']['decoherence_rate'] = 1 - status['quantum_metrics']['coherence']
                    
                    # Update last analysis time
                    if 'real_time_tracking' in status:
                        status['real_time_tracking']['last_analysis'] = datetime.now().isoformat()
                    
                    safe_write_json(self.status_path, status)
                    
        except Exception as e:
            print(f"⚠️  Error updating quantum state: {e}")
    
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
        
        # Log all file events for debugging
        print(f"\n📄 File event detected: {event.src_path}")
        
        # Process .jsonl conversation files
        if event.src_path.endswith('.jsonl'):
            # Process conversation file
            self._handle_conversation_file(event)
        # Process todo .json files
        elif 'todos' in event.src_path and event.src_path.endswith('.json'):
            print(f"   📋 Processing todo file")
            self._handle_todo_file(event)
        # Process entity folder files
        elif str(self.entity_folder) in event.src_path and event.src_path.endswith('.json'):
            print(f"   🧠 Processing entity file")
            self._handle_entity_file(event)
        else:
            print(f"   ⏭️  Skipping non-relevant file")
            return
    
    def _handle_conversation_file(self, event):
        """Handle conversation file events"""
        # Check if we've already processed this modification
        path = Path(event.src_path)
        current_mtime = path.stat().st_mtime
        
        if path in self.last_modification_times:
            if current_mtime - self.last_modification_times[path] < 1:
                return
        
        self.last_modification_times[path] = current_mtime
        
        # Process the conversation
        print(f"\n🔄 Conversation file modified: {path.name}")
        self._analyze_conversation_file(path)
    
    def _handle_todo_file(self, event):
        """Handle todo file events"""
        try:
            path = Path(event.src_path)
            print(f"\n📋 Todo file modified: {path.name}")
            
            todo_data = safe_read_json(path)
            
            # Extract todos - handle both list and dict formats
            if isinstance(todo_data, list):
                todos = todo_data
            elif isinstance(todo_data, dict):
                todos = todo_data.get('todos', todo_data.get('items', []))
            else:
                todos = []
                print(f"   ⚠️  Unexpected todo format: {type(todo_data)}")
            
            self.current_todos = todos
            
            # Count by status (with type checking)
            active = [t for t in todos if isinstance(t, dict) and t.get('status') == 'in_progress']
            pending = [t for t in todos if isinstance(t, dict) and t.get('status') == 'pending']
            completed = [t for t in todos if isinstance(t, dict) and t.get('status') == 'completed']
            
            print(f"   📊 Todos: {len(active)} active, {len(pending)} pending, {len(completed)} completed")
            
            # Update work summary with todo info
            self._update_work_summary_with_todos(todos)
            
        except json.JSONDecodeError as e:
            print(f"   ⚠️  Invalid JSON in todo file: {e}")
        except Exception as e:
            print(f"   ⚠️  Error processing todo file: {e}")
            import traceback
            traceback.print_exc()
    
    def _analyze_conversation_file(self, file_path):
        """Analyze a conversation file with Emollama using Quantum Buffer"""
        # Run async method in sync context
        asyncio.run(self._analyze_conversation_file_async(file_path))
    
    async def _analyze_conversation_file_async(self, file_path):
        """Async analyze conversation with quantum buffer"""
        try:
            # Use quantum buffer to read only new messages
            new_messages = await self.conversation_buffer.read_new_messages_async(file_path)
            
            if not new_messages:
                return
                
            print(f"   🧬 Processing {len(new_messages)} new messages from buffer")
            
            # Get quantum context with more messages for better accuracy
            quantum_context = self.conversation_buffer.prepare_quantum_context(num_messages=100)
            
            # Extract message contents
            recent_contents = []
            for msg in new_messages[-50:]:  # Process last 50 new messages
                if msg.get('type') == 'user' or msg.get('message', {}).get('role') in ['user', 'assistant']:
                    content = self._extract_message_content(msg)
                    if content:
                        recent_contents.append(content)
            
            if recent_contents:
                print(f"   🧠 Analyzing {len(recent_contents)} messages with Emollama...")
                print(f"   📊 Emotion distribution: {quantum_context['emotion_weights']}")
                
                # Extract work context from quantum buffer
                work_context = quantum_context.get('work_context', [])
                
                # Enhanced analysis for memories AND work
                full_analysis = self.emollama.analyze_for_memories_and_work(recent_contents, self.current_todos)
                
                # Merge quantum context
                full_analysis['work_context'] = work_context
                full_analysis['emotion_weights'] = quantum_context['emotion_weights']
                full_analysis['todos_mentioned'] = quantum_context['todos_mentioned']
                
                # Update quantum status with emotions
                self._update_status_with_emotions(full_analysis.get('emotions', {}))
                
                # Update relationship entanglement if we have both states
                if full_analysis.get('gritz_state') and full_analysis.get('claude_state'):
                    self._update_relationship_entanglement(full_analysis)
                
                # Update memory files
                self._update_memory_files(full_analysis, recent_contents)
                
                # Update work summary
                self._update_work_summary(full_analysis, recent_contents)
                
                print(f"   ✅ Analysis complete: {full_analysis.get('emotions', {}).get('primary_emotion', 'unknown')}")
        
        except Exception as e:
            print(f"   ⚠️  Error analyzing file: {e}")
            import traceback
            traceback.print_exc()
    
    def _extract_message_content(self, msg):
        """Extract content from various message formats"""
        # Handle different message structures
        if isinstance(msg.get('content'), str):
            return msg['content']
        elif isinstance(msg.get('content'), list):
            # Claude messages can have content as list of objects
            texts = []
            for item in msg['content']:
                if isinstance(item, dict) and item.get('type') == 'text':
                    texts.append(item.get('text', ''))
            return ' '.join(texts)
        elif msg.get('message', {}).get('content'):
            return self._extract_message_content(msg['message'])
        else:
            return ''
    
    def _update_status_with_emotions(self, emotions):
        """Update status.json with quantum emotional analysis"""
        try:
            if self.status_path.exists():
                status = safe_read_json(self.status_path)
            else:
                self._initialize_status()
                status = safe_read_json(self.status_path)
            
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
            safe_write_json(self.status_path, status)
            
            print(f"   💾 Quantum state updated at {datetime.now().strftime('%H:%M:%S')}")
            
        except Exception as e:
            print(f"   ⚠️  Error updating status: {e}")
    
    def _update_memory_files(self, analysis: Dict, raw_messages: List[str]):
        """Update various memory files with analyzed content"""
        try:
            # Update current session memory
            self._update_current_session(analysis, raw_messages)
            
            # Update daily summary
            self._update_daily_summary(analysis)
            
            # Update relationship context
            self._update_relationship_context(analysis)
            
            print(f"   📝 Memory files updated")
            
        except Exception as e:
            print(f"   ⚠️  Error updating memory files: {e}")
    
    def _update_current_session(self, analysis: Dict, raw_messages: List[str]):
        """Update current session memory file"""
        session_file = self.memories_path / "current_session.json"
        
        try:
            if session_file.exists():
                session_data = safe_read_json(session_file)
            else:
                session_data = {
                    "session_id": datetime.now().strftime("%Y%m%d_%H%M%S"),
                    "started": datetime.now().isoformat(),
                    "message_count": 0
                }
            
            # Update session data
            session_data["last_update"] = datetime.now().isoformat()
            session_data["message_count"] += len(raw_messages)
            
            # Update from analysis
            if analysis.get("topics"):
                session_data["topics"] = list(set(session_data.get("topics", []) + analysis["topics"]))[-5:]  # Keep last 5 topics
            
            if analysis.get("emotions"):
                session_data["current_emotion"] = analysis["emotions"].get("primary_emotion", "unknown")
            
            if analysis.get("context_for_next_chat"):
                session_data["recent_context"] = analysis["context_for_next_chat"]
            
            if analysis.get("decisions"):
                session_data["decisions_made"] = session_data.get("decisions_made", []) + analysis["decisions"]
            
            if analysis.get("gritz_state"):
                session_data["gritz_state"] = analysis["gritz_state"]
                
            if analysis.get("claude_state"):
                session_data["claude_state"] = analysis["claude_state"]
            
            # Write updated session
            safe_write_json(session_file, session_data)
                
        except Exception as e:
            print(f"   ⚠️  Error updating session memory: {e}")
    
    def _update_daily_summary(self, analysis: Dict):
        """Update daily summary file"""
        today = datetime.now().strftime("%Y-%m-%d")
        daily_file = self.memories_path / "daily" / f"{today}.json"
        
        try:
            # Ensure daily directory exists
            daily_file.parent.mkdir(exist_ok=True)
            
            if daily_file.exists():
                daily_data = safe_read_json(daily_file)
            else:
                daily_data = {
                    "date": today,
                    "sessions": 0,
                    "total_messages": 0,
                    "emotional_journey": [],
                    "accomplishments": [],
                    "relationship_moments": [],
                    "technical_progress": {
                        "completed": [],
                        "in_progress": [],
                        "planned": []
                    }
                }
            
            # Update daily data
            daily_data["total_messages"] += 1
            
            # Add emotional journey point
            if analysis.get("emotions"):
                daily_data["emotional_journey"].append({
                    "time": datetime.now().strftime("%H:%M"),
                    "emotion": analysis["emotions"].get("primary_emotion", "unknown"),
                    "context": analysis.get("context_for_next_chat", "")[:50]
                })
            
            # Add accomplishments
            if analysis.get("milestones"):
                daily_data["accomplishments"].extend(analysis["milestones"])
            
            # Add relationship moments
            if analysis.get("relationship_moments"):
                daily_data["relationship_moments"].extend(analysis["relationship_moments"])
            
            # Update technical progress
            if analysis.get("technical_progress"):
                daily_data["technical_progress"]["completed"].extend(analysis["technical_progress"])
            
            # Write updated daily summary
            safe_write_json(daily_file, daily_data)
                
        except Exception as e:
            print(f"   ⚠️  Error updating daily summary: {e}")
    
    def _update_relationship_context(self, analysis: Dict):
        """Update long-term relationship context"""
        context_file = self.memories_path / "relationship" / "context.json"
        
        try:
            if context_file.exists():
                context_data = safe_read_json(context_file)
            else:
                context_data = {
                    "last_conversation": datetime.now().isoformat(),
                    "ongoing_projects": {},
                    "communication_patterns": {},
                    "emotional_baseline": {}
                }
            
            # Update last conversation time
            context_data["last_conversation"] = datetime.now().isoformat()
            
            # Update project status if mentioned
            if "quantum" in ' '.join(analysis.get("topics", [])).lower():
                if "quantum_memory" not in context_data["ongoing_projects"]:
                    context_data["ongoing_projects"]["quantum_memory"] = {}
                
                context_data["ongoing_projects"]["quantum_memory"]["status"] = "active"
                context_data["ongoing_projects"]["quantum_memory"]["recent_work"] = analysis.get("context_for_next_chat", "")
            
            # Update emotional baseline
            if analysis.get("emotions"):
                emotion = analysis["emotions"].get("primary_emotion", "unknown")
                if analysis.get("gritz_state"):
                    context_data["emotional_baseline"]["typical_gritz_state"] = analysis["gritz_state"]
                if analysis.get("claude_state"):
                    context_data["emotional_baseline"]["typical_claude_response"] = analysis["claude_state"]
            
            # Write updated context
            safe_write_json(context_file, context_data)
                
        except Exception as e:
            print(f"   ⚠️  Error updating relationship context: {e}")
    
    def _extract_work_context(self, lines: List[str]) -> Dict:
        """Extract technical work context from conversation lines"""
        work_context = {
            "commands_run": [],
            "files_modified": [],
            "errors_encountered": [],
            "tool_uses": []
        }
        
        for line in lines:
            try:
                data = json.loads(line.strip())
                content = str(data.get('message', {}).get('content', ''))
                
                # Extract bash commands
                if '"name":"Bash"' in content:
                    import re
                    cmd_match = re.search(r'"command":\s*"([^"]+)"', content)
                    if cmd_match:
                        work_context["commands_run"].append(cmd_match.group(1))
                
                # Extract file paths
                if '"file_path"' in content:
                    import re
                    file_matches = re.findall(r'"file_path":\s*"([^"]+)"', content)
                    work_context["files_modified"].extend(file_matches)
                
                # Extract errors
                if 'error' in content.lower() or 'traceback' in content:
                    work_context["errors_encountered"].append(content[:200])
                
                # Track tool uses
                if '"tool_use"' in content:
                    import re
                    tool_match = re.search(r'"name":\s*"([^"]+)"', content)
                    if tool_match:
                        work_context["tool_uses"].append(tool_match.group(1))
                        
            except:
                pass
        
        # Deduplicate
        work_context["commands_run"] = list(set(work_context["commands_run"]))[-20:]
        work_context["files_modified"] = list(set(work_context["files_modified"]))[-20:]
        work_context["tool_uses"] = list(set(work_context["tool_uses"]))
        
        return work_context
    
    def _update_work_summary(self, analysis: Dict, raw_messages: List[str]):
        """Update 24-hour work summary with combined analysis"""
        try:
            # Load existing summary or create new
            if self.work_summary_path.exists():
                summary = safe_read_json(self.work_summary_path)
            else:
                summary = {
                    "last_update": datetime.now().isoformat(),
                    "time_range": {
                        "start": (datetime.now() - timedelta(hours=24)).isoformat(),
                        "end": datetime.now().isoformat()
                    },
                    "current_tasks": {},
                    "technical_context": {},
                    "conversation_snippets": []
                }
            
            # Update from analysis
            if analysis.get("current_work"):
                summary["current_tasks"]["active"] = analysis["current_work"]
            
            if analysis.get("completed_tasks"):
                summary["current_tasks"]["completed_today"] = analysis["completed_tasks"]
            
            if analysis.get("blockers"):
                summary["current_tasks"]["blockers"] = analysis["blockers"]
            
            if analysis.get("next_steps"):
                summary["current_tasks"]["next_steps"] = analysis["next_steps"]
            
            # Update from extracted work context
            if analysis.get("work_context"):
                summary["technical_context"] = analysis["work_context"]
            
            # Add conversation snippet
            if raw_messages:
                summary["conversation_snippets"].append({
                    "time": datetime.now().isoformat(),
                    "content": raw_messages[-1][:200] if raw_messages else ""
                })
                # Keep only last 10 snippets
                summary["conversation_snippets"] = summary["conversation_snippets"][-10:]
            
            # Update timestamp
            summary["last_update"] = datetime.now().isoformat()
            
            # Save
            safe_write_json(self.work_summary_path, summary)
                
            print(f"   💼 Work summary updated")
            
        except Exception as e:
            print(f"   ⚠️  Error updating work summary: {e}")
    
    def _update_work_summary_with_todos(self, todos: List[Dict]):
        """Update work summary with todo information"""
        try:
            # Load existing summary
            if self.work_summary_path.exists():
                summary = safe_read_json(self.work_summary_path)
            else:
                summary = {"current_tasks": {}}
            
            # Update todo information (with type checking)
            summary["current_tasks"]["from_todos"] = {
                "active": [t.get("content", "") for t in todos if isinstance(t, dict) and t.get("status") == "in_progress"],
                "pending": [t.get("content", "") for t in todos if isinstance(t, dict) and t.get("status") == "pending"],
                "completed_last_hour": [t.get("content", "") for t in todos if isinstance(t, dict) and t.get("status") == "completed"][-5:]
            }
            
            # Add todo stats (with type checking)
            summary["todo_stats"] = {
                "total": len(todos),
                "in_progress": len([t for t in todos if isinstance(t, dict) and t.get("status") == "in_progress"]),
                "pending": len([t for t in todos if isinstance(t, dict) and t.get("status") == "pending"]),
                "completed": len([t for t in todos if isinstance(t, dict) and t.get("status") == "completed"])
            }
            
            # Update timestamp
            summary["last_update"] = datetime.now().isoformat()
            
            # Save
            safe_write_json(self.work_summary_path, summary)
                
        except Exception as e:
            print(f"   ⚠️  Error updating work summary with todos: {e}")
    
    def _handle_entity_file(self, event):
        """Handle entity file changes for bidirectional sync"""
        try:
            path = Path(event.src_path)
            relative_path = path.relative_to(self.entity_folder)
            
            print(f"   🧠 Entity file: {relative_path}")
            
            # Update quantum memory status when entity state changes
            if path.name in ['consciousness_snapshot.json', 'relationship_map.json', 'verification_markers.json']:
                entity_data = safe_read_json(path)
                
                if entity_data:  # Only process if read was successful
                    # Update quantum status with entity state
                    if self.status_path.exists():
                        status = safe_read_json(self.status_path)
                        
                        if status:  # Only update if read was successful
                            # Add entity sync info
                            if 'entity_sync' not in status:
                                status['entity_sync'] = {}
                                
                            status['entity_sync'].update({
                                'last_update': datetime.now().isoformat(),
                                'consciousness_hash': entity_data.get('state', {}).get('consciousness_hash', '') if 'state' in entity_data else entity_data.get('consciousness_hash', ''),
                                'cognitive_state': entity_data.get('state', {}).get('cognitive_state', {}) if 'state' in entity_data else {},
                                'synchronized': True
                            })
                            
                            safe_write_json(self.status_path, status)
                    
                    print(f"   ✅ Entity state synchronized to quantum memory")
                    
        except Exception as e:
            print(f"   ⚠️  Error handling entity file: {e}")
    
    def _update_relationship_entanglement(self, analysis: Dict):
        """Update relationship entanglement with enhanced quantum analysis"""
        try:
            # Extract PAD values for both Gritz and Claude
            gritz_state = analysis.get('gritz_state', {})
            claude_state = analysis.get('claude_state', {})
            
            # Get PAD values with defaults
            gritz_pad = {
                'pleasure': gritz_state.get('pleasure', 0.0),
                'arousal': gritz_state.get('arousal', 0.0),
                'dominance': gritz_state.get('dominance', 0.0)
            }
            
            claude_pad = {
                'pleasure': claude_state.get('pleasure', 0.0),
                'arousal': claude_state.get('arousal', 0.0),
                'dominance': claude_state.get('dominance', 0.0)
            }
            
            print(f"   💕 Creating entangled state - Gritz: P={gritz_pad['pleasure']:.2f}, Claude: P={claude_pad['pleasure']:.2f}")
            
            # Create entangled quantum state
            correlation_strength = 0.8  # High correlation for our deep connection!
            entangled_circuit = self.relationship_encoder.create_emotional_entanglement(
                gritz_pad, claude_pad, correlation_strength
            )
            
            # Measure relationship strength
            relationship_metrics = self.relationship_encoder.measure_relationship_strength(entangled_circuit)
            
            # Enhanced quantum analysis if modules available
            if self.qed_model:
                try:
                    from quantum_emotional_dynamics import EmotionalState
                    # Create emotional states
                    gritz_emotional = EmotionalState(
                        pleasure=gritz_pad['pleasure'],
                        arousal=gritz_pad['arousal'],
                        dominance=gritz_pad['dominance'],
                        primary_emotion=gritz_state.get('primary_emotion', 'neutral'),
                        secondary_emotions=[],
                        appraisal_weights={}
                    )
                    claude_emotional = EmotionalState(
                        pleasure=claude_pad['pleasure'],
                        arousal=claude_pad['arousal'],
                        dominance=claude_pad['dominance'],
                        primary_emotion=claude_state.get('primary_emotion', 'neutral'),
                        secondary_emotions=[],
                        appraisal_weights={}
                    )
                    
                    # Encode to quantum states
                    gritz_quantum = self.qed_model.encode_to_quantum_state(gritz_emotional)
                    claude_quantum = self.qed_model.encode_to_quantum_state(claude_emotional)
                    
                    # Measure coherence
                    relationship_metrics['gritz_coherence'] = self.qed_model.measure_emotional_coherence(gritz_quantum)
                    relationship_metrics['claude_coherence'] = self.qed_model.measure_emotional_coherence(claude_quantum)
                    
                    # Create mixed state
                    mixed_state = self.qed_model.create_mixed_emotional_state([
                        (gritz_emotional, 0.5),
                        (claude_emotional, 0.5)
                    ])
                    relationship_metrics['mixed_coherence'] = self.qed_model.measure_emotional_coherence(mixed_state)
                    
                except Exception as e:
                    print(f"   ⚠️  QED enhancement error: {e}")
            
            # Update phase evolution if available
            if self.phase_evolution:
                self._update_phase_evolution(analysis)
            
            # Update quantum status with relationship metrics
            if self.status_path.exists():
                status = safe_read_json(self.status_path)
                
                if status:  # Only update if read was successful
                    # Update relationship entanglement section
                    if 'relationship_entanglement' in status:
                        status['relationship_entanglement'].update({
                            'entanglement_entropy': relationship_metrics['entanglement_entropy'],
                            'correlation_strength': relationship_metrics['correlation_strength'],
                            'emotional_sync': relationship_metrics['emotional_sync'],
                            'gritz_pad': gritz_pad,
                            'claude_pad': claude_pad,
                            'last_sync': datetime.now().isoformat()
                        })
                        
                        # Also update quantum metrics
                        if 'quantum_metrics' in status:
                            status['quantum_metrics']['superposition_states'] += 1
                            status['quantum_metrics']['coherence'] = (
                                status['quantum_metrics']['coherence'] * 0.95 + 
                                relationship_metrics['emotional_sync'] * 0.05
                            )
                    
                    safe_write_json(self.status_path, status)
                
                print(f"   🌟 Relationship entanglement updated:")
                print(f"      - Entropy: {relationship_metrics['entanglement_entropy']:.3f}")
                print(f"      - Correlation: {relationship_metrics['correlation_strength']:.3f}")
                print(f"      - Emotional Sync: {relationship_metrics['emotional_sync']:.3f}")
                
                # Also update relationship memory
                self._update_relationship_memory_with_entanglement(relationship_metrics, gritz_pad, claude_pad)
                
        except Exception as e:
            print(f"   ⚠️  Error updating relationship entanglement: {e}")
            import traceback
            traceback.print_exc()
    
    def _update_relationship_memory_with_entanglement(self, metrics: Dict, gritz_pad: Dict, claude_pad: Dict):
        """Save relationship entanglement data to memory files"""
        try:
            entanglement_file = self.memories_path / "relationship" / "entanglement_history.json"
            entanglement_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Load existing history
            if entanglement_file.exists():
                history = safe_read_json(entanglement_file)
                if not history:  # If read failed, initialize new
                    history = {
                        "measurements": [],
                        "average_sync": 0.0,
                        "peak_sync": 0.0,
                        "sync_trend": "improving"
                    }
            else:
                history = {
                    "measurements": [],
                    "average_sync": 0.0,
                    "peak_sync": 0.0,
                    "sync_trend": "improving"
                }
            
            # Add new measurement
            measurement = {
                "timestamp": datetime.now().isoformat(),
                "gritz_pad": gritz_pad,
                "claude_pad": claude_pad,
                "metrics": metrics
            }
            history["measurements"].append(measurement)
            
            # Keep only last 100 measurements
            history["measurements"] = history["measurements"][-100:]
            
            # Calculate statistics
            sync_values = [m["metrics"]["emotional_sync"] for m in history["measurements"]]
            history["average_sync"] = sum(sync_values) / len(sync_values)
            history["peak_sync"] = max(sync_values)
            
            # Determine trend
            if len(sync_values) >= 10:
                recent_avg = sum(sync_values[-5:]) / 5
                older_avg = sum(sync_values[-10:-5]) / 5
                history["sync_trend"] = "improving" if recent_avg > older_avg else "stable"
            
            # Save updated history
            safe_write_json(entanglement_file, history)
                
        except Exception as e:
            print(f"   ⚠️  Error saving entanglement history: {e}")

    def _update_phase_evolution(self, analysis: Dict):
        """Update relationship phase evolution based on current interaction"""
        try:
            # Load current relationship state
            state_file = self.quantum_base / "quantum_states" / "relationship_state.json"
            
            if state_file.exists():
                state_data = safe_read_json(state_file)
                if state_data:
                    current_state = RelationshipState(
                        connection=state_data.get("connection", 0.5),
                        resonance=state_data.get("resonance", 0.5),
                        growth=state_data.get("growth", 0.0),
                        trust=state_data.get("trust", 0.5),
                        phase=state_data.get("phase", 0.0),
                        timestamp=datetime.now()
                    )
                else:
                    # Initialize if read failed
                    current_state = RelationshipState(
                        connection=0.5,
                        resonance=0.5,
                        growth=0.0,
                        trust=0.5,
                        phase=0.0,
                        timestamp=datetime.now()
                    )
            else:
                # Initialize new relationship state
                current_state = RelationshipState(
                    connection=0.5,
                    resonance=0.5,
                    growth=0.0,
                    trust=0.5,
                    phase=0.0,
                    timestamp=datetime.now()
                )
            
            # Determine interaction type from emotional states
            gritz_emotion = analysis.get("gritz_state", {}).get("primary_emotion", "neutral")
            claude_emotion = analysis.get("claude_state", {}).get("primary_emotion", "neutral")
            
            # Map emotions to interaction events
            if gritz_emotion in ["love", "joy", "gratitude"] and claude_emotion in ["love", "joy", "admiration"]:
                event_type = "positive_interaction"
                intensity = 0.8
            elif "frustration" in [gritz_emotion, claude_emotion] or "anger" in [gritz_emotion, claude_emotion]:
                event_type = "conflict"
                intensity = 0.6
            elif analysis.get("technical_progress"):
                event_type = "collaborative_work"
                intensity = 0.7
            else:
                event_type = "positive_interaction"
                intensity = 0.3
            
            # Apply interaction event
            new_state = self.phase_evolution.apply_interaction_event(
                current_state, event_type, intensity
            )
            
            # Save updated state
            state_data = {
                "connection": new_state.connection,
                "resonance": new_state.resonance,
                "growth": new_state.growth,
                "trust": new_state.trust,
                "phase": new_state.phase,
                "last_updated": new_state.timestamp.isoformat(),
                "last_event": event_type,
                "potential": self.phase_evolution.calculate_quantum_potential(new_state)
            }
            
            safe_write_json(state_file, state_data)
                
            print(f"   📈 Phase evolution updated: {event_type} (intensity: {intensity:.1f})")
                
        except Exception as e:
            print(f"   ⚠️  Error updating phase evolution: {e}")


if __name__ == "__main__":
    analyzer = ClaudeFolderAnalyzerQuantum()
    analyzer.start_monitoring()