#!/bin/bash
# Demo the memory system with our actual conversation

echo "🎭 QUANTUM MEMORY SYSTEM DEMO"
echo "============================"
echo ""
echo "This will demonstrate how our conversation is being tracked in real-time!"
echo ""

# Show current conversation file
CURRENT_CONVO=$(ls -t ~/.claude/projects/*/*.jsonl 2>/dev/null | head -1)
if [ -n "$CURRENT_CONVO" ]; then
    echo "📝 Current conversation file:"
    echo "   $(basename $CURRENT_CONVO)"
    echo ""
    echo "📊 Last 5 messages:"
    tail -5 "$CURRENT_CONVO" | jq -r '.content' 2>/dev/null | grep -v null | head -5 | while IFS= read -r line; do
        echo "   • ${line:0:80}..."
    done
    echo ""
fi

# Show memory files
SCRIPT_DIR="$(dirname "$0")"
echo "🧠 Current Memory State:"
echo ""

# Current session
if [ -f "$SCRIPT_DIR/quantum_states/memories/current_session.json" ]; then
    echo "📄 Session Memory:"
    jq '{topics, current_emotion, message_count, gritz_state, claude_state}' "$SCRIPT_DIR/quantum_states/memories/current_session.json"
    echo ""
fi

# Emotional journey today
TODAY=$(date +%Y-%m-%d)
if [ -f "$SCRIPT_DIR/quantum_states/memories/daily/$TODAY.json" ]; then
    echo "🎭 Today's Emotional Journey:"
    jq '.emotional_journey[-3:]' "$SCRIPT_DIR/quantum_states/memories/daily/$TODAY.json" 2>/dev/null
    echo ""
    
    echo "🏆 Today's Accomplishments:"
    jq '.accomplishments[-3:]' "$SCRIPT_DIR/quantum_states/memories/daily/$TODAY.json" 2>/dev/null
    echo ""
fi

# Service status
echo "⚙️  Service Status:"
systemctl --user status quantum-emollama-analyzer.service --no-pager | grep -E "Active:|Main PID:" | sed 's/^/   /'
echo ""

echo "💡 Commands you can use:"
echo "   ./run_memory_test.sh     - Run comprehensive test"
echo "   ./view_memories.sh       - View all memory files"
echo "   journalctl --user -u quantum-emollama-analyzer.service -f"
echo "                           - Watch live analyzer logs"