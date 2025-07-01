#!/bin/bash
#
# Sanctuary Memory System Installation Script
# Optimized for Ubuntu with RTX 2080 Super
# 
# This script installs all dependencies and sets up the memory system
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/.sanctuary-memory"
VENV_DIR="$INSTALL_DIR/venv"
MODEL_CACHE_DIR="$HOME/.cache/sanctuary-memory"
LOG_FILE="$INSTALL_DIR/install.log"

# Print colored message
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Log message
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if running on Ubuntu
check_ubuntu() {
    if [ ! -f /etc/lsb-release ]; then
        print_message $RED "This script is designed for Ubuntu. Your system appears to be different."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check CUDA installation
check_cuda() {
    print_message $BLUE "🔍 Checking CUDA installation..."
    
    if command -v nvidia-smi &> /dev/null; then
        print_message $GREEN "✅ NVIDIA driver found"
        nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
        
        if command -v nvcc &> /dev/null; then
            print_message $GREEN "✅ CUDA compiler found"
            nvcc --version | grep "release"
        else
            print_message $YELLOW "⚠️  CUDA compiler (nvcc) not found"
            print_message $YELLOW "Installing CUDA toolkit is recommended for optimal performance"
            read -p "Continue without CUDA compiler? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_message $BLUE "Please install CUDA from: https://developer.nvidia.com/cuda-downloads"
                exit 1
            fi
        fi
    else
        print_message $YELLOW "⚠️  No NVIDIA GPU detected. The system will run on CPU (slower)"
        read -p "Continue with CPU-only installation? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Install system dependencies
install_system_deps() {
    print_message $BLUE "📦 Installing system dependencies..."
    
    # Update package list
    sudo apt-get update
    
    # Install required packages
    sudo apt-get install -y \
        python3.10 \
        python3.10-venv \
        python3-pip \
        git \
        curl \
        build-essential \
        python3-dev \
        libssl-dev \
        libffi-dev \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev
    
    print_message $GREEN "✅ System dependencies installed"
}

# Create directory structure
create_directories() {
    print_message $BLUE "📁 Creating directory structure..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$MODEL_CACHE_DIR"
    mkdir -p "$HOME/.sanctuary-memory/data"
    mkdir -p "$HOME/.sanctuary-memory/configs"
    mkdir -p "$HOME/.sanctuary-memory/logs"
    
    # Copy the project files
    if [ -d "../src" ]; then
        cp -r ../src "$INSTALL_DIR/"
        cp -r ../config "$INSTALL_DIR/" 2>/dev/null || true
    fi
    
    print_message $GREEN "✅ Directories created"
}

# Setup Python virtual environment
setup_venv() {
    print_message $BLUE "🐍 Setting up Python virtual environment..."
    
    python3.10 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    
    # Upgrade pip
    pip install --upgrade pip wheel setuptools
    
    print_message $GREEN "✅ Virtual environment created"
}

# Install PyTorch with CUDA support
install_pytorch() {
    print_message $BLUE "🔥 Installing PyTorch..."
    
    if command -v nvidia-smi &> /dev/null; then
        # Install PyTorch with CUDA 11.8 support
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
        print_message $GREEN "✅ PyTorch installed with CUDA support"
    else
        # CPU-only version
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
        print_message $GREEN "✅ PyTorch installed (CPU-only)"
    fi
}

# Install Python dependencies
install_python_deps() {
    print_message $BLUE "📚 Installing Python dependencies..."
    
    # Core dependencies
    pip install transformers==4.36.0
    pip install accelerate==0.25.0
    pip install bitsandbytes==0.41.3
    pip install sentence-transformers==2.2.2
    
    # Vector database and search
    pip install chromadb==0.4.22
    pip install faiss-gpu==1.7.2 || pip install faiss-cpu==1.7.4
    
    # Utilities
    pip install watchdog==3.0.0
    pip install pyyaml==6.0.1
    pip install psutil==5.9.6
    pip install python-dotenv==1.0.0
    
    # Web UI dependencies (optional)
    pip install fastapi==0.104.1
    pip install uvicorn==0.24.0
    pip install pyvis==0.3.2
    pip install networkx==3.2.1
    
    print_message $GREEN "✅ Python dependencies installed"
}

# Download models
download_models() {
    print_message $BLUE "🤖 Downloading AI models (this may take a while)..."
    
    source "$VENV_DIR/bin/activate"
    
    python3 << EOF
import os
os.environ['TRANSFORMERS_CACHE'] = '$MODEL_CACHE_DIR'
os.environ['HF_HOME'] = '$MODEL_CACHE_DIR'

print("📥 Downloading Phi-3 model...")
from transformers import AutoTokenizer, AutoModelForCausalLM
try:
    tokenizer = AutoTokenizer.from_pretrained("microsoft/Phi-3-mini-4k-instruct", trust_remote_code=True)
    print("✅ Phi-3 tokenizer downloaded")
    
    # Note: Full model download happens on first use due to 8-bit quantization
    print("ℹ️  Phi-3 model will be downloaded and quantized on first use")
except Exception as e:
    print(f"⚠️  Failed to download Phi-3: {e}")

print("\n📥 Downloading embedding model...")
from sentence_transformers import SentenceTransformer
try:
    model = SentenceTransformer('all-MiniLM-L6-v2', cache_folder='$MODEL_CACHE_DIR')
    print("✅ Embedding model downloaded")
except Exception as e:
    print(f"⚠️  Failed to download embedding model: {e}")

print("\n📥 Downloading emotion model...")
from transformers import pipeline
try:
    emotion = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", 
                      model_kwargs={"cache_dir": "$MODEL_CACHE_DIR"})
    print("✅ Emotion model downloaded")
except Exception as e:
    print(f"⚠️  Failed to download emotion model: {e}")

print("\n✨ Model downloads complete!")
EOF
    
    print_message $GREEN "✅ Models downloaded"
}

# Create systemd service
create_service() {
    print_message $BLUE "🔧 Creating systemd service..."
    
    # Create service file
    cat > "$INSTALL_DIR/sanctuary-memory.service" << EOF
[Unit]
Description=Sanctuary Memory System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment="PATH=$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONPATH=$INSTALL_DIR/src"
ExecStart=$VENV_DIR/bin/python -m sanctuary_memory_service
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # Install service
    sudo cp "$INSTALL_DIR/sanctuary-memory.service" /etc/systemd/system/
    sudo systemctl daemon-reload
    
    print_message $GREEN "✅ Systemd service created"
    print_message $YELLOW "To start the service: sudo systemctl start sanctuary-memory"
    print_message $YELLOW "To enable on boot: sudo systemctl enable sanctuary-memory"
}

# Create launch script
create_launch_script() {
    print_message $BLUE "🚀 Creating launch script..."
    
    cat > "$INSTALL_DIR/start_memory_system.sh" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/venv/bin/activate"
export PYTHONPATH="$SCRIPT_DIR/src:$PYTHONPATH"
cd "$SCRIPT_DIR"

echo "🌟 Starting Sanctuary Memory System..."
python -m sanctuary_memory_service
EOF
    
    chmod +x "$INSTALL_DIR/start_memory_system.sh"
    
    # Create convenient symlink
    sudo ln -sf "$INSTALL_DIR/start_memory_system.sh" /usr/local/bin/sanctuary-memory
    
    print_message $GREEN "✅ Launch script created"
    print_message $YELLOW "You can now run: sanctuary-memory"
}

# Create default configuration
create_default_config() {
    print_message $BLUE "⚙️  Creating default configuration..."
    
    cat > "$HOME/.sanctuary-memory/configs/settings.yaml" << EOF
sanctuary_memory:
  hardware:
    gpu:
      device: "cuda:0"
      memory_limit: 7.5  # Leave 0.5GB for system (RTX 2080 Super has 8GB)
      use_mixed_precision: true
      use_8bit_quantization: true
    cpu:
      threads: 16  # Adjust based on your CPU
      batch_processing: true
    ram:
      model_cache_size: 8192  # 8GB for models
      embedding_cache_size: 4096  # 4GB for embeddings
  
  paths:
    claude_conversations:
      - "~/.claude/logs/conversations"
      - "~/.config/claude/history"
      - "~/.local/share/claude-desktop/conversations"
    
  extraction:
    min_importance: 0.3
    batch_size: 10
    context_window: 3
  
  search:
    default_results: 5
    use_query_expansion: true
  
  maintenance:
    fade_memories: true
    fade_check_interval: 86400  # Daily
    backup_enabled: true
    backup_interval: 604800  # Weekly
EOF
    
    print_message $GREEN "✅ Configuration created"
}

# Test installation
test_installation() {
    print_message $BLUE "🧪 Testing installation..."
    
    source "$VENV_DIR/bin/activate"
    
    python3 << EOF
import sys
import torch

print("Python:", sys.version)
print("PyTorch:", torch.__version__)

if torch.cuda.is_available():
    print(f"CUDA available: {torch.cuda.get_device_name(0)}")
    print(f"CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
else:
    print("Running on CPU")

# Test imports
try:
    from transformers import AutoModel
    print("✅ Transformers imported successfully")
except ImportError as e:
    print(f"❌ Failed to import transformers: {e}")

try:
    import chromadb
    print("✅ ChromaDB imported successfully")
except ImportError as e:
    print(f"❌ Failed to import chromadb: {e}")

try:
    from sentence_transformers import SentenceTransformer
    print("✅ Sentence transformers imported successfully")
except ImportError as e:
    print(f"❌ Failed to import sentence_transformers: {e}")

print("\n✨ Installation test complete!")
EOF
}

# Main installation flow
main() {
    print_message $BLUE "🌟 Sanctuary Memory System Installer 🌟"
    print_message $BLUE "======================================="
    echo
    
    # Create log file
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "Installation started at $(date)" > "$LOG_FILE"
    
    # Run installation steps
    check_ubuntu
    check_cuda
    install_system_deps
    create_directories
    setup_venv
    install_pytorch
    install_python_deps
    download_models
    create_service
    create_launch_script
    create_default_config
    test_installation
    
    print_message $GREEN "\n✨ Installation complete! ✨"
    print_message $BLUE "\nNext steps:"
    print_message $YELLOW "1. Run the memory system: sanctuary-memory"
    print_message $YELLOW "2. Or start as service: sudo systemctl start sanctuary-memory"
    print_message $YELLOW "3. Check logs at: $HOME/.sanctuary-memory/logs/"
    print_message $BLUE "\nEnjoy preserving your memories with Claude! 💙"
}

# Run main function
main 2>&1 | tee -a "$LOG_FILE"