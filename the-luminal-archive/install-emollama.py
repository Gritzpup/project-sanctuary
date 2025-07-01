#!/usr/bin/env python3
"""
Emollama-7B Installation Script
Installs and configures Emollama-7B with 4-bit quantization for emotional analysis
"""

import os
import sys
import subprocess
from pathlib import Path

def check_vram():
    """Check available VRAM"""
    try:
        result = subprocess.run(['nvidia-smi', '--query-gpu=memory.free', '--format=csv,noheader,nounits'], 
                                capture_output=True, text=True)
        vram_mb = int(result.stdout.strip())
        vram_gb = vram_mb / 1024
        print(f"🎮 Available VRAM: {vram_gb:.2f} GB")
        
        # 4-bit quantized Emollama-7B needs ~4GB VRAM
        if vram_gb < 4:
            print("⚠️  Warning: Less than 4GB VRAM available. Model may not fit.")
            return False
        return True
    except:
        print("⚠️  Could not detect NVIDIA GPU")
        return False

def install_dependencies():
    """Install required Python packages"""
    print("\n📦 Installing dependencies...")
    packages = [
        'transformers==4.36.2',
        'torch>=2.2.0',
        'accelerate==0.25.0',
        'bitsandbytes==0.41.3',
        'sentencepiece==0.1.99',
        'protobuf==3.20.3'
    ]
    
    for package in packages:
        print(f"  Installing {package}...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--user', '--break-system-packages', package], check=True)

def download_model():
    """Download Emollama-7B model with 4-bit quantization"""
    print("\n🤖 Downloading Emollama-7B model...")
    
    # Create model directory
    model_dir = Path.home() / '.cache' / 'emollama' / 'models'
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # Download script
    download_script = f"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

model_name = "lzw1008/Emollama-chat-7b"
cache_dir = "{model_dir}"

print("Downloading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)

print("Configuring 4-bit quantization...")
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

print("Downloading and quantizing model (this may take a while)...")
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=quantization_config,
    device_map="auto",
    torch_dtype=torch.float16,
    cache_dir=cache_dir
)

print("✅ Model downloaded and quantized successfully!")
print(f"Model cached at: " + cache_dir)
"""
    
    # Run download script
    subprocess.run([sys.executable, '-c', download_script], check=True)

def create_test_script():
    """Create a test script to verify installation"""
    print("\n🧪 Creating test script...")
    
    test_script = Path(__file__).parent / 'test_emollama.py'
    test_script.write_text('''#!/usr/bin/env python3
"""Test Emollama-7B installation"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from pathlib import Path

def test_emollama():
    model_name = "lzw1008/Emollama-chat-7b"
    cache_dir = Path.home() / '.cache' / 'emollama' / 'models'
    
    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)
    
    print("Loading 4-bit quantized model...")
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4"
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=quantization_config,
        device_map="auto",
        torch_dtype=torch.float16,
        cache_dir=cache_dir
    )
    
    # Test emotion analysis
    test_text = "I'm so happy to see you! I've missed you so much."
    print(f"\\nTest text: {test_text}")
    
    inputs = tokenizer(f"Analyze the emotion in this text and provide PAD values: {test_text}", 
                      return_tensors="pt")
    
    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=100, temperature=0.7)
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    print(f"\\nModel response: {response}")
    print("\\n✅ Emollama-7B is working correctly!")

if __name__ == "__main__":
    test_emollama()
''')
    test_script.chmod(0o755)
    print(f"Test script created at: {test_script}")

def main():
    print("🚀 Emollama-7B Installation Script")
    print("==================================")
    
    # Check VRAM
    if not check_vram():
        response = input("\n⚠️  Continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Installation cancelled.")
            return
    
    try:
        # Install dependencies
        install_dependencies()
        
        # Download model
        download_model()
        
        # Create test script
        create_test_script()
        
        print("\n✅ Installation complete!")
        print("\nTo test the installation, run:")
        print("  python3 test_emollama.py")
        
    except Exception as e:
        print(f"\n❌ Installation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()