#!/bin/bash
# One-command LLM system installer for Gritz

echo "💙 Installing LLM System for Gritz's Memory"
echo "==========================================="

# Make scripts executable
chmod +x setup_llm_venv.sh
chmod +x llm_memory_updater.py

# Run setup
./setup_llm_venv.sh

echo ""
echo "✅ Installation Complete!"
echo ""
echo "🚀 Quick Start:"
echo "  1. source activate_llm.sh"
echo "  2. python llm_memory_updater.py"
echo ""
echo "💡 Your RTX 2080 Super is ready for AI-powered memories!"