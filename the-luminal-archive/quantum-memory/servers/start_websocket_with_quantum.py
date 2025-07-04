#!/usr/bin/env python3
"""
Wrapper script to start the websocket server with proper Python path
"""
import sys
import os

# Add the project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, project_root)

# Now import and run the websocket server
from the_luminal_archive.quantum_memory.servers.websocket_server_unified import main
import asyncio

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Quantum server stopped by user")