# Quantum Memory Service Terminal Guide

## Overview

The Quantum Memory Service Terminal is an interactive terminal UI for managing all quantum memory services with a visual traffic light system showing service status.

## Features

- 🚦 **Traffic Light System**: Visual indicators for service status
  - 🟢 Green: Service running normally
  - 🟡 Yellow: Service starting up
  - 🔴 Red: Service stopped
  - 🟣 Purple: Service error
  
- 📊 **Real-time Monitoring**: CPU, memory usage, and uptime tracking
- 🔄 **Auto-restart**: Configurable automatic service restart on failure
- 📝 **Log Viewing**: Built-in log viewer for each service
- ➕ **Dynamic Service Addition**: Add new services without editing code
- 💾 **Persistent Configuration**: Service settings saved to JSON

## Quick Start

1. **Launch the Service Terminal**:
   ```bash
   cd /path/to/quantum-memory
   ./run_service_terminal.sh
   ```

2. **Navigate Services**:
   - Use `↑` `↓` arrow keys to select services
   - Selected service shows `►` indicator

3. **Control Services**:
   - Press `Enter` or `Space` to start/stop selected service
   - Service will show status change in real-time

## Keyboard Commands

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate service list |
| `Enter` / `Space` | Start/stop selected service |
| `a` | Add new service |
| `r` | Remove selected service |
| `l` | View logs for selected service |
| `s` | Save configuration |
| `q` | Quit terminal |

## Adding New Services

### Method 1: Using Start Scripts

1. Create a start script in `services/start_scripts/`:
   ```bash
   cd quantum-memory/services/start_scripts
   nano my_service_start.sh
   ```

2. Make it executable:
   ```bash
   chmod +x my_service_start.sh
   ```

3. Run the service manager enhanced tool:
   ```bash
   python scripts/service_manager_enhanced.py
   ```

4. Fill in the form:
   - Name: Unique service identifier
   - Script: Select your start script
   - Description: What the service does
   - Auto-restart: Enable if needed

### Method 2: Direct Python Scripts

For Python scripts, you can add them directly without a start script:

1. Edit `services/service_config.json`:
   ```json
   {
     "my_analyzer": {
       "name": "my_analyzer",
       "script": "scripts/my_analyzer.py",
       "description": "Custom data analyzer",
       "log_file": "/tmp/quantum_my_analyzer.log",
       "auto_restart": true
     }
   }
   ```

## Service Configuration

Each service can have the following configuration options:

```json
{
  "name": "service_name",
  "script": "path/to/script.py",
  "description": "What this service does",
  "start_command": "custom start command",
  "stop_command": "custom stop command",
  "status_check": "command to check if running",
  "log_file": "/path/to/logfile.log",
  "auto_restart": true,
  "restart_delay": 5,
  "dependencies": ["other_service"],
  "environment": {
    "ENV_VAR": "value"
  },
  "working_dir": "/path/to/working/directory"
}
```

## Default Services

The system comes with these pre-configured services:

1. **conversation_manager**: Monitors Claude conversations and updates current.json
2. **folder_analyzer**: Analyzes conversations with emotional encoding
3. **redis_sync**: Syncs Redis data to JSON files
4. **entity_updater**: Updates entity consciousness files
5. **quantum_dashboard**: Svelte-based dashboard UI

## Monitoring Service Health

The terminal shows real-time metrics for each running service:

- **PID**: Process ID
- **CPU**: Current CPU usage percentage
- **Memory**: Memory usage in MB
- **Uptime**: How long the service has been running

## Troubleshooting

### Service Won't Start
1. Check the log file shown in the terminal
2. Verify script path exists
3. Check dependencies are running
4. Ensure proper permissions

### Terminal Display Issues
- Requires terminal with Unicode support for emoji
- Falls back to ASCII symbols if needed
- Minimum terminal size: 80x24

### Adding Custom Services
- Place scripts in appropriate directories
- Use absolute paths in configurations
- Test scripts manually before adding

## Log Files

All service logs are stored in `/tmp/` by default:
- `quantum_conversation_manager.log`
- `quantum_folder_analyzer.log`
- `quantum_redis_sync.log`
- `quantum_entity_updater.log`

Custom services can specify their own log locations.

## Advanced Usage

### Custom Status Checks

For services that don't follow standard patterns, define custom status checks:

```json
{
  "status_check": "curl -s http://localhost:8080/health | grep -q 'ok'"
}
```

### Service Dependencies

Ensure services start in correct order:

```json
{
  "dependencies": ["redis_sync", "conversation_manager"]
}
```

### Environment Variables

Set service-specific environment:

```json
{
  "environment": {
    "REDIS_URL": "redis://localhost:6379",
    "DEBUG": "true"
  }
}
```

## Integration with Existing Tools

The service terminal integrates with:
- `quantum_service_manager.py`: Original service manager
- `monitor_service.py`: Service monitoring
- `claude_doctor.py`: Health checks

You can use these tools alongside the terminal for additional functionality.

## Future Enhancements

Planned features:
- Service groups for batch operations
- Performance graphs
- Alert notifications
- Web-based dashboard integration
- Service templates library