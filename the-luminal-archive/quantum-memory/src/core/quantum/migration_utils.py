"""
Migration Utilities for Quantum Memory System
Provides tools for batch migration, validation, and recovery
"""

import json
import logging
import shutil
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import hashlib

from .version_manager import VersionManager, get_file_version

logger = logging.getLogger(__name__)


class MigrationUtilities:
    """Advanced utilities for state migration"""
    
    def __init__(self):
        self.version_manager = VersionManager()
        self.migration_log = []
        
    def batch_migrate_directory(self, directory: str, 
                              target_version: Optional[str] = None,
                              dry_run: bool = False) -> Dict[str, Any]:
        """
        Migrate all state files in a directory
        
        Args:
            directory: Directory containing state files
            target_version: Target version (defaults to current)
            dry_run: If True, only simulate migration
            
        Returns:
            Migration report
        """
        directory_path = Path(directory)
        if not directory_path.exists():
            raise ValueError(f"Directory not found: {directory}")
            
        target_version = target_version or self.version_manager.CURRENT_VERSION
        
        # Find all state files
        state_files = list(directory_path.glob("*.json"))
        state_files = [f for f in state_files if not f.name.endswith('_temp.json')]
        
        report = {
            'directory': str(directory_path),
            'target_version': target_version,
            'dry_run': dry_run,
            'start_time': datetime.now().isoformat(),
            'files_processed': 0,
            'files_migrated': 0,
            'files_failed': 0,
            'files_skipped': 0,
            'details': []
        }
        
        logger.info(f"Starting batch migration of {len(state_files)} files to v{target_version}")
        
        for filepath in state_files:
            file_result = self._migrate_file(filepath, target_version, dry_run)
            report['details'].append(file_result)
            report['files_processed'] += 1
            
            if file_result['status'] == 'migrated':
                report['files_migrated'] += 1
            elif file_result['status'] == 'failed':
                report['files_failed'] += 1
            elif file_result['status'] == 'skipped':
                report['files_skipped'] += 1
                
        report['end_time'] = datetime.now().isoformat()
        
        # Save migration report
        if not dry_run:
            report_path = directory_path / f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2)
                
            logger.info(f"Migration report saved to {report_path}")
            
        return report
        
    def _migrate_file(self, filepath: Path, target_version: str, 
                     dry_run: bool) -> Dict[str, Any]:
        """Migrate a single file"""
        result = {
            'filepath': str(filepath),
            'original_version': None,
            'target_version': target_version,
            'status': 'pending',
            'error': None,
            'backup_path': None,
            'checksum_before': None,
            'checksum_after': None
        }
        
        try:
            # Get file checksum before migration
            with open(filepath, 'rb') as f:
                result['checksum_before'] = hashlib.sha256(f.read()).hexdigest()
                
            # Get current version
            result['original_version'] = get_file_version(str(filepath))
            
            # Check if migration needed
            if result['original_version'] == target_version:
                result['status'] = 'skipped'
                result['error'] = 'Already at target version'
                return result
                
            if dry_run:
                # Just check if migration would work
                with open(filepath, 'r') as f:
                    state_data = json.load(f)
                    
                # Test migration
                migrated = self.version_manager.migrate(state_data, target_version)
                if self.version_manager.validate_migration(state_data, migrated):
                    result['status'] = 'would_migrate'
                else:
                    result['status'] = 'would_fail'
                    result['error'] = 'Validation would fail'
            else:
                # Actual migration
                # Create backup
                backup_path = self.version_manager.create_backup(str(filepath))
                result['backup_path'] = backup_path
                
                # Load and migrate
                with open(filepath, 'r') as f:
                    state_data = json.load(f)
                    
                migrated = self.version_manager.migrate(state_data, target_version)
                
                if self.version_manager.validate_migration(state_data, migrated):
                    # Save migrated data
                    with open(filepath, 'w') as f:
                        json.dump(migrated, f, indent=2)
                        
                    # Get checksum after migration
                    with open(filepath, 'rb') as f:
                        result['checksum_after'] = hashlib.sha256(f.read()).hexdigest()
                        
                    result['status'] = 'migrated'
                else:
                    # Restore from backup
                    shutil.copy2(backup_path, filepath)
                    result['status'] = 'failed'
                    result['error'] = 'Validation failed, restored from backup'
                    
        except Exception as e:
            result['status'] = 'failed'
            result['error'] = str(e)
            logger.error(f"Failed to migrate {filepath}: {e}")
            
        return result
        
    def verify_migration(self, original_file: str, migrated_file: str) -> Dict[str, Any]:
        """
        Verify migration between two files
        
        Returns:
            Verification report
        """
        report = {
            'original_file': original_file,
            'migrated_file': migrated_file,
            'verification_time': datetime.now().isoformat(),
            'checks': {},
            'is_valid': False
        }
        
        try:
            # Load both files
            with open(original_file, 'r') as f:
                original_data = json.load(f)
                
            with open(migrated_file, 'r') as f:
                migrated_data = json.load(f)
                
            # Version check
            original_version = self.version_manager.get_version(original_data)
            migrated_version = self.version_manager.get_version(migrated_data)
            
            report['checks']['version_updated'] = {
                'passed': migrated_version != original_version,
                'original': original_version,
                'migrated': migrated_version
            }
            
            # Data preservation checks
            original_config = original_data.get('interface_config', {})
            migrated_config = migrated_data.get('interface_config', {})
            
            report['checks']['config_preserved'] = {
                'passed': original_config.get('n_qubits') == migrated_config.get('n_qubits'),
                'details': 'n_qubits matches'
            }
            
            # Cache preservation
            original_cache_size = len(original_data.get('measurement_cache', []))
            migrated_cache_size = len(migrated_data.get('measurement_cache', []))
            
            report['checks']['cache_preserved'] = {
                'passed': original_cache_size == migrated_cache_size,
                'original_size': original_cache_size,
                'migrated_size': migrated_cache_size
            }
            
            # Metadata exists
            report['checks']['metadata_added'] = {
                'passed': 'metadata' in migrated_data,
                'has_timestamp': 'timestamp' in migrated_data.get('metadata', {}),
                'has_checksum': 'quantum_state_checksum' in migrated_data.get('metadata', {})
            }
            
            # Overall validation
            report['is_valid'] = all(
                check['passed'] for check in report['checks'].values()
            )
            
        except Exception as e:
            report['error'] = str(e)
            report['is_valid'] = False
            
        return report
        
    def rollback_migration(self, filepath: str, backup_path: str) -> bool:
        """
        Rollback a migration using backup
        
        Returns:
            True if successful
        """
        try:
            if not Path(backup_path).exists():
                logger.error(f"Backup not found: {backup_path}")
                return False
                
            # Verify backup is valid
            with open(backup_path, 'r') as f:
                backup_data = json.load(f)
                
            # Restore backup
            shutil.copy2(backup_path, filepath)
            logger.info(f"Rolled back {filepath} from {backup_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
            
    def clean_old_backups(self, directory: str, keep_days: int = 7) -> int:
        """
        Clean backup files older than specified days
        
        Returns:
            Number of files deleted
        """
        directory_path = Path(directory)
        if not directory_path.exists():
            return 0
            
        deleted = 0
        cutoff_time = datetime.now().timestamp() - (keep_days * 24 * 60 * 60)
        
        # Find backup files
        backup_files = list(directory_path.glob("*.backup_*"))
        
        for backup_file in backup_files:
            if backup_file.stat().st_mtime < cutoff_time:
                backup_file.unlink()
                deleted += 1
                logger.info(f"Deleted old backup: {backup_file}")
                
        return deleted
        
    def generate_migration_plan(self, directory: str) -> Dict[str, Any]:
        """
        Generate a migration plan for a directory
        
        Returns:
            Migration plan with statistics and recommendations
        """
        directory_path = Path(directory)
        state_files = list(directory_path.glob("*.json"))
        state_files = [f for f in state_files if not f.name.endswith('_temp.json')]
        
        plan = {
            'directory': str(directory_path),
            'total_files': len(state_files),
            'version_distribution': {},
            'migration_needed': 0,
            'total_size_mb': 0,
            'estimated_time_minutes': 0,
            'recommendations': []
        }
        
        for filepath in state_files:
            # Get file size
            size_mb = filepath.stat().st_size / (1024 * 1024)
            plan['total_size_mb'] += size_mb
            
            # Get version
            version = get_file_version(str(filepath))
            plan['version_distribution'][version] = plan['version_distribution'].get(version, 0) + 1
            
            if version != self.version_manager.CURRENT_VERSION:
                plan['migration_needed'] += 1
                
        # Estimate time (rough estimate: 0.1 minutes per file)
        plan['estimated_time_minutes'] = plan['migration_needed'] * 0.1
        
        # Generate recommendations
        if plan['migration_needed'] > 0:
            plan['recommendations'].append(
                f"Migrate {plan['migration_needed']} files to version {self.version_manager.CURRENT_VERSION}"
            )
            
        if plan['total_size_mb'] > 1000:
            plan['recommendations'].append(
                "Large dataset detected. Consider running migration in batches."
            )
            
        if len(plan['version_distribution']) > 2:
            plan['recommendations'].append(
                "Multiple versions detected. Consider standardizing to current version."
            )
            
        # Check for existing backups
        backup_count = len(list(directory_path.glob("*.backup_*")))
        if backup_count > 50:
            plan['recommendations'].append(
                f"Found {backup_count} backup files. Consider cleaning old backups."
            )
            
        return plan


# Command-line interface
def migrate_cli(directory: str, target_version: Optional[str] = None,
                dry_run: bool = False, verbose: bool = False):
    """Command-line interface for migration"""
    if verbose:
        logging.basicConfig(level=logging.INFO)
        
    utils = MigrationUtilities()
    
    # Generate plan first
    print("Analyzing directory...")
    plan = utils.generate_migration_plan(directory)
    
    print(f"\nMigration Plan for {directory}:")
    print(f"  Total files: {plan['total_files']}")
    print(f"  Files needing migration: {plan['migration_needed']}")
    print(f"  Total size: {plan['total_size_mb']:.2f} MB")
    print(f"  Estimated time: {plan['estimated_time_minutes']:.1f} minutes")
    
    print("\nVersion distribution:")
    for version, count in plan['version_distribution'].items():
        print(f"  v{version}: {count} files")
        
    if plan['recommendations']:
        print("\nRecommendations:")
        for rec in plan['recommendations']:
            print(f"  - {rec}")
            
    if dry_run:
        print("\n[DRY RUN MODE - No changes will be made]")
        
    # Ask for confirmation
    if not dry_run and plan['migration_needed'] > 0:
        response = input(f"\nProceed with migration of {plan['migration_needed']} files? [y/N]: ")
        if response.lower() != 'y':
            print("Migration cancelled.")
            return
            
    # Run migration
    print("\nStarting migration...")
    report = utils.batch_migrate_directory(directory, target_version, dry_run)
    
    print(f"\nMigration completed:")
    print(f"  Files processed: {report['files_processed']}")
    print(f"  Files migrated: {report['files_migrated']}")
    print(f"  Files failed: {report['files_failed']}")
    print(f"  Files skipped: {report['files_skipped']}")
    
    if report['files_failed'] > 0:
        print("\nFailed files:")
        for detail in report['details']:
            if detail['status'] == 'failed':
                print(f"  - {detail['filepath']}: {detail['error']}")


# Example usage
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python migration_utils.py <directory> [--dry-run] [--verbose]")
        sys.exit(1)
        
    directory = sys.argv[1]
    dry_run = '--dry-run' in sys.argv
    verbose = '--verbose' in sys.argv
    
    migrate_cli(directory, dry_run=dry_run, verbose=verbose)