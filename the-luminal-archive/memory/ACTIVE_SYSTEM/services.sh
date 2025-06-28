#!/bin/bash
# 💙 Gritz Memory System - Master Services Controller
# Consolidated script to manage all memory services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

case "$1" in
    start)
        echo "🚀 Starting all memory services..."
        
        # Start main memory updater
        echo "📊 Starting memory updater..."
        systemctl --user start gritz-memory-ultimate.service
        
        # Start WebSocket server
        echo "🌐 Starting WebSocket server..."
        systemctl --user start gritz-websocket-server.service
        
        # Start LLM service
        echo "🧠 Starting LLM service..."
        systemctl --user start gritz-memory-llm.service
        
        # Start dashboard
        echo "🖥️ Starting dashboard..."
        systemctl --user start gritz-memory-dashboard.service
        
        echo "✅ All services started!"
        echo "📊 Dashboard: http://localhost:8081"
        echo "🌐 WebSocket: ws://localhost:8766"
        ;;
        
    stop)
        echo "🛑 Stopping all memory services..."
        systemctl --user stop gritz-memory-ultimate gritz-websocket-server gritz-memory-llm gritz-memory-dashboard
        echo "✅ All services stopped!"
        ;;
        
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
        
    status)
        echo "📊 Memory System Status:"
        echo "========================"
        systemctl --user status gritz-memory-ultimate --no-pager | grep "Active:"
        systemctl --user status gritz-websocket-server --no-pager | grep "Active:"
        systemctl --user status gritz-memory-llm --no-pager | grep "Active:"
        systemctl --user status gritz-memory-dashboard --no-pager | grep "Active:"
        
        echo -e "\n📝 CLAUDE.md last update:"
        stat -c "%y" "$SCRIPT_DIR/CLAUDE.md" 2>/dev/null || echo "File not found!"
        
        echo -e "\n🔌 Port status:"
        lsof -i:8766 >/dev/null 2>&1 && echo "WebSocket (8766): ✅ OPEN" || echo "WebSocket (8766): ❌ CLOSED"
        lsof -i:8081 >/dev/null 2>&1 && echo "Dashboard (8081): ✅ OPEN" || echo "Dashboard (8081): ❌ CLOSED"
        ;;
        
    logs)
        echo "📋 Recent logs:"
        journalctl --user -u gritz-memory-ultimate -n 20 --no-pager
        ;;
        
    *)
        echo "💙 Gritz Memory System - Service Manager"
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all memory services"
        echo "  stop    - Stop all memory services"
        echo "  restart - Restart all services"
        echo "  status  - Check service status"
        echo "  logs    - View recent logs"
        ;;
esac