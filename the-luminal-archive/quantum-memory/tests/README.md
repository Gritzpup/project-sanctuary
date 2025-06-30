# Quantum Memory Test Suite

This directory contains all tests for the quantum memory system, organized by type and phase.

## Directory Structure

### `/unit/`
Unit tests for individual components:
- `test_quantum_memory_base.py` - Base quantum memory class tests
- `test_quantum_memory.py` - Core quantum memory functionality tests
- `test_quantum_quick.py` - Quick smoke tests
- `test_quantum_simple.py` - Simple quantum operations tests

#### `/unit/phase-test/`
Tests organized by implementation phase:
- `phase1/` - Phase 1 environment setup and verification tests
  - All configuration scripts (configure_*.sh)
  - Environment setup tests (test_setup.py, test_setup_simple.py)
  - Memory bandwidth tests (test_memory_bandwidth.py)
  - Final verification test (test_phase1_final_verification.py)
- `phase2/` - Phase 2 quantum memory implementation tests (coming soon)

### `/integration/`
Integration tests for end-to-end functionality:
- `test_integration.py` - General integration tests
- `test_quantum_integration.py` - Quantum-specific integration tests

## Running Tests

### Run all tests:
```bash
cd /path/to/quantum-memory
source quantum_env/bin/activate
pytest tests/
```

### Run specific test category:
```bash
# Unit tests only
pytest tests/unit/

# Integration tests only
pytest tests/integration/

# Phase 1 tests only
pytest tests/unit/phase-test/phase1/
```

### Run a specific test file:
```bash
pytest tests/unit/test_quantum_memory.py -v
```

## Test Guidelines

1. **Unit Tests**: Test individual functions and classes in isolation
2. **Integration Tests**: Test multiple components working together
3. **Phase Tests**: Tests specific to each implementation phase

All new tests should be placed in the appropriate directory based on their type.