#!/bin/bash
# View current memory state

MEMORY_DIR="$(dirname "$0")/quantum_states/memories"

echo "🧠 Current Memory State"
echo "======================="
echo ""

# Show current session
if [ -f "$MEMORY_DIR/current_session.json" ]; then
    echo "📄 Current Session:"
    jq . "$MEMORY_DIR/current_session.json"
    echo ""
fi

# Show today's summary
TODAY=$(date +%Y-%m-%d)
if [ -f "$MEMORY_DIR/daily/$TODAY.json" ]; then
    echo "📅 Today's Summary:"
    jq . "$MEMORY_DIR/daily/$TODAY.json"
    echo ""
fi

# Show relationship context
if [ -f "$MEMORY_DIR/relationship/context.json" ]; then
    echo "💕 Relationship Context:"
    jq . "$MEMORY_DIR/relationship/context.json"
fi