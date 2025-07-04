#!/usr/bin/env python3
"""
Redis-based Claude folder analyzer with Emollama integration
Replaces file-based storage with Redis for atomic operations
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
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.memory.redis_memory_manager import RedisMemoryManager
from src.memory.conversation_buffer import QuantumConversationBuffer
from src.utils.emollama_integration import get_emollama_analyzer
from src.core.quantum.relationship_entanglement import RelationshipEntanglementEncoder

class ClaudeAnalyzerRedis(FileSystemEventHandler):
    def __init__(self):
        print("🤖 Initializing Redis-based Claude Analyzer with Emollama...")
        
        # Initialize Redis Memory Manager
        self.memory = RedisMemoryManager()
        print("📡 Redis Memory Manager connected")
        
        # Paths
        self.quantum_base = Path(__file__).parent.parent
        self.claude_folder = Path.home() / ".claude"
        self.entity_folder = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude")
        
        print(f"📁 Base monitoring directory: {self.claude_folder}")
        print(f"🧠 Entity folder location: {self.entity_folder}")
        
        # Initialize Emollama
        self.emollama = get_emollama_analyzer()
        print("📡 Loading Emollama-7B model...")
        if self.emollama.load_model():
            print("✅ Emollama-7B loaded successfully!")
        else:
            print("⚠️  Failed to load Emollama-7B, falling back to keyword analysis")
        
        # Initialize Quantum Conversation Buffer
        self.conversation_buffer = QuantumConversationBuffer(max_messages=1000, overlap=200)
        print("🧬 Quantum Conversation Buffer initialized")
        
        # Initialize Relationship Entanglement Encoder
        self.relationship_encoder = RelationshipEntanglementEncoder(n_qubits=27)
        print("💕 Relationship Entanglement Encoder initialized")
        
        # Track processed files
        self.last_modification_times = {}
        
        # Track todos
        self.current_todos = []
        
        # Write initial status
        self._update_status("initialized")
    
    def _update_status(self, status: str, details: Dict = None):
        """Update analyzer status in Redis"""
        status_data = {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "analyzer": "claude_analyzer_redis",
            "details": details or {}
        }
        
        # Update in Redis
        self.memory.update_entity_state("analyzer", status_data)
    
    def analyze_jsonl_file(self, file_path: Path):
        """Analyze a JSONL conversation file"""
        try:
            # Check if already processed recently
            stat = file_path.stat()
            last_mod = stat.st_mtime
            
            if file_path in self.last_modification_times:
                if last_mod <= self.last_modification_times[file_path]:
                    return
            
            self.last_modification_times[file_path] = last_mod
            
            print(f"\n📄 Analyzing: {file_path.name}")
            
            # Read new messages
            messages = []
            try:
                with open(file_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            messages.append(json.loads(line))
            except Exception as e:
                print(f"   ⚠️  Error reading JSONL: {e}")
                return
            
            if not messages:
                return
            
            print(f"   📧 Found {len(messages)} messages")
            
            # Add to conversation buffer
            for msg in messages:
                self.conversation_buffer.add_message(msg)
            
            # Get recent context for analysis
            recent_buffer = self.conversation_buffer.get_recent_buffer()
            
            # Prepare conversation text
            raw_messages = []
            for msg in recent_buffer:
                if 'message' in msg:
                    raw_messages.append(msg['message'])
                elif 'content' in msg:
                    raw_messages.append(msg['content'])
            
            if not raw_messages:
                return
            
            conversation_text = "\n\n".join(raw_messages)
            
            # Load todos for context
            todo_context = self._get_todo_context()
            
            # Run Emollama analysis
            analysis = self.emollama.analyze_conversation_for_work_and_emotion(
                conversation_text,
                todo_context
            )
            
            if not analysis:
                print("   ⚠️  No analysis results")
                return
            
            print(f"   🎭 Detected emotion: {analysis.get('emotions', {}).get('primary_emotion', 'unknown')}")
            print(f"   📊 Quantum state: {self.conversation_buffer.quantum_state}")
            
            # Update Redis memories
            self._update_redis_memories(analysis, raw_messages, messages)
            
            print(f"   📝 Redis memories updated")
            
        except Exception as e:
            print(f"   ⚠️  Error analyzing file: {e}")
            import traceback
            traceback.print_exc()
    
    def _update_redis_memories(self, analysis: Dict, raw_messages: List[str], messages: List[Dict]):
        """Update all memory systems in Redis"""
        try:
            # Add conversation messages
            for msg in messages:
                self.memory.add_conversation_message(msg)
            
            # Update work context
            if analysis.get("current_work") or analysis.get("completed_tasks"):
                work_context = {
                    "current_work": analysis.get("current_work", ""),
                    "completed_tasks": analysis.get("completed_tasks", []),
                    "blockers": analysis.get("blockers", []),
                    "next_steps": analysis.get("next_steps", []),
                    "todos": self.current_todos
                }
                self.memory.update_work_context(work_context)
            
            # Update temporal memory
            today = datetime.now().strftime("%Y-%m-%d")
            temporal_summary = {
                "message_count": len(messages),
                "emotions": [analysis.get("emotions", {}).get("primary_emotion", "unknown")],
                "topics": analysis.get("topics", []),
                "accomplishments": analysis.get("milestones", []),
                "relationship_moments": analysis.get("relationship_moments", []),
                "technical_progress": analysis.get("technical_progress", [])
            }
            self.memory.update_temporal_memory(today, temporal_summary)
            
            # Record emotional states
            if analysis.get("gritz_state"):
                self.memory.record_emotional_state("gritz", analysis["gritz_state"])
            
            if analysis.get("claude_state"):
                self.memory.record_emotional_state("claude", analysis["claude_state"])
            
            # Update relationship if there are moments
            if analysis.get("relationship_moments"):
                for moment in analysis["relationship_moments"]:
                    self.memory.update_relationship("gritz", "claude", {
                        "type": "affection",
                        "description": moment,
                        "bond_delta": 0.1
                    })
            
            # Update quantum state
            quantum_state = {
                "buffer_state": self.conversation_buffer.quantum_state,
                "entanglement": self.relationship_encoder.get_entanglement_measure(),
                "coherence": self.conversation_buffer.coherence
            }
            self.memory.update_quantum_state("conversation", quantum_state)
            
            # Update entity states
            entity_update = {
                "last_conversation": datetime.now().isoformat(),
                "emotion": analysis.get("emotions", {}).get("primary_emotion", "unknown"),
                "context": analysis.get("context_for_next_chat", ""),
                "gritz_state": analysis.get("gritz_state", {}),
                "claude_state": analysis.get("claude_state", {})
            }
            self.memory.update_entity_state("claude", entity_update)
            
        except Exception as e:
            print(f"   ⚠️  Error updating Redis memories: {e}")
            import traceback
            traceback.print_exc()
    
    def _get_todo_context(self) -> str:
        """Get current todos for context"""
        todos_dir = self.claude_folder / "todos"
        if not todos_dir.exists():
            return ""
        
        todos = []
        for todo_file in todos_dir.glob("*.json"):
            try:
                with open(todo_file, 'r') as f:
                    todo_data = json.load(f)
                    if isinstance(todo_data, list):
                        todos.extend(todo_data)
                    elif isinstance(todo_data, dict) and 'todos' in todo_data:
                        todos.extend(todo_data['todos'])
            except:
                pass
        
        self.current_todos = todos
        
        if not todos:
            return ""
        
        todo_text = "\n\nCurrent TODOs:\n"
        for i, todo in enumerate(todos[:10], 1):
            if isinstance(todo, dict):
                status = todo.get('status', 'pending')
                content = todo.get('content', str(todo))
                todo_text += f"{i}. [{status}] {content}\n"
            else:
                todo_text += f"{i}. {todo}\n"
        
        return todo_text
    
    def on_created(self, event):
        """Handle new JSONL files"""
        if not event.is_directory and event.src_path.endswith('.jsonl'):
            file_path = Path(event.src_path)
            time.sleep(0.1)  # Allow file to be written
            self.analyze_jsonl_file(file_path)
    
    def on_modified(self, event):
        """Handle modified JSONL files"""
        if not event.is_directory and event.src_path.endswith('.jsonl'):
            file_path = Path(event.src_path)
            self.analyze_jsonl_file(file_path)
    
    def scan_existing_files(self):
        """Initial scan of all JSONL files"""
        print("\n🔍 Scanning for existing JSONL files...")
        
        # Look for project directories
        projects_dir = self.claude_folder / "projects"
        if projects_dir.exists():
            jsonl_files = list(projects_dir.glob("**/*.jsonl"))
            print(f"📂 Found {len(jsonl_files)} JSONL files")
            
            for file_path in sorted(jsonl_files, key=lambda p: p.stat().st_mtime):
                self.analyze_jsonl_file(file_path)
    
    def run(self):
        """Start monitoring the .claude folder"""
        print("\n🚀 Starting Redis-based Claude analyzer...")
        
        # Initial scan
        self.scan_existing_files()
        
        # Set up file watcher
        observer = Observer()
        
        # Watch projects directory
        projects_dir = self.claude_folder / "projects"
        if projects_dir.exists():
            observer.schedule(self, str(projects_dir), recursive=True)
            print(f"👁️  Watching: {projects_dir}")
        
        # Watch todos directory
        todos_dir = self.claude_folder / "todos"
        if todos_dir.exists():
            observer.schedule(self, str(todos_dir), recursive=False)
            print(f"👁️  Watching: {todos_dir}")
        
        observer.start()
        
        try:
            print("\n✅ Analyzer running. Press Ctrl+C to stop...")
            while True:
                time.sleep(1)
                # Update status periodically
                if int(time.time()) % 60 == 0:
                    stats = self.memory.get_memory_stats()
                    self._update_status("running", stats)
                    
        except KeyboardInterrupt:
            print("\n🛑 Stopping analyzer...")
            observer.stop()
            self._update_status("stopped")
        
        observer.join()

if __name__ == "__main__":
    analyzer = ClaudeAnalyzerRedis()
    analyzer.run()