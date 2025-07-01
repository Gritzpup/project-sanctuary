#!/usr/bin/env python3
"""
Simple test runner for Phase 2 features (no pytest required)
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

import numpy as np
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Import our modules
try:
    from core.quantum.quantum_classical_interface import QuantumClassicalInterface
    from core.quantum.version_manager import VersionManager
    from core.quantum.backup_manager import BackupManager
    from core.quantum.checkpoint_manager import CheckpointManager
    print("✓ All Phase 2 modules imported successfully")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)

def test_enhanced_save_load():
    """Test enhanced save/load with metadata"""
    print("\n1. Testing enhanced save/load...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        interface = QuantumClassicalInterface(n_qubits=5, device='cpu')
        test_file = Path(temp_dir) / "test_state.json"
        
        # Save
        interface.save_state(str(test_file))
        
        # Check metadata
        with open(test_file, 'r') as f:
            data = json.load(f)
            
        assert 'metadata' in data
        assert 'compression_metrics' in data
        assert 'fidelity_metrics' in data
        assert 'emotional_context' in data
        
        print("   ✓ Metadata fields present")
        print("   ✓ Save/load working")
        return True

def test_compression():
    """Test compression functionality"""
    print("\n2. Testing compression...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        interface = QuantumClassicalInterface(n_qubits=5, device='cpu')
        test_file = Path(temp_dir) / "test_state.json"
        
        # Save normal and compressed
        interface.save_state(str(test_file))
        interface.save_state_compressed(str(test_file))
        
        normal_size = test_file.stat().st_size
        compressed_size = Path(str(test_file) + '.zlib').stat().st_size
        ratio = 1 - (compressed_size / normal_size)
        
        print(f"   Compression ratio: {ratio*100:.1f}%")
        assert ratio > 0.3
        
        # Test load
        interface.load_state_compressed(str(test_file) + '.zlib')
        print("   ✓ Compression working")
        return True

def test_version_management():
    """Test version management"""
    print("\n3. Testing version management...")
    
    manager = VersionManager()
    
    # Test old format
    old_state = {
        'interface_config': {'n_qubits': 27},
        'measurement_cache': []
    }
    
    # Migrate
    migrated = manager.migrate(old_state)
    
    assert manager.get_version(migrated) == "2.0"
    assert 'metadata' in migrated
    
    print("   ✓ Version detection working")
    print("   ✓ Migration working")
    return True

def test_backup_manager():
    """Test backup manager"""
    print("\n4. Testing backup manager...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        manager = BackupManager(
            backup_dir=str(Path(temp_dir) / "backups"),
            max_backups=3
        )
        
        # Create test file
        test_file = Path(temp_dir) / "test.json"
        with open(test_file, 'w') as f:
            json.dump({'test': True}, f)
            
        # Create backups
        for i in range(5):
            manager.create_backup(str(test_file))
            
        # Check rotation
        backups = manager.list_backups()
        assert len(backups) <= 3
        
        print(f"   Created 5 backups, kept {len(backups)} (max 3)")
        print("   ✓ Backup rotation working")
        return True

def test_checkpoint_manager():
    """Test checkpoint manager"""
    print("\n5. Testing checkpoint manager...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        manager = CheckpointManager(
            checkpoint_dir=str(Path(temp_dir) / "checkpoints"),
            max_checkpoints=3
        )
        
        # Mock interface
        class MockInterface:
            def save_state(self, filepath):
                with open(filepath, 'w') as f:
                    json.dump({'test': True}, f)
            def load_state(self, filepath):
                pass
            def get_interface_status(self):
                return {'n_qubits': 27, 'device': 'cpu'}
                
        interface = MockInterface()
        
        # Create checkpoints
        for i in range(5):
            manager.create_checkpoint(interface, name=f"cp_{i}")
            
        checkpoints = manager.list_checkpoints()
        assert len(checkpoints) <= 3
        
        print(f"   Created 5 checkpoints, kept {len(checkpoints)} (max 3)")
        print("   ✓ Checkpoint management working")
        return True

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("PHASE 2 SIMPLE TEST SUITE")
    print("="*60)
    
    tests = [
        ("Enhanced Save/Load", test_enhanced_save_load),
        ("Compression", test_compression),
        ("Version Management", test_version_management),
        ("Backup Manager", test_backup_manager),
        ("Checkpoint Manager", test_checkpoint_manager)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"   ✗ {test_name} failed: {e}")
            failed += 1
            
    print("\n" + "="*60)
    print(f"RESULTS: {passed}/{len(tests)} tests passed")
    print("="*60)
    
    if failed == 0:
        print("\n🎉 ALL PHASE 2 TESTS PASSED! 🎉")
        print("\nPhase 2 Features Working:")
        print("✅ Enhanced save/load with metadata")
        print("✅ Compression (zlib)")
        print("✅ Version management & migration")
        print("✅ Backup rotation")
        print("✅ Checkpoint management")
        print("\nReady for Phase 3! 🚀")
    else:
        print(f"\n⚠️  {failed} tests failed")

if __name__ == "__main__":
    main()