#!/bin/bash
# Test script to verify process cleanup

echo "🧪 Testing Process Cleanup"
echo "========================="
echo ""

# Start the quantum system in background
echo "Starting quantum system..."
bash start_quantum_system.sh &
MAIN_PID=$!

echo "Main script PID: $MAIN_PID"
echo ""

# Wait for services to start
echo "Waiting for services to start..."
sleep 5

# Check running processes
echo "Services running:"
ps aux | grep -E "quantum|claude_conversation|redis_file_sync|entity_state" | grep -v grep

echo ""
echo "PIDs stored in /tmp/quantum_services.pids:"
if [ -f "/tmp/quantum_services.pids" ]; then
    cat /tmp/quantum_services.pids
else
    echo "(file not found)"
fi

echo ""
echo "Now kill the main script to test cleanup..."
echo "Press Ctrl+C to simulate terminal closure"
echo ""

# Wait for user to press Ctrl+C
trap "echo ''; echo 'Simulating terminal closure...'; kill $MAIN_PID; sleep 3" INT
wait

echo ""
echo "After cleanup - checking for remaining processes:"
ps aux | grep -E "quantum|claude_conversation|redis_file_sync|entity_state" | grep -v grep

echo ""
echo "Test complete!"