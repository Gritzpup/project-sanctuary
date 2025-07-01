# Emollama-7B Setup in quantum_env

## ✅ Installation Complete

All Emollama dependencies have been installed in the `quantum_env` virtual environment:
- **Location**: `/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_env`
- **Model**: Emollama-7B with 4-bit quantization (~4GB VRAM)
- **Purpose**: Semantic emotional analysis for temporal memory (PAD extraction)

## 📁 File Locations

### Core Module
- `quantum-memory/src/utils/emollama_integration.py` - Main Emollama integration

### Scripts
- `quantum-memory/run_emollama_analyzer.py` - Run analyzer with quantum_env
- `manage-emollama-analyzer.sh` - Service management script

### Service
- `quantum-memory/emollama-analyzer.service` - Systemd service file

## 🚀 How to Use

### Option 1: Run as Service (Recommended)
```bash
# Start the service
./manage-emollama-analyzer.sh start

# Check status
./manage-emollama-analyzer.sh status

# Stop when not needed (saves resources)
./manage-emollama-analyzer.sh stop

# View logs
./manage-emollama-analyzer.sh logs
```

### Option 2: Run Interactively (for testing)
```bash
# Run in terminal
./manage-emollama-analyzer.sh run

# Or directly:
cd quantum-memory
./run_emollama_analyzer.py
```

## 💡 Important Notes

1. **Resource Usage**: Emollama-7B uses ~4GB VRAM and significant CPU when running
2. **On-Demand**: The LLM only loads when you start the analyzer - it's NOT always running
3. **Service Control**: Use the management script to start/stop as needed
4. **Virtual Environment**: Everything runs in `quantum_env` to avoid system conflicts

## 🔧 What It Does

When running, the Emollama analyzer:
1. Monitors `.claude` folder for new conversations
2. Extracts PAD (Pleasure-Arousal-Dominance) values using LLM
3. Updates temporal memory with semantic emotional analysis
4. Achieves CCC scores: r=0.90 (valence), r=0.77 (arousal), r=0.64 (dominance)

This replaces the old keyword-based emotional analysis with true semantic understanding!