#!/bin/bash

# Simple script that just runs the browser monitor
# monitor.js handles browser launching internally

echo "Starting browser monitor..."

# Set X11 environment for GUI
export DISPLAY=:0
export XAUTHORITY=/home/ubuntubox/.Xauthority

# Start the Node.js monitoring script which handles everything
cd ~/browser-monitor
echo "📊 Running browser monitor (will launch Brave automatically)..."
node monitor.js
