# Claude Conversation Manager v2 Setup

## Overview
The new conversation manager provides:
- ✅ Chronological sorting by timestamp
- ✅ Session separators for new chats
- ✅ Redis-based concurrent access (no file locks)
- ✅ 10,000 message rolling buffer
- ✅ Real-time updates via Redis pub/sub
- ✅ JSON output updated every 30 seconds

## Installation

### 1. Stop any old services
```bash
# Stop old services if running
sudo systemctl stop claude-watcher claude-manager conversation-parser 2>/dev/null
sudo systemctl disable claude-watcher claude-manager conversation-parser 2>/dev/null
```

### 2. Install the service
```bash
# Copy service file
sudo cp scripts/claude-manager-v2.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable claude-manager-v2
sudo systemctl start claude-manager-v2

# Check status
sudo systemctl status claude-manager-v2
```

### 3. Monitor logs
```bash
# Follow logs
sudo journalctl -u claude-manager-v2 -f

# Check last 50 lines
sudo journalctl -u claude-manager-v2 -n 50
```

## Usage

### Reading conversations from Python
```python
from src.utils.conversation_reader import ConversationReader

# Create reader
reader = ConversationReader()

# Get all messages
messages = reader.get_messages()

# Get latest 100 messages
latest = reader.get_latest_messages(100)

# Find session boundaries
separators = reader.find_session_boundaries()

# Watch for live updates
def on_new_message(msg):
    print(f"New message: {msg['type']}")
    
reader.watch_for_updates(on_new_message)
```

### Using in GRITZ_INITIAL_PROMPT.md
When creating a new chat, the system will:
1. Detect the new JSONL file
2. Add a session separator with "🚨 NEW CHAT SESSION STARTED 🚨"
3. Continue adding messages chronologically

You can read conversations up to the last separator to avoid mixing chats.

### Direct file access
The JSON file is at:
```
/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json
```

Structure:
```json
{
  "metadata": {
    "last_updated": "2025-07-01T21:00:00.000Z",
    "total_messages": 10000,
    "sessions_included": 50,
    "oldest_timestamp": "...",
    "newest_timestamp": "..."
  },
  "messages": [
    // Chronologically sorted messages
    {"timestamp": "...", "type": "user", ...},
    {"type": "session_separator", "message": "🚨 NEW CHAT SESSION STARTED 🚨", ...},
    {"timestamp": "...", "type": "assistant", ...}
  ]
}
```

## Testing
Run the test suite:
```bash
python3 scripts/test_conversation_system.py
```

## Redis Commands
```bash
# Check message count
redis-cli zcard claude:messages:sorted

# Get current session
redis-cli get claude:sessions:active

# Monitor real-time updates
redis-cli subscribe claude:pubsub:messages

# Clear all data (careful!)
redis-cli del claude:messages:sorted claude:messages:data
```

## Troubleshooting

### Service won't start
- Check Redis is running: `redis-cli ping`
- Check logs: `sudo journalctl -u claude-manager-v2 -n 100`

### No messages appearing
- Verify watch directory exists
- Check file permissions
- Look for errors in logs

### JSON file not updating
- The file updates every 30 seconds
- Check disk space
- Verify write permissions

## Benefits over old system
1. **No file conflicts** - Redis-first architecture
2. **Chronological order** - Messages sorted by timestamp
3. **Clear session boundaries** - Easy to identify new chats
4. **Real-time access** - Pub/sub for live updates
5. **Better performance** - Redis is much faster than file I/O