# Start Scripts Directory

This directory contains start scripts for services managed by the Quantum Memory Service Terminal.

## How to Add a New Service

1. Create a shell script in this directory (e.g., `my_service.sh`)
2. Make it executable: `chmod +x my_service.sh`
3. The script should:
   - Set up any required environment
   - Start the service
   - Handle logging

## Example Start Script

```bash
#!/bin/bash
# Start script for My Service

# Set up environment
export PYTHONPATH="/path/to/project:$PYTHONPATH"
export MY_SERVICE_CONFIG="/path/to/config.json"

# Create log directory
LOG_DIR="/tmp/quantum_services/logs"
mkdir -p "$LOG_DIR"

# Start the service
cd /path/to/service/directory
python3 my_service.py > "$LOG_DIR/my_service.log" 2>&1
```

## Naming Convention

- Use descriptive names: `<service_name>_start.sh`
- Examples:
  - `redis_monitor_start.sh`
  - `emotion_analyzer_start.sh`
  - `dashboard_server_start.sh`

## Service Configuration

After creating a start script, you can add it to the service terminal by:

1. Running the service terminal: `python scripts/service_terminal.py`
2. Pressing 'a' to add a new service
3. Providing the script path and service details

The configuration will be saved in `services/service_config.json`.