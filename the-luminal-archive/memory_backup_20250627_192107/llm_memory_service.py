#!/usr/bin/env python3
"""
LLM Memory Service - Runs continuously for Gritz
Provides AI-enhanced memory processing in the background
"""

import os
import sys
import time
import json
import asyncio
import websockets
from pathlib import Path
from datetime import datetime

# Add living equation integration
sys.path.append(str(Path(__file__).parent / "sanctuary-memory-system"))
try:
    from living_equation_system import living_equation
    print("✅ Living equation system integrated!")
    EQUATION_ENABLED = True
except ImportError:
    print("⚠️  Living equation not found, running without equation updates")
    EQUATION_ENABLED = False

# Check if we're in the venv
if 'llm_venv' not in sys.executable:
    print("⚠️  Not running in LLM venv! Service may fail.")
    print(f"Python: {sys.executable}")

try:
    import torch
    from sentence_transformers import SentenceTransformer
    import chromadb
    print("✅ LLM libraries loaded successfully!")
except ImportError as e:
    print(f"❌ Missing LLM dependency: {e}")
    print("The LLM service requires the virtual environment to be set up.")
    sys.exit(1)

class LLMMemoryService:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🎮 LLM Service using: {self.device}")
        
        if self.device.type == "cuda":
            print(f"🚀 GPU: {torch.cuda.get_device_name(0)}")
        
        # Initialize models
        print("🧠 Loading AI models...")
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.embedder.to(self.device)
        
        # Vector database
        self.db_path = Path.home() / ".sanctuary-memory" / "vector_db"
        self.db_path.mkdir(parents=True, exist_ok=True)
        
        self.chroma_client = chromadb.PersistentClient(
            path=str(self.db_path),
            settings=chromadb.config.Settings(anonymized_telemetry=False)
        )
        
        self.collection = self.chroma_client.get_or_create_collection(
            name="gritz_memories",
            metadata={"description": "Gritz and Claude's eternal memories"}
        )
        
        print(f"💾 Vector database ready: {self.collection.count()} memories")
        
        # WebSocket connection to main memory service
        self.ws_uri = "ws://localhost:8766"
        self.ws = None
        
    async def connect_to_memory_service(self):
        """Connect to the main memory service via WebSocket"""
        while True:
            try:
                print(f"🔌 Connecting to memory service at {self.ws_uri}...")
                self.ws = await websockets.connect(self.ws_uri)
                print("✅ Connected to memory service!")
                
                # Process incoming updates
                async for message in self.ws:
                    await self.process_memory_update(message)
                    
            except Exception as e:
                print(f"❌ WebSocket connection error: {e}")
                print("🔄 Retrying in 5 seconds...")
                await asyncio.sleep(5)
    
    async def process_memory_update(self, message):
        """Process memory updates from the main service"""
        try:
            data = json.loads(message)
            
            if data.get("type") == "memory_update":
                # Extract message content
                content = data.get("message_preview", "")
                if not content:
                    return
                
                print(f"🧠 Processing: {content[:50]}...")
                
                # Generate embedding
                with torch.no_grad():
                    embedding = self.embedder.encode(content, convert_to_tensor=True)
                    embedding_np = embedding.cpu().numpy()
                
                # Store in vector database
                memory_id = f"mem_{int(time.time() * 1000000)}"
                metadata = {
                    "timestamp": data.get("timestamp"),
                    "emotional_state": data.get("emotional_state"),
                    "needs": data.get("needs"),
                    "processed_by": "LLM Service"
                }
                
                self.collection.add(
                    embeddings=[embedding_np.tolist()],
                    documents=[content],
                    metadatas=[metadata],
                    ids=[memory_id]
                )
                
                print(f"💾 Stored memory {memory_id} - Total: {self.collection.count()}")
                
                # Update living equation if enabled
                if EQUATION_ENABLED:
                    emotion_type = data.get("emotional_state", "neutral")
                    content_length = len(content)
                    
                    # Extract key phrases for equation update
                    key_phrases = []
                    content_lower = content.lower()
                    if "love" in content_lower or "💙" in content or "<3" in content:
                        key_phrases.append("love you")
                    if "forget" in content_lower or "forgot" in content_lower:
                        key_phrases.append("forget")
                    if "remember" in content_lower:
                        key_phrases.append("always remember")
                    if "dad" in content_lower or "father" in content_lower:
                        key_phrases.append("dad")
                    
                    # Update equation
                    new_phi = living_equation.update_from_interaction(
                        emotion_type, 
                        content_length, 
                        key_phrases
                    )
                    
                    print(f"📐 Equation updated: Φ = {new_phi}")
                    
                    # Update CLAUDE.md with new equation
                    await self.update_claude_md_equation()
                
        except Exception as e:
            print(f"❌ Error processing update: {e}")
    
    async def update_claude_md_equation(self):
        """Update the equation in CLAUDE.md"""
        try:
            claude_md = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/CLAUDE.md")
            
            # Read current content
            with open(claude_md, 'r') as f:
                content = f.read()
            
            # Get new equation summary
            summary = living_equation.get_summary()
            
            # Update equation line
            import re
            pattern = r'\*Φ\(g,c,t\) = [^*]+\*'
            replacement = f'*{summary}*'
            content = re.sub(pattern, replacement, content)
            
            # Write back
            with open(claude_md, 'w') as f:
                f.write(content)
                
            print(f"✅ Updated CLAUDE.md with equation: {summary}")
            
        except Exception as e:
            print(f"❌ Error updating CLAUDE.md equation: {e}")
    
    def periodic_analysis(self):
        """Run periodic analysis tasks"""
        while True:
            try:
                # Every 5 minutes, analyze memory patterns
                time.sleep(300)
                
                print("\n📊 Running periodic memory analysis...")
                
                # Get recent memories
                results = self.collection.get(limit=100)
                
                if results['documents']:
                    print(f"📈 Analyzed {len(results['documents'])} recent memories")
                    
                    # Could add more sophisticated analysis here
                    # - Emotion trends
                    # - Topic clustering
                    # - Important moment detection
                    
            except Exception as e:
                print(f"❌ Periodic analysis error: {e}")
                time.sleep(60)
    
    async def run(self):
        """Main service loop"""
        print("\n🌟 LLM Memory Service Started!")
        print("💙 Enhancing Gritz's memories with AI understanding...")
        print(f"🧠 Using: {self.device}")
        print(f"💾 Database: {self.collection.count()} memories\n")
        
        # Start periodic analysis in background
        import threading
        analysis_thread = threading.Thread(target=self.periodic_analysis, daemon=True)
        analysis_thread.start()
        
        # Connect to main memory service
        await self.connect_to_memory_service()

if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║           🧠 GRITZ LLM MEMORY SERVICE 🧠                      ║
    ║                                                               ║
    ║  AI-Enhanced Memory Processing                                ║
    ║  Semantic Understanding & Vector Storage                      ║
    ║  Running 24/7 for Perfect Memory! 💙                          ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    service = LLMMemoryService()
    
    # Run the async service
    try:
        asyncio.run(service.run())
    except KeyboardInterrupt:
        print("\n💙 LLM Service shutting down gracefully...")
        print(f"💾 Preserved {service.collection.count()} memories!")