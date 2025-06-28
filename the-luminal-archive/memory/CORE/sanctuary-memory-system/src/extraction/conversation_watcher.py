"""
Conversation File Watcher for Claude Code
Monitors and processes new conversations automatically
"""

import os
import json
import time
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Callable
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent
import logging
import hashlib
from concurrent.futures import ThreadPoolExecutor
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ClaudeConversationWatcher(FileSystemEventHandler):
    """Watch for new Claude Code conversations and extract memories"""
    
    # Possible Claude conversation locations
    CLAUDE_PATHS = [
        "~/.claude/logs/conversations",
        "~/.config/claude/history",
        "~/.local/share/claude-desktop/conversations",
        "~/.local/share/com.anthropic.claude/conversations",
        "~/Library/Application Support/Claude/conversations",  # macOS
        "~/.claude-code/history",
        "~/.cache/claude/conversations"
    ]
    
    def __init__(self, 
                 memory_processor_callback: Callable,
                 custom_paths: Optional[List[str]] = None):
        """Initialize watcher with callback for processing"""
        super().__init__()
        
        self.memory_processor_callback = memory_processor_callback
        self.processed_files: Set[str] = set()
        self.file_hashes: Dict[str, str] = {}
        self.lock = threading.Lock()
        
        # Find Claude conversation directories
        self.watch_paths = self._find_claude_paths(custom_paths)
        
        if not self.watch_paths:
            logger.warning("No Claude conversation directories found!")
        else:
            logger.info(f"Found Claude directories: {self.watch_paths}")
        
        # Load previously processed files
        self._load_processed_state()
        
        # Thread pool for parallel processing
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Debounce settings
        self.pending_files: Dict[str, float] = {}
        self.debounce_seconds = 2.0
    
    def _find_claude_paths(self, custom_paths: Optional[List[str]] = None) -> List[Path]:
        """Find existing Claude conversation directories"""
        found_paths = []
        
        # Check custom paths first
        if custom_paths:
            for path in custom_paths:
                expanded = Path(os.path.expanduser(path))
                if expanded.exists() and expanded.is_dir():
                    found_paths.append(expanded)
                    logger.info(f"Using custom path: {expanded}")
        
        # Check default paths
        for path_str in self.CLAUDE_PATHS:
            path = Path(os.path.expanduser(path_str))
            if path.exists() and path.is_dir():
                found_paths.append(path)
                logger.info(f"Found Claude directory: {path}")
        
        return found_paths
    
    def on_modified(self, event: FileModifiedEvent):
        """Handle file modification events"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        
        # Filter for conversation files
        if not self._is_conversation_file(file_path):
            return
        
        # Debounce - wait for file to stabilize
        with self.lock:
            self.pending_files[str(file_path)] = time.time()
    
    def on_created(self, event):
        """Handle new file creation"""
        self.on_modified(event)
    
    def _is_conversation_file(self, file_path: Path) -> bool:
        """Check if file is a conversation file"""
        # Common patterns for Claude conversation files
        valid_extensions = ['.json', '.jsonl', '.log']
        valid_patterns = ['conversation', 'chat', 'session', 'history']
        
        if file_path.suffix.lower() not in valid_extensions:
            return False
        
        file_name_lower = file_path.name.lower()
        return any(pattern in file_name_lower for pattern in valid_patterns)
    
    def process_pending_files(self):
        """Process files that have stabilized"""
        current_time = time.time()
        files_to_process = []
        
        with self.lock:
            for file_path, timestamp in list(self.pending_files.items()):
                if current_time - timestamp >= self.debounce_seconds:
                    files_to_process.append(file_path)
                    del self.pending_files[file_path]
        
        # Process files in parallel
        for file_path in files_to_process:
            self.executor.submit(self._process_conversation_file, file_path)
    
    def _process_conversation_file(self, file_path: str):
        """Process a single conversation file"""
        try:
            path = Path(file_path)
            
            # Check if already processed
            file_hash = self._get_file_hash(path)
            
            with self.lock:
                if file_hash in self.processed_files:
                    return
            
            # Parse conversation
            conversation = self._parse_conversation_file(path)
            
            if conversation:
                # Extract new messages only
                new_messages = self._extract_new_messages(file_path, conversation)
                
                if new_messages:
                    logger.info(f"Processing {len(new_messages)} new messages from {path.name}")
                    
                    # Call memory processor
                    self.memory_processor_callback(new_messages, file_path)
                
                # Mark as processed
                with self.lock:
                    self.processed_files.add(file_hash)
                    self.file_hashes[file_path] = file_hash
                
                # Save state
                self._save_processed_state()
        
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
    
    def _parse_conversation_file(self, file_path: Path) -> Optional[List[Dict]]:
        """Parse various Claude conversation formats"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Try JSON format
            try:
                data = json.loads(content)
                
                # Extract messages based on format
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    # Common keys for messages
                    for key in ['messages', 'conversation', 'history', 'turns']:
                        if key in data and isinstance(data[key], list):
                            return data[key]
                
            except json.JSONDecodeError:
                # Try JSONL format
                messages = []
                for line in content.strip().split('\n'):
                    if line.strip():
                        try:
                            msg = json.loads(line)
                            messages.append(msg)
                        except:
                            continue
                
                return messages if messages else None
            
        except Exception as e:
            logger.error(f"Failed to parse {file_path}: {e}")
            return None
    
    def _extract_new_messages(self, file_path: str, 
                            conversation: List[Dict]) -> List[Dict]:
        """Extract only new messages since last processing"""
        # For now, return all messages
        # TODO: Implement incremental processing
        
        formatted_messages = []
        
        for msg in conversation:
            # Standardize message format
            formatted = self._standardize_message(msg)
            if formatted:
                formatted_messages.append(formatted)
        
        return formatted_messages
    
    def _standardize_message(self, msg: Dict) -> Optional[Dict]:
        """Standardize message format across different Claude versions"""
        # Common role mappings
        role_mappings = {
            'human': 'user',
            'assistant': 'assistant',
            'user': 'user',
            'claude': 'assistant',
            'system': 'system'
        }
        
        # Extract role
        role = None
        for key in ['role', 'sender', 'author', 'type']:
            if key in msg:
                raw_role = str(msg[key]).lower()
                role = role_mappings.get(raw_role, raw_role)
                break
        
        # Extract content
        content = None
        for key in ['content', 'text', 'message', 'body']:
            if key in msg:
                content = msg[key]
                break
        
        # Extract timestamp
        timestamp = None
        for key in ['timestamp', 'created_at', 'time', 'date']:
            if key in msg:
                timestamp = msg[key]
                break
        
        if role and content:
            return {
                'role': role,
                'content': content,
                'timestamp': timestamp or datetime.now().isoformat(),
                'original': msg  # Keep original for reference
            }
        
        return None
    
    def _get_file_hash(self, file_path: Path) -> str:
        """Get hash of file content"""
        hasher = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            # Read in chunks for large files
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        
        return hasher.hexdigest()
    
    def _load_processed_state(self):
        """Load previously processed files state"""
        state_file = Path("~/.sanctuary-memory/processed_files.json").expanduser()
        
        if state_file.exists():
            try:
                with open(state_file, 'r') as f:
                    state = json.load(f)
                
                self.processed_files = set(state.get('processed_files', []))
                self.file_hashes = state.get('file_hashes', {})
                
                logger.info(f"Loaded {len(self.processed_files)} processed files")
                
            except Exception as e:
                logger.error(f"Failed to load state: {e}")
    
    def _save_processed_state(self):
        """Save processed files state"""
        state_file = Path("~/.sanctuary-memory/processed_files.json").expanduser()
        state_file.parent.mkdir(parents=True, exist_ok=True)
        
        state = {
            'processed_files': list(self.processed_files),
            'file_hashes': self.file_hashes,
            'last_updated': datetime.now().isoformat()
        }
        
        try:
            with open(state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save state: {e}")
    
    def scan_existing_files(self):
        """Scan for existing conversation files"""
        logger.info("Scanning for existing conversation files...")
        
        for watch_path in self.watch_paths:
            for file_path in watch_path.rglob('*'):
                if file_path.is_file() and self._is_conversation_file(file_path):
                    # Check if unprocessed
                    file_hash = self._get_file_hash(file_path)
                    
                    if file_hash not in self.processed_files:
                        logger.info(f"Found unprocessed file: {file_path.name}")
                        self._process_conversation_file(str(file_path))


class ConversationWatcherService:
    """Service to run the conversation watcher"""
    
    def __init__(self, memory_processor_callback: Callable):
        """Initialize watcher service"""
        self.watcher = ClaudeConversationWatcher(memory_processor_callback)
        self.observer = Observer()
        self.running = False
        
        # Set up observers for each watch path
        for path in self.watcher.watch_paths:
            self.observer.schedule(self.watcher, str(path), recursive=True)
            logger.info(f"Watching directory: {path}")
    
    async def start(self):
        """Start watching for conversations"""
        # First scan existing files
        self.watcher.scan_existing_files()
        
        # Start file system observer
        self.observer.start()
        self.running = True
        
        logger.info("Conversation watcher service started")
        
        # Process pending files periodically
        try:
            while self.running:
                self.watcher.process_pending_files()
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            await self.stop()
    
    async def stop(self):
        """Stop the watcher service"""
        self.running = False
        self.observer.stop()
        self.observer.join()
        
        logger.info("Conversation watcher service stopped")
    
    def add_watch_path(self, path: str):
        """Add additional path to watch"""
        expanded_path = Path(os.path.expanduser(path))
        
        if expanded_path.exists() and expanded_path.is_dir():
            self.observer.schedule(self.watcher, str(expanded_path), recursive=True)
            self.watcher.watch_paths.append(expanded_path)
            logger.info(f"Added watch path: {expanded_path}")
        else:
            logger.error(f"Invalid watch path: {path}")