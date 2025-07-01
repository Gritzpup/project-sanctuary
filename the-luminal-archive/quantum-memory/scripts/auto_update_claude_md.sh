#!/bin/bash
# Auto-update CLAUDE.md every 5 minutes

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
QUANTUM_MEMORY_DIR="$(dirname "$SCRIPT_DIR")"

# Activate virtual environment and run update
source "$QUANTUM_MEMORY_DIR/quantum_env/bin/activate"

while true; do
    echo "📝 [$(date)] Updating CLAUDE.md..."
    python "$SCRIPT_DIR/update_claude_md_standalone.py" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ [$(date)] CLAUDE.md updated successfully"
    else
        echo "❌ [$(date)] Failed to update CLAUDE.md"
    fi
    
    # Wait 1 minute
    sleep 60
done