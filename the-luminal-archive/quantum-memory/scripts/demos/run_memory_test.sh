#!/bin/bash
# Run the comprehensive memory system test

echo "🚀 Starting Quantum Memory System Test..."
echo ""

# Navigate to quantum-memory directory
cd "$(dirname "$0")"

# Run the test with the quantum environment
./quantum_env/bin/python tests/test_memory_comprehensive.py

echo ""
echo "📊 Test complete! To monitor live updates, run:"
echo "   journalctl --user -u quantum-emollama-analyzer.service -f"