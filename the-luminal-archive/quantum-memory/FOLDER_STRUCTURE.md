# Quantum Memory System - Folder Structure

## Project Organization

```
quantum-memory/
├── src/                      # Main source code directory
│   ├── api/                  # API endpoints (future)
│   ├── core/                 # Core functionality
│   │   ├── base.py          # Base classes and interfaces
│   │   └── quantum/         # Quantum implementations
│   │       ├── emotional_encoder.py         # Emotional state quantum encoding
│   │       ├── entanglement_encoder.py      # Quantum entanglement implementation
│   │       ├── quantum_classical_interface.py # Classical-quantum bridge
│   │       ├── quantum_memory.py            # Main quantum memory system
│   │       ├── quantum_memory_simple.py     # Simplified version
│   │       └── tensor_network_memory.py     # Tensor network implementation
│   ├── emotion/             # Emotion processing (future)
│   ├── memory/              # Memory system components
│   ├── psychological/       # Psychological models
│   │   ├── emotional_baseline.py  # Emotional baseline detection
│   │   ├── phase_detection.py     # Conversation phase detection
│   │   └── semantic_dedup.py      # Semantic deduplication
│   ├── quantum/             # Additional quantum components (future)
│   └── utils/               # Utility functions
│
├── tests/                   # Test suite
│   ├── installation/        # Installation verification
│   │   └── phase1/         # Phase 1 completion markers
│   ├── integration/        # Integration tests
│   │   ├── test_integration.py
│   │   └── test_quantum_integration.py
│   └── unit/              # Unit tests
│       ├── phase-test/    # Phase-specific tests
│       │   └── phase1/    # Phase 1 tests and configs
│       │       ├── test_phase1_final_verification.py  # Main verification
│       │       ├── test_quantum_memory_comprehensive.py
│       │       ├── test_emotional_quantum_memory_demo.py
│       │       └── configure_*.sh  # System configuration scripts
│       └── test_quantum_*.py  # Various quantum tests
│
├── services/               # Service layer
│   ├── api/               # API services (future)
│   └── websocket/         # WebSocket server
│       └── server.py      # WebSocket implementation
│
├── scripts/               # Utility scripts
│   ├── check_system.py    # System requirements checker
│   ├── setup_quantum_memory.py  # Setup script
│   ├── start_quantum_memory.sh  # Start services
│   └── stop_quantum_memory.sh   # Stop services
│
├── utils/                 # Project utilities
│   ├── checkpoint/        # Checkpoint management
│   │   ├── claude_sync.py       # Claude synchronization
│   │   └── state_manager.py     # State management
│   ├── recovery/          # Recovery utilities
│   │   └── CLAUDE.md     # Active memory checkpoint (DO NOT DELETE)
│   ├── env_loader.py     # Environment configuration
│   └── privileged_ops.py # Privileged operations
│
├── configs/              # Configuration files
├── data/                 # Data storage
│   ├── checkpoints/      # Memory checkpoints
│   └── configs/          # Runtime configurations
├── dashboard/            # Web dashboard
│   └── static/          # Static assets
├── docs/                # Documentation
│   ├── README.md        # Main documentation
│   ├── phase_checklist.md  # Phase completion tracking
│   └── research-paper.md   # Research documentation
├── notebooks/           # Jupyter notebooks
│
├── quantum_env/         # Python virtual environment
├── CLAUDE.md           # Quantum memory system documentation
├── PROJECT_STRUCTURE.md # Technical structure details
├── requirements.txt    # Python dependencies
├── setup.py           # Package setup
├── main.py           # Main entry point
├── activate_quantum_env.sh  # Environment activation
└── .pre-commit-config.yaml  # Pre-commit hooks

```

## Key Directories

### `/src/` - Source Code
All production code lives here, organized by functionality:
- `core/` - Core system components
- `psychological/` - Emotional and psychological models
- `memory/` - Memory persistence and retrieval

### `/tests/` - Testing
Comprehensive test suite:
- `unit/` - Component-level tests
- `integration/` - System integration tests
- `installation/` - Environment verification

### `/services/` - Service Layer
External interfaces:
- `websocket/` - Real-time communication
- `api/` - REST API (future)

### `/utils/` - Utilities
Support functionality:
- `checkpoint/` - State management
- `recovery/` - System recovery tools

## Important Files

- `CLAUDE.md` (root) - Technical documentation
- `utils/recovery/CLAUDE.md` - Active memory checkpoint
- `test_phase1_final_verification.py` - Main Phase 1 test
- `main.py` - System entry point

## Phase Organization

The project follows a phased implementation:
- **Phase 1**: Environment setup and verification ✅
- **Phase 2**: Core quantum memory implementation (current)
- **Phase 3**: Integration and optimization
- **Phase 4**: Production deployment

All phase-specific tests and configurations are organized under `/tests/unit/phase-test/`.