# 🧹 Quantum Memory Cleanup Plan

## Files to Move/Reorganize

### 1. Documentation Files
- `compass_artifact_wf-081152f0-6ee4-4ab2-acb1-2a736f2c0c71_text_markdown.md` → `docs/research/quantum_memory_research.md`
- `README.md` → `docs/README.md`
- `GETTING_STARTED.md` → `docs/GETTING_STARTED.md`
- `IMPLEMENTATION_STATUS.md` → `docs/IMPLEMENTATION_STATUS.md`

### 2. Core Scripts
**From ACTIVE_SYSTEM/scripts/ to core/psychological/**
- `emotional_baseline_manager.py` → `core/psychological/emotional_baseline.py`
- `phase_detection_tracking.py` → `core/psychological/phase_detection.py`
- `semantic_deduplication_system.py` → `core/psychological/semantic_dedup.py`

**From ACTIVE_SYSTEM/scripts/ to core/memory/**
- `memory_system.py` → `core/memory/memory_system.py`
- `memory_health_monitor.py` → `core/memory/health_monitor.py`

**From root to core/quantum/**
- `quantum_emotional_encoder.py` → `core/quantum/emotional_encoder.py`

### 3. Dashboard Consolidation
- `ACTIVE_SYSTEM/dashboard/dashboard.html` → `dashboard/index.html`

### 4. Recovery/Utils
- `ACTIVE_SYSTEM/recovery/CLAUDE.md` → `utils/recovery/CLAUDE.md`

### 5. Setup Scripts
- `setup_quantum_memory.py` → `scripts/setup_quantum_memory.py`
- `start_quantum_memory.sh` → `scripts/start_quantum_memory.sh`

## Directories to Remove
- `CORE/` (empty)
- `ACTIVE_SYSTEM/` (after moving all files)

## New Directories to Create

```bash
# Phase 1 Essential Directories
quantum-memory/
├── core/
│   ├── quantum/
│   ├── psychological/
│   └── memory/
├── docs/
│   └── research/
├── dashboard/
│   └── static/
├── utils/
│   ├── checkpoint/
│   └── recovery/
├── scripts/
├── tests/
│   └── unit/
└── data/
    ├── checkpoints/
    └── configs/
```

## Phase 1 Focus Files to Create

### 1. Core Infrastructure
- `core/__init__.py` - Package initialization
- `core/base.py` - Base classes for all components

### 2. Checkpoint Management
- `utils/checkpoint/claude_sync.py` - Monitor .claude folder
- `utils/checkpoint/state_manager.py` - Save/load memory states

### 3. Basic API
- `services/api/__init__.py` - REST API setup
- `services/websocket/server.py` - Real-time updates

### 4. Configuration
- `data/configs/system_config.json` - System settings
- `data/configs/quantum_config.json` - Quantum parameters

## Cleanup Commands

```bash
# 1. Create new directory structure
mkdir -p core/{quantum,psychological,memory}
mkdir -p docs/research
mkdir -p dashboard/static
mkdir -p utils/{checkpoint,recovery}
mkdir -p scripts
mkdir -p tests/unit
mkdir -p data/{checkpoints,configs}
mkdir -p services/{api,websocket}

# 2. Move files (shown above)

# 3. Remove old directories
rm -rf CORE/
rm -rf ACTIVE_SYSTEM/

# 4. Update imports in all Python files
```

## Benefits of This Structure
1. **Clear separation** between quantum, psychological, and memory components
2. **Easier testing** with organized modules
3. **Better imports** with proper package structure
4. **Scalable** for future phases
5. **Clean root** directory with logical organization