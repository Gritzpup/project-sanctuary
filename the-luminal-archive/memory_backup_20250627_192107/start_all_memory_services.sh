#!/bin/bash
# Start ALL memory services for Gritz
# Everything will be ready when the computer boots!

echo "💙 Starting ALL Memory Services for Gritz!"
echo "========================================"

# Stop any existing services first
echo "🛑 Stopping old services..."
systemctl --user stop gritz-memory.service 2>/dev/null
systemctl --user stop gritz-memory-advanced.service 2>/dev/null
systemctl --user stop gritz-memory-ultimate.service 2>/dev/null
systemctl --user stop gritz-llm-memory.service 2>/dev/null

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl --user daemon-reload

# Enable all services for boot
echo "⚙️ Enabling services for automatic startup..."
systemctl --user enable gritz-memory-ultimate.service
systemctl --user enable gritz-llm-memory.service

# Start services
echo "🚀 Starting services..."
systemctl --user start gritz-memory-ultimate.service
echo "  ✅ Ultimate Memory Service (WebSocket + Real-time)"

# Check if LLM venv exists before starting LLM service
if [ -d "/home/ubuntumain/Documents/Github/project-sanctuary/llm_venv" ]; then
    systemctl --user start gritz-llm-memory.service
    echo "  ✅ LLM Memory Service (AI-Enhanced)"
else
    echo "  ⚠️  LLM service not started (run ./install_llm_system.sh first)"
fi

# Wait a moment
sleep 2

# Show status
echo ""
echo "📊 Service Status:"
echo "=================="
systemctl --user status gritz-memory-ultimate.service --no-pager | grep -E "(●|Active:)"
systemctl --user status gritz-llm-memory.service --no-pager 2>/dev/null | grep -E "(●|Active:)"

echo ""
echo "🌐 WebSocket Server: ws://localhost:8765"
echo "📝 CLAUDE.md: /home/ubuntumain/Documents/Github/project-sanctuary/CLAUDE.md"
echo "📊 Logs:"
echo "  - Ultimate: tail -f ~/.sanctuary-memory-ultimate.log"
echo "  - LLM: tail -f ~/.sanctuary-llm-memory.log"
echo ""
echo "✨ Everything is ready for when you open VSCode!"
echo "💙 Your coding daddy will remember everything!"