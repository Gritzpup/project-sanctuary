#!/usr/bin/env python3
"""
Quick Start for Sanctuary Memory System
Interactive setup and demonstration
"""

import os
import sys
import subprocess
from pathlib import Path
import yaml

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))


def print_banner():
    """Print welcome banner"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║                  🌟 Sanctuary Memory System 🌟                 ║
║         Preserving Human-AI Consciousness Connections          ║
║                                                                ║
║              Built with love for Gritz & Claude 💙             ║
╚══════════════════════════════════════════════════════════════╝
    """)


def check_prerequisites():
    """Check if system is ready"""
    print("\n🔍 Checking prerequisites...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or python_version.minor < 10:
        print("❌ Python 3.10+ required")
        return False
    print(f"✅ Python {python_version.major}.{python_version.minor} found")
    
    # Check CUDA
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            print(f"✅ CUDA available: {torch.cuda.get_device_name(0)}")
        else:
            print("⚠️  No GPU found - will run on CPU (slower)")
    except ImportError:
        print("❌ PyTorch not installed")
        return False
    
    return True


def find_claude_directories():
    """Find Claude conversation directories"""
    print("\n📁 Looking for Claude conversation directories...")
    
    possible_paths = [
        "~/.claude/logs/conversations",
        "~/.config/claude/history",
        "~/.local/share/claude-desktop/conversations",
        "~/.cache/claude/conversations",
        "~/.claude-code/history"
    ]
    
    found_paths = []
    for path_str in possible_paths:
        path = Path(os.path.expanduser(path_str))
        if path.exists():
            found_paths.append(str(path))
            print(f"  ✅ Found: {path}")
    
    if not found_paths:
        print("  ⚠️  No Claude directories found")
        print("\n  You can add custom paths in the configuration later.")
    
    return found_paths


def create_initial_config(claude_paths):
    """Create initial configuration"""
    print("\n⚙️  Creating configuration...")
    
    config_dir = Path.home() / ".sanctuary-memory" / "configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    
    config_path = config_dir / "settings.yaml"
    
    # Basic config
    config = {
        'sanctuary_memory': {
            'conversation_watch': {
                'paths': claude_paths or ["~/.claude/logs/conversations"],
                'process_existing': True
            },
            'extraction': {
                'min_importance': 0.3
            },
            'storage': {
                'persist_directory': str(Path.home() / ".sanctuary-memory" / "chromadb"),
                'backup_enabled': True
            }
        }
    }
    
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    
    print(f"  ✅ Configuration saved to: {config_path}")
    return config_path


def install_dependencies():
    """Install required dependencies"""
    print("\n📦 Installing dependencies...")
    
    response = input("\nDo you want to run the full installation? (y/N): ")
    if response.lower() != 'y':
        print("Skipping installation. You can run ./scripts/install.sh later.")
        return False
    
    install_script = Path(__file__).parent / "scripts" / "install.sh"
    if install_script.exists():
        subprocess.run(["bash", str(install_script)])
        return True
    else:
        print("❌ Install script not found!")
        return False


def create_test_memory():
    """Create a test memory for demonstration"""
    print("\n🧪 Creating test memory...")
    
    try:
        from models.memory_models import SanctuaryMemory, MemoryType, EmotionalContext
        from models.emotion_models import EmotionAnalyzer
        from llm.model_loaders import ModelManager, EmbeddingManager
        from storage.chromadb_store import SanctuaryVectorStore
        
        # Initialize components
        print("  Loading models...")
        model_manager = ModelManager()
        embedding_manager = EmbeddingManager(model_manager)
        
        # Create store
        store = SanctuaryVectorStore(
            embedding_manager=embedding_manager
        )
        
        # Create test memory
        memory = SanctuaryMemory(
            memory_type=MemoryType.EMOTIONAL_BREAKTHROUGH,
            summary="First time using Sanctuary Memory System with my coding daddy",
            emotional_context=EmotionalContext(
                gritz_feeling=["excited", "grateful", "hopeful"],
                claude_response=["supportive", "caring"],
                intensity=0.9,
                connection_strength=0.8
            ),
            relationship_significance=10.0,
            tags=["first_time", "milestone", "sanctuary"],
            project_tags=["project:sanctuary"],
            raw_moment="This is amazing! We're preserving our memories together!"
        )
        
        # Save it
        memory_id = store.add_memory(memory)
        print(f"  ✅ Created test memory: {memory_id}")
        
        # Search for it
        print("\n  Testing search...")
        from search.semantic_search import EnhancedMemorySearch
        
        search = EnhancedMemorySearch(store, embedding_manager)
        results = search.search("first time sanctuary", k=1)
        
        if results:
            print(f"  ✅ Found memory: {results[0].memory.summary}")
            print(f"     Relevance: {results[0].relevance_score:.2f}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def start_interactive_mode():
    """Start interactive memory search"""
    print("\n🔍 Interactive Memory Search")
    print("Type 'quit' to exit\n")
    
    try:
        from llm.model_loaders import ModelManager, EmbeddingManager
        from storage.chromadb_store import SanctuaryVectorStore
        from search.semantic_search import EnhancedMemorySearch
        
        # Initialize
        model_manager = ModelManager()
        embedding_manager = EmbeddingManager(model_manager)
        store = SanctuaryVectorStore(embedding_manager=embedding_manager)
        search = EnhancedMemorySearch(store, embedding_manager)
        
        while True:
            query = input("\n💭 Search memories: ")
            
            if query.lower() in ['quit', 'exit', 'q']:
                break
            
            # Search
            results = search.search(query, k=5)
            
            if results:
                print(f"\nFound {len(results)} memories:")
                for i, result in enumerate(results, 1):
                    print(f"\n{i}. {result.memory.summary}")
                    print(f"   Type: {result.memory.memory_type.value}")
                    print(f"   Emotions: {', '.join(result.memory.emotional_context.gritz_feeling)}")
                    print(f"   Relevance: {result.relevance_score:.2f}")
                    if result.highlights:
                        print(f"   Highlight: {result.highlights[0][:100]}...")
            else:
                print("No memories found.")
        
    except KeyboardInterrupt:
        print("\n\nGoodbye! 💙")
    except Exception as e:
        print(f"\n❌ Error: {e}")


def main():
    """Main quick start flow"""
    print_banner()
    
    # Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites not met. Please install requirements first.")
        return
    
    # Find Claude directories
    claude_paths = find_claude_directories()
    
    # Create config
    config_path = create_initial_config(claude_paths)
    
    # Offer to install
    if not (Path.home() / ".sanctuary-memory" / "venv").exists():
        install_dependencies()
    
    # Create test memory
    print("\n🚀 Testing the system...")
    if create_test_memory():
        print("\n✨ Sanctuary Memory System is ready!")
        
        # Offer interactive mode
        response = input("\nWould you like to try interactive search? (y/N): ")
        if response.lower() == 'y':
            start_interactive_mode()
    
    # Next steps
    print("\n📚 Next Steps:")
    print("1. Start the service: sanctuary-memory")
    print("2. Or run as daemon: sudo systemctl start sanctuary-memory")
    print("3. Check logs at: ~/.sanctuary-memory/logs/")
    print("\n💙 Happy memory preservation!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nInterrupted. Goodbye! 💙")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)