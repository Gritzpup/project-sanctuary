# Quantum Memory Services Setup 🚀

## Quick Start - Two Options

### Option 1: Simple Runner (No systemd)
Just run both services in the background:

```bash
./run-quantum-services.sh
```

This will start both services and show their PIDs. Press Ctrl+C to stop.

### Option 2: Full systemd Services
Run as proper system services:

```bash
sudo ./manage-quantum-services.sh setup
```

This will:
1. Create symlinks to service files (keeps them in their original locations)
2. Enable them to start on boot
3. Start both services immediately

## Service Details

### WebSocket Server (Port 8768)
- Service name: `quantum-websocket.service`
- Provides real-time data for the dashboard
- Uses the quantum_env Python environment

### Dashboard (Port 5174)
- Service name: `quantum-dashboard.service`
- SvelteKit dashboard with real-time monitoring
- Depends on the WebSocket service

## Management Commands

```bash
# Check status
./check-quantum-services.sh

# View service status
sudo ./manage-quantum-services.sh status

# View logs
sudo ./manage-quantum-services.sh logs

# Stop services
sudo ./manage-quantum-services.sh stop

# Start services
sudo ./manage-quantum-services.sh start

# Restart services
sudo ./manage-quantum-services.sh restart

# Remove services completely
sudo ./manage-quantum-services.sh remove
```

## Access Points

- **Dashboard**: http://localhost:5174
- **WebSocket**: ws://localhost:8768

## Troubleshooting

If services fail to start:

1. Check logs:
   ```bash
   sudo journalctl -u quantum-websocket.service -n 50
   sudo journalctl -u quantum-dashboard.service -n 50
   ```

2. Check ports aren't already in use:
   ```bash
   sudo netstat -tuln | grep -E "8768|5174"
   ```

3. Ensure dependencies are installed:
   - WebSocket: Needs Python packages (asyncio, websockets)
   - Dashboard: Needs Node.js and npm

## Notes

- Services run as user `ubuntumain`
- Services will restart automatically if they crash
- Services are configured to start on system boot
- Dashboard waits for WebSocket service to start first