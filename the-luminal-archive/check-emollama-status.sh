#\!/bin/bash

echo "🔍 Checking Emollama-7B Installation Status..."
echo "=========================================="

# Check if model files exist
MODEL_CACHE="$HOME/.cache/emollama/models"
if [ -d "$MODEL_CACHE" ]; then
    echo "✅ Model cache directory exists"
    echo "📁 Cache contents:"
    du -sh "$MODEL_CACHE"/* 2>/dev/null || echo "   (empty)"
else
    echo "❌ Model cache directory not found"
fi

# Check if transformers cache has the model
HF_CACHE="$HOME/.cache/huggingface/hub"
if [ -d "$HF_CACHE" ]; then
    echo ""
    echo "🤗 HuggingFace cache:"
    find "$HF_CACHE" -name "*emollama*" -type d 2>/dev/null  < /dev/null |  head -5
fi

# Test if we can import the module
echo ""
echo "🐍 Testing Python import..."
cd /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive
python3 -c "
import sys
sys.path.insert(0, '/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive')
try:
    from quantum_memory.src.core.emollama_integration import get_emollama_analyzer
    analyzer = get_emollama_analyzer()
    print('✅ Emollama module imported successfully')
    print('🔄 Loading model (this may take a moment)...')
    if analyzer.load_model():
        print('✅ Model loaded successfully!')
    else:
        print('⚠️  Model loading failed')
except Exception as e:
    print(f'❌ Import error: {e}')
"

# Check service status
echo ""
echo "🚀 Service Status:"
if systemctl --user is-active emollama-analyzer.service >/dev/null 2>&1; then
    echo "✅ Emollama analyzer service is running"
    systemctl --user status emollama-analyzer.service --no-pager | head -10
else
    echo "⚠️  Emollama analyzer service is not running"
fi

# Check old analyzer
if pgrep -f "claude_folder_analyzer_watchdog.py" >/dev/null; then
    echo ""
    echo "⚠️  Old watchdog analyzer is still running"
    echo "   Run './switch-to-emollama.sh' to switch"
fi

echo ""
echo "📊 Current memory status:"
ps aux | grep -E "(emollama|claude_folder)" | grep -v grep || echo "No analyzers running"
