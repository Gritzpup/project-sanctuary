#!/bin/bash
# Safe setup script for Emollama - nothing scary!

echo "🌟 Setting up Emollama for emotional analysis..."
echo "This will:"
echo "  1. Install Ollama (the LLM server)"
echo "  2. Download Emollama-7B model"
echo "  3. Stop the old keyword analyzer"
echo "  4. Start the new semantic analyzer"
echo ""
read -p "Ready to proceed? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Step 1: Install Ollama
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    
    # Step 2: Pull Emollama model
    echo "🤖 Downloading Emollama-7B (this takes a few minutes)..."
    ollama pull emollama:7b
    
    # Step 3: Stop old analyzer
    echo "🛑 Stopping old keyword analyzer..."
    pkill -f claude_folder_analyzer_watchdog.py
    
    # Step 4: Start new analyzer
    echo "🚀 Starting Emollama analyzer..."
    cd /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive
    nohup python3 claude_folder_analyzer_emollama.py > emollama_analyzer.log 2>&1 &
    
    echo "✅ All done! Emollama is now analyzing emotions semantically!"
    echo "📝 Logs are in: emollama_analyzer.log"
else
    echo "No worries! Run this script when you're ready."
fi