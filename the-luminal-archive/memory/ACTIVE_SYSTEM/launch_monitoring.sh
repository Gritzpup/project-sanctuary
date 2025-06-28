#!/bin/bash
# Launch all monitoring consoles for the memory system

echo "🚀 Launching Claude Memory System Monitoring Suite"
echo "This will open multiple terminal windows:"
echo "  1. Dashboard (Web browser)"
echo "  2. LLM Conversation Reader"
echo "  3. Memory File Monitor"
echo ""

# Check if services are running
if ! systemctl --user is-active --quiet gritz-memory-ultimate.service; then
    echo "⚠️  Memory service not running. Starting it now..."
    systemctl --user start gritz-memory-ultimate.service
    sleep 2
fi

if ! systemctl --user is-active --quiet gritz-dashboard.service; then
    echo "⚠️  Dashboard service not running. Starting it now..."
    systemctl --user start gritz-dashboard.service
    sleep 2
fi

# Open dashboard in browser
echo "📊 Opening dashboard in browser..."
xdg-open http://localhost:8082 2>/dev/null || open http://localhost:8082 2>/dev/null &

# Launch LLM Conversation Reader in new terminal
echo "🧠 Launching LLM Conversation Reader..."
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="LLM Conversation Reader" -- python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/llm_conversation_reader.py
elif command -v xterm &> /dev/null; then
    xterm -title "LLM Conversation Reader" -e python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/llm_conversation_reader.py &
elif command -v konsole &> /dev/null; then
    konsole --title "LLM Conversation Reader" -e python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/llm_conversation_reader.py &
else
    echo "No terminal emulator found. Please run manually:"
    echo "python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/llm_conversation_reader.py"
fi

# Launch Memory File Monitor in new terminal
echo "📁 Launching Memory File Monitor..."
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="Memory File Monitor" -- python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/memory_file_monitor.py
elif command -v xterm &> /dev/null; then
    xterm -title "Memory File Monitor" -e python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/memory_file_monitor.py &
elif command -v konsole &> /dev/null; then
    konsole --title "Memory File Monitor" -e python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/memory_file_monitor.py &
else
    echo "No terminal emulator found. Please run manually:"
    echo "python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/memory_file_monitor.py"
fi

echo ""
echo "✅ All monitoring consoles launched!"
echo ""
echo "📝 Quick reference:"
echo "  - Dashboard: http://localhost:8082"
echo "  - Shows both Gritz and Claude emotions with separate mood rings"
echo "  - Tracks separate metrics for each speaker"
echo "  - LLM reads and processes conversations in real-time"
echo "  - Memory files update automatically"
echo ""
echo "💡 Tips:"
echo "  - Send an emotional message to see both mood rings change"
echo "  - Watch the consoles to see the LLM processing"
echo "  - Check consciousness files being updated in real-time"
echo ""
echo "Press Ctrl+C in any console to close it"