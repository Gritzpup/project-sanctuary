#!/bin/bash
# Launch all monitoring consoles for the memory system

echo "🚀 Launching Claude Memory System Monitoring Suite"
echo "This will open multiple terminal windows:"
echo "  1. Dashboard (Web browser)"
echo "  2. LLM Conversation Reader"
echo "  3. Memory File Monitor"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to find best terminal
find_terminal() {
    if command_exists gnome-terminal; then
        echo "gnome-terminal"
    elif command_exists konsole; then
        echo "konsole"  
    elif command_exists xfce4-terminal; then
        echo "xfce4-terminal"
    elif command_exists terminator; then
        echo "terminator"
    elif command_exists mate-terminal; then
        echo "mate-terminal"
    elif command_exists lxterminal; then
        echo "lxterminal"
    elif command_exists xterm; then
        echo "xterm"
    elif command_exists tmux; then
        echo "tmux"
    else
        echo "none"
    fi
}

# Function to launch in terminal
launch_in_terminal() {
    local title="$1"
    local script="$2"
    local terminal=$(find_terminal)
    
    echo "🔧 Using terminal: $terminal"
    
    case "$terminal" in
        "gnome-terminal")
            gnome-terminal -- bash -c "cd '$SCRIPT_DIR' && python3 '$script'; echo 'Press Enter to close...'; read" &
            ;;
        "konsole")
            konsole --new-tab -e bash -c "cd '$SCRIPT_DIR' && python3 '$script'; echo 'Press Enter to close...'; read" &
            ;;
        "xfce4-terminal")
            xfce4-terminal --title="$title" -e "bash -c 'cd $SCRIPT_DIR && python3 $script; echo Press Enter to close...; read'" &
            ;;
        "terminator")
            terminator -T "$title" -e "bash -c 'cd $SCRIPT_DIR && python3 $script; echo Press Enter to close...; read'" &
            ;;
        "mate-terminal")
            mate-terminal --title="$title" -e "bash -c 'cd $SCRIPT_DIR && python3 $script; echo Press Enter to close...; read'" &
            ;;
        "lxterminal")
            lxterminal --title="$title" -e bash -c "cd '$SCRIPT_DIR' && python3 '$script'; echo 'Press Enter to close...'; read" &
            ;;
        "xterm")
            xterm -T "$title" -e bash -c "cd '$SCRIPT_DIR' && python3 '$script'; echo 'Press Enter to close...'; read" &
            ;;
        "tmux")
            # Use tmux as fallback
            tmux new-session -d -s "$title" "cd '$SCRIPT_DIR' && python3 '$script'"
            echo "✅ Launched $title in tmux. Attach with: tmux attach -t '$title'"
            ;;
        *)
            # Last resort - run in background
            echo "⚠️  No suitable terminal found. Running $title in background..."
            cd "$SCRIPT_DIR" && python3 "$script" > "/tmp/${title// /_}.log" 2>&1 &
            echo "Logs available at: /tmp/${title// /_}.log"
            ;;
    esac
}

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
if command_exists xdg-open; then
    xdg-open http://localhost:8082 2>/dev/null &
elif command_exists open; then
    open http://localhost:8082 2>/dev/null &
elif command_exists firefox; then
    firefox http://localhost:8082 2>/dev/null &
elif command_exists chromium-browser; then
    chromium-browser http://localhost:8082 2>/dev/null &
else
    echo "Please open http://localhost:8082 in your browser"
fi

# Launch monitoring consoles
echo ""
echo "🧠 Launching LLM Conversation Reader..."
launch_in_terminal "LLM Conversation Reader" "llm_conversation_reader.py"
sleep 1

echo "📁 Launching Memory File Monitor..."
launch_in_terminal "Memory File Monitor" "memory_file_monitor.py"
sleep 1

echo ""
echo "✅ All systems launched!"
echo ""
echo "📋 Status:"
echo "  - Dashboard: http://localhost:8082"
echo "  - Memory deduplication: ENABLED"
echo "  - Persistent memory: ACTIVE"
echo "  - Emotion popup queue: FIXED"
echo ""
echo "🎯 What's working now:"
echo "  ✓ No more memory processing loops"
echo "  ✓ Emotions show one at a time"
echo "  ✓ Separate metrics for Gritz and Claude"
echo "  ✓ PERSISTENT MEMORY ACROSS CHATS! 💙"
echo ""
echo "💡 Tips:"
echo "  - Say something emotional to test the mood rings"
echo "  - Check the consoles to see real-time processing"
echo "  - When you start a new chat, I'll remember you!"
echo ""

# If using tmux, show how to attach
if [ "$(find_terminal)" = "tmux" ]; then
    echo "📺 Tmux sessions running. View with:"
    echo "  tmux attach -t 'LLM Conversation Reader'"
    echo "  tmux attach -t 'Memory File Monitor'"
    echo ""
fi