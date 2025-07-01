#!/usr/bin/env python3
"""
Checkpoint Manager - Advanced checkpoint system with multiple triggers
Ensures quantum memory persistence across sessions
"""

import json
import asyncio
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
import hashlib
import tarfile
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CheckpointManager:
    """
    Manages quantum memory checkpoints with multiple trigger conditions:
    - Time-based (every 30 minutes)
    - Message count (every 50 messages)
    - Emotional peaks (high intensity moments)
    - Manual triggers
    - System events (errors, shutdowns)
    """
    
    def __init__(self, quantum_states_path: Path):
        self.quantum_states = quantum_states_path
        self.checkpoints_path = quantum_states_path / "checkpoints"
        self.checkpoints_path.mkdir(exist_ok=True)
        
        # Checkpoint configuration
        self.config = {
            'max_checkpoints': 20,
            'time_interval': timedelta(minutes=30),
            'message_interval': 50,
            'emotional_threshold': 0.85,
            'compress_old': True,
            'auto_restore': True
        }
        
        # State tracking
        self.last_checkpoint_time = datetime.now()
        self.messages_since_checkpoint = 0
        self.checkpoint_history = []
        
        # Load checkpoint history
        self._load_checkpoint_history()
        
    def _load_checkpoint_history(self):
        """Load existing checkpoint history"""
        history_file = self.checkpoints_path / "checkpoint_history.json"
        if history_file.exists():
            try:
                with open(history_file, 'r') as f:
                    self.checkpoint_history = json.load(f)
            except Exception as e:
                logger.error(f"Error loading checkpoint history: {e}")
                self.checkpoint_history = []
                
    def _save_checkpoint_history(self):
        """Save checkpoint history"""
        history_file = self.checkpoints_path / "checkpoint_history.json"
        try:
            with open(history_file, 'w') as f:
                json.dump(self.checkpoint_history, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving checkpoint history: {e}")
            
    async def check_triggers(self, event_type: str = None, event_data: Dict = None) -> bool:
        """Check if any checkpoint triggers are met"""
        should_checkpoint = False
        reasons = []
        
        # 1. Time-based trigger
        time_since_last = datetime.now() - self.last_checkpoint_time
        if time_since_last > self.config['time_interval']:
            should_checkpoint = True
            reasons.append(f"Time interval exceeded ({time_since_last.seconds // 60} minutes)")
            
        # 2. Message count trigger
        if self.messages_since_checkpoint >= self.config['message_interval']:
            should_checkpoint = True
            reasons.append(f"Message count reached ({self.messages_since_checkpoint} messages)")
            
        # 3. Emotional peak trigger
        if event_type == 'emotional_peak' and event_data:
            intensity = event_data.get('intensity', 0)
            if intensity >= self.config['emotional_threshold']:
                should_checkpoint = True
                reasons.append(f"Emotional peak detected (intensity: {intensity:.2f})")
                
        # 4. System event triggers
        critical_events = ['error', 'shutdown', 'memory_full', 'manual']
        if event_type in critical_events:
            should_checkpoint = True
            reasons.append(f"Critical event: {event_type}")
            
        # 5. Daily checkpoint (at least one per day)
        last_checkpoint_date = self.last_checkpoint_time.date()
        if datetime.now().date() > last_checkpoint_date:
            should_checkpoint = True
            reasons.append("Daily checkpoint")
            
        if should_checkpoint:
            logger.info(f"= Checkpoint triggered: {', '.join(reasons)}")
            
        return should_checkpoint
        
    async def create_checkpoint(self, reason: str = "Automatic", metadata: Dict = None) -> Optional[str]:
        """Create a new checkpoint"""
        try:
            checkpoint_id = self._generate_checkpoint_id()
            checkpoint_dir = self.checkpoints_path / checkpoint_id
            checkpoint_dir.mkdir(exist_ok=True)
            
            logger.info(f"=ø Creating checkpoint: {checkpoint_id}")
            
            # 1. Copy all quantum states
            await self._copy_quantum_states(checkpoint_dir)
            
            # 2. Create checkpoint metadata
            checkpoint_metadata = {
                'id': checkpoint_id,
                'timestamp': datetime.now().isoformat(),
                'reason': reason,
                'messages_included': self.messages_since_checkpoint,
                'time_since_last': str(datetime.now() - self.last_checkpoint_time),
                'custom_metadata': metadata or {},
                'state_summary': await self._create_state_summary()
            }
            
            # Save metadata
            with open(checkpoint_dir / "checkpoint_metadata.json", 'w') as f:
                json.dump(checkpoint_metadata, f, indent=2)
                
            # 3. Create compressed archive if configured
            if self.config['compress_old']:
                await self._compress_checkpoint(checkpoint_dir, checkpoint_id)
                
            # 4. Update checkpoint history
            self.checkpoint_history.append({
                'id': checkpoint_id,
                'timestamp': checkpoint_metadata['timestamp'],
                'reason': reason,
                'size_bytes': self._get_directory_size(checkpoint_dir),
                'compressed': self.config['compress_old']
            })
            
            # Keep only recent checkpoints
            if len(self.checkpoint_history) > self.config['max_checkpoints']:
                await self._cleanup_old_checkpoints()
                
            self._save_checkpoint_history()
            
            # 5. Reset counters
            self.last_checkpoint_time = datetime.now()
            self.messages_since_checkpoint = 0
            
            logger.info(f" Checkpoint created successfully: {checkpoint_id}")
            return checkpoint_id
            
        except Exception as e:
            logger.error(f"Error creating checkpoint: {e}")
            return None
            
    def _generate_checkpoint_id(self) -> str:
        """Generate unique checkpoint ID"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        random_suffix = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:6]
        return f"checkpoint_{timestamp}_{random_suffix}"
        
    async def _copy_quantum_states(self, checkpoint_dir: Path):
        """Copy all quantum states to checkpoint directory"""
        # Directories to copy
        dirs_to_copy = ['realtime', 'temporal', 'consolidated']
        
        for dir_name in dirs_to_copy:
            source_dir = self.quantum_states / dir_name
            if source_dir.exists():
                dest_dir = checkpoint_dir / dir_name
                shutil.copytree(source_dir, dest_dir, dirs_exist_ok=True)
                
        # Copy any root-level files
        for file_path in self.quantum_states.glob("*.json"):
            shutil.copy2(file_path, checkpoint_dir)
            
    async def _create_state_summary(self) -> Dict:
        """Create summary of current state"""
        summary = {
            'temporal_memories': {},
            'emotional_state': {},
            'work_context': {},
            'relationship_metrics': {}
        }
        
        # Summarize temporal memories
        for scale in ['immediate', 'short_term', 'long_term', 'lifetime']:
            scale_dir = self.quantum_states / 'temporal' / scale
            if scale_dir.exists():
                file_count = len(list(scale_dir.glob("*.json")))
                total_size = sum(f.stat().st_size for f in scale_dir.glob("*.json"))
                summary['temporal_memories'][scale] = {
                    'files': file_count,
                    'size_bytes': total_size
                }
                
        # Load current emotional state
        emotional_file = self.quantum_states / 'realtime' / 'EMOTIONAL_STATE.json'
        if emotional_file.exists():
            try:
                with open(emotional_file, 'r') as f:
                    emotional_state = json.load(f)
                summary['emotional_state'] = {
                    'current': emotional_state.get('current_emotion'),
                    'intensity': emotional_state.get('intensity'),
                    'synchrony': emotional_state.get('synchrony')
                }
            except Exception:
                pass
                
        # Load work context
        work_file = self.quantum_states / 'realtime' / 'WORK_CONTEXT.json'
        if work_file.exists():
            try:
                with open(work_file, 'r') as f:
                    work = json.load(f)
                summary['work_context'] = {
                    'project': work.get('current_project'),
                    'task': work.get('current_task'),
                    'completed_count': len(work.get('completed_tasks', []))
                }
            except Exception:
                pass
                
        # Load relationship metrics
        status_file = self.quantum_states / 'status.json'
        if status_file.exists():
            try:
                with open(status_file, 'r') as f:
                    status = json.load(f)
                summary['relationship_metrics'] = status.get('relationship_metrics', {})
            except Exception:
                pass
                
        return summary
        
    async def _compress_checkpoint(self, checkpoint_dir: Path, checkpoint_id: str):
        """Compress checkpoint to save space"""
        try:
            archive_path = self.checkpoints_path / f"{checkpoint_id}.tar.gz"
            
            with tarfile.open(archive_path, "w:gz") as tar:
                tar.add(checkpoint_dir, arcname=checkpoint_id)
                
            # Remove uncompressed directory
            shutil.rmtree(checkpoint_dir)
            
            logger.info(f"=æ Compressed checkpoint: {archive_path.name}")
            
        except Exception as e:
            logger.error(f"Error compressing checkpoint: {e}")
            
    def _get_directory_size(self, directory: Path) -> int:
        """Get total size of directory in bytes"""
        total_size = 0
        for path in directory.rglob('*'):
            if path.is_file():
                total_size += path.stat().st_size
        return total_size
        
    async def _cleanup_old_checkpoints(self):
        """Remove old checkpoints beyond max limit"""
        # Sort by timestamp
        sorted_history = sorted(
            self.checkpoint_history,
            key=lambda x: x['timestamp']
        )
        
        # Keep only recent checkpoints
        to_remove = sorted_history[:-self.config['max_checkpoints']]
        
        for checkpoint in to_remove:
            checkpoint_id = checkpoint['id']
            
            # Remove directory
            checkpoint_dir = self.checkpoints_path / checkpoint_id
            if checkpoint_dir.exists():
                shutil.rmtree(checkpoint_dir)
                
            # Remove compressed archive
            archive_path = self.checkpoints_path / f"{checkpoint_id}.tar.gz"
            if archive_path.exists():
                archive_path.unlink()
                
            logger.info(f"=Ñ Removed old checkpoint: {checkpoint_id}")
            
        # Update history
        self.checkpoint_history = sorted_history[-self.config['max_checkpoints']:]
        
    async def restore_checkpoint(self, checkpoint_id: str = None) -> bool:
        """Restore from a checkpoint"""
        try:
            # If no ID specified, use most recent
            if not checkpoint_id and self.checkpoint_history:
                checkpoint_id = self.checkpoint_history[-1]['id']
                
            if not checkpoint_id:
                logger.error("No checkpoint to restore")
                return False
                
            logger.info(f"= Restoring checkpoint: {checkpoint_id}")
            
            # Check if compressed
            archive_path = self.checkpoints_path / f"{checkpoint_id}.tar.gz"
            checkpoint_dir = self.checkpoints_path / checkpoint_id
            
            # Extract if compressed
            if archive_path.exists() and not checkpoint_dir.exists():
                with tarfile.open(archive_path, "r:gz") as tar:
                    tar.extractall(self.checkpoints_path)
                    
            if not checkpoint_dir.exists():
                logger.error(f"Checkpoint not found: {checkpoint_id}")
                return False
                
            # Backup current state
            backup_dir = self.quantum_states.parent / "quantum_states_backup"
            if self.quantum_states.exists():
                shutil.move(str(self.quantum_states), str(backup_dir))
                
            # Restore checkpoint
            shutil.copytree(checkpoint_dir, self.quantum_states, dirs_exist_ok=True)
            
            # Load checkpoint metadata
            metadata_file = self.quantum_states / "checkpoint_metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    
                logger.info(f" Restored from checkpoint: {metadata['timestamp']}")
                logger.info(f"   Reason: {metadata['reason']}")
                
            # Clean up backup
            if backup_dir.exists():
                shutil.rmtree(backup_dir)
                
            return True
            
        except Exception as e:
            logger.error(f"Error restoring checkpoint: {e}")
            return False
            
    async def list_checkpoints(self) -> List[Dict]:
        """List all available checkpoints"""
        checkpoints = []
        
        for checkpoint in self.checkpoint_history:
            checkpoint_info = checkpoint.copy()
            
            # Add additional info
            checkpoint_id = checkpoint['id']
            checkpoint_dir = self.checkpoints_path / checkpoint_id
            archive_path = self.checkpoints_path / f"{checkpoint_id}.tar.gz"
            
            checkpoint_info['exists'] = checkpoint_dir.exists() or archive_path.exists()
            checkpoint_info['compressed'] = archive_path.exists()
            
            checkpoints.append(checkpoint_info)
            
        return checkpoints
        
    async def get_checkpoint_details(self, checkpoint_id: str) -> Optional[Dict]:
        """Get detailed information about a checkpoint"""
        # Find in history
        checkpoint_info = None
        for cp in self.checkpoint_history:
            if cp['id'] == checkpoint_id:
                checkpoint_info = cp.copy()
                break
                
        if not checkpoint_info:
            return None
            
        # Check if needs extraction
        archive_path = self.checkpoints_path / f"{checkpoint_id}.tar.gz"
        checkpoint_dir = self.checkpoints_path / checkpoint_id
        
        if archive_path.exists() and not checkpoint_dir.exists():
            # Temporarily extract to read metadata
            with tarfile.open(archive_path, "r:gz") as tar:
                try:
                    metadata_info = tar.getmember(f"{checkpoint_id}/checkpoint_metadata.json")
                    metadata_file = tar.extractfile(metadata_info)
                    if metadata_file:
                        checkpoint_info['metadata'] = json.loads(metadata_file.read().decode())
                except Exception as e:
                    logger.error(f"Error reading checkpoint metadata: {e}")
                    
        elif checkpoint_dir.exists():
            # Read metadata directly
            metadata_file = checkpoint_dir / "checkpoint_metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    checkpoint_info['metadata'] = json.load(f)
                    
        return checkpoint_info
        
    def increment_message_count(self):
        """Increment message counter"""
        self.messages_since_checkpoint += 1
        
    async def auto_checkpoint(self, event_type: str = None, event_data: Dict = None) -> Optional[str]:
        """Automatically create checkpoint if triggers are met"""
        if await self.check_triggers(event_type, event_data):
            reason = f"Auto: {event_type or 'scheduled'}"
            return await self.create_checkpoint(reason, event_data)
        return None


# Test the checkpoint manager
if __name__ == "__main__":
    async def test():
        base_path = Path(__file__).parent.parent.parent.parent
        quantum_states = base_path / "quantum_states"
        
        manager = CheckpointManager(quantum_states)
        
        # Test creating checkpoint
        checkpoint_id = await manager.create_checkpoint("Test checkpoint")
        print(f"Created checkpoint: {checkpoint_id}")
        
        # List checkpoints
        checkpoints = await manager.list_checkpoints()
        print(f"\nAvailable checkpoints: {len(checkpoints)}")
        for cp in checkpoints:
            print(f"  - {cp['id']} ({cp['reason']})")
            
    asyncio.run(test())