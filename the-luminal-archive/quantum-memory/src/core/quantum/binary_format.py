"""
Binary Format Handler for Quantum Memory System
Provides efficient binary I/O with minimal overhead
"""

import struct
import numpy as np
import torch
import zlib
import lz4.frame
import logging
import json
from typing import Dict, Any, Union, Optional, BinaryIO, Tuple
from datetime import datetime
from pathlib import Path
import io

logger = logging.getLogger(__name__)


class BinaryFormatHandler:
    """
    Handles efficient binary format for quantum states
    
    Format Specification:
    - Magic number: 4 bytes ('QMS\x01')
    - Header size: 4 bytes (uint32)
    - Header: Variable (JSON metadata)
    - Data sections: Multiple sections with:
        - Section ID: 4 bytes
        - Section size: 8 bytes (uint64)
        - Section data: Variable
    """
    
    # Magic number and version
    MAGIC = b'QMS\x01'  # Quantum Memory State v1
    
    # Section identifiers
    SECTION_STATE_VECTOR = b'SVEC'
    SECTION_MPS_TENSORS = b'MPST'
    SECTION_CLASSICAL = b'CLAS'
    SECTION_EMOTIONAL = b'EMOT'
    SECTION_METADATA = b'META'
    
    # Compression methods
    COMPRESS_NONE = 0
    COMPRESS_ZLIB = 1
    COMPRESS_LZ4 = 2
    
    def __init__(self, compression_method: int = COMPRESS_LZ4,
                 compression_level: int = 1):
        """
        Initialize binary format handler
        
        Args:
            compression_method: Compression method to use
            compression_level: Compression level (1-9 for zlib, 1-16 for lz4)
        """
        self.compression_method = compression_method
        self.compression_level = compression_level
        
    def write(self, file_path: Union[str, Path, BinaryIO], 
              state_data: Dict[str, Any]) -> int:
        """
        Write quantum state to binary format
        
        Args:
            file_path: Output file path or file object
            state_data: State data to write
            
        Returns:
            Total bytes written
        """
        if isinstance(file_path, (str, Path)):
            with open(file_path, 'wb') as f:
                return self._write_to_file(f, state_data)
        else:
            return self._write_to_file(file_path, state_data)
            
    def read(self, file_path: Union[str, Path, BinaryIO]) -> Dict[str, Any]:
        """
        Read quantum state from binary format
        
        Args:
            file_path: Input file path or file object
            
        Returns:
            State data dictionary
        """
        if isinstance(file_path, (str, Path)):
            with open(file_path, 'rb') as f:
                return self._read_from_file(f)
        else:
            return self._read_from_file(file_path)
            
    def _write_to_file(self, f: BinaryIO, state_data: Dict[str, Any]) -> int:
        """Write state data to file object"""
        bytes_written = 0
        
        # Write magic number
        f.write(self.MAGIC)
        bytes_written += len(self.MAGIC)
        
        # Prepare header
        header = {
            'version': '1.0',
            'timestamp': datetime.now().isoformat(),
            'compression': self.compression_method,
            'n_qubits': state_data.get('n_qubits', 27),
            'sections': []
        }
        
        # Write placeholder for header size
        header_size_pos = f.tell()
        f.write(struct.pack('<I', 0))
        bytes_written += 4
        
        # Write sections
        sections_start = f.tell()
        
        # State vector section
        if 'state_vector' in state_data:
            section_info = self._write_state_vector_section(f, state_data['state_vector'])
            header['sections'].append(section_info)
            bytes_written += section_info['size']
            
        # MPS tensors section
        if 'mps_tensors' in state_data:
            section_info = self._write_mps_section(f, state_data['mps_tensors'])
            header['sections'].append(section_info)
            bytes_written += section_info['size']
            
        # Classical data section
        classical_data = {
            'pad_values': state_data.get('pad_values'),
            'confidence': state_data.get('confidence'),
            'measurement_cache': state_data.get('measurement_cache')
        }
        if any(v is not None for v in classical_data.values()):
            section_info = self._write_classical_section(f, classical_data)
            header['sections'].append(section_info)
            bytes_written += section_info['size']
            
        # Emotional context section
        if 'emotional_context' in state_data:
            section_info = self._write_emotional_section(f, state_data['emotional_context'])
            header['sections'].append(section_info)
            bytes_written += section_info['size']
            
        # Metadata section
        if 'metadata' in state_data:
            section_info = self._write_metadata_section(f, state_data['metadata'])
            header['sections'].append(section_info)
            bytes_written += section_info['size']
            
        # Write header at the beginning
        current_pos = f.tell()
        f.seek(header_size_pos)
        
        header_bytes = json.dumps(header).encode('utf-8')
        f.write(struct.pack('<I', len(header_bytes)))
        f.write(header_bytes)
        bytes_written += len(header_bytes)
        
        # Seek back to end
        f.seek(current_pos)
        
        logger.info(f"Wrote {bytes_written} bytes in binary format")
        return bytes_written
        
    def _read_from_file(self, f: BinaryIO) -> Dict[str, Any]:
        """Read state data from file object"""
        # Read and verify magic number
        magic = f.read(len(self.MAGIC))
        if magic != self.MAGIC:
            raise ValueError(f"Invalid magic number: {magic}")
            
        # Read header
        header_size = struct.unpack('<I', f.read(4))[0]
        header_bytes = f.read(header_size)
        header = json.loads(header_bytes.decode('utf-8'))
        
        # Read sections
        state_data = {
            'n_qubits': header.get('n_qubits', 27),
            'format_version': header.get('version'),
            'timestamp': header.get('timestamp')
        }
        
        for section_info in header['sections']:
            section_id = section_info['id'].encode('utf-8')
            
            if section_id == self.SECTION_STATE_VECTOR:
                state_data['state_vector'] = self._read_state_vector_section(f, section_info)
            elif section_id == self.SECTION_MPS_TENSORS:
                state_data['mps_tensors'] = self._read_mps_section(f, section_info)
            elif section_id == self.SECTION_CLASSICAL:
                classical_data = self._read_classical_section(f, section_info)
                state_data.update(classical_data)
            elif section_id == self.SECTION_EMOTIONAL:
                state_data['emotional_context'] = self._read_emotional_section(f, section_info)
            elif section_id == self.SECTION_METADATA:
                state_data['metadata'] = self._read_metadata_section(f, section_info)
            else:
                # Skip unknown section
                f.seek(section_info['size'], 1)
                logger.warning(f"Skipped unknown section: {section_id}")
                
        return state_data
        
    def _write_state_vector_section(self, f: BinaryIO, state_vector: Union[np.ndarray, torch.Tensor]) -> Dict[str, Any]:
        """Write state vector section"""
        start_pos = f.tell()
        
        # Write section ID
        f.write(self.SECTION_STATE_VECTOR)
        
        # Convert to numpy if needed
        if isinstance(state_vector, torch.Tensor):
            state_vector = state_vector.cpu().numpy()
            
        # Prepare data
        dtype_str = str(state_vector.dtype)
        shape = state_vector.shape
        data_bytes = state_vector.tobytes()
        
        # Compress if enabled
        if self.compression_method != self.COMPRESS_NONE:
            data_bytes = self._compress(data_bytes)
            
        # Write section size
        section_size = 4 + 4 + len(shape) * 4 + len(dtype_str) + len(data_bytes)
        f.write(struct.pack('<Q', section_size))
        
        # Write metadata
        f.write(struct.pack('<I', len(dtype_str)))
        f.write(dtype_str.encode('utf-8'))
        f.write(struct.pack('<I', len(shape)))
        for dim in shape:
            f.write(struct.pack('<I', dim))
            
        # Write data
        f.write(data_bytes)
        
        return {
            'id': self.SECTION_STATE_VECTOR.decode('utf-8'),
            'offset': start_pos,
            'size': f.tell() - start_pos,
            'compressed': self.compression_method != self.COMPRESS_NONE,
            'dtype': dtype_str,
            'shape': list(shape)
        }
        
    def _read_state_vector_section(self, f: BinaryIO, section_info: Dict[str, Any]) -> np.ndarray:
        """Read state vector section"""
        # Read section ID
        section_id = f.read(4)
        
        # Read section size
        section_size = struct.unpack('<Q', f.read(8))[0]
        
        # Read metadata
        dtype_len = struct.unpack('<I', f.read(4))[0]
        dtype_str = f.read(dtype_len).decode('utf-8')
        
        shape_len = struct.unpack('<I', f.read(4))[0]
        shape = []
        for _ in range(shape_len):
            shape.append(struct.unpack('<I', f.read(4))[0])
            
        # Read data
        metadata_size = 4 + dtype_len + 4 + shape_len * 4
        data_size = section_size - metadata_size
        data_bytes = f.read(data_size)
        
        # Decompress if needed
        if section_info.get('compressed', False):
            data_bytes = self._decompress(data_bytes)
            
        # Reconstruct array
        dtype = getattr(np, dtype_str.split('.')[-1])
        array = np.frombuffer(data_bytes, dtype=dtype).reshape(shape)
        
        return array
        
    def _write_mps_section(self, f: BinaryIO, mps_tensors: list) -> Dict[str, Any]:
        """Write MPS tensors section"""
        start_pos = f.tell()
        
        # Write section ID
        f.write(self.SECTION_MPS_TENSORS)
        
        # Prepare all tensor data
        tensor_data = []
        for tensor in mps_tensors:
            if isinstance(tensor, torch.Tensor):
                tensor = tensor.cpu().numpy()
                
            tensor_bytes = tensor.tobytes()
            if self.compression_method != self.COMPRESS_NONE:
                tensor_bytes = self._compress(tensor_bytes)
                
            tensor_data.append({
                'dtype': str(tensor.dtype),
                'shape': tensor.shape,
                'data': tensor_bytes
            })
            
        # Calculate total size
        total_size = 4  # Number of tensors
        for td in tensor_data:
            total_size += 4 + len(td['dtype'])  # dtype
            total_size += 4 + 4 * len(td['shape'])  # shape
            total_size += 8 + len(td['data'])  # data
            
        # Write section size
        f.write(struct.pack('<Q', total_size))
        
        # Write number of tensors
        f.write(struct.pack('<I', len(tensor_data)))
        
        # Write each tensor
        for td in tensor_data:
            # Dtype
            f.write(struct.pack('<I', len(td['dtype'])))
            f.write(td['dtype'].encode('utf-8'))
            
            # Shape
            f.write(struct.pack('<I', len(td['shape'])))
            for dim in td['shape']:
                f.write(struct.pack('<I', dim))
                
            # Data
            f.write(struct.pack('<Q', len(td['data'])))
            f.write(td['data'])
            
        return {
            'id': self.SECTION_MPS_TENSORS.decode('utf-8'),
            'offset': start_pos,
            'size': f.tell() - start_pos,
            'compressed': self.compression_method != self.COMPRESS_NONE,
            'n_tensors': len(mps_tensors)
        }
        
    def _read_mps_section(self, f: BinaryIO, section_info: Dict[str, Any]) -> list:
        """Read MPS tensors section"""
        # Read section ID and size
        section_id = f.read(4)
        section_size = struct.unpack('<Q', f.read(8))[0]
        
        # Read number of tensors
        n_tensors = struct.unpack('<I', f.read(4))[0]
        
        tensors = []
        for _ in range(n_tensors):
            # Read dtype
            dtype_len = struct.unpack('<I', f.read(4))[0]
            dtype_str = f.read(dtype_len).decode('utf-8')
            
            # Read shape
            shape_len = struct.unpack('<I', f.read(4))[0]
            shape = []
            for _ in range(shape_len):
                shape.append(struct.unpack('<I', f.read(4))[0])
                
            # Read data
            data_len = struct.unpack('<Q', f.read(8))[0]
            data_bytes = f.read(data_len)
            
            # Decompress if needed
            if section_info.get('compressed', False):
                data_bytes = self._decompress(data_bytes)
                
            # Reconstruct tensor
            dtype = getattr(np, dtype_str.split('.')[-1])
            tensor = np.frombuffer(data_bytes, dtype=dtype).reshape(shape)
            tensors.append(tensor)
            
        return tensors
        
    def _write_classical_section(self, f: BinaryIO, classical_data: Dict[str, Any]) -> Dict[str, Any]:
        """Write classical data section"""
        import json
        
        start_pos = f.tell()
        f.write(self.SECTION_CLASSICAL)
        
        # Convert to JSON for simplicity
        json_bytes = json.dumps(classical_data, cls=NumpyJSONEncoder).encode('utf-8')
        
        if self.compression_method != self.COMPRESS_NONE:
            json_bytes = self._compress(json_bytes)
            
        f.write(struct.pack('<Q', len(json_bytes)))
        f.write(json_bytes)
        
        return {
            'id': self.SECTION_CLASSICAL.decode('utf-8'),
            'offset': start_pos,
            'size': f.tell() - start_pos,
            'compressed': self.compression_method != self.COMPRESS_NONE
        }
        
    def _read_classical_section(self, f: BinaryIO, section_info: Dict[str, Any]) -> Dict[str, Any]:
        """Read classical data section"""
        import json
        
        section_id = f.read(4)
        data_size = struct.unpack('<Q', f.read(8))[0]
        json_bytes = f.read(data_size)
        
        if section_info.get('compressed', False):
            json_bytes = self._decompress(json_bytes)
            
        data = json.loads(json_bytes.decode('utf-8'))
        
        # Convert lists back to numpy arrays where appropriate
        if 'pad_values' in data and data['pad_values'] is not None:
            data['pad_values'] = np.array(data['pad_values'])
            
        return data
        
    def _write_emotional_section(self, f: BinaryIO, emotional_data: Dict[str, Any]) -> Dict[str, Any]:
        """Write emotional context section"""
        import json
        
        start_pos = f.tell()
        f.write(self.SECTION_EMOTIONAL)
        
        # Convert to JSON
        json_bytes = json.dumps(emotional_data, cls=NumpyJSONEncoder).encode('utf-8')
        
        if self.compression_method != self.COMPRESS_NONE:
            json_bytes = self._compress(json_bytes)
            
        f.write(struct.pack('<Q', len(json_bytes)))
        f.write(json_bytes)
        
        return {
            'id': self.SECTION_EMOTIONAL.decode('utf-8'),
            'offset': start_pos,
            'size': f.tell() - start_pos,
            'compressed': self.compression_method != self.COMPRESS_NONE
        }
        
    def _read_emotional_section(self, f: BinaryIO, section_info: Dict[str, Any]) -> Dict[str, Any]:
        """Read emotional context section"""
        import json
        
        section_id = f.read(4)
        data_size = struct.unpack('<Q', f.read(8))[0]
        json_bytes = f.read(data_size)
        
        if section_info.get('compressed', False):
            json_bytes = self._decompress(json_bytes)
            
        return json.loads(json_bytes.decode('utf-8'))
        
    def _write_metadata_section(self, f: BinaryIO, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Write metadata section"""
        import json
        
        start_pos = f.tell()
        f.write(self.SECTION_METADATA)
        
        json_bytes = json.dumps(metadata).encode('utf-8')
        
        if self.compression_method != self.COMPRESS_NONE:
            json_bytes = self._compress(json_bytes)
            
        f.write(struct.pack('<Q', len(json_bytes)))
        f.write(json_bytes)
        
        return {
            'id': self.SECTION_METADATA.decode('utf-8'),
            'offset': start_pos,
            'size': f.tell() - start_pos,
            'compressed': self.compression_method != self.COMPRESS_NONE
        }
        
    def _read_metadata_section(self, f: BinaryIO, section_info: Dict[str, Any]) -> Dict[str, Any]:
        """Read metadata section"""
        import json
        
        section_id = f.read(4)
        data_size = struct.unpack('<Q', f.read(8))[0]
        json_bytes = f.read(data_size)
        
        if section_info.get('compressed', False):
            json_bytes = self._decompress(json_bytes)
            
        return json.loads(json_bytes.decode('utf-8'))
        
    def _compress(self, data: bytes) -> bytes:
        """Compress data using configured method"""
        if self.compression_method == self.COMPRESS_ZLIB:
            return zlib.compress(data, level=self.compression_level)
        elif self.compression_method == self.COMPRESS_LZ4:
            return lz4.frame.compress(data, compression_level=self.compression_level)
        else:
            return data
            
    def _decompress(self, data: bytes) -> bytes:
        """Decompress data based on header info"""
        if self.compression_method == self.COMPRESS_ZLIB:
            return zlib.decompress(data)
        elif self.compression_method == self.COMPRESS_LZ4:
            return lz4.frame.decompress(data)
        else:
            return data
            
    def get_file_info(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """Get information about a binary file without fully loading it"""
        file_path = Path(file_path)
        info = {
            'file_path': str(file_path),
            'file_size': file_path.stat().st_size,
            'valid': False
        }
        
        try:
            with open(file_path, 'rb') as f:
                # Check magic
                magic = f.read(len(self.MAGIC))
                if magic != self.MAGIC:
                    info['error'] = 'Invalid magic number'
                    return info
                    
                # Read header
                header_size = struct.unpack('<I', f.read(4))[0]
                header_bytes = f.read(header_size)
                header = json.loads(header_bytes.decode('utf-8'))
                
                info['valid'] = True
                info['version'] = header.get('version')
                info['timestamp'] = header.get('timestamp')
                info['n_qubits'] = header.get('n_qubits')
                info['compression'] = header.get('compression')
                info['sections'] = [s['id'] for s in header.get('sections', [])]
                
        except Exception as e:
            info['error'] = str(e)
            
        return info


class NumpyJSONEncoder(json.JSONEncoder):
    """JSON encoder that handles numpy types"""
    
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.complexfloating):
            return {'real': float(obj.real), 'imag': float(obj.imag)}
        return super().default(obj)


# Performance testing utilities
def benchmark_binary_format():
    """Benchmark different compression methods"""
    import time
    
    # Generate test data
    n_qubits = 10
    state_data = {
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
        'emotional_context': {
            'recent_emotions': [[0.7, 0.5, 0.6], [0.8, 0.4, 0.5]],
            'stability': 0.85
        }
    }
    
    results = {}
    
    for compression in [BinaryFormatHandler.COMPRESS_NONE,
                       BinaryFormatHandler.COMPRESS_ZLIB,
                       BinaryFormatHandler.COMPRESS_LZ4]:
        handler = BinaryFormatHandler(compression_method=compression)
        
        # Test write
        start = time.time()
        bytes_written = handler.write('test.qms', state_data)
        write_time = time.time() - start
        
        # Test read
        start = time.time()
        loaded_data = handler.read('test.qms')
        read_time = time.time() - start
        
        # Get file size
        file_size = Path('test.qms').stat().st_size
        
        compression_name = ['none', 'zlib', 'lz4'][compression]
        results[compression_name] = {
            'write_time': write_time,
            'read_time': read_time,
            'file_size': file_size,
            'compression_ratio': 1 - (file_size / bytes_written) if compression else 1.0
        }
        
        # Clean up
        Path('test.qms').unlink()
        
    return results


# Example usage
if __name__ == "__main__":
    import json
    
    # Test binary format
    handler = BinaryFormatHandler(compression_method=BinaryFormatHandler.COMPRESS_LZ4)
    
    # Create test data
    test_data = {
        'n_qubits': 5,
        'state_vector': np.random.complex128((2**5,)),
        'pad_values': np.array([0.7, 0.5, 0.6]),
        'confidence': 0.95,
        'metadata': {
            'experiment': 'test',
            'timestamp': datetime.now().isoformat()
        }
    }
    
    # Write
    bytes_written = handler.write('test_state.qms', test_data)
    print(f"Wrote {bytes_written} bytes")
    
    # Get file info
    info = handler.get_file_info('test_state.qms')
    print(f"\nFile info:")
    print(json.dumps(info, indent=2))
    
    # Read
    loaded_data = handler.read('test_state.qms')
    print(f"\nLoaded data keys: {list(loaded_data.keys())}")
    
    # Verify
    print(f"\nVerification:")
    print(f"  State vector shape: {loaded_data['state_vector'].shape}")
    print(f"  PAD values: {loaded_data['pad_values']}")
    print(f"  n_qubits match: {test_data['n_qubits'] == loaded_data['n_qubits']}")
    
    # Benchmark
    print(f"\nBenchmarking compression methods...")
    results = benchmark_binary_format()
    
    print("\nBenchmark results:")
    for method, stats in results.items():
        print(f"\n{method}:")
        print(f"  Write time: {stats['write_time']:.4f}s")
        print(f"  Read time: {stats['read_time']:.4f}s")
        print(f"  File size: {stats['file_size']} bytes")
        print(f"  Compression: {stats['compression_ratio']*100:.1f}%")
        
    # Clean up
    Path('test_state.qms').unlink()