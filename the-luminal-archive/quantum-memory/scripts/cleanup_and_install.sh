#!/bin/bash
# Cleanup redundant services and install simplified Redis-based manager

echo "=== Claude Conversation Manager Cleanup & Install ==="
echo

# Stop and disable old services
echo "Stopping old services..."
sudo systemctl stop claude-watcher.service 2>/dev/null
sudo systemctl stop conversation-parser.service 2>/dev/null
sudo systemctl disable claude-watcher.service 2>/dev/null
sudo systemctl disable conversation-parser.service 2>/dev/null

# Remove old service files
echo "Removing old service files..."
sudo rm -f /etc/systemd/system/claude-watcher.service
sudo rm -f /etc/systemd/system/conversation-parser.service

# List of redundant files to remove
REDUNDANT_FILES=(
    "claude_folder_watcher.py"
    "claude_folder_watcher_smart.py"
    "claude_folder_watcher_redis.py"
    "conversation_parser_service.py"
    "conversation_parser_smart.py"
    "conversation_parser_smart_v2.py"
    "conversation_parser_redis.py"
    "claude-watcher.service"
    "claude-watcher-smart.service"
    "claude-watcher-redis.service"
    "conversation-parser.service"
    "conversation-parser-smart.service"
    "install_smart_services.sh"
    "install_smart_services_v2.sh"
    "start_claude_watcher.sh"
)

# Remove redundant scripts
echo "Removing redundant scripts..."
SCRIPT_DIR="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/scripts"
for file in "${REDUNDANT_FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$file" ]; then
        echo "  Removing: $file"
        rm -f "$SCRIPT_DIR/$file"
    fi
done

# Remove old aggregated conversations file
echo "Removing old aggregated_conversations.jsonl..."
rm -f /home/ubuntumain/.claude/aggregated_conversations.jsonl

# Install new service
echo "Installing new simplified service..."
sudo cp "$SCRIPT_DIR/claude-manager.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable claude-manager.service
sudo systemctl start claude-manager.service

# Check status
echo
echo "=== Service Status ==="
sudo systemctl status claude-manager.service --no-pager

echo
echo "=== Cleanup Complete ==="
echo "The simplified Redis-based Claude conversation manager is now running."
echo "Conversations are saved to: the-luminal-archive/quantum-memory/quantum_states/conversations/current.json"
echo
echo "To monitor logs: journalctl -u claude-manager -f"