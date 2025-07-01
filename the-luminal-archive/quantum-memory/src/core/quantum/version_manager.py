"""
Version Management System for Quantum Memory States
Handles versioning, migration, and backward compatibility
"""

import json
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime
from pathlib import Path
import shutil

logger = logging.getLogger(__name__)


class VersionManager:
    """Manages versions and migrations for quantum memory states"""
    
    # Current version
    CURRENT_VERSION = "2.0"
    
    # Version history
    VERSION_HISTORY = {
        "1.0": {
            "release_date": "2025-01-01",
            "description": "Initial version with basic state saving"
        },
        "2.0": {
            "release_date": "2025-06-30", 
            "description": "Added metadata, compression, checksums, and emotional context"
        }
    }
    
    def __init__(self):
        """Initialize version manager"""
        self.migrations = self._register_migrations()
        
    def _register_migrations(self) -> Dict[str, Callable]:
        """Register all migration functions"""
        return {
            "1.0_to_2.0": self._migrate_1_0_to_2_0
        }
        
    def get_version(self, state_data: Dict[str, Any]) -> str:
        """Extract version from state data"""
        # Try new location first (v2.0+)
        if 'metadata' in state_data and 'version' in state_data['metadata']:
            return state_data['metadata']['version']
            
        # Check old location (v1.0)
        if 'version' in state_data:
            return state_data['version']
            
        # If no version found, assume 1.0
        return "1.0"
        
    def needs_migration(self, state_data: Dict[str, Any]) -> bool:
        """Check if state needs migration to current version"""
        version = self.get_version(state_data)
        return version != self.CURRENT_VERSION
        
    def migrate(self, state_data: Dict[str, Any], target_version: Optional[str] = None) -> Dict[str, Any]:
        """
        Migrate state data to target version
        
        Args:
            state_data: State data to migrate
            target_version: Target version (defaults to current)
            
        Returns:
            Migrated state data
        """
        target_version = target_version or self.CURRENT_VERSION
        current_version = self.get_version(state_data)
        
        if current_version == target_version:
            logger.info(f"State already at version {target_version}")
            return state_data
            
        logger.info(f"Migrating state from {current_version} to {target_version}")
        
        # Apply migrations sequentially
        migrated_data = state_data.copy()
        
        if current_version == "1.0" and target_version == "2.0":
            migration_key = "1.0_to_2.0"
            if migration_key in self.migrations:
                migrated_data = self.migrations[migration_key](migrated_data)
                logger.info(f"Applied migration: {migration_key}")
                
        return migrated_data
        
    def _migrate_1_0_to_2_0(self, state_data: Dict[str, Any]) -> Dict[str, Any]:
        """Migrate from version 1.0 to 2.0"""
        logger.info("Applying migration from 1.0 to 2.0")
        
        # Create new structure
        migrated = {
            'metadata': {
                'version': '2.0',
                'timestamp': datetime.now().isoformat(),
                'save_timestamp_unix': datetime.now().timestamp(),
                'quantum_state_checksum': None,  # Can't calculate from old data
                'n_measurements_cached': len(state_data.get('measurement_cache', [])),
                'device': state_data.get('interface_config', {}).get('device', 'cuda:0'),
                'cuda_available': True,  # Assume true for old saves
                'migration_info': {
                    'migrated_from': '1.0',
                    'migration_date': datetime.now().isoformat()
                }
            },
            'compression_metrics': {
                'original_size_bytes': 0,
                'compressed_size_bytes': 0,
                'compression_ratio': 0,
                'compression_percentage': 0
            },
            'fidelity_metrics': {
                'measurement_fidelities': [],
                'average_fidelity': 0.0,
                'min_fidelity': 1.0,
                'max_fidelity': 0.0
            },
            'emotional_context': {
                'recent_emotions': [],
                'average_confidence': 0.0,
                'emotional_stability': 0.0
            }
        }
        
        # Copy existing data
        migrated['interface_config'] = state_data.get('interface_config', {})
        migrated['measurement_cache'] = state_data.get('measurement_cache', [])
        migrated['classical_network_state'] = state_data.get('classical_network_state', {})
        migrated['tensor_memory_stats'] = {}
        
        # Extract emotional context from measurement cache if available
        if migrated['measurement_cache']:
            recent_states = [item['state'] for item in migrated['measurement_cache'][-10:]]
            if recent_states:
                migrated['emotional_context']['recent_emotions'] = [
                    {
                        'pad_values': state.get('pad_values', [0, 0, 0]),
                        'timestamp': state.get('timestamp', datetime.now().isoformat()),
                        'confidence': state.get('confidence', 0.0)
                    }
                    for state in recent_states
                ]
                
                # Calculate average confidence
                confidences = [state.get('confidence', 0.0) for state in recent_states]
                if confidences:
                    migrated['emotional_context']['average_confidence'] = sum(confidences) / len(confidences)
                    
                # Extract fidelity metrics
                fidelities = [state.get('measurement_fidelity', 1.0) for state in recent_states]
                if fidelities:
                    migrated['fidelity_metrics']['measurement_fidelities'] = fidelities
                    migrated['fidelity_metrics']['average_fidelity'] = sum(fidelities) / len(fidelities)
                    migrated['fidelity_metrics']['min_fidelity'] = min(fidelities)
                    migrated['fidelity_metrics']['max_fidelity'] = max(fidelities)
                    
        return migrated
        
    def create_backup(self, filepath: str) -> str:
        """Create backup of state file before migration"""
        backup_path = f"{filepath}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(filepath, backup_path)
        logger.info(f"Created backup at {backup_path}")
        return backup_path
        
    def validate_migration(self, original_data: Dict[str, Any], 
                         migrated_data: Dict[str, Any]) -> bool:
        """
        Validate that migration preserved essential data
        
        Returns:
            True if migration is valid
        """
        # Check that key data is preserved
        checks = []
        
        # Check interface config
        original_config = original_data.get('interface_config', {})
        migrated_config = migrated_data.get('interface_config', {})
        checks.append(original_config.get('n_qubits') == migrated_config.get('n_qubits'))
        
        # Check measurement cache size
        original_cache = original_data.get('measurement_cache', [])
        migrated_cache = migrated_data.get('measurement_cache', [])
        checks.append(len(original_cache) == len(migrated_cache))
        
        # Check version is updated
        checks.append(self.get_version(migrated_data) == self.CURRENT_VERSION)
        
        # All checks must pass
        is_valid = all(checks)
        
        if not is_valid:
            logger.error("Migration validation failed!")
            
        return is_valid
        
    def get_version_info(self, version: Optional[str] = None) -> Dict[str, Any]:
        """Get information about a specific version"""
        version = version or self.CURRENT_VERSION
        
        if version not in self.VERSION_HISTORY:
            return {"error": f"Unknown version: {version}"}
            
        info = self.VERSION_HISTORY[version].copy()
        info['version'] = version
        info['is_current'] = (version == self.CURRENT_VERSION)
        
        return info
        
    def get_migration_path(self, from_version: str, to_version: str) -> list:
        """Get the migration path between versions"""
        # For now, we only support direct migrations
        if from_version == "1.0" and to_version == "2.0":
            return ["1.0_to_2.0"]
            
        return []


# Utility functions for file operations
def load_with_migration(filepath: str) -> Dict[str, Any]:
    """Load state file with automatic migration if needed"""
    with open(filepath, 'r') as f:
        state_data = json.load(f)
        
    manager = VersionManager()
    
    if manager.needs_migration(state_data):
        # Create backup
        manager.create_backup(filepath)
        
        # Migrate
        migrated_data = manager.migrate(state_data)
        
        # Validate
        if manager.validate_migration(state_data, migrated_data):
            # Save migrated version
            with open(filepath, 'w') as f:
                json.dump(migrated_data, f, indent=2)
                
            logger.info(f"Successfully migrated {filepath} to version {manager.CURRENT_VERSION}")
            return migrated_data
        else:
            logger.error("Migration failed validation, returning original data")
            return state_data
            
    return state_data


def get_file_version(filepath: str) -> str:
    """Get version of a saved state file without loading entire file"""
    with open(filepath, 'r') as f:
        # Read only enough to find version
        content = f.read(1000)  # First 1KB should contain metadata
        
    try:
        # Try to parse partial JSON to find version
        if '"metadata"' in content and '"version"' in content:
            # Extract version from metadata
            start = content.find('"version"') + len('"version"') + 1
            start = content.find('"', start) + 1
            end = content.find('"', start)
            return content[start:end]
    except:
        pass
        
    return "1.0"  # Default to 1.0 if can't determine


# Example usage
if __name__ == "__main__":
    # Test version manager
    manager = VersionManager()
    
    print(f"Current version: {manager.CURRENT_VERSION}")
    print(f"Version history: {manager.VERSION_HISTORY}")
    
    # Test migration
    old_state = {
        'interface_config': {'n_qubits': 27, 'device': 'cuda:0'},
        'measurement_cache': [
            {
                'state': {
                    'pad_values': [0.5, 0.3, 0.7],
                    'confidence': 0.95,
                    'timestamp': '2025-01-01T12:00:00',
                    'metadata': {},
                    'measurement_fidelity': 0.98
                },
                'measurements': {'000': 500, '111': 500}
            }
        ]
    }
    
    print("\nTesting migration from 1.0 to 2.0...")
    migrated = manager.migrate(old_state)
    print(f"Migration successful: {manager.validate_migration(old_state, migrated)}")
    print(f"New version: {manager.get_version(migrated)}")