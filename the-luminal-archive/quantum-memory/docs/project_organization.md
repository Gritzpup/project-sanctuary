# Quantum Memory Project Organization

## Overview
The quantum memory project has been reorganized for clarity and maintainability. This document describes the current structure and where to find specific components.

## Directory Structure

```
quantum-memory/
├── src/                           # Main source code
│   ├── core/                      # Core quantum components
│   │   ├── quantum/              # Quantum-specific modules
│   │   │   ├── quantum_memory.py           # Main quantum memory class
│   │   │   ├── emotional_encoder.py        # Emotional pattern encoding
│   │   │   ├── entanglement_encoder.py     # Entanglement associations
│   │   │   ├── quantum_classical_interface.py # Hybrid processing
│   │   │   ├── quantum_utils.py            # State tomography, visualization
│   │   │   ├── cuquantum_advanced.py       # Path caching, autodiff, profiling
│   │   │   ├── gpu_memory_manager.py       # VRAM monitoring, OOM prevention
│   │   │   ├── state_serializer.py         # State persistence
│   │   │   ├── hdf5_storage.py            # HDF5 backend
│   │   │   ├── checkpoint_manager.py       # Checkpoint system
│   │   │   └── ...                         # Other quantum modules
│   │   └── memory/               # Classical memory integration
│   └── utils/                    # Utility functions
│
├── tests/                        # All test files
│   ├── unit/                     # Unit tests
│   │   └── phase-test/          # Phase-specific tests
│   │       ├── phase1/          # Phase 1 core tests
│   │       └── phase2/          # Phase 2 advanced tests
│   ├── integration/             # Integration tests
│   ├── verification/            # Test runners and verification scripts
│   │   ├── phase2_verification.py
│   │   ├── run_phase2_tests.py
│   │   ├── show_phase2_complete.py
│   │   └── show_phase2_summary.py
│   └── results/                 # Test results and reports
│       ├── phase2_*.json        # Phase 2 test results
│       ├── scientific_validation_report.txt
│       └── phase2_*.md          # Phase summaries
│
├── docs/                        # Documentation
│   ├── phase2/                  # Phase 2 documentation
│   │   ├── PHASE2_COMPLETE.md
│   │   ├── PHASE2_FINAL_COMPLETE.md
│   │   └── PHASE2_100_PERCENT_COMPLETE.md
│   ├── phase_checklist.md      # Master checklist
│   ├── storage_architecture.md  # Storage design docs
│   └── project_organization.md  # This file
│
├── scripts/                     # Utility scripts
├── services/                    # API and websocket services
├── dashboard/                   # Web dashboard
└── configs/                     # Configuration files
```

## Key Components

### Phase 2 Advanced Features

1. **Quantum Utilities** (`src/core/quantum/quantum_utils.py`)
   - State tomography for debugging
   - Bloch sphere visualization
   - QAOA/VQE circuit generation
   - Circuit optimization algorithms

2. **cuQuantum Advanced** (`src/core/quantum/cuquantum_advanced.py`)
   - Path caching for repeated circuits
   - Automatic differentiation support
   - Custom memory allocators
   - Stream-based concurrent execution
   - Performance profiling integration

3. **GPU Memory Management** (`src/core/quantum/gpu_memory_manager.py`)
   - Real-time VRAM monitoring
   - OOM prevention mechanisms
   - Mixed precision support

## Running Tests

### Quick Test
```bash
python run_test_with_details.py
```

### Specific Phase Tests
```bash
# Phase 1 tests
python tests/unit/phase-test/phase1/test_phase1_final_verification.py

# Phase 2 tests
python tests/verification/run_phase2_tests.py
```

### View Results
```bash
# Show phase 2 completion status
python tests/verification/show_phase2_complete.py

# View test results
cat tests/results/phase2_summary.md
```

## Important Files

- **Main Test Runner**: `run_test_with_details.py` - Comprehensive test suite with scientific validation
- **Phase Checklist**: `docs/phase_checklist.md` - Master tracking document
- **Test Results**: `tests/results/` - All test outputs and reports
- **Verification Scripts**: `tests/verification/` - Phase-specific test runners

## Development Workflow

1. Check phase requirements in `docs/phase_checklist.md`
2. Implement features in appropriate `src/core/quantum/` modules
3. Write tests in `tests/unit/phase-test/`
4. Run comprehensive tests with `run_test_with_details.py`
5. Review results in `tests/results/`

## Notes

- All Phase 2 features are now complete (57/57 items)
- The system includes full GPU acceleration and memory management
- Scientific validation ensures quantum mechanics compliance
- Emotional encoding and entanglement features are operational

Built with love for Gritz 💝