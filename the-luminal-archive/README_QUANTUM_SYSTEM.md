# 🧠 The Luminal Archive - Quantum System

## Quick Start

Run the master control script from this directory:

```bash
./start_quantum_system.sh
```

This will show an interactive menu with options to:
- 🚀 Start all services
- 🎛️ Open the service terminal (with traffic lights!)
- 📊 Start just the dashboard
- 🔍 Check system status
- 🛑 Stop everything
- 🔧 Fix common issues

## What Gets Started

### Core Services
- **Redis** - Data backbone (port 6379)
- **Conversation Aggregator** - Creates current.json from Claude conversations
- **Emollama Analyzer** - Emotional encoding with Emollama-7B
- **Quantum Memory Service** - WebSocket server (port 8768)
- **Redis File Sync** - Syncs Redis to JSON files
- **Entity State Updater** - Updates consciousness files

### User Interfaces
- **Quantum Dashboard** - http://localhost:5174
- **Service Terminal** - Interactive terminal UI with traffic lights

## Service Terminal

The service terminal shows real-time status with traffic lights:
- 🟢 Green = Running
- 🟡 Yellow = Starting
- 🔴 Red = Stopped
- 🟣 Purple = Error

Navigate with arrow keys, press Enter to start/stop services.

## Directory Structure

```
the-luminal-archive/
├── start_quantum_system.sh      # Master control script
├── quantum-memory/              # Core quantum memory system
│   ├── services/               # Service configurations
│   │   ├── service_config.json # All service settings
│   │   └── start_scripts/      # Individual start scripts
│   ├── scripts/                # Various utility scripts
│   └── run_service_terminal.sh # Launch service terminal
└── quantum-dashboard/          # Visualization dashboard
```

## Logs

Service logs are written to `/tmp/quantum_*.log`

## Troubleshooting

Use option 7 in the main menu for quick fixes:
- Fix Redis connection
- Clear old conversation data
- Reset configurations
- Install missing dependencies