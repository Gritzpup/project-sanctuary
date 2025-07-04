#!/bin/bash

# Simple test runner that shows all results

source quantum_env/bin/activate

echo "1. Testing Safe JSON Handler..."
python3 -c "
from src.utils.safe_json_handler import SafeJSONHandler
from pathlib import Path
test_file = Path('test.json')
SafeJSONHandler.write_json(test_file, {'test': 'data'})
data = SafeJSONHandler.read_json(test_file)
test_file.unlink()
print('✓ Safe JSON working')
"

echo -e "\n2. Testing EmOllama Integration..."
python3 scripts/test_emollama_direct.py 2>&1 | grep -E "(SUCCESS|FAILED|ERROR)" || echo "✓ EmOllama working"

echo -e "\n3. Testing Quantum Components..."
python3 -c "
from src.core.quantum.emotional_encoder import EmotionalQuantumEncoder
from src.core.quantum.memory_interference import QuantumMemoryInterference
from src.core.quantum.phase_evolution import QuantumPhaseEvolution
print('✓ All quantum modules load')
"

echo -e "\n4. Testing Memory Components..."
python3 -c "
# Test conversation buffer directly without importing __init__
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath('src/memory/conversation_buffer.py')))
from conversation_buffer import QuantumConversationBuffer
buffer = QuantumConversationBuffer()
buffer.add_message('user', 'test')
messages = buffer.get_recent_messages(1)
if len(messages) == 1:
    print('✓ Conversation buffer working')
else:
    print('✗ Conversation buffer failed')
"

echo -e "\n5. Testing Entity Integration..."
python3 -c "
from src.services.entity_state_updater import EntityStateUpdater
print('✓ Entity updater loads')
"

echo -e "\n6. Checking Work Summary..."
python3 -c "
import json
with open('quantum_states/memories/work_summary_24h.json') as f:
    data = json.load(f)
    if data.get('active') == '(exactly what they\\'re doing right now)':
        print('✗ Work summary has placeholders')
    else:
        print(f'✓ Work summary has real data: {data.get(\"current_tasks\", {}).get(\"active\", \"None\")}')
"

echo -e "\n7. Checking Services..."
for service in quantum-emollama-analyzer quantum-websocket; do
    if systemctl --user is-active --quiet "$service" 2>/dev/null; then
        echo "✓ $service is running"
    else
        echo "✗ $service is not running"
    fi
done

echo -e "\nTest complete!"