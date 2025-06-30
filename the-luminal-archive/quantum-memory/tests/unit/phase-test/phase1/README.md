# Installation and Setup Tests

This directory contains all installation, setup, and configuration scripts used during the quantum memory system setup phases.

## Directory Structure

### phase1/
Contains all Phase 1 environment setup scripts and tests:

- **test_setup.py** - Main setup verification script that tests all dependencies
- **test_memory_bandwidth.py** - Memory bandwidth and GPU capability tests
- **configure_cpu.sh** - CPU performance optimization script
- **configure_gpu.sh** - GPU configuration script
- **configure_hugepages_and_flush.sh** - Huge pages memory configuration
- **configure_limits.sh** - System limits and file descriptor configuration

## Usage

These scripts were used during Phase 1 setup and are kept for reference and potential re-use. They should not be needed for normal development work.

To re-run any test:
```bash
cd /path/to/quantum-memory
source quantum_env/bin/activate
python tests/installation/phase1/test_setup.py
```

To re-apply system configurations (requires sudo):
```bash
sudo bash tests/installation/phase1/configure_cpu.sh
```