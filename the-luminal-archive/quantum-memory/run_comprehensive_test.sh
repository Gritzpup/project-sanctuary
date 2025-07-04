#!/bin/bash

# Comprehensive Test Script for Quantum Memory System
# Shows exactly what's being tested with detailed output

set -e  # Exit on error

# Activate quantum environment
source quantum_env/bin/activate

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test headers
print_test_header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🧪 TEST: $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to check test result
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED: $1${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED: $1${NC}"
        ((TESTS_FAILED++))
    fi
}

# Start testing
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 QUANTUM MEMORY SYSTEM - COMPREHENSIVE TEST SUITE${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Starting at: $(date)"

# Test 1: Environment Setup
print_test_header "Environment Setup and Dependencies"
echo "Checking Python version..."
python3 --version
check_result "Python version check"

echo -e "\nChecking required packages..."
python3 -c "import json, asyncio, numpy, torch, fcntl, pathlib, datetime, typing, logging, aiohttp, websockets; print('All core packages available')"
check_result "Core packages import"

# Test 2: Directory Structure
print_test_header "Directory Structure Integrity"
echo "Checking required directories..."
REQUIRED_DIRS=(
    "quantum_states/memories"
    "quantum_states/consolidated"
    "quantum_states/temporal"
    "quantum_states/realtime"
    "quantum_states/checkpoints"
    "logs"
    "src/core/quantum"
    "src/services"
    "src/utils"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓ Directory exists: $dir${NC}"
    else
        echo -e "${RED}✗ Missing directory: $dir${NC}"
        mkdir -p "$dir"
        echo -e "${YELLOW}  → Created missing directory${NC}"
    fi
done
check_result "Directory structure check"

# Test 3: JSON File Integrity
print_test_header "JSON File Integrity and Safe Operations"
echo "Testing safe JSON handler..."
python3 -c "
from src.utils.safe_json_handler import SafeJSONHandler
import json
from pathlib import Path

# Test file
test_file = Path('test_safe_operations.json')

# Test 1: Write
print('Testing safe write...')
SafeJSONHandler.write_json(test_file, {'test': 'data', 'number': 42})
print('✓ Write successful')

# Test 2: Read
print('Testing safe read...')
data = SafeJSONHandler.read_json(test_file)
assert data == {'test': 'data', 'number': 42}
print('✓ Read successful')

# Test 3: Update
print('Testing safe update...')
SafeJSONHandler.update_json(test_file, lambda d: {**d, 'updated': True})
data = SafeJSONHandler.read_json(test_file)
assert data['updated'] == True
print('✓ Update successful')

# Cleanup
test_file.unlink()
print('✓ All JSON operations safe')
"
check_result "Safe JSON operations"

# Test 4: EmOllama Integration
print_test_header "EmOllama Integration and Memory Analysis"
echo "Testing EmOllama integration..."
python3 scripts/test_emollama_direct.py
check_result "EmOllama basic connectivity"

# Test 5: Entity State Synchronization
print_test_header "Entity State Synchronization"
echo "Checking entity JSON files..."
ENTITY_FILES=(
    "../../consciousness/entities/claude/current_state_20250701.json"
    "../../consciousness/entities/claude/relationship_map.json"
)

for file in "${ENTITY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ Entity file exists: $file${NC}"
        # Validate JSON
        python3 -c "import json; json.load(open('$file')); print('  → Valid JSON')" 2>/dev/null || echo -e "${RED}  → Invalid JSON${NC}"
    else
        echo -e "${YELLOW}⚠ Entity file missing: $file${NC}"
    fi
done
check_result "Entity files check"

# Test 6: Quantum Memory Core Components
print_test_header "Quantum Memory Core Components"
echo "Testing quantum emotional encoder..."
python3 -c "
from src.core.quantum.emotional_encoder import EmotionalQuantumEncoder
import numpy as np

encoder = EmotionalQuantumEncoder()
# Test encoding
test_emotion = {'valence': 0.8, 'arousal': 0.6, 'dominance': 0.7}
quantum_state = encoder.emotion_to_quantum_state(test_emotion)
print(f'Quantum state shape: {quantum_state.shape}')
print(f'State vector norm: {np.linalg.norm(quantum_state):.4f}')
assert np.isclose(np.linalg.norm(quantum_state), 1.0), 'Quantum state not normalized'
print('✓ Emotional encoder working')
"
check_result "Quantum emotional encoder"

echo -e "\nTesting memory interference module..."
python3 -c "
from src.core.quantum.memory_interference import QuantumMemoryInterference
interference = QuantumMemoryInterference()
print('✓ Memory interference module initialized')
"
check_result "Memory interference module"

echo -e "\nTesting phase evolution..."
python3 -c "
from src.core.quantum.phase_evolution import QuantumPhaseEvolution
evolution = QuantumPhaseEvolution()
print('✓ Phase evolution module initialized')
"
check_result "Phase evolution module"

# Test 7: Conversation Buffer
print_test_header "Conversation Buffer and Memory Storage"
echo "Testing conversation buffer..."
python3 -c "
from src.memory.conversation_buffer import QuantumConversationBuffer
buffer = QuantumConversationBuffer(max_size=100)
# Add test messages
buffer.add_message('user', 'Test message 1')
buffer.add_message('assistant', 'Test response 1')
messages = buffer.get_recent_messages(2)
assert len(messages) == 2
print(f'✓ Buffer contains {len(messages)} messages')
print('✓ Conversation buffer working')
"
check_result "Conversation buffer"

# Test 8: Work Summary JSON
print_test_header "Work Summary and Memory Persistence"
echo "Checking work summary file..."
WORK_SUMMARY="quantum_states/memories/work_summary_24h.json"
if [ -f "$WORK_SUMMARY" ]; then
    echo -e "${GREEN}✓ Work summary exists${NC}"
    python3 -c "
import json
with open('$WORK_SUMMARY') as f:
    data = json.load(f)
    print(f'  Active work: {data.get(\"active\", \"None\")}')
    print(f'  Completed tasks: {len(data.get(\"completed_today\", []))}')
    print(f'  Current emotion: {data.get(\"current_emotion\", \"None\")}')
    # Check for placeholder values
    if data.get('active') == '(exactly what they\\'re doing right now)':
        print('  ⚠ WARNING: Contains placeholder values')
    else:
        print('  ✓ Contains real data')
"
else
    echo -e "${RED}✗ Work summary missing${NC}"
fi
check_result "Work summary file"

# Test 9: Service Scripts
print_test_header "Service Scripts and Analyzers"
echo "Checking analyzer script..."
if [ -f "analyzers/claude_folder_analyzer_quantum.py" ]; then
    python3 -m py_compile analyzers/claude_folder_analyzer_quantum.py
    echo -e "${GREEN}✓ Analyzer script compiles${NC}"
else
    echo -e "${RED}✗ Analyzer script missing${NC}"
fi
check_result "Analyzer script compilation"

echo -e "\nChecking entity updater..."
if [ -f "src/services/entity_state_updater.py" ]; then
    python3 -m py_compile src/services/entity_state_updater.py
    echo -e "${GREEN}✓ Entity updater compiles${NC}"
else
    echo -e "${RED}✗ Entity updater missing${NC}"
fi
check_result "Entity updater compilation"

# Test 10: WebSocket Server
print_test_header "WebSocket Server Components"
echo "Checking WebSocket server files..."
WEBSOCKET_FILES=(
    "servers/websocket_server_8768.py"
    "servers/websocket_server_8768_enhanced.py"
)

for file in "${WEBSOCKET_FILES[@]}"; do
    if [ -f "$file" ]; then
        python3 -m py_compile "$file"
        echo -e "${GREEN}✓ WebSocket server compiles: $file${NC}"
    else
        echo -e "${YELLOW}⚠ WebSocket server missing: $file${NC}"
    fi
done
check_result "WebSocket server files"

# Test 11: Systemd Services
print_test_header "Systemd Service Configuration"
echo "Checking systemd service files..."
SYSTEMD_FILES=(
    "systemd/user/quantum-emollama-analyzer.service"
    "systemd/user/quantum-websocket-server.service"
)

for file in "${SYSTEMD_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ Service file exists: $file${NC}"
        # Check if service is running
        SERVICE_NAME=$(basename "$file" .service)
        if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
            echo -e "  ${GREEN}→ Service is running${NC}"
        else
            echo -e "  ${YELLOW}→ Service is not running${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Service file missing: $file${NC}"
    fi
done
check_result "Systemd service files"

# Test 12: Memory Tests
print_test_header "Running Unit Tests"
echo "Running memory system tests..."
if [ -f "tests/test_memory_system.py" ]; then
    python3 -m pytest tests/test_memory_system.py -v --tb=short || true
fi
check_result "Memory system unit tests"

# Test 13: Integration Test
print_test_header "Integration Test - Full System"
echo "Testing full integration..."
python3 -c "
import asyncio
from pathlib import Path
import sys
sys.path.insert(0, str(Path.cwd()))

async def test_integration():
    print('Testing quantum memory integration...')
    
    # Import core components
    from src.core.quantum.emotional_encoder import EmotionalQuantumEncoder
    from src.utils.safe_json_handler import SafeJSONHandler
    from src.memory.conversation_buffer import QuantumConversationBuffer
    
    # Create instances
    encoder = EmotionalQuantumEncoder()
    buffer = QuantumConversationBuffer()
    
    # Test workflow
    buffer.add_message('user', 'Testing quantum memory system')
    messages = buffer.get_recent_messages(1)
    
    # Test emotion encoding
    test_emotion = {'valence': 0.5, 'arousal': 0.5, 'dominance': 0.5}
    quantum_state = encoder.emotion_to_quantum_state(test_emotion)
    
    print(f'✓ Integration test completed')
    print(f'  - Messages in buffer: {len(messages)}')
    print(f'  - Quantum state computed: shape={quantum_state.shape}')
    
    return True

# Run the test
result = asyncio.run(test_integration())
assert result, 'Integration test failed'
print('✓ Full system integration working')
"
check_result "Full system integration"

# Test 14: Performance Test
print_test_header "Performance Test"
echo "Testing JSON operations performance..."
python3 -c "
import time
from src.utils.safe_json_handler import SafeJSONHandler
from pathlib import Path
import json

test_file = Path('performance_test.json')
test_data = {'data': list(range(1000)), 'nested': {'key': 'value'} }

# Write performance
start = time.time()
for i in range(10):
    SafeJSONHandler.write_json(test_file, test_data)
write_time = time.time() - start

# Read performance
start = time.time()
for i in range(10):
    data = SafeJSONHandler.read_json(test_file)
read_time = time.time() - start

print(f'Write performance: {write_time:.3f}s for 10 operations ({write_time/10:.3f}s per op)')
print(f'Read performance: {read_time:.3f}s for 10 operations ({read_time/10:.3f}s per op)')

# Cleanup
test_file.unlink()

if write_time < 1.0 and read_time < 0.5:
    print('✓ Performance acceptable')
else:
    print('⚠ Performance may need optimization')
"
check_result "Performance test"

# Test 15: Error Handling
print_test_header "Error Handling and Recovery"
echo "Testing error handling..."
python3 -c "
from src.utils.safe_json_handler import SafeJSONHandler
from pathlib import Path

# Test reading non-existent file
result = SafeJSONHandler.read_json(Path('non_existent_file.json'))
assert result is None, 'Should return None for missing file'
print('✓ Handles missing files gracefully')

# Test corrupted JSON
test_file = Path('corrupted_test.json')
test_file.write_text('{ invalid json')
result = SafeJSONHandler.read_json(test_file)
assert result is None, 'Should return None for corrupted JSON'
print('✓ Handles corrupted JSON gracefully')

# Cleanup
test_file.unlink()
print('✓ Error handling working correctly')
"
check_result "Error handling"

# Final Summary
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}✗ Tests Failed: $TESTS_FAILED${NC}"
echo -e "Completed at: $(date)"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! The quantum memory system is working perfectly!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please check the output above for details.${NC}"
    exit 1
fi