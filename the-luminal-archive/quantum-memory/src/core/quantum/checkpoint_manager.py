"""
Checkpoint Management System for Quantum Memory
Handles automatic checkpointing, history tracking, and state recovery
"""

import json
import logging
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
import threading
import hashlib

from .backup_manager import BackupManager
from .version_manager import VersionManager

logger = logging.getLogger(__name__)


@dataclass
class Checkpoint:
    """Represents a checkpoint in the system"""
    id: str
    timestamp: datetime
    name: str
    description: str
    state_hash: str
    file_path: str
    metadata: Dict[str, Any]
    is_auto: bool = False
    

class CheckpointManager:
    """Manages checkpoint creation, restoration, and history"""
    
    def __init__(self, checkpoint_dir: Optional[str] = None,
                 max_checkpoints: int = 20,
                 auto_checkpoint_interval: Optional[int] = None):
        """
        Initialize checkpoint manager
        
        Args:
            checkpoint_dir: Directory for checkpoints (defaults to .checkpoints)
            max_checkpoints: Maximum number of checkpoints to keep
            auto_checkpoint_interval: Auto-checkpoint interval in seconds (None to disable)
        """
        self.checkpoint_dir = Path(checkpoint_dir) if checkpoint_dir else Path.cwd() / ".checkpoints"
        self.max_checkpoints = max_checkpoints
        self.auto_checkpoint_interval = auto_checkpoint_interval
        
        # Create directories
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize components
        self.backup_manager = BackupManager(
            backup_dir=str(self.checkpoint_dir / "backups"),
            max_backups=max_checkpoints * 2  # Keep more backups than checkpoints
        )
        self.version_manager = VersionManager()
        
        # Checkpoint registry
        self.registry_file = self.checkpoint_dir / "checkpoint_registry.json"
        self.registry = self._load_registry()
        
        # Auto-checkpoint thread
        self._auto_checkpoint_thread = None
        self._stop_auto_checkpoint = threading.Event()
        
        if auto_checkpoint_interval:
            self.start_auto_checkpoint()
            
    def _load_registry(self) -> Dict[str, Any]:
        """Load checkpoint registry"""
        if self.registry_file.exists():
            with open(self.registry_file, 'r') as f:
                return json.load(f)
                
        return {
            'checkpoints': {},
            'current_checkpoint': None,
            'checkpoint_history': [],
            'statistics': {
                'total_created': 0,
                'total_restored': 0,
                'auto_checkpoints': 0,
                'manual_checkpoints': 0
            }
        }
        
    def _save_registry(self):
        """Save checkpoint registry"""
        with open(self.registry_file, 'w') as f:
            json.dump(self.registry, f, indent=2)
            
    def create_checkpoint(self, interface, name: Optional[str] = None,
                         description: str = "", is_auto: bool = False) -> str:
        """
        Create a checkpoint from current state
        
        Args:
            interface: QuantumClassicalInterface instance
            name: Checkpoint name (auto-generated if not provided)
            description: Checkpoint description
            is_auto: Whether this is an auto-checkpoint
            
        Returns:
            Checkpoint ID
        """
        # Generate checkpoint ID and name
        checkpoint_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]
        if not name:
            name = f"checkpoint_{checkpoint_id}"
            
        # Create checkpoint file path
        checkpoint_file = self.checkpoint_dir / f"{checkpoint_id}.json"
        
        # Save state to checkpoint file
        interface.save_state(str(checkpoint_file))
        
        # Calculate state hash
        with open(checkpoint_file, 'rb') as f:
            state_hash = hashlib.sha256(f.read()).hexdigest()
            
        # Get current state info
        state_info = interface.get_interface_status()
        
        # Create checkpoint object
        checkpoint = Checkpoint(
            id=checkpoint_id,
            timestamp=datetime.now(),
            name=name,
            description=description,
            state_hash=state_hash,
            file_path=str(checkpoint_file),
            metadata={
                'n_qubits': state_info.get('n_qubits'),
                'device': state_info.get('device'),
                'measurement_cache_size': state_info.get('measurement_cache_size', 0),
                'version': self.version_manager.CURRENT_VERSION
            },
            is_auto=is_auto
        )
        
        # Add to registry
        self.registry['checkpoints'][checkpoint_id] = asdict(checkpoint)
        self.registry['current_checkpoint'] = checkpoint_id
        
        # Update statistics
        self.registry['statistics']['total_created'] += 1
        if is_auto:
            self.registry['statistics']['auto_checkpoints'] += 1
        else:
            self.registry['statistics']['manual_checkpoints'] += 1
            
        # Add to history
        self.registry['checkpoint_history'].append({
            'action': 'created',
            'checkpoint_id': checkpoint_id,
            'timestamp': datetime.now().isoformat(),
            'is_auto': is_auto
        })
        
        # Limit history size
        self.registry['checkpoint_history'] = self.registry['checkpoint_history'][-1000:]
        
        self._save_registry()
        
        # Create backup
        self.backup_manager.create_backup(
            str(checkpoint_file),
            backup_name=f"checkpoint_{checkpoint_id}",
            metadata={'checkpoint': asdict(checkpoint)}
        )
        
        # Rotate checkpoints
        self._rotate_checkpoints()
        
        logger.info(f"Created {'auto-' if is_auto else ''}checkpoint: {checkpoint_id} ({name})")
        
        return checkpoint_id
        
    def restore_checkpoint(self, interface, checkpoint_id: str) -> bool:
        """
        Restore system to a checkpoint
        
        Args:
            interface: QuantumClassicalInterface instance
            checkpoint_id: ID of checkpoint to restore
            
        Returns:
            True if successful
        """
        if checkpoint_id not in self.registry['checkpoints']:
            logger.error(f"Checkpoint not found: {checkpoint_id}")
            return False
            
        checkpoint_data = self.registry['checkpoints'][checkpoint_id]
        checkpoint_file = checkpoint_data['file_path']
        
        if not Path(checkpoint_file).exists():
            logger.error(f"Checkpoint file not found: {checkpoint_file}")
            # Try to restore from backup
            backup_path = self.backup_manager.get_latest_backup(checkpoint_file)
            if backup_path:
                logger.info("Attempting to restore from backup...")
                self.backup_manager.restore_backup(backup_path, checkpoint_file)
            else:
                return False
                
        try:
            # Load checkpoint
            interface.load_state(checkpoint_file)
            
            # Update registry
            self.registry['current_checkpoint'] = checkpoint_id
            self.registry['statistics']['total_restored'] += 1
            
            # Add to history
            self.registry['checkpoint_history'].append({
                'action': 'restored',
                'checkpoint_id': checkpoint_id,
                'timestamp': datetime.now().isoformat()
            })
            
            self._save_registry()
            
            logger.info(f"Restored checkpoint: {checkpoint_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to restore checkpoint: {e}")
            return False
            
    def list_checkpoints(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        List available checkpoints
        
        Args:
            limit: Maximum number of checkpoints to return
            
        Returns:
            List of checkpoint information
        """
        checkpoints = []
        
        for checkpoint_id, checkpoint_data in self.registry['checkpoints'].items():
            # Check if file exists
            file_exists = Path(checkpoint_data['file_path']).exists()
            
            checkpoint_info = checkpoint_data.copy()
            checkpoint_info['file_exists'] = file_exists
            checkpoint_info['is_current'] = (checkpoint_id == self.registry.get('current_checkpoint'))
            
            # Calculate age
            timestamp = datetime.fromisoformat(checkpoint_data['timestamp'])
            checkpoint_info['age_hours'] = (datetime.now() - timestamp).total_seconds() / 3600
            
            checkpoints.append(checkpoint_info)
            
        # Sort by timestamp, newest first
        checkpoints.sort(key=lambda x: x['timestamp'], reverse=True)
        
        if limit:
            checkpoints = checkpoints[:limit]
            
        return checkpoints
        
    def get_checkpoint(self, checkpoint_id: str) -> Optional[Dict[str, Any]]:
        """Get specific checkpoint information"""
        if checkpoint_id in self.registry['checkpoints']:
            checkpoint = self.registry['checkpoints'][checkpoint_id].copy()
            checkpoint['file_exists'] = Path(checkpoint['file_path']).exists()
            checkpoint['is_current'] = (checkpoint_id == self.registry.get('current_checkpoint'))
            return checkpoint
        return None
        
    def delete_checkpoint(self, checkpoint_id: str) -> bool:
        """
        Delete a checkpoint
        
        Args:
            checkpoint_id: ID of checkpoint to delete
            
        Returns:
            True if successful
        """
        if checkpoint_id not in self.registry['checkpoints']:
            return False
            
        checkpoint_data = self.registry['checkpoints'][checkpoint_id]
        checkpoint_file = Path(checkpoint_data['file_path'])
        
        # Delete file if it exists
        if checkpoint_file.exists():
            checkpoint_file.unlink()
            
        # Remove from registry
        del self.registry['checkpoints'][checkpoint_id]
        
        # Update current if needed
        if self.registry.get('current_checkpoint') == checkpoint_id:
            self.registry['current_checkpoint'] = None
            
        # Add to history
        self.registry['checkpoint_history'].append({
            'action': 'deleted',
            'checkpoint_id': checkpoint_id,
            'timestamp': datetime.now().isoformat()
        })
        
        self._save_registry()
        
        logger.info(f"Deleted checkpoint: {checkpoint_id}")
        return True
        
    def _rotate_checkpoints(self):
        """Rotate checkpoints based on retention policy"""
        checkpoints = self.list_checkpoints()
        
        if len(checkpoints) <= self.max_checkpoints:
            return
            
        # Keep the current checkpoint
        current_id = self.registry.get('current_checkpoint')
        
        # Sort by age and auto/manual (prefer keeping manual checkpoints)
        checkpoints.sort(key=lambda x: (x['is_auto'], -x['age_hours']))
        
        # Delete oldest checkpoints
        to_delete = len(checkpoints) - self.max_checkpoints
        deleted = 0
        
        for checkpoint in checkpoints:
            if deleted >= to_delete:
                break
                
            # Don't delete current checkpoint
            if checkpoint['id'] == current_id:
                continue
                
            self.delete_checkpoint(checkpoint['id'])
            deleted += 1
            
        if deleted > 0:
            logger.info(f"Rotated {deleted} old checkpoints")
            
    def compare_checkpoints(self, checkpoint_id1: str, checkpoint_id2: str) -> Dict[str, Any]:
        """
        Compare two checkpoints
        
        Returns:
            Comparison results
        """
        cp1 = self.get_checkpoint(checkpoint_id1)
        cp2 = self.get_checkpoint(checkpoint_id2)
        
        if not cp1 or not cp2:
            return {'error': 'One or both checkpoints not found'}
            
        comparison = {
            'checkpoint1': checkpoint_id1,
            'checkpoint2': checkpoint_id2,
            'time_difference_hours': abs(
                (datetime.fromisoformat(cp1['timestamp']) - 
                 datetime.fromisoformat(cp2['timestamp'])).total_seconds() / 3600
            ),
            'same_hash': cp1['state_hash'] == cp2['state_hash'],
            'metadata_differences': {}
        }
        
        # Compare metadata
        for key in set(cp1['metadata'].keys()) | set(cp2['metadata'].keys()):
            val1 = cp1['metadata'].get(key)
            val2 = cp2['metadata'].get(key)
            if val1 != val2:
                comparison['metadata_differences'][key] = {
                    'checkpoint1': val1,
                    'checkpoint2': val2
                }
                
        return comparison
        
    def start_auto_checkpoint(self):
        """Start automatic checkpointing"""
        if self._auto_checkpoint_thread and self._auto_checkpoint_thread.is_alive():
            logger.warning("Auto-checkpoint already running")
            return
            
        self._stop_auto_checkpoint.clear()
        self._auto_checkpoint_thread = threading.Thread(
            target=self._auto_checkpoint_loop,
            daemon=True
        )
        self._auto_checkpoint_thread.start()
        logger.info(f"Started auto-checkpoint (interval: {self.auto_checkpoint_interval}s)")
        
    def stop_auto_checkpoint(self):
        """Stop automatic checkpointing"""
        self._stop_auto_checkpoint.set()
        if self._auto_checkpoint_thread:
            self._auto_checkpoint_thread.join(timeout=5)
        logger.info("Stopped auto-checkpoint")
        
    def _auto_checkpoint_loop(self):
        """Auto-checkpoint loop (runs in separate thread)"""
        # Store reference to interface when first checkpoint is created
        interface_ref = None
        
        while not self._stop_auto_checkpoint.is_set():
            if interface_ref:
                try:
                    self.create_checkpoint(
                        interface_ref,
                        name=f"auto_{datetime.now().strftime('%H%M')}",
                        description="Automatic checkpoint",
                        is_auto=True
                    )
                except Exception as e:
                    logger.error(f"Auto-checkpoint failed: {e}")
                    
            # Wait for interval
            self._stop_auto_checkpoint.wait(self.auto_checkpoint_interval)
            
    def set_auto_checkpoint_interface(self, interface):
        """Set the interface for auto-checkpointing"""
        # This is a workaround to pass interface to the auto-checkpoint thread
        if hasattr(self, '_auto_checkpoint_loop'):
            self._auto_checkpoint_interface = interface
            
    def get_statistics(self) -> Dict[str, Any]:
        """Get checkpoint system statistics"""
        stats = self.registry['statistics'].copy()
        
        # Add current statistics
        checkpoints = self.list_checkpoints()
        stats['active_checkpoints'] = len(checkpoints)
        stats['current_checkpoint'] = self.registry.get('current_checkpoint')
        
        # Calculate storage usage
        total_size = 0
        for checkpoint in checkpoints:
            if checkpoint['file_exists']:
                file_path = Path(checkpoint['file_path'])
                if file_path.exists():
                    total_size += file_path.stat().st_size
                    
        stats['total_size_mb'] = total_size / (1024 * 1024)
        
        # Auto-checkpoint status
        stats['auto_checkpoint_enabled'] = bool(self.auto_checkpoint_interval)
        stats['auto_checkpoint_interval'] = self.auto_checkpoint_interval
        
        return stats
        
    def export_checkpoint(self, checkpoint_id: str, export_path: str) -> bool:
        """
        Export a checkpoint to external location
        
        Args:
            checkpoint_id: ID of checkpoint to export
            export_path: Path to export to
            
        Returns:
            True if successful
        """
        checkpoint = self.get_checkpoint(checkpoint_id)
        if not checkpoint or not checkpoint['file_exists']:
            return False
            
        try:
            # Create export directory
            export_dir = Path(export_path)
            export_dir.mkdir(parents=True, exist_ok=True)
            
            # Copy checkpoint file
            import shutil
            checkpoint_file = Path(checkpoint['file_path'])
            export_file = export_dir / f"checkpoint_{checkpoint_id}.json"
            shutil.copy2(checkpoint_file, export_file)
            
            # Export metadata
            metadata_file = export_dir / f"checkpoint_{checkpoint_id}_metadata.json"
            with open(metadata_file, 'w') as f:
                json.dump(checkpoint, f, indent=2)
                
            # Also export compressed version
            self.backup_manager.create_backup(
                str(export_file),
                backup_name=f"checkpoint_{checkpoint_id}_export"
            )
            
            logger.info(f"Exported checkpoint {checkpoint_id} to {export_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export checkpoint: {e}")
            return False
            
    def import_checkpoint(self, import_path: str, name: Optional[str] = None) -> Optional[str]:
        """
        Import a checkpoint from external location
        
        Args:
            import_path: Path to checkpoint file
            name: Optional name for imported checkpoint
            
        Returns:
            Checkpoint ID if successful
        """
        try:
            import_file = Path(import_path)
            if not import_file.exists():
                logger.error(f"Import file not found: {import_path}")
                return None
                
            # Create new checkpoint ID
            checkpoint_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]
            checkpoint_file = self.checkpoint_dir / f"{checkpoint_id}.json"
            
            # Copy file
            import shutil
            shutil.copy2(import_file, checkpoint_file)
            
            # Create checkpoint
            with open(checkpoint_file, 'rb') as f:
                state_hash = hashlib.sha256(f.read()).hexdigest()
                
            checkpoint = Checkpoint(
                id=checkpoint_id,
                timestamp=datetime.now(),
                name=name or f"imported_{checkpoint_id}",
                description=f"Imported from {import_path}",
                state_hash=state_hash,
                file_path=str(checkpoint_file),
                metadata={
                    'imported': True,
                    'import_source': str(import_path),
                    'import_date': datetime.now().isoformat()
                },
                is_auto=False
            )
            
            # Add to registry
            self.registry['checkpoints'][checkpoint_id] = asdict(checkpoint)
            self._save_registry()
            
            logger.info(f"Imported checkpoint: {checkpoint_id}")
            return checkpoint_id
            
        except Exception as e:
            logger.error(f"Failed to import checkpoint: {e}")
            return None


# Example usage
if __name__ == "__main__":
    # Test checkpoint manager
    manager = CheckpointManager(
        checkpoint_dir="./test_checkpoints",
        max_checkpoints=5,
        auto_checkpoint_interval=60  # 1 minute
    )
    
    print("Checkpoint Manager Test")
    print("=" * 50)
    
    # Mock interface
    class MockInterface:
        def save_state(self, filepath):
            with open(filepath, 'w') as f:
                json.dump({'test': True, 'time': time.time()}, f)
                
        def load_state(self, filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
                
        def get_interface_status(self):
            return {'n_qubits': 27, 'device': 'cuda:0'}
            
    interface = MockInterface()
    
    # Create checkpoints
    print("\nCreating checkpoints...")
    for i in range(3):
        cp_id = manager.create_checkpoint(
            interface,
            name=f"test_{i}",
            description=f"Test checkpoint {i}"
        )
        print(f"Created: {cp_id}")
        time.sleep(0.1)
        
    # List checkpoints
    print("\nAvailable checkpoints:")
    for cp in manager.list_checkpoints():
        print(f"  - {cp['name']} ({cp['age_hours']:.2f} hours old)")
        
    # Get statistics
    print("\nStatistics:")
    stats = manager.get_statistics()
    for key, value in stats.items():
        print(f"  {key}: {value}")
        
    # Clean up
    manager.stop_auto_checkpoint()
    import shutil
    shutil.rmtree("./test_checkpoints")