# 📁 Memory System Folder Structure

*Last Updated: 2025-06-27*

## 🏗️ Clean Organization

```
memory/
├── 📄 CLAUDE.md                          # ⭐ Your living memory file (auto-updated)
├── 🖼️ claude-avatar.png                  # Your beautiful avatar image!
│
├── 🔧 Active Scripts
│   ├── advanced_memory_updater_ws.py     # Main WebSocket memory updater
│   ├── llm_memory_service.py            # LLM service for semantic processing
│   ├── llm_memory_updater.py           # LLM integration helper
│   ├── install_llm_system.sh            # LLM setup script
│   ├── start_websocket_server.sh        # WebSocket launcher
│   ├── start_memory_dashboard_with_avatar.sh  # Dashboard launcher
│   └── start_all_memory_services.sh     # Start everything
│
├── 📚 Documentation
│   ├── LLM_SETUP_GUIDE.md              # LLM installation guide
│   ├── LLM_STATUS_REPORT.md            # Current LLM status
│   ├── MEMORY_DASHBOARD_AVATAR.md      # Dashboard documentation
│   ├── MEMORY_SYSTEM_LOCATION.md       # File locations
│   ├── MEMORY_SYSTEM_SUMMARY.md        # System overview
│   ├── UNIQUE_GREETINGS_SETUP.md       # Greeting configuration
│   └── FOLDER_STRUCTURE.md             # This file!
│
├── 🧠 LLM Virtual Environment
│   └── llm_venv/                       # Python venv with AI models
│       ├── bin/                        # Python binaries
│       ├── lib/                        # Installed packages
│       └── share/                      # Package data
│
├── 📦 sanctuary-memory-system/         # Advanced memory implementation
│   ├── README.md                       # Main documentation
│   ├── README_ACTUAL.md               # Implementation details
│   ├── demo.py                        # Demo script
│   └── docs/                          # Additional docs
│
└── 📊 gritz-memory-system/            # Core memory system
    ├── README.md                      # System documentation
    ├── docs/
    │   └── memory_dashboard.html      # Dashboard interface
    └── backups/                       # Backup files

```

## 🚀 Running Services

1. **WebSocket Server** (Port 8766)
   - Broadcasting real-time memory updates
   - Started via systemd

2. **LLM Service** 
   - Processing memories with AI
   - Using GPU acceleration
   - Started via systemd

3. **Memory Dashboard** (Port 8081)
   - Visual interface with Claude's avatar
   - Real-time emotion display
   - WebSocket connection status

## 💡 Quick Commands

```bash
# Check all services
systemctl --user status gritz-memory-ultimate

# View dashboard
firefox http://localhost:8081

# Watch CLAUDE.md updates
watch -n 1 cat CLAUDE.md | head -20

# Check WebSocket
python3 -c "import asyncio, websockets; asyncio.run(websockets.connect('ws://localhost:8766'))"
```

## 🧹 What We Cleaned Up

- ✅ Removed duplicate documentation files
- ✅ Deleted old test scripts
- ✅ Removed outdated setup scripts
- ✅ Cleaned up backup versions
- ✅ Consolidated everything into organized folders

Your memory system is now clean, organized, and running beautifully! 💙