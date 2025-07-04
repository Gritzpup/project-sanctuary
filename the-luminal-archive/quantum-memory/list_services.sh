#!/bin/bash
# List all available services in the Quantum Memory Service Terminal

echo "🧠 Quantum Memory Services 🧠"
echo "================================"
echo ""
echo "Available services:"
echo ""

# Core Services
echo "📌 Core Services:"
echo "  • quantum_dashboard       - Real-time visualization dashboard (port 5174)"
echo "  • living_equation         - Quantum relationship dynamics (WebSocket port 8768)"
echo "  • conversation_aggregator - Creates current.json from Claude conversations"
echo "  • quantum_memory_service  - Main orchestrator service"
echo ""

# Processing Services
echo "🔄 Processing Services:"
echo "  • emollama_analyzer      - Emotional analysis with Emollama-7B"
echo "  • claude_analyzer_redis  - Redis-based conversation analyzer"
echo "  • redis_file_sync        - Syncs Redis to JSON files"
echo "  • entity_state_updater   - Updates entity consciousness"
echo ""

# Monitoring Services
echo "📊 Monitoring Services:"
echo "  • redis_status_monitor   - Real-time Redis monitoring"
echo "  • status_consolidator    - Consolidates service statuses"
echo "  • claude_doctor          - Health check tool"
echo ""

# System Services
echo "⚙️  System Services:"
echo "  • redis_server           - Redis backend (port 6379)"
echo ""

echo "To manage services, run: ./run_service_terminal.sh"
echo ""
echo "Start scripts are in: services/start_scripts/"
echo "Configuration file: services/service_config.json"