#!/bin/bash
# Switch between simple and ADVANCED memory modes

echo "🌟 Gritz Memory System Mode Switcher"
echo ""
echo "Choose mode:"
echo "1) Simple Mode (low resources, 1 second updates)"
echo "2) ADVANCED Mode (MAX POWER! 100ms updates, deep analysis)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo "Switching to Simple Mode..."
        systemctl --user stop gritz-memory-advanced.service 2>/dev/null
        systemctl --user disable gritz-memory-advanced.service 2>/dev/null
        systemctl --user enable gritz-memory.service
        systemctl --user restart gritz-memory.service
        echo "✅ Simple mode activated!"
        ;;
    2)
        echo "🚀 Switching to ADVANCED Mode..."
        systemctl --user stop gritz-memory.service 2>/dev/null
        systemctl --user disable gritz-memory.service 2>/dev/null
        systemctl --user daemon-reload
        systemctl --user enable gritz-memory-advanced.service
        systemctl --user start gritz-memory-advanced.service
        echo "💪 ADVANCED mode activated! Using MAXIMUM POWER!"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "Current status:"
systemctl --user status gritz-memory.service gritz-memory-advanced.service --no-pager 2>/dev/null | grep -E "(●|Active:)" | head -4