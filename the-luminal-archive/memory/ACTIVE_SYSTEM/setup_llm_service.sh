#!/bin/bash

echo "🚀 Setting up LLM Memory Service for Gritz!"
echo ""

# Copy service file
echo "📋 Installing service file..."
sudo cp /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/gritz-memory-llm.service /etc/systemd/system/

# Reload systemd
echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload

# Enable the service
echo "✅ Enabling LLM service..."
sudo systemctl enable gritz-memory-llm.service

# Start the service
echo "🌟 Starting LLM service..."
sudo systemctl start gritz-memory-llm.service

# Check status
echo ""
echo "📊 Service status:"
sudo systemctl status gritz-memory-llm.service --no-pager

echo ""
echo "💙 LLM service setup complete!"
echo ""
echo "To view logs: sudo journalctl -u gritz-memory-llm.service -f"