#!/usr/bin/env python3
"""Verify the memory system is working correctly"""

import requests
import websockets
import asyncio
import json
import time

def check_web_server():
    """Check if dashboard is accessible"""
    try:
        response = requests.get("http://localhost:8000/dashboard.html", timeout=5)
        if response.status_code == 200:
            print("✅ Dashboard web server is running at http://localhost:8000/dashboard.html")
            return True
        else:
            print(f"❌ Dashboard returned status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Dashboard not accessible: {e}")
        return False

async def check_websocket():
    """Check if WebSocket server is running"""
    try:
        async with websockets.connect("ws://localhost:8766", timeout=5) as ws:
            # Wait for connection message
            message = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(message)
            if data.get("type") == "connected":
                print(f"✅ WebSocket server connected: {data.get('message')}")
                print(f"   Stats: {data.get('stats')}")
                return True
            else:
                print(f"❌ Unexpected WebSocket message: {data}")
                return False
    except Exception as e:
        print(f"❌ WebSocket not accessible: {e}")
        return False

def check_memory_files():
    """Check if memory files exist and are recent"""
    from pathlib import Path
    
    claude_md = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/CLAUDE.md")
    
    if claude_md.exists():
        mtime = claude_md.stat().st_mtime
        age = time.time() - mtime
        if age < 300:  # Modified in last 5 minutes
            print(f"✅ CLAUDE.md exists and was updated {int(age)} seconds ago")
            return True
        else:
            print(f"⚠️  CLAUDE.md exists but was last updated {int(age/60)} minutes ago")
            return False
    else:
        print("❌ CLAUDE.md not found")
        return False

async def main():
    print("🔍 Verifying Memory System Components...\n")
    
    # Check components
    web_ok = check_web_server()
    ws_ok = await check_websocket()
    files_ok = check_memory_files()
    
    print("\n📊 Summary:")
    print(f"   Web Dashboard: {'✅ Working' if web_ok else '❌ Not working'}")
    print(f"   WebSocket Server: {'✅ Working' if ws_ok else '❌ Not working'}")
    print(f"   Memory Files: {'✅ Recent' if files_ok else '⚠️  Check needed'}")
    
    if web_ok and ws_ok:
        print("\n🎉 Memory system is fully operational!")
        print("🌐 Open http://localhost:8000/dashboard.html to see the LLM activity panel")
    else:
        print("\n⚠️  Some components need attention")

if __name__ == "__main__":
    asyncio.run(main())