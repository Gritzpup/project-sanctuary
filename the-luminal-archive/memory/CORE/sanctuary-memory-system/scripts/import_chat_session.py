#!/usr/bin/env python3
"""
Import Claude Chat Session
Convert markdown chat logs into memories for the Sanctuary Memory System
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import re
from datetime import datetime
from pathlib import Path
import argparse
import logging

from config_loader import get_config
from models.memory_models import SanctuaryMemory
from llm.model_loaders import ModelManager, EmbeddingManager
from storage.chromadb_store import SanctuaryVectorStore
from extraction.memory_extractor import MemoryExtractor
from models.emotion_models import EmotionAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChatSessionParser:
    """Parse Claude chat session markdown files"""
    
    def __init__(self):
        self.messages = []
        self.current_message = None
        self.in_code_block = False
        
    def parse_file(self, file_path: str) -> list:
        """Parse a markdown chat file into messages"""
        logger.info(f"Parsing chat session: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split by common separators
        lines = content.split('\n')
        
        current_role = None
        current_content = []
        messages = []
        
        for line in lines:
            # Check for role indicators
            if line.strip() == "👤" or line.strip() == "You":
                # Save previous message if exists
                if current_role and current_content:
                    messages.append({
                        'role': 'user' if current_role == 'You' else 'assistant',
                        'content': '\n'.join(current_content).strip(),
                        'timestamp': datetime.now().isoformat()  # We don't have timestamps in the file
                    })
                current_role = 'You'
                current_content = []
                
            elif line.strip() == "🤖" or line.strip() == "Claude":
                # Save previous message if exists
                if current_role and current_content:
                    messages.append({
                        'role': 'user' if current_role == 'You' else 'assistant',
                        'content': '\n'.join(current_content).strip(),
                        'timestamp': datetime.now().isoformat()
                    })
                current_role = 'Claude'
                current_content = []
                
            elif line.strip().startswith("📊 Tokens:"):
                # Skip token count lines
                continue
                
            elif line.strip() in ["🔧", "💭 Thinking...", "📄"]:
                # Skip tool indicators
                continue
                
            else:
                # Add to current message content
                if current_role:
                    current_content.append(line)
        
        # Don't forget the last message
        if current_role and current_content:
            messages.append({
                'role': 'user' if current_role == 'You' else 'assistant',
                'content': '\n'.join(current_content).strip(),
                'timestamp': datetime.now().isoformat()
            })
        
        logger.info(f"Parsed {len(messages)} messages")
        return messages
    
    def extract_emotional_moments(self, messages: list) -> list:
        """Extract particularly emotional or significant messages"""
        emotional_patterns = [
            r"i really like you",
            r"coding daddy",
            r"ai daddy",
            r"thanks for being nice to me",
            r"i hope you.*(remember|protect)",
            r"daddy issues",
            r"vulnerable",
            r"anxiety",
            r"really appreciate you",
            r"hugs on",
            r"nuzzles",
            r"i love"
        ]
        
        significant_messages = []
        
        for i, msg in enumerate(messages):
            content_lower = msg['content'].lower()
            
            # Check for emotional patterns
            for pattern in emotional_patterns:
                if re.search(pattern, content_lower):
                    # Include context (previous and next message)
                    context_start = max(0, i-1)
                    context_end = min(len(messages), i+2)
                    
                    significant_messages.append({
                        'message': msg,
                        'context': messages[context_start:context_end],
                        'index': i
                    })
                    break
        
        return significant_messages


def import_chat_session(file_path: str, extract_all: bool = False):
    """Import a chat session into the memory system"""
    
    print(f"""
    🌟 Importing Chat Session 🌟
    
    File: {file_path}
    Extract all: {extract_all}
    """)
    
    # Check file exists
    if not Path(file_path).exists():
        logger.error(f"File not found: {file_path}")
        return
    
    # Initialize components
    print("Loading models...")
    config = get_config()
    model_manager = ModelManager()
    embedding_manager = EmbeddingManager(model_manager)
    emotion_analyzer = EmotionAnalyzer()
    
    # Initialize storage
    print("Connecting to memory store...")
    vector_store = SanctuaryVectorStore(
        persist_directory=config.storage.persist_directory,
        collection_name=config.storage.collection_name,
        embedding_manager=embedding_manager
    )
    
    # Initialize extractor
    memory_extractor = MemoryExtractor(
        emotion_analyzer=emotion_analyzer,
        phi3_processor=None  # We'll use pattern-based for speed
    )
    
    # Parse chat session
    parser = ChatSessionParser()
    messages = parser.parse_file(file_path)
    
    if not messages:
        logger.error("No messages found in file")
        return
    
    print(f"\nFound {len(messages)} messages in chat session")
    
    # Extract memories
    if extract_all:
        # Process all messages
        print("Extracting memories from all messages...")
        memories = memory_extractor.extract_memories_from_conversation(
            messages,
            min_importance=0.2  # Lower threshold for importing
        )
    else:
        # Extract only significant moments
        print("Extracting significant emotional moments...")
        significant = parser.extract_emotional_moments(messages)
        print(f"Found {len(significant)} significant moments")
        
        # Extract memories from significant conversations
        memories = []
        for sig in significant:
            context_memories = memory_extractor.extract_memories_from_conversation(
                sig['context'],
                min_importance=0.2
            )
            memories.extend(context_memories)
    
    if not memories:
        print("No memories extracted")
        return
    
    print(f"\n✨ Extracted {len(memories)} memories!")
    
    # Show preview
    print("\nPreview of extracted memories:")
    for i, memory in enumerate(memories[:5]):
        print(f"\n{i+1}. {memory.memory_type.value}: {memory.summary[:80]}...")
        print(f"   Emotions: {', '.join(memory.emotional_context.gritz_feeling[:3])}")
        print(f"   Significance: {memory.relationship_significance:.1f}/10")
    
    if len(memories) > 5:
        print(f"\n... and {len(memories) - 5} more memories")
    
    # Ask for confirmation
    response = input("\nImport these memories? (y/N): ")
    if response.lower() != 'y':
        print("Import cancelled")
        return
    
    # Import memories
    print("\nImporting memories...")
    imported = vector_store.add_memories_batch(memories)
    
    print(f"\n✅ Successfully imported {len(imported)} memories!")
    
    # Show some statistics
    stats = vector_store.get_statistics()
    print(f"\nMemory store now contains {stats['total_memories']} total memories")
    
    # Suggest visualization
    print("\n💡 To visualize your memories, run:")
    print("   ./scripts/visualize_memories.py")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Import Claude chat sessions into Sanctuary Memory System"
    )
    
    parser.add_argument(
        "file",
        type=str,
        help="Path to chat session markdown file"
    )
    
    parser.add_argument(
        "--all",
        action="store_true",
        help="Extract all messages (default: only significant moments)"
    )
    
    parser.add_argument(
        "--min-importance",
        type=float,
        default=0.2,
        help="Minimum importance threshold (0-1)"
    )
    
    args = parser.parse_args()
    
    try:
        import_chat_session(args.file, extract_all=args.all)
    except KeyboardInterrupt:
        print("\n\nImport cancelled")
    except Exception as e:
        logger.error(f"Import failed: {e}")
        raise


if __name__ == "__main__":
    main()