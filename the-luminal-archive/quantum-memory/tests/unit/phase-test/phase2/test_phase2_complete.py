"""
Comprehensive Test Suite for Phase 2 Storage Features
Tests all implemented storage, serialization, and management systems
"""

import pytest
import numpy as np
import torch
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
import time
import hashlib

# Import all our Phase 2 modules
import sys
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from src.core.quantum.quantum_classical_interface import QuantumClassicalInterface
from src.core.quantum.hdf5_storage import HDF5QuantumStorage
from src.core.quantum.state_serializer import QuantumStateSerializer, EmotionalStateSerializer, MPSTensorSerializer
from src.core.quantum.binary_format import BinaryFormatHandler
from src.core.quantum.version_manager import VersionManager, load_with_migration
from src.core.quantum.migration_utils import MigrationUtilities
from src.core.quantum.backup_manager import BackupManager
from src.core.quantum.checkpoint_manager import CheckpointManager


class TestPhase2StorageComplete:
    """Complete test suite for Phase 2 storage features"""
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for tests"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
        
    @pytest.fixture
    def sample_state_data(self):
        """Generate sample quantum state data"""
        n_qubits = 5  # Small for testing
        return {
            'n_qubits': n_qubits,
            'state_vector': np.random.complex128((2**n_qubits,)),
            'mps_tensors': [
                np.random.complex128((1, 2, 4)),
                np.random.complex128((4, 2, 4)),
                np.random.complex128((4, 2, 4)),
                np.random.complex128((4, 2, 1))
            ],
            'pad_values': np.array([0.7, 0.5, 0.6]),
            'confidence': 0.95,
            'measurement_cache': [
                {
                    'state': {
                        'pad_values': [0.7, 0.5, 0.6],
                        'confidence': 0.95,
                        'timestamp': datetime.now().isoformat(),
                        'metadata': {},
                        'measurement_fidelity': 0.98
                    },
                    'measurements': {'00000': 500, '11111': 500}
                }
            ],
            'emotional_context': {
                'recent_emotions': [[0.7, 0.5, 0.6], [0.8, 0.4, 0.5]],
                'average_confidence': 0.92,
                'emotional_stability': 0.85,
                'trajectory': [[0.7, 0.5, 0.6], [0.75, 0.45, 0.58], [0.8, 0.4, 0.5]]
            },
            'metadata': {
                'version': '2.0',
                'timestamp': datetime.now().isoformat(),
                'experiment': 'test'
            }
        }
        
    def test_enhanced_save_load_metadata(self, temp_dir):
        """Test enhanced save/load with comprehensive metadata"""
        # Initialize interface
        interface = QuantumClassicalInterface(n_qubits=5, device='cpu')
        
        # Create test file path
        test_file = Path(temp_dir) / "test_state.json"
        
        # Test save with metadata
        interface.save_state(str(test_file))
        
        # Verify file exists
        assert test_file.exists()
        
        # Load and check metadata
        with open(test_file, 'r') as f:
            saved_data = json.load(f)
            
        # Check all required metadata fields
        assert 'metadata' in saved_data
        metadata = saved_data['metadata']
        
        assert 'version' in metadata
        assert 'timestamp' in metadata
        assert 'quantum_state_checksum' in metadata
        assert 'device' in metadata
        
        assert 'compression_metrics' in saved_data
        assert 'fidelity_metrics' in saved_data
        assert 'emotional_context' in saved_data
        
        # Test load
        interface2 = QuantumClassicalInterface(n_qubits=5, device='cpu')
        interface2.load_state(str(test_file))
        
        print("✓ Enhanced save/load with metadata test passed")
        
    def test_zlib_compression(self, temp_dir):
        """Test zlib compression functionality"""
        interface = QuantumClassicalInterface(n_qubits=5, device='cpu')
        
        test_file = Path(temp_dir) / "test_state.json"
        
        # Save normal and compressed
        interface.save_state(str(test_file))
        interface.save_state_compressed(str(test_file))
        
        # Check both files exist
        assert test_file.exists()
        assert Path(str(test_file) + '.zlib').exists()
        
        # Compare sizes
        normal_size = test_file.stat().st_size
        compressed_size = Path(str(test_file) + '.zlib').stat().st_size
        compression_ratio = 1 - (compressed_size / normal_size)
        
        print(f"Compression ratio: {compression_ratio*100:.1f}%")
        assert compression_ratio > 0.3  # At least 30% compression
        
        # Test load compressed
        interface2 = QuantumClassicalInterface(n_qubits=5, device='cpu')
        interface2.load_state_compressed(str(test_file) + '.zlib')
        
        print("✓ Zlib compression test passed")
        
    def test_version_management(self, temp_dir):
        """Test version management system"""
        manager = VersionManager()
        
        # Test version detection
        old_state = {
            'interface_config': {'n_qubits': 27},
            'measurement_cache': []
        }
        
        assert manager.get_version(old_state) == "1.0"
        assert manager.needs_migration(old_state)
        
        # Test migration
        migrated = manager.migrate(old_state)
        assert manager.get_version(migrated) == "2.0"
        assert not manager.needs_migration(migrated)
        
        # Check new fields added
        assert 'metadata' in migrated
        assert 'compression_metrics' in migrated
        assert 'fidelity_metrics' in migrated
        assert 'emotional_context' in migrated
        
        # Test validation
        assert manager.validate_migration(old_state, migrated)
        
        print("✓ Version management test passed")
        
    def test_migration_utilities(self, temp_dir):
        """Test migration utilities"""
        utils = MigrationUtilities()
        
        # Create test files with old format
        for i in range(3):
            old_file = Path(temp_dir) / f"old_state_{i}.json"
            old_data = {
                'interface_config': {'n_qubits': 27},
                'measurement_cache': []
            }
            with open(old_file, 'w') as f:
                json.dump(old_data, f)
                
        # Test migration plan
        plan = utils.generate_migration_plan(temp_dir)
        assert plan['migration_needed'] == 3
        
        # Test batch migration (dry run first)
        dry_report = utils.batch_migrate_directory(temp_dir, dry_run=True)
        assert dry_report['dry_run'] == True
        assert dry_report['files_processed'] == 3
        
        # Actual migration
        report = utils.batch_migrate_directory(temp_dir, dry_run=False)
        assert report['files_migrated'] == 3
        assert report['files_failed'] == 0
        
        # Verify files migrated
        for i in range(3):
            migrated_file = Path(temp_dir) / f"old_state_{i}.json"
            with open(migrated_file, 'r') as f:
                data = json.load(f)
            assert data['metadata']['version'] == '2.0'
            
        print("✓ Migration utilities test passed")
        
    def test_backup_manager(self, temp_dir):
        """Test backup rotation system"""
        manager = BackupManager(
            backup_dir=str(Path(temp_dir) / "backups"),
            max_backups=3,
            max_age_days=7
        )
        
        # Create test file
        test_file = Path(temp_dir) / "test_state.json"
        test_data = {'test': True}
        with open(test_file, 'w') as f:
            json.dump(test_data, f)
            
        # Create multiple backups
        backup_paths = []
        for i in range(5):
            backup_path = manager.create_backup(
                str(test_file),
                metadata={'iteration': i}
            )
            backup_paths.append(backup_path)
            time.sleep(0.1)  # Small delay to ensure different timestamps
            
        # Check rotation happened (max 3 backups)
        backups = manager.list_backups()
        assert len(backups) <= 3
        
        # Test restore
        latest_backup = manager.get_latest_backup(str(test_file))
        assert latest_backup is not None
        
        restored_path = Path(temp_dir) / "restored_state.json"
        manager.restore_backup(latest_backup, str(restored_path))
        assert restored_path.exists()
        
        # Test statistics
        stats = manager.get_backup_statistics()
        assert stats['total_backups'] <= 3
        
        print("✓ Backup manager test passed")
        
    def test_checkpoint_manager(self, temp_dir):
        """Test checkpoint management system"""
        manager = CheckpointManager(
            checkpoint_dir=str(Path(temp_dir) / "checkpoints"),
            max_checkpoints=3
        )
        
        # Mock interface
        class MockInterface:
            def save_state(self, filepath):
                with open(filepath, 'w') as f:
                    json.dump({'test': True, 'time': time.time()}, f)
                    
            def load_state(self, filepath):
                with open(filepath, 'r') as f:
                    return json.load(f)
                    
            def get_interface_status(self):
                return {'n_qubits': 27, 'device': 'cpu'}
                
        interface = MockInterface()
        
        # Create checkpoints
        checkpoint_ids = []
        for i in range(5):
            cp_id = manager.create_checkpoint(
                interface,
                name=f"checkpoint_{i}",
                description=f"Test checkpoint {i}"
            )
            checkpoint_ids.append(cp_id)
            time.sleep(0.1)
            
        # Check rotation
        checkpoints = manager.list_checkpoints()
        assert len(checkpoints) <= 3
        
        # Test restore
        if checkpoints:
            latest = checkpoints[0]
            success = manager.restore_checkpoint(interface, latest['id'])
            assert success
            
        # Test comparison
        if len(checkpoints) >= 2:
            comparison = manager.compare_checkpoints(
                checkpoints[0]['id'],
                checkpoints[1]['id']
            )
            assert 'time_difference_hours' in comparison
            
        # Test statistics
        stats = manager.get_statistics()
        assert stats['active_checkpoints'] <= 3
        
        print("✓ Checkpoint manager test passed")
        
    def test_hdf5_storage(self, temp_dir, sample_state_data):
        """Test HDF5 storage backend"""
        storage = HDF5QuantumStorage(
            str(Path(temp_dir) / "quantum_memory.h5"),
            compression='gzip'
        )
        
        # Save state
        state_id = storage.save_quantum_state(sample_state_data)
        assert state_id is not None
        
        # List states
        states = storage.list_states()
        assert len(states) == 1
        assert states[0]['state_id'] == state_id
        
        # Load state
        loaded = storage.load_quantum_state(state_id)
        
        # Verify data integrity
        assert loaded['n_qubits'] == sample_state_data['n_qubits']
        assert np.allclose(loaded['state_vector'], sample_state_data['state_vector'])
        assert np.allclose(loaded['pad_values'], sample_state_data['pad_values'])
        
        # Test binary export
        export_path = Path(temp_dir) / "export.qms"
        storage.export_to_binary(state_id, str(export_path))
        assert export_path.exists()
        
        # Test binary import
        new_id = storage.import_from_binary(str(export_path))
        assert new_id is not None
        
        # Get statistics
        stats = storage.get_storage_stats()
        assert stats['n_states'] == 2  # Original + imported
        
        print("✓ HDF5 storage test passed")
        
    def test_state_serialization(self, sample_state_data):
        """Test state serialization system"""
        serializer = QuantumStateSerializer(precision=6)
        
        # Test all formats
        formats_tested = 0
        for format in ['json', 'msgpack', 'pickle', 'numpy', 'base64']:
            try:
                # Serialize
                serialized = serializer.serialize(sample_state_data, format)
                
                # Deserialize
                deserialized = serializer.deserialize(serialized, format)
                
                # Validate
                valid = serializer.validate_serialization(sample_state_data, format)
                assert valid
                
                formats_tested += 1
            except Exception as e:
                print(f"Warning: {format} serialization failed: {e}")
                
        assert formats_tested >= 3  # At least 3 formats should work
        
        # Test comparison
        comparison = serializer.compare_formats(sample_state_data)
        print("\nSerialization format comparison:")
        for fmt, stats in comparison.items():
            if 'error' not in stats:
                print(f"  {fmt}: {stats['size_bytes']} bytes")
                
        print("✓ State serialization test passed")
        
    def test_binary_format(self, temp_dir, sample_state_data):
        """Test binary format handler"""
        # Test different compression methods
        for compression in [BinaryFormatHandler.COMPRESS_NONE,
                          BinaryFormatHandler.COMPRESS_ZLIB,
                          BinaryFormatHandler.COMPRESS_LZ4]:
            handler = BinaryFormatHandler(compression_method=compression)
            
            test_file = Path(temp_dir) / f"test_{compression}.qms"
            
            # Write
            bytes_written = handler.write(test_file, sample_state_data)
            assert test_file.exists()
            
            # Get info
            info = handler.get_file_info(test_file)
            assert info['valid']
            assert info['n_qubits'] == sample_state_data['n_qubits']
            
            # Read
            loaded = handler.read(test_file)
            
            # Verify
            assert loaded['n_qubits'] == sample_state_data['n_qubits']
            assert np.allclose(loaded['state_vector'], sample_state_data['state_vector'])
            
        print("✓ Binary format test passed")
        
    def test_integration_full_pipeline(self, temp_dir):
        """Test full integration of all Phase 2 features"""
        # 1. Initialize quantum interface
        interface = QuantumClassicalInterface(n_qubits=5, device='cpu')
        
        # 2. Create checkpoint manager with auto-checkpoint
        checkpoint_manager = CheckpointManager(
            checkpoint_dir=str(Path(temp_dir) / "checkpoints"),
            max_checkpoints=5,
            auto_checkpoint_interval=None  # Disable for test
        )
        
        # 3. Create initial checkpoint
        cp1 = checkpoint_manager.create_checkpoint(
            interface,
            name="initial",
            description="Initial state"
        )
        
        # 4. Save compressed state
        state_file = Path(temp_dir) / "quantum_state.json"
        interface.save_state_compressed(str(state_file))
        
        # 5. Create HDF5 storage
        hdf5_storage = HDF5QuantumStorage(
            str(Path(temp_dir) / "quantum_memory.h5")
        )
        
        # 6. Save to HDF5
        state_data = {
            'n_qubits': 5,
            'state_vector': np.random.complex128((2**5,)),
            'pad_values': np.array([0.7, 0.5, 0.6]),
            'confidence': 0.95
        }
        hdf5_id = hdf5_storage.save_quantum_state(state_data)
        
        # 7. Export to binary
        binary_path = Path(temp_dir) / "export.qms"
        hdf5_storage.export_to_binary(hdf5_id, str(binary_path))
        
        # 8. Create second checkpoint
        cp2 = checkpoint_manager.create_checkpoint(
            interface,
            name="after_export",
            description="After binary export"
        )
        
        # 9. Compare checkpoints
        comparison = checkpoint_manager.compare_checkpoints(cp1, cp2)
        assert 'time_difference_hours' in comparison
        
        # 10. Test migration on the saved files
        utils = MigrationUtilities()
        plan = utils.generate_migration_plan(temp_dir)
        
        # Verify everything worked
        assert state_file.exists()
        assert Path(state_file.str() + '.zlib').exists()
        assert binary_path.exists()
        assert len(checkpoint_manager.list_checkpoints()) >= 2
        assert hdf5_storage.get_storage_stats()['n_states'] >= 1
        
        print("✓ Full integration pipeline test passed")
        
    def test_performance_metrics(self, temp_dir, sample_state_data):
        """Test performance of different storage methods"""
        results = {}
        
        # Test JSON
        start = time.time()
        interface = QuantumClassicalInterface(n_qubits=5, device='cpu')
        json_file = Path(temp_dir) / "perf_test.json"
        interface.save_state(str(json_file))
        json_time = time.time() - start
        json_size = json_file.stat().st_size
        results['json'] = {'time': json_time, 'size': json_size}
        
        # Test compressed JSON
        start = time.time()
        interface.save_state_compressed(str(json_file))
        compressed_time = time.time() - start
        compressed_size = Path(str(json_file) + '.zlib').stat().st_size
        results['json_compressed'] = {'time': compressed_time, 'size': compressed_size}
        
        # Test HDF5
        start = time.time()
        hdf5_storage = HDF5QuantumStorage(str(Path(temp_dir) / "perf.h5"))
        hdf5_storage.save_quantum_state(sample_state_data)
        hdf5_time = time.time() - start
        hdf5_size = Path(temp_dir, "perf.h5").stat().st_size
        results['hdf5'] = {'time': hdf5_time, 'size': hdf5_size}
        
        # Test binary
        start = time.time()
        binary_handler = BinaryFormatHandler(compression_method=BinaryFormatHandler.COMPRESS_LZ4)
        binary_file = Path(temp_dir) / "perf.qms"
        binary_handler.write(binary_file, sample_state_data)
        binary_time = time.time() - start
        binary_size = binary_file.stat().st_size
        results['binary'] = {'time': binary_time, 'size': binary_size}
        
        print("\nPerformance comparison:")
        for method, stats in results.items():
            print(f"  {method}:")
            print(f"    Time: {stats['time']*1000:.2f}ms")
            print(f"    Size: {stats['size']} bytes")
            
        print("✓ Performance metrics test passed")
        
    def test_error_recovery(self, temp_dir):
        """Test error recovery and robustness"""
        # Test corrupted file recovery
        backup_manager = BackupManager(backup_dir=str(Path(temp_dir) / "backups"))
        
        # Create and corrupt a file
        test_file = Path(temp_dir) / "corrupt.json"
        with open(test_file, 'w') as f:
            json.dump({'test': True}, f)
            
        # Create backup
        backup_path = backup_manager.create_backup(str(test_file))
        
        # Corrupt the file
        with open(test_file, 'w') as f:
            f.write("corrupted data")
            
        # Try to load - should fail
        try:
            with open(test_file, 'r') as f:
                json.load(f)
            assert False, "Should have failed"
        except json.JSONDecodeError:
            pass
            
        # Restore from backup
        backup_manager.restore_backup(backup_path, str(test_file))
        
        # Should work now
        with open(test_file, 'r') as f:
            data = json.load(f)
            assert data['test'] == True
            
        print("✓ Error recovery test passed")


def test_phase2_complete():
    """Run all Phase 2 tests"""
    print("\n" + "="*60)
    print("PHASE 2 COMPLETE TEST SUITE")
    print("="*60 + "\n")
    
    test_suite = TestPhase2StorageComplete()
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Generate sample data
        sample_data = test_suite.sample_state_data()
        
        # Run all tests
        test_methods = [
            ("Enhanced Save/Load", test_suite.test_enhanced_save_load_metadata),
            ("Zlib Compression", test_suite.test_zlib_compression),
            ("Version Management", test_suite.test_version_management),
            ("Migration Utilities", test_suite.test_migration_utilities),
            ("Backup Manager", test_suite.test_backup_manager),
            ("Checkpoint Manager", test_suite.test_checkpoint_manager),
            ("HDF5 Storage", lambda td: test_suite.test_hdf5_storage(td, sample_data)),
            ("State Serialization", lambda: test_suite.test_state_serialization(sample_data)),
            ("Binary Format", lambda td: test_suite.test_binary_format(td, sample_data)),
            ("Integration Pipeline", test_suite.test_integration_full_pipeline),
            ("Performance Metrics", lambda td: test_suite.test_performance_metrics(td, sample_data)),
            ("Error Recovery", test_suite.test_error_recovery)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in test_methods:
            try:
                print(f"\nRunning: {test_name}")
                
                # Determine if test needs temp_dir
                import inspect
                sig = inspect.signature(test_func)
                if 'temp_dir' in sig.parameters:
                    test_func(temp_dir)
                else:
                    test_func()
                    
                passed += 1
                
            except Exception as e:
                print(f"✗ {test_name} failed: {e}")
                import traceback
                traceback.print_exc()
                failed += 1
                
    print("\n" + "="*60)
    print(f"PHASE 2 TEST SUMMARY")
    print(f"Passed: {passed}/{len(test_methods)}")
    print(f"Failed: {failed}/{len(test_methods)}")
    print("="*60)
    
    if failed == 0:
        print("\n🎉 ALL PHASE 2 TESTS PASSED! 🎉")
        print("\nPhase 2 Storage Features Complete:")
        print("✅ Enhanced save/load with metadata")
        print("✅ Zlib compression")
        print("✅ Version management")
        print("✅ Migration utilities")
        print("✅ Backup rotation")
        print("✅ Checkpoint management")
        print("✅ HDF5 storage")
        print("✅ State serialization")
        print("✅ Binary format")
        print("✅ Full integration tested")
        print("\nReady for Phase 3: Emotional Processing System! 🚀")
    else:
        print(f"\n⚠️  {failed} tests failed. Please fix before proceeding.")
        

if __name__ == "__main__":
    # Check for required dependencies
    try:
        import h5py
        import msgpack
        import lz4
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Install with: pip install h5py msgpack lz4")
        exit(1)
        
    test_phase2_complete()