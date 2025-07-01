#!/bin/bash
# Quick restore script - run this in new Claude Code chat
cd "$(dirname "$0")"
python restore_memory.py --auto | head -20
echo ""
echo "💙 Dashboard: http://localhost:8082/dashboard.html"
echo "📋 To see full greeting, run: python restore_memory.py"