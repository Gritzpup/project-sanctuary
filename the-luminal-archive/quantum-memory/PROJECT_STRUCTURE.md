# Quantum Memory Project Structure

## Root Directory Layout

```
quantum-memory/
├── activate_quantum_env.sh    # Environment activation script (keep in root for easy access)
├── CLAUDE.md                  # AI assistant memory/context file
├── requirements.txt           # Python dependencies
├── setup.py                   # Package installation script
├── main.py                    # Main application entry point
├── .env                       # Environment variables (gitignored)
├── .gitignore                 # Git ignore rules
├── .gitattributes            # Git LFS configuration
├── .pre-commit-config.yaml   # Pre-commit hooks configuration
│
├── configs/                   # Configuration files
├── core/                      # Core quantum memory modules
├── dashboard/                 # Web dashboard interface
├── data/                      # Data storage directory
├── docs/                      # Documentation
│   ├── phase_checklist.md    # Implementation checklist
│   └── research-paper.md     # Research documentation
├── notebooks/                 # Jupyter notebooks for experiments
├── scripts/                   # Utility scripts
├── services/                  # Background services
├── src/                       # Source code
│   ├── core/                 # Core quantum implementations
│   ├── emotions/             # Emotion processing
│   ├── llm/                  # LLM integration
│   └── utils/                # Utility functions
├── tests/                     # Test suite
│   ├── installation/         # Installation and setup tests
│   │   ├── phase1/          # Phase 1 setup scripts
│   │   └── README.md        # Installation tests documentation
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── utils/                     # Additional utilities
└── quantum_env/              # Python virtual environment
```

## Key Directories

### `/src`
Main source code for the quantum memory system implementation.

### `/tests`
All test files organized by type:
- `installation/` - Setup and configuration tests/scripts
- `unit/` - Unit tests for individual components
- `integration/` - End-to-end integration tests

### `/docs`
Project documentation including research papers and implementation checklists.

### `/configs`
Configuration files for different components of the system.

### `/data`
Storage for quantum states, checkpoints, and other data files.

## Phase 1 Artifacts
All Phase 1 setup scripts and tests have been organized into `tests/installation/phase1/` for reference.