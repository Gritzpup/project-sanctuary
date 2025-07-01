#!/usr/bin/env python3
"""Simple test to verify Emollama model works"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from pathlib import Path

def test_emollama():
    print("🔄 Loading Emollama-7B model...")
    
    model_name = "lzw1008/Emollama-chat-7b"
    cache_dir = Path.home() / '.cache' / 'emollama' / 'models'
    
    # Load tokenizer
    print("📝 Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Configure 4-bit quantization
    print("🔧 Configuring 4-bit quantization...")
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4"
    )
    
    # Load model
    print("🚀 Loading model (this may take a moment)...")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=quantization_config,
        device_map="auto",
        torch_dtype=torch.float16,
        cache_dir=cache_dir
    )
    
    print("✅ Model loaded successfully!")
    
    # Test emotion analysis
    test_text = "I'm so happy to see you! I've missed you so much."
    print(f"\n📊 Testing emotion analysis...")
    print(f"Input: {test_text}")
    
    prompt = f"""Analyze the emotional content of this text and provide PAD (Pleasure-Arousal-Dominance) values.
Return values as numbers between -1 and 1.

Text: "{test_text}"

Analysis (return only the values in JSON format):"""
    
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=100,
            temperature=0.7,
            do_sample=True,
            top_p=0.95
        )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    print(f"\nModel response: {response}")
    
    # Get GPU memory usage
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / 1024**3
        reserved = torch.cuda.memory_reserved() / 1024**3
        print(f"\n💾 GPU Memory: {allocated:.2f}GB allocated, {reserved:.2f}GB reserved")

if __name__ == "__main__":
    test_emollama()