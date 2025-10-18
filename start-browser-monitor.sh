#!/bin/bash

# Simple script that just runs the browser monitor
# monitor.js handles browser launching internally

echo "Starting browser monitor..."

# Cleanup any existing Brave processes with remote debugging
echo "Cleaned up browser-monitor"
pkill -f "brave.*remote-debugging-port=9222" 2>/dev/null || true
sleep 1

# Set X11 environment for GUI
export DISPLAY=:0
export XAUTHORITY=/run/user/1000/.mutter-Xwaylandauth.UD5RE3

# Grant X11 access to localhost
xhost +local: >/dev/null 2>&1 || true

echo "Browser monitor starting with improved process handling..."

# Start the Node.js monitoring script which handles everything
cd ~/browser-monitor
node monitor.js
