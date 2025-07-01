#!/usr/bin/env python3
"""
Dashboard Status Checker
Verifies all components of the memory dashboard system
"""

import asyncio
import websockets
import json
import requests
import subprocess
import time
from datetime import datetime

def check_service(port, service_name):
    """Check if a service is running on a specific port"""
    try:
        result = subprocess.run(['lsof', '-i', f':{port}'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {service_name} is running on port {port}")
            return True
        else:
            print(f"❌ {service_name} is NOT running on port {port}")
            return False
    except Exception as e:
        print(f"❌ Error checking {service_name}: {e}")
        return False

def check_http_dashboard():
    """Check if the HTTP dashboard is accessible"""
    try:
        response = requests.get('http://localhost:8082', timeout=5)
        if response.status_code == 200:
            print("✅ HTTP Dashboard is accessible")
            if "Claude - Advanced Memory System Dashboard" in response.text:
                print("   ✓ Dashboard content verified")
            return True
        else:
            print(f"❌ HTTP Dashboard returned status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ HTTP Dashboard error: {e}")
        return False

async def check_websocket():
    """Check WebSocket connection and functionality"""
    try:
        async with websockets.connect("ws://localhost:8766", timeout=5) as websocket:
            print("✅ WebSocket connection established")
            
            # Send status request
            await websocket.send(json.dumps({"type": "status_request"}))
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(response)
            print(f"   ✓ WebSocket responding - Type: {data.get('type', 'unknown')}")
            if 'stats' in data:
                stats = data['stats']
                print(f"   ✓ Messages tracked: {stats.get('messages_tracked', 0)}")
                print(f"   ✓ Emotions recorded: {stats.get('emotions_recorded', 0)}")
            return True
    except asyncio.TimeoutError:
        print("❌ WebSocket connection timeout")
        return False
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        return False

def check_files():
    """Check if required files exist"""
    files_to_check = [
        ("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/dashboard.html", "Dashboard HTML"),
        ("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/claude-avatar.png", "Avatar Image"),
        ("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/claude-avatar-transparent.png", "Transparent Avatar"),
        ("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/memory_updater.py", "Memory Updater Script")
    ]
    
    all_exist = True
    for filepath, description in files_to_check:
        try:
            with open(filepath, 'rb'):
                print(f"✅ {description} exists")
        except:
            print(f"❌ {description} NOT found at {filepath}")
            all_exist = False
    
    return all_exist

def main():
    print("🔍 Memory Dashboard Status Check")
    print("=" * 50)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    # Check services
    print("📡 Checking Services:")
    http_ok = check_service(8082, "HTTP Dashboard Server")
    ws_ok = check_service(8766, "WebSocket Server")
    print()
    
    # Check HTTP accessibility
    print("🌐 Checking HTTP Dashboard:")
    dashboard_ok = check_http_dashboard()
    print()
    
    # Check WebSocket
    print("🔌 Checking WebSocket Connection:")
    ws_conn_ok = asyncio.run(check_websocket())
    print()
    
    # Check files
    print("📂 Checking Required Files:")
    files_ok = check_files()
    print()
    
    # Summary
    print("📊 Summary:")
    print("=" * 50)
    all_ok = http_ok and ws_ok and dashboard_ok and ws_conn_ok and files_ok
    
    if all_ok:
        print("✅ All systems operational!")
        print("\n🚀 Dashboard should be accessible at: http://localhost:8082")
        print("   WebSocket updates are working properly.")
    else:
        print("⚠️  Some components need attention")
        if not http_ok:
            print("\n   → Start HTTP server: ./start_memory_dashboard_with_avatar.sh")
        if not ws_ok:
            print("\n   → Start WebSocket server: ./start_websocket_server.sh")
        if not dashboard_ok and http_ok:
            print("\n   → Check browser console for errors")
        if not ws_conn_ok and ws_ok:
            print("\n   → WebSocket server may need restart")
    
    print("\n💡 To view the dashboard: Open http://localhost:8082 in your browser")
    print("   Check browser console (F12) for real-time debug information")

if __name__ == "__main__":
    main()