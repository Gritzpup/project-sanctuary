"""
HDF5 Storage Backend for Quantum Memory System
Provides efficient binary storage with hierarchical organization
"""

import h5py
import numpy as np
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any, Union, Tuple
import hashlib
import zlib

logger = logging.getLogger(__name__)


class HDF5QuantumStorage:
    """
    HDF5-based storage for quantum states with the following schema:
    
    /quantum_states/
        /{timestamp}/
            /metadata
                - version: str
                - n_qubits: int
                - timestamp: str
                - checksum: str
                - compression: str
            /quantum_data/
                /state_vector: complex128[]
                /mps_tensors/
                    /tensor_0: complex128[...]
                    /tensor_1: complex128[...]
                    ...
            /classical_data/
                /pad_values: float64[3]
                /confidence: float64
                /measurement_cache: JSON string
            /emotional_context/
                /recent_emotions: float64[N, 3]
                /stability: float64
                /trajectory: float64[M, 3]
    """
    
    def __init__(self, storage_path: str, compression: str = 'gzip',
                 compression_level: int = 6):
        """
        Initialize HDF5 storage
        
        Args:
            storage_path: Path to HDF5 file
            compression: Compression type ('gzip', 'lzf', 'szip', or None)
            compression_level: Compression level (1-9 for gzip)
        """
        self.storage_path = Path(storage_path)
        self.compression = compression
        self.compression_level = compression_level
        
        # Ensure directory exists
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize file if it doesn't exist
        if not self.storage_path.exists():
            self._initialize_file()
            
    def _initialize_file(self):
        """Initialize HDF5 file with base structure"""
        with h5py.File(self.storage_path, 'w') as f:
            # Create base groups
            f.create_group('quantum_states')
            f.create_group('checkpoints')
            f.create_group('index')
            
            # Add file metadata
            f.attrs['schema_version'] = '1.0'
            f.attrs['created'] = datetime.now().isoformat()
            f.attrs['description'] = 'Quantum Memory Storage'
            
        logger.info(f"Initialized HDF5 storage at {self.storage_path}")
        
    def save_quantum_state(self, state_data: Dict[str, Any], 
                          state_id: Optional[str] = None) -> str:
        """
        Save quantum state to HDF5
        
        Args:
            state_data: Dictionary containing quantum state data
            state_id: Optional ID (auto-generated if not provided)
            
        Returns:
            State ID
        """
        if state_id is None:
            state_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            
        with h5py.File(self.storage_path, 'a') as f:
            # Create state group
            state_group = f.create_group(f'quantum_states/{state_id}')
            
            # Save metadata
            metadata_group = state_group.create_group('metadata')
            metadata_group.attrs['version'] = state_data.get('version', '2.0')
            metadata_group.attrs['n_qubits'] = state_data.get('n_qubits', 27)
            metadata_group.attrs['timestamp'] = datetime.now().isoformat()
            metadata_group.attrs['compression'] = self.compression or 'none'
            
            # Save quantum data
            quantum_group = state_group.create_group('quantum_data')
            
            # State vector
            if 'state_vector' in state_data:
                state_vector = np.array(state_data['state_vector'], dtype=np.complex128)
                
                # Calculate checksum before saving
                checksum = hashlib.sha256(state_vector.tobytes()).hexdigest()
                metadata_group.attrs['checksum'] = checksum
                
                # Save with compression
                if self.compression:
                    quantum_group.create_dataset(
                        'state_vector',
                        data=state_vector,
                        compression=self.compression,
                        compression_opts=self.compression_level if self.compression == 'gzip' else None
                    )
                else:
                    quantum_group.create_dataset('state_vector', data=state_vector)
                    
            # MPS tensors
            if 'mps_tensors' in state_data:
                mps_group = quantum_group.create_group('mps_tensors')
                for i, tensor in enumerate(state_data['mps_tensors']):
                    tensor_data = np.array(tensor, dtype=np.complex128)
                    
                    if self.compression:
                        mps_group.create_dataset(
                            f'tensor_{i}',
                            data=tensor_data,
                            compression=self.compression,
                            compression_opts=self.compression_level if self.compression == 'gzip' else None
                        )
                    else:
                        mps_group.create_dataset(f'tensor_{i}', data=tensor_data)
                        
                mps_group.attrs['n_tensors'] = len(state_data['mps_tensors'])
                mps_group.attrs['bond_dimension'] = state_data.get('bond_dimension', 64)
                
            # Save classical data
            classical_group = state_group.create_group('classical_data')
            
            if 'pad_values' in state_data:
                classical_group.create_dataset(
                    'pad_values',
                    data=np.array(state_data['pad_values'], dtype=np.float64)
                )
                
            if 'confidence' in state_data:
                classical_group.attrs['confidence'] = float(state_data['confidence'])
                
            if 'measurement_cache' in state_data:
                # Store complex data as JSON
                cache_json = json.dumps(state_data['measurement_cache'])
                classical_group.create_dataset(
                    'measurement_cache',
                    data=np.string_(cache_json)
                )
                
            # Save emotional context
            if 'emotional_context' in state_data:
                emotional_group = state_group.create_group('emotional_context')
                emotional_data = state_data['emotional_context']
                
                if 'recent_emotions' in emotional_data:
                    emotions_array = np.array(emotional_data['recent_emotions'], dtype=np.float64)
                    emotional_group.create_dataset('recent_emotions', data=emotions_array)
                    
                if 'stability' in emotional_data:
                    emotional_group.attrs['stability'] = float(emotional_data['stability'])
                    
                if 'trajectory' in emotional_data:
                    trajectory_array = np.array(emotional_data['trajectory'], dtype=np.float64)
                    emotional_group.create_dataset('trajectory', data=trajectory_array)
                    
            # Update index
            self._update_index(f, state_id)
            
        logger.info(f"Saved quantum state: {state_id}")
        return state_id
        
    def load_quantum_state(self, state_id: str) -> Dict[str, Any]:
        """
        Load quantum state from HDF5
        
        Args:
            state_id: State ID to load
            
        Returns:
            State data dictionary
        """
        state_data = {}
        
        with h5py.File(self.storage_path, 'r') as f:
            state_path = f'quantum_states/{state_id}'
            
            if state_path not in f:
                raise KeyError(f"State not found: {state_id}")
                
            state_group = f[state_path]
            
            # Load metadata
            metadata = dict(state_group['metadata'].attrs)
            state_data['metadata'] = metadata
            state_data['version'] = metadata.get('version', '2.0')
            state_data['n_qubits'] = int(metadata.get('n_qubits', 27))
            
            # Load quantum data
            quantum_group = state_group['quantum_data']
            
            if 'state_vector' in quantum_group:
                state_data['state_vector'] = quantum_group['state_vector'][:]
                
                # Verify checksum
                if 'checksum' in metadata:
                    calculated_checksum = hashlib.sha256(
                        state_data['state_vector'].tobytes()
                    ).hexdigest()
                    
                    if calculated_checksum != metadata['checksum']:
                        logger.warning(f"Checksum mismatch for state {state_id}")
                        
            # Load MPS tensors
            if 'mps_tensors' in quantum_group:
                mps_group = quantum_group['mps_tensors']
                n_tensors = int(mps_group.attrs.get('n_tensors', 0))
                
                state_data['mps_tensors'] = []
                for i in range(n_tensors):
                    tensor_name = f'tensor_{i}'
                    if tensor_name in mps_group:
                        state_data['mps_tensors'].append(mps_group[tensor_name][:])
                        
                state_data['bond_dimension'] = int(mps_group.attrs.get('bond_dimension', 64))
                
            # Load classical data
            if 'classical_data' in state_group:
                classical_group = state_group['classical_data']
                
                if 'pad_values' in classical_group:
                    state_data['pad_values'] = classical_group['pad_values'][:]
                    
                if 'confidence' in classical_group.attrs:
                    state_data['confidence'] = float(classical_group.attrs['confidence'])
                    
                if 'measurement_cache' in classical_group:
                    cache_json = classical_group['measurement_cache'][()].decode('utf-8')
                    state_data['measurement_cache'] = json.loads(cache_json)
                    
            # Load emotional context
            if 'emotional_context' in state_group:
                emotional_group = state_group['emotional_context']
                emotional_data = {}
                
                if 'recent_emotions' in emotional_group:
                    emotional_data['recent_emotions'] = emotional_group['recent_emotions'][:]
                    
                if 'stability' in emotional_group.attrs:
                    emotional_data['stability'] = float(emotional_group.attrs['stability'])
                    
                if 'trajectory' in emotional_group:
                    emotional_data['trajectory'] = emotional_group['trajectory'][:]
                    
                state_data['emotional_context'] = emotional_data
                
        logger.info(f"Loaded quantum state: {state_id}")
        return state_data
        
    def _update_index(self, f: h5py.File, state_id: str):
        """Update state index for fast lookup"""
        index_group = f['index']
        
        # Add to chronological index
        if 'chronological' not in index_group:
            index_group.create_dataset(
                'chronological',
                data=np.array([state_id], dtype='S64'),
                maxshape=(None,),
                chunks=True
            )
        else:
            # Append to existing
            chrono_index = index_group['chronological']
            chrono_index.resize((chrono_index.shape[0] + 1,))
            chrono_index[-1] = state_id.encode('utf-8')
            
        # Update latest pointer
        index_group.attrs['latest'] = state_id
        index_group.attrs['count'] = len(index_group['chronological'])
        
    def list_states(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """List available quantum states"""
        states = []
        
        with h5py.File(self.storage_path, 'r') as f:
            if 'quantum_states' not in f:
                return states
                
            quantum_states = f['quantum_states']
            
            # Get state IDs
            state_ids = list(quantum_states.keys())
            
            # Sort by timestamp (newest first)
            state_ids.sort(reverse=True)
            
            if limit:
                state_ids = state_ids[:limit]
                
            for state_id in state_ids:
                state_group = quantum_states[state_id]
                metadata = dict(state_group['metadata'].attrs)
                
                state_info = {
                    'state_id': state_id,
                    'timestamp': metadata.get('timestamp'),
                    'version': metadata.get('version'),
                    'n_qubits': metadata.get('n_qubits'),
                    'has_state_vector': 'state_vector' in state_group.get('quantum_data', {}),
                    'has_mps': 'mps_tensors' in state_group.get('quantum_data', {}),
                    'compression': metadata.get('compression', 'none')
                }
                
                states.append(state_info)
                
        return states
        
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        stats = {
            'file_path': str(self.storage_path),
            'file_size_mb': 0,
            'n_states': 0,
            'compression': self.compression,
            'states_by_version': {}
        }
        
        if self.storage_path.exists():
            stats['file_size_mb'] = self.storage_path.stat().st_size / (1024 * 1024)
            
            with h5py.File(self.storage_path, 'r') as f:
                if 'index' in f:
                    stats['n_states'] = int(f['index'].attrs.get('count', 0))
                    
                if 'quantum_states' in f:
                    # Count states by version
                    for state_id in f['quantum_states']:
                        version = f[f'quantum_states/{state_id}/metadata'].attrs.get('version', 'unknown')
                        stats['states_by_version'][version] = stats['states_by_version'].get(version, 0) + 1
                        
        return stats
        
    def export_to_binary(self, state_id: str, output_path: str):
        """Export quantum state to efficient binary format"""
        state_data = self.load_quantum_state(state_id)
        
        # Create binary format
        with open(output_path, 'wb') as f:
            # Write header
            header = {
                'format': 'QMS_BINARY_v1',
                'state_id': state_id,
                'timestamp': datetime.now().isoformat(),
                'n_qubits': state_data.get('n_qubits', 27)
            }
            
            header_bytes = json.dumps(header).encode('utf-8')
            f.write(len(header_bytes).to_bytes(4, 'little'))
            f.write(header_bytes)
            
            # Write state vector if present
            if 'state_vector' in state_data:
                state_vector = state_data['state_vector']
                
                # Compress if large
                if state_vector.nbytes > 1024 * 1024:  # 1MB
                    compressed = zlib.compress(state_vector.tobytes(), level=9)
                    f.write(b'COMP')  # Compression marker
                    f.write(len(compressed).to_bytes(8, 'little'))
                    f.write(compressed)
                else:
                    f.write(b'RAW ')  # Raw marker
                    f.write(state_vector.nbytes.to_bytes(8, 'little'))
                    f.write(state_vector.tobytes())
                    
            # Write metadata
            metadata_bytes = json.dumps(state_data.get('metadata', {})).encode('utf-8')
            f.write(len(metadata_bytes).to_bytes(4, 'little'))
            f.write(metadata_bytes)
            
        logger.info(f"Exported state {state_id} to {output_path}")
        
    def import_from_binary(self, binary_path: str) -> str:
        """Import quantum state from binary format"""
        with open(binary_path, 'rb') as f:
            # Read header
            header_length = int.from_bytes(f.read(4), 'little')
            header = json.loads(f.read(header_length).decode('utf-8'))
            
            if header.get('format') != 'QMS_BINARY_v1':
                raise ValueError(f"Unknown format: {header.get('format')}")
                
            state_data = {
                'n_qubits': header['n_qubits'],
                'version': '2.0'
            }
            
            # Read state vector
            marker = f.read(4)
            if marker in [b'COMP', b'RAW ']:
                size = int.from_bytes(f.read(8), 'little')
                data = f.read(size)
                
                if marker == b'COMP':
                    data = zlib.decompress(data)
                    
                state_vector = np.frombuffer(data, dtype=np.complex128)
                state_data['state_vector'] = state_vector
                
            # Read metadata
            metadata_length = int.from_bytes(f.read(4), 'little')
            metadata = json.loads(f.read(metadata_length).decode('utf-8'))
            state_data['metadata'] = metadata
            
        # Save to HDF5
        state_id = header.get('state_id', datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
        return self.save_quantum_state(state_data, state_id)
        
    def optimize_storage(self):
        """Optimize HDF5 file by repacking"""
        temp_path = self.storage_path.with_suffix('.tmp')
        
        # Copy with optimization
        with h5py.File(self.storage_path, 'r') as src:
            with h5py.File(temp_path, 'w') as dst:
                # Copy with better chunking
                src.copy('/', dst, expand_soft=True, expand_external=True)
                
        # Replace original
        import shutil
        shutil.move(temp_path, self.storage_path)
        
        logger.info("Optimized HDF5 storage")


# Example usage
if __name__ == "__main__":
    # Test HDF5 storage
    storage = HDF5QuantumStorage("./test_quantum.h5", compression='gzip')
    
    # Create test data
    test_state = {
        'n_qubits': 27,
        'state_vector': np.random.complex128((2**10,)),  # 10 qubits for testing
        'pad_values': np.array([0.7, 0.5, 0.6]),
        'confidence': 0.95,
        'emotional_context': {
            'recent_emotions': np.random.rand(10, 3),
            'stability': 0.8
        }
    }
    
    # Save state
    state_id = storage.save_quantum_state(test_state)
    print(f"Saved state: {state_id}")
    
    # List states
    print("\nAvailable states:")
    for state in storage.list_states():
        print(f"  - {state['state_id']} (v{state['version']})")
        
    # Get stats
    print("\nStorage statistics:")
    stats = storage.get_storage_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
        
    # Clean up
    Path("./test_quantum.h5").unlink()