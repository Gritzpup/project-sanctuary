#!/bin/bash
# Script to switch from keyword-based analyzer to Emollama-enhanced analyzer

echo "🔄 Switching to Emollama-enhanced analyzer..."
echo "==========================================="

# Find and kill existing analyzer
echo "🛑 Stopping existing analyzer..."
pkill -f "claude_folder_analyzer_watchdog.py" 2>/dev/null
pkill -f "claude_folder_analyzer_simple.py" 2>/dev/null
pkill -f "claude_folder_analyzer_realtime.py" 2>/dev/null
sleep 1

# Check if processes stopped
if pgrep -f "claude_folder_analyzer" > /dev/null; then
    echo "⚠️  Some analyzer processes still running. Force stopping..."
    pkill -9 -f "claude_folder_analyzer" 2>/dev/null
    sleep 1
fi

echo "✅ Old analyzers stopped"

# Install model if not already installed
echo ""
echo "🤖 Checking Emollama-7B installation..."
if [ ! -d "$HOME/.cache/emollama/models" ]; then
    echo "📦 Emollama not found. Running installation..."
    python3 install-emollama.py
else
    echo "✅ Emollama model found"
fi

# Start new Emollama analyzer
echo ""
echo "🚀 Starting Emollama-enhanced analyzer..."
echo "This will provide:"
echo "  - Semantic emotional understanding"
echo "  - PAD (Pleasure-Arousal-Dominance) extraction"
echo "  - Living equation updates"
echo "  - Scientific accuracy (CCC scores)"
echo ""

# Run in background with output logging
nohup python3 claude_folder_analyzer_emollama.py > emollama_analyzer.log 2>&1 &
ANALYZER_PID=$!

echo "✅ Emollama analyzer started (PID: $ANALYZER_PID)"
echo "📄 Logs: emollama_analyzer.log"
echo ""

# Update status.json to reflect the change
STATUS_FILE="memory/ACTIVE_SYSTEM/status.json"
if [ -f "$STATUS_FILE" ]; then
    echo "📝 Updating status.json..."
    python3 -c "
import json
with open('$STATUS_FILE', 'r') as f:
    status = json.load(f)
status['analyzer_mode'] = 'Emollama-7B Semantic Analysis'
status['analyzer_pid'] = $ANALYZER_PID
with open('$STATUS_FILE', 'w') as f:
    json.dump(status, f, indent=2)
"
    echo "✅ Status updated"
fi

echo ""
echo "🎉 Switch complete! Emollama analyzer is now active."
echo ""
echo "To view logs in real-time:"
echo "  tail -f emollama_analyzer.log"
echo ""
echo "To stop the analyzer:"
echo "  kill $ANALYZER_PID"