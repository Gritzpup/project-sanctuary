#!/usr/bin/env python3
"""
Thread-safe JSON file handler with file locking to prevent race conditions
"""

import json
import fcntl
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class SafeJSONHandler:
    """
    Thread-safe JSON file operations using file locking
    Prevents race conditions when multiple processes access the same file
    """
    
    @staticmethod
    def read_json(filepath: Path, max_retries: int = 3, retry_delay: float = 0.1) -> Optional[Dict[str, Any]]:
        """
        Safely read JSON file with file locking and retry logic
        
        Args:
            filepath: Path to JSON file
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            
        Returns:
            Parsed JSON data or None if failed
        """
        filepath = Path(filepath)
        
        for attempt in range(max_retries):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    # Acquire shared lock for reading
                    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                    try:
                        data = json.load(f)
                        return data
                    finally:
                        # Release lock
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                        
            except json.JSONDecodeError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"JSON decode error on {filepath}, retrying... ({e})")
                    time.sleep(retry_delay)
                    continue
                else:
                    logger.error(f"Failed to read {filepath} after {max_retries} attempts: {e}")
                    return None
            except FileNotFoundError:
                logger.warning(f"File not found: {filepath}")
                return None
            except Exception as e:
                logger.error(f"Unexpected error reading {filepath}: {e}")
                return None
                
        return None
    
    @staticmethod
    def write_json(filepath: Path, data: Dict[str, Any], 
                   create_backup: bool = True, 
                   max_retries: int = 3, 
                   retry_delay: float = 0.1) -> bool:
        """
        Safely write JSON file with atomic write and file locking
        
        Args:
            filepath: Path to JSON file
            data: Data to write
            create_backup: Whether to create a backup before writing
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            
        Returns:
            True if successful, False otherwise
        """
        filepath = Path(filepath)
        
        # Ensure directory exists
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # Create backup if requested and file exists
        if create_backup and filepath.exists():
            backup_path = filepath.with_suffix('.json.bak')
            try:
                import shutil
                shutil.copy2(filepath, backup_path)
            except Exception as e:
                logger.warning(f"Failed to create backup: {e}")
        
        # Write to temporary file first (atomic write)
        temp_path = filepath.with_suffix('.json.tmp')
        
        for attempt in range(max_retries):
            try:
                with open(temp_path, 'w', encoding='utf-8') as f:
                    # Acquire exclusive lock for writing
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                    try:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                        f.flush()
                        os.fsync(f.fileno())  # Force write to disk
                    finally:
                        # Release lock
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                
                # Atomic rename (on same filesystem)
                os.replace(temp_path, filepath)
                return True
                
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Write error on {filepath}, retrying... ({e})")
                    time.sleep(retry_delay)
                    continue
                else:
                    logger.error(f"Failed to write {filepath} after {max_retries} attempts: {e}")
                    # Clean up temp file if it exists
                    if temp_path.exists():
                        try:
                            temp_path.unlink()
                        except:
                            pass
                    return False
                    
        return False
    
    @staticmethod
    def update_json(filepath: Path, update_func: callable, 
                    max_retries: int = 3, 
                    retry_delay: float = 0.1) -> bool:
        """
        Safely update JSON file with a function (read-modify-write)
        
        Args:
            filepath: Path to JSON file
            update_func: Function that takes current data and returns updated data
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            
        Returns:
            True if successful, False otherwise
        """
        filepath = Path(filepath)
        
        for attempt in range(max_retries):
            try:
                # Read current data
                current_data = SafeJSONHandler.read_json(filepath)
                if current_data is None:
                    current_data = {}
                
                # Apply update function
                updated_data = update_func(current_data)
                
                # Write back
                if SafeJSONHandler.write_json(filepath, updated_data, create_backup=False):
                    return True
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Update error on {filepath}, retrying... ({e})")
                    time.sleep(retry_delay)
                    continue
                else:
                    logger.error(f"Failed to update {filepath} after {max_retries} attempts: {e}")
                    return False
                    
        return False


# Convenience functions
def safe_read_json(filepath: Path) -> Optional[Dict[str, Any]]:
    """Convenience function for safe JSON reading"""
    return SafeJSONHandler.read_json(filepath)

def safe_write_json(filepath: Path, data: Dict[str, Any]) -> bool:
    """Convenience function for safe JSON writing"""
    return SafeJSONHandler.write_json(filepath, data)

def safe_update_json(filepath: Path, update_func: callable) -> bool:
    """Convenience function for safe JSON updating"""
    return SafeJSONHandler.update_json(filepath, update_func)