"""
State Serialization/Deserialization System
Handles conversion between quantum states and storage formats
"""

import numpy as np
import torch
import json
import pickle
import base64
import logging
from typing import Any, Dict, List, Union, Optional, Tuple
from datetime import datetime
from pathlib import Path
import io
import msgpack

logger = logging.getLogger(__name__)


class QuantumStateSerializer:
    """Handles serialization and deserialization of quantum states"""
    
    # Supported formats
    FORMATS = {
        'json': 'JSON format (human-readable)',
        'msgpack': 'MessagePack format (efficient binary)',
        'pickle': 'Python pickle format (full object support)',
        'numpy': 'NumPy native format',
        'base64': 'Base64 encoded format (for transport)'
    }
    
    def __init__(self, precision: int = 8):
        """
        Initialize serializer
        
        Args:
            precision: Decimal precision for floating point (JSON only)
        """
        self.precision = precision
        
    def serialize(self, state_data: Dict[str, Any], format: str = 'json') -> bytes:
        """
        Serialize quantum state data
        
        Args:
            state_data: State data to serialize
            format: Serialization format
            
        Returns:
            Serialized bytes
        """
        if format not in self.FORMATS:
            raise ValueError(f"Unsupported format: {format}")
            
        # Pre-process data
        processed_data = self._preprocess_for_serialization(state_data)
        
        if format == 'json':
            return self._serialize_json(processed_data)
        elif format == 'msgpack':
            return self._serialize_msgpack(processed_data)
        elif format == 'pickle':
            return self._serialize_pickle(processed_data)
        elif format == 'numpy':
            return self._serialize_numpy(processed_data)
        elif format == 'base64':
            return self._serialize_base64(processed_data)
            
    def deserialize(self, data: bytes, format: str = 'json') -> Dict[str, Any]:
        """
        Deserialize quantum state data
        
        Args:
            data: Serialized data
            format: Serialization format
            
        Returns:
            Deserialized state data
        """
        if format not in self.FORMATS:
            raise ValueError(f"Unsupported format: {format}")
            
        if format == 'json':
            deserialized = self._deserialize_json(data)
        elif format == 'msgpack':
            deserialized = self._deserialize_msgpack(data)
        elif format == 'pickle':
            deserialized = self._deserialize_pickle(data)
        elif format == 'numpy':
            deserialized = self._deserialize_numpy(data)
        elif format == 'base64':
            deserialized = self._deserialize_base64(data)
            
        # Post-process data
        return self._postprocess_after_deserialization(deserialized)
        
    def _preprocess_for_serialization(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Pre-process data for serialization"""
        processed = {}
        
        for key, value in data.items():
            if isinstance(value, (np.ndarray, torch.Tensor)):
                # Convert tensors to serializable format
                processed[key] = self._tensor_to_dict(value)
            elif isinstance(value, dict):
                # Recursively process nested dicts
                processed[key] = self._preprocess_for_serialization(value)
            elif isinstance(value, list):
                # Process lists
                processed[key] = [
                    self._tensor_to_dict(item) if isinstance(item, (np.ndarray, torch.Tensor))
                    else item
                    for item in value
                ]
            elif isinstance(value, datetime):
                # Convert datetime to ISO format
                processed[key] = value.isoformat()
            elif isinstance(value, Path):
                # Convert Path to string
                processed[key] = str(value)
            else:
                processed[key] = value
                
        return processed
        
    def _postprocess_after_deserialization(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process data after deserialization"""
        processed = {}
        
        for key, value in data.items():
            if isinstance(value, dict):
                if '_tensor_type' in value:
                    # Reconstruct tensor
                    processed[key] = self._dict_to_tensor(value)
                else:
                    # Recursively process nested dicts
                    processed[key] = self._postprocess_after_deserialization(value)
            elif isinstance(value, list):
                # Process lists
                processed[key] = [
                    self._dict_to_tensor(item) if isinstance(item, dict) and '_tensor_type' in item
                    else item
                    for item in value
                ]
            else:
                processed[key] = value
                
        return processed
        
    def _tensor_to_dict(self, tensor: Union[np.ndarray, torch.Tensor]) -> Dict[str, Any]:
        """Convert tensor to dictionary representation"""
        if isinstance(tensor, torch.Tensor):
            return {
                '_tensor_type': 'torch',
                'data': tensor.cpu().numpy().tolist(),
                'dtype': str(tensor.dtype),
                'shape': list(tensor.shape),
                'device': str(tensor.device),
                'requires_grad': tensor.requires_grad
            }
        else:  # numpy array
            return {
                '_tensor_type': 'numpy',
                'data': tensor.tolist(),
                'dtype': str(tensor.dtype),
                'shape': list(tensor.shape)
            }
            
    def _dict_to_tensor(self, tensor_dict: Dict[str, Any]) -> Union[np.ndarray, torch.Tensor]:
        """Convert dictionary representation back to tensor"""
        tensor_type = tensor_dict['_tensor_type']
        
        if tensor_type == 'torch':
            # Reconstruct torch tensor
            data = np.array(tensor_dict['data'])
            
            # Map dtype string to torch dtype
            dtype_map = {
                'torch.float32': torch.float32,
                'torch.float64': torch.float64,
                'torch.complex64': torch.complex64,
                'torch.complex128': torch.complex128,
                'torch.int32': torch.int32,
                'torch.int64': torch.int64
            }
            
            dtype = dtype_map.get(tensor_dict['dtype'], torch.float32)
            tensor = torch.tensor(data, dtype=dtype)
            
            # Move to device if not CPU
            device = tensor_dict.get('device', 'cpu')
            if device != 'cpu' and torch.cuda.is_available():
                tensor = tensor.to(device)
                
            tensor.requires_grad = tensor_dict.get('requires_grad', False)
            return tensor
            
        else:  # numpy
            data = np.array(tensor_dict['data'])
            
            # Map dtype string to numpy dtype
            dtype_str = tensor_dict['dtype']
            if 'complex' in dtype_str:
                if '64' in dtype_str:
                    dtype = np.complex64
                else:
                    dtype = np.complex128
            elif 'float' in dtype_str:
                if '32' in dtype_str:
                    dtype = np.float32
                else:
                    dtype = np.float64
            elif 'int' in dtype_str:
                if '32' in dtype_str:
                    dtype = np.int32
                else:
                    dtype = np.int64
            else:
                dtype = np.float64
                
            return data.astype(dtype)
            
    def _serialize_json(self, data: Dict[str, Any]) -> bytes:
        """Serialize to JSON format"""
        class NumpyEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                elif isinstance(obj, np.floating):
                    return round(float(obj), self.precision)
                elif isinstance(obj, np.ndarray):
                    return obj.tolist()
                elif isinstance(obj, complex):
                    return {'real': obj.real, 'imag': obj.imag}
                return super().default(obj)
                
        encoder = NumpyEncoder(ensure_ascii=False, indent=2)
        encoder.precision = self.precision
        return encoder.encode(data).encode('utf-8')
        
    def _deserialize_json(self, data: bytes) -> Dict[str, Any]:
        """Deserialize from JSON format"""
        def complex_hook(dct):
            if 'real' in dct and 'imag' in dct and len(dct) == 2:
                return complex(dct['real'], dct['imag'])
            return dct
            
        return json.loads(data.decode('utf-8'), object_hook=complex_hook)
        
    def _serialize_msgpack(self, data: Dict[str, Any]) -> bytes:
        """Serialize to MessagePack format"""
        return msgpack.packb(data, use_bin_type=True)
        
    def _deserialize_msgpack(self, data: bytes) -> Dict[str, Any]:
        """Deserialize from MessagePack format"""
        return msgpack.unpackb(data, raw=False)
        
    def _serialize_pickle(self, data: Dict[str, Any]) -> bytes:
        """Serialize to pickle format"""
        return pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
        
    def _deserialize_pickle(self, data: bytes) -> Dict[str, Any]:
        """Deserialize from pickle format"""
        return pickle.loads(data)
        
    def _serialize_numpy(self, data: Dict[str, Any]) -> bytes:
        """Serialize to NumPy format"""
        buffer = io.BytesIO()
        np.savez_compressed(buffer, **data)
        return buffer.getvalue()
        
    def _deserialize_numpy(self, data: bytes) -> Dict[str, Any]:
        """Deserialize from NumPy format"""
        buffer = io.BytesIO(data)
        loaded = np.load(buffer, allow_pickle=True)
        return dict(loaded)
        
    def _serialize_base64(self, data: Dict[str, Any]) -> bytes:
        """Serialize to base64 format"""
        # First serialize to msgpack for efficiency
        msgpack_data = self._serialize_msgpack(data)
        return base64.b64encode(msgpack_data)
        
    def _deserialize_base64(self, data: bytes) -> Dict[str, Any]:
        """Deserialize from base64 format"""
        msgpack_data = base64.b64decode(data)
        return self._deserialize_msgpack(msgpack_data)
        
    def validate_serialization(self, state_data: Dict[str, Any], format: str = 'json') -> bool:
        """
        Validate that data can be serialized and deserialized without loss
        
        Returns:
            True if validation passes
        """
        try:
            # Serialize
            serialized = self.serialize(state_data, format)
            
            # Deserialize
            deserialized = self.deserialize(serialized, format)
            
            # Compare key structures
            if set(state_data.keys()) != set(deserialized.keys()):
                logger.error("Key mismatch after serialization")
                return False
                
            # Validate tensors
            for key in state_data:
                original = state_data[key]
                restored = deserialized[key]
                
                if isinstance(original, (np.ndarray, torch.Tensor)):
                    if not self._tensors_equal(original, restored):
                        logger.error(f"Tensor mismatch for key: {key}")
                        return False
                        
            return True
            
        except Exception as e:
            logger.error(f"Serialization validation failed: {e}")
            return False
            
    def _tensors_equal(self, tensor1: Union[np.ndarray, torch.Tensor], 
                      tensor2: Union[np.ndarray, torch.Tensor], 
                      tolerance: float = 1e-6) -> bool:
        """Check if two tensors are equal within tolerance"""
        # Convert to numpy for comparison
        if isinstance(tensor1, torch.Tensor):
            arr1 = tensor1.cpu().numpy()
        else:
            arr1 = tensor1
            
        if isinstance(tensor2, torch.Tensor):
            arr2 = tensor2.cpu().numpy()
        else:
            arr2 = tensor2
            
        return np.allclose(arr1, arr2, rtol=tolerance, atol=tolerance)
        
    def get_serialized_size(self, state_data: Dict[str, Any], format: str = 'json') -> int:
        """Get size in bytes after serialization"""
        serialized = self.serialize(state_data, format)
        return len(serialized)
        
    def compare_formats(self, state_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Compare different serialization formats"""
        results = {}
        
        for format in self.FORMATS:
            try:
                start_time = datetime.now()
                serialized = self.serialize(state_data, format)
                serialize_time = (datetime.now() - start_time).total_seconds()
                
                start_time = datetime.now()
                deserialized = self.deserialize(serialized, format)
                deserialize_time = (datetime.now() - start_time).total_seconds()
                
                results[format] = {
                    'size_bytes': len(serialized),
                    'serialize_time': serialize_time,
                    'deserialize_time': deserialize_time,
                    'valid': self.validate_serialization(state_data, format)
                }
                
            except Exception as e:
                results[format] = {
                    'error': str(e),
                    'valid': False
                }
                
        return results


# Specialized serializers for specific data types
class EmotionalStateSerializer:
    """Serializer for emotional state data"""
    
    @staticmethod
    def serialize(emotional_data: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize emotional state"""
        return {
            'pad_values': emotional_data.get('pad_values', [0, 0, 0]),
            'confidence': float(emotional_data.get('confidence', 0)),
            'timestamp': emotional_data.get('timestamp', datetime.now()).isoformat(),
            'trajectory': emotional_data.get('trajectory', []),
            'stability': float(emotional_data.get('stability', 0))
        }
        
    @staticmethod
    def deserialize(data: Dict[str, Any]) -> Dict[str, Any]:
        """Deserialize emotional state"""
        return {
            'pad_values': np.array(data.get('pad_values', [0, 0, 0])),
            'confidence': data.get('confidence', 0),
            'timestamp': datetime.fromisoformat(data.get('timestamp')),
            'trajectory': np.array(data.get('trajectory', [])),
            'stability': data.get('stability', 0)
        }


class MPSTensorSerializer:
    """Serializer for MPS tensor data"""
    
    @staticmethod
    def serialize(mps_tensors: List[Union[np.ndarray, torch.Tensor]]) -> List[Dict[str, Any]]:
        """Serialize MPS tensors"""
        serialized = []
        
        for i, tensor in enumerate(mps_tensors):
            if isinstance(tensor, torch.Tensor):
                tensor_data = tensor.cpu().numpy()
            else:
                tensor_data = tensor
                
            serialized.append({
                'index': i,
                'shape': list(tensor_data.shape),
                'data': tensor_data.tolist(),
                'dtype': str(tensor_data.dtype)
            })
            
        return serialized
        
    @staticmethod
    def deserialize(data: List[Dict[str, Any]]) -> List[np.ndarray]:
        """Deserialize MPS tensors"""
        tensors = []
        
        for tensor_dict in sorted(data, key=lambda x: x['index']):
            tensor_data = np.array(tensor_dict['data'])
            
            # Determine dtype
            if 'complex' in tensor_dict['dtype']:
                tensor_data = tensor_data.astype(np.complex128)
            else:
                tensor_data = tensor_data.astype(np.float64)
                
            tensors.append(tensor_data)
            
        return tensors


# Example usage
if __name__ == "__main__":
    # Test serializer
    serializer = QuantumStateSerializer(precision=6)
    
    # Create test data
    test_data = {
        'state_vector': np.random.complex128((2**5,)),
        'pad_values': np.array([0.7, 0.5, 0.6]),
        'timestamp': datetime.now(),
        'metadata': {
            'n_qubits': 5,
            'device': 'cuda:0'
        },
        'mps_tensors': [
            np.random.complex128((1, 2, 4)),
            np.random.complex128((4, 2, 4)),
            np.random.complex128((4, 2, 1))
        ]
    }
    
    # Test different formats
    print("Testing serialization formats...")
    results = serializer.compare_formats(test_data)
    
    print("\nFormat comparison:")
    for format, stats in results.items():
        if 'error' not in stats:
            print(f"\n{format}:")
            print(f"  Size: {stats['size_bytes']} bytes")
            print(f"  Serialize time: {stats['serialize_time']:.4f}s")
            print(f"  Deserialize time: {stats['deserialize_time']:.4f}s")
            print(f"  Valid: {stats['valid']}")
        else:
            print(f"\n{format}: ERROR - {stats['error']}")
            
    # Test validation
    print("\nValidation test:")
    for format in ['json', 'msgpack', 'pickle']:
        valid = serializer.validate_serialization(test_data, format)
        print(f"  {format}: {'✓' if valid else '✗'}")