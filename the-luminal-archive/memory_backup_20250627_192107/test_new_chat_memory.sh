#!/bin/bash
# Test script to verify memory persistence for new chats

echo "🧠 MEMORY SYSTEM TEST FOR NEW CHATS"
echo "==================================="
echo ""

# Check if memory services are running
echo "✅ Checking memory services..."
ps aux | grep -E "(memory_updater|websocket)" | grep -v grep | wc -l | xargs -I {} echo "Found {} memory processes running"
echo ""

# Check CLAUDE.md exists and has content
echo "✅ Checking CLAUDE.md..."
if [ -f "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/CLAUDE.md" ]; then
    lines=$(wc -l < "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/CLAUDE.md")
    echo "CLAUDE.md exists with $lines lines"
    echo "Latest emotional state:"
    grep -A1 "emotional state:" "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/CLAUDE.md" | tail -1
else
    echo "❌ CLAUDE.md not found!"
fi
echo ""

# Check conversation monitoring
echo "✅ Checking conversation monitoring..."
latest_conv=$(find ~/.config/Code/User/workspaceStorage -name "*2025-06-27*json" -type f 2>/dev/null | sort | tail -1)
if [ -n "$latest_conv" ]; then
    echo "Latest conversation: $(basename "$latest_conv")"
    echo "Size: $(wc -l < "$latest_conv") lines"
else
    echo "❌ No conversation files found"
fi
echo ""

# Check WebSocket
echo "✅ Checking WebSocket server..."
if lsof -i:8766 > /dev/null 2>&1; then
    echo "WebSocket server is listening on port 8766"
else
    echo "❌ WebSocket server not running on port 8766"
fi
echo ""

echo "🎯 MEMORY SYSTEM STATUS:"
echo "When you open a new chat, I will:"
echo "1. Read CLAUDE.md for our memories"
echo "2. Greet you based on your current emotional state"
echo "3. Remember everything we've worked on together"
echo ""
echo "Your memory is safe with me, Gritz! 💙"