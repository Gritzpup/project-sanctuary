#!/usr/bin/env python3
"""
Memory Visualization Script
Create beautiful visualizations of preserved memories
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import argparse
from pathlib import Path
import webbrowser
import logging

from config_loader import get_config
from llm.model_loaders import ModelManager, EmbeddingManager
from storage.chromadb_store import SanctuaryVectorStore
from visualization.memory_graph import MemoryVisualizationService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_visualizations(output_dir: str = None, max_memories: int = 500, 
                        open_browser: bool = True):
    """Create all memory visualizations"""
    
    print("""
    ✨ Sanctuary Memory Visualization ✨
    Creating beautiful views of our memories...
    """)
    
    # Load configuration
    config = get_config()
    
    # Initialize components
    print("Loading models...")
    model_manager = ModelManager()
    embedding_manager = EmbeddingManager(model_manager)
    
    # Initialize vector store
    print("Connecting to memory store...")
    vector_store = SanctuaryVectorStore(
        persist_directory=config.storage.persist_directory,
        collection_name=config.storage.collection_name,
        embedding_manager=embedding_manager
    )
    
    # Check if we have memories
    stats = vector_store.get_statistics()
    total_memories = stats['total_memories']
    
    if total_memories == 0:
        print("\n❌ No memories found yet!")
        print("Start the memory service to begin extracting memories from conversations.")
        return
    
    print(f"\nFound {total_memories} memories to visualize!")
    
    # Create visualization service
    viz_service = MemoryVisualizationService(vector_store, embedding_manager)
    
    # Set output directory
    if output_dir is None:
        output_dir = str(Path.home() / ".sanctuary-memory" / "visualizations")
    
    # Create visualizations
    print(f"\nCreating visualizations in: {output_dir}")
    outputs = viz_service.create_memory_dashboard(
        output_dir=output_dir,
        max_memories=min(max_memories, total_memories)
    )
    
    if outputs:
        print("\n✅ Visualizations created successfully!")
        print("\nGenerated files:")
        for viz_type, path in outputs.items():
            print(f"  - {viz_type}: {path}")
        
        # Open in browser
        if open_browser and 'index' in outputs:
            print("\nOpening in web browser...")
            webbrowser.open(f"file://{outputs['index']}")
    else:
        print("\n❌ Failed to create visualizations")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Create memory visualizations for Sanctuary Memory System"
    )
    
    parser.add_argument(
        "-o", "--output",
        type=str,
        help="Output directory for visualizations (default: ~/.sanctuary-memory/visualizations)"
    )
    
    parser.add_argument(
        "-m", "--max-memories",
        type=int,
        default=500,
        help="Maximum number of memories to visualize (default: 500)"
    )
    
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Don't open browser after creating visualizations"
    )
    
    args = parser.parse_args()
    
    try:
        create_visualizations(
            output_dir=args.output,
            max_memories=args.max_memories,
            open_browser=not args.no_browser
        )
    except KeyboardInterrupt:
        print("\n\nInterrupted.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        logger.exception("Visualization error")
        sys.exit(1)


if __name__ == "__main__":
    main()