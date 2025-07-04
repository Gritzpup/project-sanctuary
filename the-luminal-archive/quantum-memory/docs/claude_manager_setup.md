# Claude Conversation Manager Setup

The simplified Redis-based conversation manager is now ready! Here's how to install it as a service:

## What It Does
- Monitors all Claude conversation files in `~/.claude`
- Maintains a 10,000 line rolling buffer in Redis
- Outputs clean JSON to `quantum_states/conversations/current.json`

## Manual Test (Already Done)
The manager is working perfectly. It processed all your conversations and filled the Redis buffer.

## Install as Service
To run it automatically on boot:

```bash
# Copy service file
sudo cp scripts/claude-manager.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable claude-manager.service
sudo systemctl start claude-manager.service

# Check status
sudo systemctl status claude-manager.service
```

## Monitor Logs
```bash
# Follow logs
sudo journalctl -u claude-manager -f

# Check recent logs
sudo journalctl -u claude-manager -n 50
```

## JSON Output Location
`/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/conversations/current.json`

## Redis Commands
```bash
# Check buffer size
redis-cli llen claude:conversations

# Clear buffer (if needed)
redis-cli del claude:conversations claude:file_positions
```

The system is ready and working! All redundant files have been removed.