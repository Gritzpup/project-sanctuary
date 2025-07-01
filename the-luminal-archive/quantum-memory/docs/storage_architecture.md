# Quantum Memory Storage Architecture

## Overview

The Quantum Memory System uses a multi-layered storage architecture optimized for quantum state persistence, with support for compression, versioning, and efficient retrieval.

## Storage Formats

### 1. JSON Format (Human-Readable)
Primary format for configuration and metadata storage.

**File Extensions:**
- `.json` - Uncompressed JSON
- `.json.zlib` - Compressed JSON

**Structure:**
```json
{
  "metadata": {
    "version": "2.0",
    "timestamp": "2025-06-30T12:34:56.789Z",
    "quantum_state_checksum": "sha256_hash",
    "compression_metrics": {...}
  },
  "interface_config": {...},
  "measurement_cache": [...],
  "emotional_context": {...}
}
```

### 2. HDF5 Format (Binary, Hierarchical)
Efficient storage for large quantum states and tensor data.

**File Extension:** `.h5`

**Schema:**
```
/quantum_states/
    /{state_id}/
        /metadata/
            - version: str
            - n_qubits: int
            - timestamp: str
            - checksum: str
            - compression: str
        /quantum_data/
            /state_vector: complex128[2^n]
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
/checkpoints/
    /{checkpoint_id}/
        - Similar structure to quantum_states
/index/
    /chronological: string array of state IDs
    - latest: str (most recent state ID)
    - count: int
```

### 3. Binary Format (Optimized)
Custom binary format for fast I/O and network transfer.

**File Extension:** `.qms` (Quantum Memory State)

**Format Specification:**
```
[Header Length: 4 bytes]
[Header JSON: variable]
[Compression Marker: 4 bytes] ('COMP' or 'RAW ')
[Data Length: 8 bytes]
[State Vector Data: variable]
[Metadata Length: 4 bytes]
[Metadata JSON: variable]
```

### 4. NumPy Format
For quantum state vectors and tensor networks.

**File Extensions:**
- `.npz` - Compressed NumPy archive
- `.npy` - Single NumPy array

## Directory Structure

```
project-sanctuary/
├── .checkpoints/           # Checkpoint storage
│   ├── checkpoint_registry.json
│   ├── {checkpoint_id}.json
│   └── backups/           # Checkpoint backups
├── .backups/              # Automatic backup rotation
│   ├── backup_metadata.json
│   └── {backup_id}.json.zlib
├── quantum_states/        # HDF5 storage
│   └── quantum_memory.h5
├── exports/              # Exported states
│   ├── {export_id}.qms
│   └── {export_id}_metadata.json
└── cache/               # Temporary storage
    └── mps_contractions/
```

## Compression Strategy

### 1. Classical Data (JSON)
- **Algorithm:** zlib level 9
- **Target:** 60-80% compression ratio
- **Applied to:** Metadata, configuration, measurement cache

### 2. Quantum State Vectors
- **Algorithm:** gzip in HDF5
- **Target:** 68% compression (as per requirements)
- **Chunking:** Adaptive based on state size

### 3. MPS Tensors
- **Strategy:** Bond dimension optimization
- **Compression:** Per-tensor in HDF5
- **Sparsity:** Exploit low-rank structure

## Version Management

### Version History
- **1.0:** Initial format (basic JSON)
- **2.0:** Added metadata, compression, checksums

### Migration Path
```
v1.0 → v2.0:
  - Add metadata wrapper
  - Calculate checksums
  - Extract emotional context
  - Update file structure
```

## Performance Considerations

### 1. Read Performance
- **HDF5:** ~1-10ms for single state load
- **Binary:** ~0.5-5ms for optimized format
- **JSON:** ~5-50ms depending on size

### 2. Write Performance
- **Async writes:** Non-blocking save operations
- **Batch updates:** Group multiple states
- **Compression:** Background thread for large states

### 3. Memory Usage
- **Streaming:** Large states loaded in chunks
- **Caching:** LRU cache for recent states
- **Cleanup:** Automatic temporary file removal

## Security & Integrity

### 1. Checksums
- **Algorithm:** SHA256
- **Coverage:** State vectors, metadata
- **Verification:** On load and periodic checks

### 2. Backup Strategy
- **Frequency:** Before each write
- **Rotation:** Keep last 10 backups
- **Compression:** All backups compressed

### 3. Recovery
- **Levels:**
  1. Primary file
  2. Local backup
  3. Checkpoint history
  4. Export archives

## API Usage Examples

### Saving States
```python
# JSON format
interface.save_state("quantum_state.json")
interface.save_state_compressed("quantum_state.json")

# HDF5 format
storage = HDF5QuantumStorage("quantum_memory.h5")
state_id = storage.save_quantum_state(state_data)

# Binary export
storage.export_to_binary(state_id, "export.qms")
```

### Loading States
```python
# With automatic migration
interface.load_state("quantum_state.json")

# From HDF5
state_data = storage.load_quantum_state(state_id)

# From binary
new_id = storage.import_from_binary("export.qms")
```

### Checkpointing
```python
checkpoint_manager = CheckpointManager()
cp_id = checkpoint_manager.create_checkpoint(interface, "experiment_start")
checkpoint_manager.restore_checkpoint(interface, cp_id)
```

## Best Practices

1. **Regular Checkpoints:** Create checkpoints before major operations
2. **Compression:** Enable for production, disable for debugging
3. **Cleanup:** Run storage optimization monthly
4. **Exports:** Create portable exports for sharing
5. **Monitoring:** Track storage growth and performance

## Troubleshooting

### Common Issues

1. **"Checksum mismatch"**
   - Cause: Data corruption
   - Solution: Restore from backup

2. **"State not found"**
   - Cause: Missing file or wrong ID
   - Solution: Check index, list available states

3. **"Compression failed"**
   - Cause: Insufficient memory
   - Solution: Reduce compression level or disable

### Recovery Procedures

1. **Corrupted HDF5:**
   ```bash
   h5recover quantum_memory.h5
   ```

2. **Missing checkpoint:**
   ```python
   backup_path = backup_manager.get_latest_backup(checkpoint_file)
   backup_manager.restore_backup(backup_path)
   ```

3. **Version mismatch:**
   ```python
   utils = MigrationUtilities()
   utils.batch_migrate_directory("./quantum_states")
   ```