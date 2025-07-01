"""
Backup File Rotation System for Quantum Memory States
Manages automatic backups with rotation, compression, and retention policies
"""

import os
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import zlib
import hashlib

logger = logging.getLogger(__name__)


class BackupManager:
    """Manages backup creation, rotation, and restoration"""
    
    def __init__(self, backup_dir: Optional[str] = None,
                 max_backups: int = 10,
                 max_age_days: int = 30,
                 compression: bool = True):
        """
        Initialize backup manager
        
        Args:
            backup_dir: Directory for backups (defaults to .backups in working dir)
            max_backups: Maximum number of backups to keep
            max_age_days: Maximum age of backups in days
            compression: Whether to compress backups
        """
        self.backup_dir = Path(backup_dir) if backup_dir else Path.cwd() / ".backups"
        self.max_backups = max_backups
        self.max_age_days = max_age_days
        self.compression = compression
        
        # Create backup directory if it doesn't exist
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Backup metadata file
        self.metadata_file = self.backup_dir / "backup_metadata.json"
        self.metadata = self._load_metadata()
        
    def _load_metadata(self) -> Dict[str, Any]:
        """Load backup metadata"""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                return json.load(f)
        return {
            'backups': {},
            'rotation_history': [],
            'last_cleanup': None
        }
        
    def _save_metadata(self):
        """Save backup metadata"""
        with open(self.metadata_file, 'w') as f:
            json.dump(self.metadata, f, indent=2)
            
    def create_backup(self, source_path: str, backup_name: Optional[str] = None,
                     metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Create a backup of a file
        
        Args:
            source_path: Path to file to backup
            backup_name: Optional backup name (auto-generated if not provided)
            metadata: Optional metadata to store with backup
            
        Returns:
            Path to backup file
        """
        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"Source file not found: {source_path}")
            
        # Generate backup name if not provided
        if not backup_name:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_name = f"{source.stem}_backup_{timestamp}"
            
        # Determine backup path
        if self.compression:
            backup_path = self.backup_dir / f"{backup_name}.json.zlib"
        else:
            backup_path = self.backup_dir / f"{backup_name}.json"
            
        # Create backup
        if self.compression:
            self._create_compressed_backup(source, backup_path)
        else:
            shutil.copy2(source, backup_path)
            
        # Calculate checksum
        with open(source, 'rb') as f:
            checksum = hashlib.sha256(f.read()).hexdigest()
            
        # Update metadata
        self.metadata['backups'][str(backup_path)] = {
            'source_path': str(source),
            'backup_name': backup_name,
            'timestamp': datetime.now().isoformat(),
            'size_bytes': backup_path.stat().st_size,
            'checksum': checksum,
            'compressed': self.compression,
            'metadata': metadata or {}
        }
        
        self._save_metadata()
        
        logger.info(f"Created backup: {backup_path}")
        
        # Trigger rotation if needed
        self._rotate_backups()
        
        return str(backup_path)
        
    def _create_compressed_backup(self, source: Path, backup_path: Path):
        """Create compressed backup"""
        with open(source, 'rb') as f:
            data = f.read()
            
        compressed = zlib.compress(data, level=9)
        
        # Write with header
        header = {
            'original_size': len(data),
            'compressed_size': len(compressed),
            'compression_ratio': 1 - (len(compressed) / len(data))
        }
        
        with open(backup_path, 'wb') as f:
            header_bytes = json.dumps(header).encode('utf-8')
            f.write(len(header_bytes).to_bytes(4, 'little'))
            f.write(header_bytes)
            f.write(compressed)
            
    def restore_backup(self, backup_path: str, target_path: Optional[str] = None) -> str:
        """
        Restore a backup
        
        Args:
            backup_path: Path to backup file
            target_path: Where to restore (defaults to original location)
            
        Returns:
            Path to restored file
        """
        backup = Path(backup_path)
        if not backup.exists():
            raise FileNotFoundError(f"Backup not found: {backup_path}")
            
        # Get backup info
        backup_info = self.metadata['backups'].get(str(backup))
        if not backup_info:
            logger.warning(f"No metadata found for backup: {backup_path}")
            backup_info = {'compressed': backup_path.endswith('.zlib')}
            
        # Determine target path
        if not target_path and backup_info:
            target_path = backup_info.get('source_path')
            
        if not target_path:
            raise ValueError("No target path specified and cannot determine from metadata")
            
        target = Path(target_path)
        
        # Restore based on compression
        if backup_info.get('compressed', False):
            self._restore_compressed_backup(backup, target)
        else:
            shutil.copy2(backup, target)
            
        logger.info(f"Restored backup from {backup_path} to {target_path}")
        
        return str(target)
        
    def _restore_compressed_backup(self, backup: Path, target: Path):
        """Restore compressed backup"""
        with open(backup, 'rb') as f:
            # Read header
            header_length = int.from_bytes(f.read(4), 'little')
            header = json.loads(f.read(header_length).decode('utf-8'))
            # Read compressed data
            compressed = f.read()
            
        # Decompress
        data = zlib.decompress(compressed)
        
        # Write to target
        with open(target, 'wb') as f:
            f.write(data)
            
    def _rotate_backups(self):
        """Rotate backups based on retention policy"""
        # Get all backups sorted by timestamp
        backups = []
        for backup_path, info in self.metadata['backups'].items():
            if Path(backup_path).exists():
                backups.append((
                    backup_path,
                    datetime.fromisoformat(info['timestamp']),
                    info
                ))
                
        backups.sort(key=lambda x: x[1], reverse=True)  # Newest first
        
        removed = []
        
        # Remove backups exceeding max count
        if len(backups) > self.max_backups:
            for backup_path, timestamp, info in backups[self.max_backups:]:
                self._remove_backup(backup_path)
                removed.append({
                    'path': backup_path,
                    'reason': 'max_count_exceeded',
                    'timestamp': timestamp.isoformat()
                })
                
        # Remove old backups
        cutoff_date = datetime.now() - timedelta(days=self.max_age_days)
        for backup_path, timestamp, info in backups:
            if timestamp < cutoff_date:
                self._remove_backup(backup_path)
                removed.append({
                    'path': backup_path,
                    'reason': 'too_old',
                    'timestamp': timestamp.isoformat()
                })
                
        # Update rotation history
        if removed:
            self.metadata['rotation_history'].append({
                'timestamp': datetime.now().isoformat(),
                'removed_count': len(removed),
                'removed_backups': removed
            })
            
            # Keep only last 100 rotation history entries
            self.metadata['rotation_history'] = self.metadata['rotation_history'][-100:]
            
            self._save_metadata()
            
            logger.info(f"Rotated {len(removed)} backups")
            
    def _remove_backup(self, backup_path: str):
        """Remove a backup file and its metadata"""
        path = Path(backup_path)
        if path.exists():
            path.unlink()
            
        if backup_path in self.metadata['backups']:
            del self.metadata['backups'][backup_path]
            
    def list_backups(self, source_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List available backups
        
        Args:
            source_path: Filter by source path
            
        Returns:
            List of backup information
        """
        backups = []
        
        for backup_path, info in self.metadata['backups'].items():
            if Path(backup_path).exists():
                if source_path and info.get('source_path') != source_path:
                    continue
                    
                backup_info = info.copy()
                backup_info['backup_path'] = backup_path
                backup_info['age_days'] = (
                    datetime.now() - datetime.fromisoformat(info['timestamp'])
                ).days
                
                backups.append(backup_info)
                
        # Sort by timestamp, newest first
        backups.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return backups
        
    def get_latest_backup(self, source_path: str) -> Optional[str]:
        """Get the latest backup for a source file"""
        backups = self.list_backups(source_path)
        if backups:
            return backups[0]['backup_path']
        return None
        
    def verify_backup(self, backup_path: str) -> Dict[str, Any]:
        """
        Verify backup integrity
        
        Returns:
            Verification result
        """
        result = {
            'backup_path': backup_path,
            'exists': False,
            'metadata_exists': False,
            'checksum_valid': None,
            'can_restore': False,
            'error': None
        }
        
        try:
            backup = Path(backup_path)
            result['exists'] = backup.exists()
            
            if not result['exists']:
                result['error'] = 'Backup file not found'
                return result
                
            # Check metadata
            backup_info = self.metadata['backups'].get(str(backup))
            result['metadata_exists'] = backup_info is not None
            
            if not backup_info:
                result['error'] = 'No metadata found for backup'
                return result
                
            # Verify we can read/restore the backup
            if backup_info.get('compressed', False):
                # Try to read compressed header
                with open(backup, 'rb') as f:
                    header_length = int.from_bytes(f.read(4), 'little')
                    header = json.loads(f.read(header_length).decode('utf-8'))
                    result['can_restore'] = True
            else:
                # Try to read as JSON
                with open(backup, 'r') as f:
                    json.load(f)
                    result['can_restore'] = True
                    
        except Exception as e:
            result['error'] = str(e)
            result['can_restore'] = False
            
        return result
        
    def cleanup_orphaned_backups(self) -> int:
        """
        Clean up backup files without metadata
        
        Returns:
            Number of files cleaned
        """
        cleaned = 0
        
        # Find all backup files
        backup_files = list(self.backup_dir.glob("*_backup_*"))
        
        # Check against metadata
        known_backups = set(self.metadata['backups'].keys())
        
        for backup_file in backup_files:
            if str(backup_file) not in known_backups:
                backup_file.unlink()
                cleaned += 1
                logger.info(f"Removed orphaned backup: {backup_file}")
                
        if cleaned > 0:
            self.metadata['last_cleanup'] = datetime.now().isoformat()
            self._save_metadata()
            
        return cleaned
        
    def get_backup_statistics(self) -> Dict[str, Any]:
        """Get backup system statistics"""
        total_size = 0
        compressed_size = 0
        backup_count = 0
        
        for backup_path, info in self.metadata['backups'].items():
            if Path(backup_path).exists():
                backup_count += 1
                size = info.get('size_bytes', 0)
                total_size += size
                
                if info.get('compressed', False):
                    compressed_size += size
                    
        return {
            'backup_directory': str(self.backup_dir),
            'total_backups': backup_count,
            'total_size_mb': total_size / (1024 * 1024),
            'compressed_size_mb': compressed_size / (1024 * 1024),
            'max_backups': self.max_backups,
            'max_age_days': self.max_age_days,
            'compression_enabled': self.compression,
            'last_cleanup': self.metadata.get('last_cleanup'),
            'rotation_history_count': len(self.metadata.get('rotation_history', []))
        }
        
    def export_backup_history(self, output_path: str):
        """Export backup history to a file"""
        history = {
            'export_date': datetime.now().isoformat(),
            'statistics': self.get_backup_statistics(),
            'current_backups': self.list_backups(),
            'rotation_history': self.metadata.get('rotation_history', [])
        }
        
        with open(output_path, 'w') as f:
            json.dump(history, f, indent=2)
            
        logger.info(f"Exported backup history to {output_path}")


# Integration with QuantumClassicalInterface
def integrate_backup_manager(interface_class):
    """Decorator to add backup functionality to QuantumClassicalInterface"""
    
    # Store original save_state method
    original_save_state = interface_class.save_state
    
    def save_state_with_backup(self, filepath: str, create_backup: bool = True):
        """Enhanced save_state with automatic backup"""
        # Create backup if file exists
        if create_backup and Path(filepath).exists():
            if not hasattr(self, '_backup_manager'):
                backup_dir = Path(filepath).parent / ".backups"
                self._backup_manager = BackupManager(backup_dir=str(backup_dir))
                
            self._backup_manager.create_backup(
                filepath,
                metadata={'interface_version': getattr(self, '__version__', 'unknown')}
            )
            
        # Call original save method
        return original_save_state(self, filepath)
        
    # Replace method
    interface_class.save_state = save_state_with_backup
    
    # Add backup-related methods
    interface_class.list_state_backups = lambda self, filepath: (
        self._backup_manager.list_backups(filepath) 
        if hasattr(self, '_backup_manager') else []
    )
    
    interface_class.restore_state_backup = lambda self, backup_path, target_path=None: (
        self._backup_manager.restore_backup(backup_path, target_path)
        if hasattr(self, '_backup_manager') else None
    )
    
    return interface_class


# Example usage
if __name__ == "__main__":
    # Test backup manager
    manager = BackupManager(
        backup_dir="./test_backups",
        max_backups=5,
        max_age_days=7,
        compression=True
    )
    
    print("Backup Manager Test")
    print("=" * 50)
    
    # Create test file
    test_file = Path("test_state.json")
    test_data = {
        'test': True,
        'timestamp': datetime.now().isoformat(),
        'data': list(range(100))
    }
    
    with open(test_file, 'w') as f:
        json.dump(test_data, f)
        
    # Create backups
    print("\nCreating backups...")
    for i in range(3):
        backup_path = manager.create_backup(
            str(test_file),
            metadata={'iteration': i}
        )
        print(f"Created: {backup_path}")
        
    # List backups
    print("\nAvailable backups:")
    for backup in manager.list_backups():
        print(f"  - {backup['backup_name']} ({backup['age_days']} days old)")
        
    # Get statistics
    print("\nBackup statistics:")
    stats = manager.get_backup_statistics()
    for key, value in stats.items():
        print(f"  {key}: {value}")
        
    # Clean up
    test_file.unlink()
    shutil.rmtree("./test_backups")