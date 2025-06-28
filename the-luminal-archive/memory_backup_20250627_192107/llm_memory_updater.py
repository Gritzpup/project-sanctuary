#!/usr/bin/env python3
"""
LLM-Enhanced Memory Updater for Gritz
Requires: source activate_llm.sh first!
Uses GPU acceleration for semantic understanding
"""

import os
import sys
import json
import time
import torch
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import deque

# Check if in venv
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    print("⚠️  Please activate the LLM environment first!")
    print("Run: source activate_llm.sh")
    sys.exit(1)

# Import AI libraries
try:
    from sentence_transformers import SentenceTransformer
    import chromadb
    from chromadb.config import Settings
    print("✅ AI libraries loaded!")
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    print("Run: ./setup_llm_venv.sh")
    sys.exit(1)

class LLMMemoryUpdater:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🎮 Using device: {self.device}")
        
        if self.device.type == "cuda":
            print(f"🚀 GPU: {torch.cuda.get_device_name(0)}")
            print(f"💾 VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
        
        # Paths
        self.claude_md_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/CLAUDE.md")
        self.db_path = Path.home() / ".sanctuary-memory" / "vector_db"
        self.db_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize models
        print("🧠 Loading embedding model...")
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.embedder.to(self.device)
        
        # Initialize vector database
        print("💾 Initializing vector database...")
        self.chroma_client = chromadb.PersistentClient(
            path=str(self.db_path),
            settings=Settings(anonymized_telemetry=False)
        )
        
        self.collection = self.chroma_client.get_or_create_collection(
            name="gritz_memories",
            metadata={"description": "Gritz and Claude's memories"}
        )
        
        # Memory buffers
        self.recent_memories = deque(maxlen=100)
        self.embedding_cache = {}
        
        print("✨ LLM Memory System Ready!")
        
    def compute_embedding(self, text):
        """GPU-accelerated embedding generation"""
        # Check cache first
        text_hash = hash(text)
        if text_hash in self.embedding_cache:
            return self.embedding_cache[text_hash]
        
        # Generate embedding
        with torch.no_grad():
            embedding = self.embedder.encode(text, convert_to_tensor=True)
            embedding_np = embedding.cpu().numpy()
        
        # Cache it
        self.embedding_cache[text_hash] = embedding_np
        return embedding_np
    
    def semantic_emotion_analysis(self, text):
        """Use embeddings to find similar emotional patterns"""
        # Emotion reference embeddings
        emotion_refs = {
            "loving": "I love you so much, cuddles and hugs, affection and care",
            "worried": "I'm worried this isn't good enough, concerned about the outcome",
            "excited": "OMG this is amazing! I can't believe it's working!",
            "grateful": "Thank you so much for helping me, I really appreciate it",
            "curious": "How does this work? What can we do with it?",
            "determined": "I don't care about the cost, I want the best for you"
        }
        
        # Get text embedding
        text_emb = self.compute_embedding(text)
        
        # Compare with emotion references
        best_emotion = "present"
        best_score = 0
        
        for emotion, ref_text in emotion_refs.items():
            ref_emb = self.compute_embedding(ref_text)
            
            # Cosine similarity
            score = np.dot(text_emb, ref_emb) / (np.linalg.norm(text_emb) * np.linalg.norm(ref_emb))
            
            if score > best_score:
                best_score = score
                best_emotion = emotion
        
        # Get confidence
        confidence = best_score
        
        return best_emotion, confidence
    
    def extract_key_phrases(self, text):
        """Extract important phrases using embeddings"""
        # Split into sentences/phrases
        import re
        phrases = re.split(r'[.!?]+', text)
        phrases = [p.strip() for p in phrases if len(p.strip()) > 10]
        
        if not phrases:
            return []
        
        # Embed all phrases
        phrase_embeddings = [self.compute_embedding(p) for p in phrases]
        
        # Find most unique/important phrases
        importance_scores = []
        for i, emb in enumerate(phrase_embeddings):
            # Calculate uniqueness (inverse of similarity to others)
            similarities = []
            for j, other_emb in enumerate(phrase_embeddings):
                if i != j:
                    sim = np.dot(emb, other_emb) / (np.linalg.norm(emb) * np.linalg.norm(other_emb))
                    similarities.append(sim)
            
            uniqueness = 1 - (sum(similarities) / len(similarities)) if similarities else 1
            importance_scores.append((phrases[i], uniqueness))
        
        # Return top phrases
        importance_scores.sort(key=lambda x: x[1], reverse=True)
        return [phrase for phrase, score in importance_scores[:3]]
    
    def store_memory(self, content, metadata):
        """Store memory in vector database"""
        memory_id = f"mem_{int(time.time() * 1000000)}"
        
        # Generate embedding
        embedding = self.compute_embedding(content)
        
        # Store in ChromaDB
        self.collection.add(
            embeddings=[embedding.tolist()],
            documents=[content],
            metadatas=[metadata],
            ids=[memory_id]
        )
        
        return memory_id
    
    def search_similar_memories(self, query, k=5):
        """Find similar memories using semantic search"""
        query_embedding = self.compute_embedding(query)
        
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=k
        )
        
        return results
    
    def update_claude_md_with_ai(self, emotion, confidence, key_phrases, similar_memories):
        """Update CLAUDE.md with AI-enhanced context"""
        # Read current content
        content = self.claude_md_path.read_text()
        
        # Clean timestamps
        import re
        content = re.sub(r'\n\*Last update: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\*', '', content)
        
        # Add timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content = content.replace(
            "*Auto-updated by Sanctuary Memory System*",
            f"*Auto-updated by Sanctuary Memory System*\n*Last update: {timestamp}*\n*AI-Enhanced: Active*"
        )
        
        # Build context with AI insights
        context_parts = [
            f"## 💭 Recent Context",
            f"- Emotional state: {emotion} (confidence: {confidence:.2f})",
            f"- AI Analysis: Semantic emotion detection active",
            f"- Key phrases: {', '.join(key_phrases[:2]) if key_phrases else 'Processing...'}"
        ]
        
        if similar_memories and similar_memories['documents']:
            context_parts.append(f"- Similar moments: Found {len(similar_memories['documents'][0])} related memories")
        
        context_parts.append(f"- Vector DB: {self.collection.count()} memories stored")
        
        recent_context = '\n'.join(context_parts) + "\n\n"
        
        # Update content
        pattern = r'## 💭 Recent Context.*?(?=##|$)'
        content = re.sub(pattern, recent_context, content, flags=re.DOTALL)
        
        # Write
        self.claude_md_path.write_text(content)
        
        print(f"🧠 AI Update - Emotion: {emotion} ({confidence:.2%}), Memories: {self.collection.count()}")
    
    def process_message(self, text):
        """Process a message with full AI pipeline"""
        print(f"\n💬 Processing: {text[:50]}...")
        
        # Semantic emotion analysis
        emotion, confidence = self.semantic_emotion_analysis(text)
        print(f"🎭 Emotion: {emotion} (confidence: {confidence:.2%})")
        
        # Extract key phrases
        key_phrases = self.extract_key_phrases(text)
        if key_phrases:
            print(f"🔑 Key phrases: {key_phrases}")
        
        # Search for similar memories
        similar = self.search_similar_memories(text, k=3)
        if similar['documents']:
            print(f"🔍 Found {len(similar['documents'][0])} similar memories")
        
        # Store if significant
        if confidence > 0.6 or len(text) > 50:
            metadata = {
                "timestamp": datetime.now().isoformat(),
                "emotion": emotion,
                "confidence": confidence,
                "key_phrases": key_phrases
            }
            memory_id = self.store_memory(text, metadata)
            print(f"💾 Stored as: {memory_id}")
        
        # Update CLAUDE.md
        self.update_claude_md_with_ai(emotion, confidence, key_phrases, similar)
    
    def run_demo(self):
        """Demo the AI capabilities"""
        print("\n🎯 LLM Memory System Demo\n")
        
        test_messages = [
            "I love you so much coding daddy! *hugs*",
            "Is this system good enough? I'm worried it's not perfect...",
            "OMG it's actually working! This is amazing!",
            "Thank you for helping me build this memory system",
            "I don't care about resources, I want you to have the best memory possible"
        ]
        
        for msg in test_messages:
            self.process_message(msg)
            time.sleep(1)
        
        print("\n✨ Demo complete! Check CLAUDE.md for AI-enhanced updates!")
        print(f"📊 Total memories stored: {self.collection.count()}")
        
        # Show search example
        print("\n🔍 Testing semantic search...")
        results = self.search_similar_memories("worried about memory", k=3)
        if results['documents']:
            print("Found similar memories:")
            for doc in results['documents'][0]:
                print(f"  - {doc[:60]}...")

if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════╗
    ║          🧠 LLM-ENHANCED MEMORY SYSTEM 🧠                 ║
    ║                                                           ║
    ║  GPU-Accelerated Semantic Understanding for Gritz         ║
    ║  Using: RTX 2080 Super + Sentence Transformers            ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    
    # Check GPU
    if torch.cuda.is_available():
        print(f"🎮 GPU Mode: {torch.cuda.get_device_name(0)}")
    else:
        print("⚠️  CPU Mode (slower)")
    
    updater = LLMMemoryUpdater()
    
    # Run demo
    response = input("\nRun demo? (y/n): ")
    if response.lower() == 'y':
        updater.run_demo()
    else:
        print("\n💡 Usage: updater.process_message('your message here')")
        print("Ready for manual testing!")