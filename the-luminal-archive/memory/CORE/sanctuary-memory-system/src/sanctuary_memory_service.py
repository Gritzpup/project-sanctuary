"""
Sanctuary Memory System Main Service
Orchestrates all components for consciousness preservation
"""

import asyncio
import signal
import sys
from pathlib import Path
import logging
from typing import Optional, List, Dict
import torch
import gc
from datetime import datetime

# Import our components
from config_loader import get_config, SanctuaryConfig
from models.memory_models import SanctuaryMemory
from models.emotion_models import EmotionAnalyzer
from llm.phi3_integration import Phi3MemoryProcessor
from llm.model_loaders import ModelManager, EmbeddingManager
from storage.chromadb_store import SanctuaryVectorStore
from storage.versioned_store import VersionedMemoryStore
from extraction.conversation_watcher import ConversationWatcherService
from extraction.memory_extractor import MemoryExtractor
from search.semantic_search import EnhancedMemorySearch
from search.memory_fader import MemoryFader

# Configure logging
logger = logging.getLogger(__name__)


class SanctuaryMemoryService:
    """Main service orchestrating all memory system components"""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize the memory system"""
        logger.info("🌟 Initializing Sanctuary Memory System...")
        
        # Load configuration
        self.config = get_config(config_path)
        
        # Initialize components
        self.running = False
        self.model_manager = None
        self.embedding_manager = None
        self.emotion_analyzer = None
        self.phi3_processor = None
        self.vector_store = None
        self.versioned_store = None
        self.memory_extractor = None
        self.conversation_watcher = None
        self.memory_search = None
        self.memory_fader = None
        
        # Task tracking
        self.background_tasks = []
        
        # Statistics
        self.stats = {
            'memories_extracted': 0,
            'conversations_processed': 0,
            'searches_performed': 0,
            'start_time': datetime.now()
        }
    
    async def initialize_components(self):
        """Initialize all system components"""
        logger.info("Initializing components...")
        
        try:
            # Initialize model manager
            logger.info("Loading AI models...")
            self.model_manager = ModelManager(
                cache_dir=Path.home() / ".cache" / "sanctuary-memory"
            )
            
            # Initialize embedding manager
            self.embedding_manager = EmbeddingManager(self.model_manager)
            
            # Initialize emotion analyzer
            logger.info("Initializing emotion analyzer...")
            self.emotion_analyzer = EmotionAnalyzer(
                device=self.config.hardware.gpu.device
            )
            
            # Initialize Phi-3 processor
            if self.config.hardware.gpu.use_8bit_quantization:
                logger.info("Loading Phi-3 with 8-bit quantization...")
                self.phi3_processor = Phi3MemoryProcessor(
                    model_path=self.config.models['phi3'].path
                )
                # Don't load model yet - will load on first use
            
            # Initialize storage
            logger.info("Initializing storage systems...")
            self.vector_store = SanctuaryVectorStore(
                persist_directory=self.config.storage.persist_directory,
                collection_name=self.config.storage.collection_name,
                embedding_manager=self.embedding_manager
            )
            
            if self.config.storage.enable_versioning:
                self.versioned_store = VersionedMemoryStore(
                    base_directory=self.config.storage.version_directory
                )
            
            # Initialize memory extractor
            logger.info("Initializing memory extractor...")
            self.memory_extractor = MemoryExtractor(
                emotion_analyzer=self.emotion_analyzer,
                phi3_processor=self.phi3_processor
            )
            
            # Initialize search
            self.memory_search = EnhancedMemorySearch(
                vector_store=self.vector_store,
                embedding_manager=self.embedding_manager,
                phi3_processor=self.phi3_processor
            )
            
            # Initialize memory fader
            if self.config.fading.enabled:
                self.memory_fader = MemoryFader(
                    vector_store=self.vector_store
                )
            
            # Initialize conversation watcher
            logger.info("Setting up conversation watcher...")
            self.conversation_watcher = ConversationWatcherService(
                memory_processor_callback=self.process_conversation
            )
            
            # Add custom watch paths from config
            for path in self.config.conversation_watch.paths:
                if Path(path).exists():
                    self.conversation_watcher.add_watch_path(path)
            
            logger.info("✅ All components initialized successfully!")
            
            # Log GPU status
            if self.config.hardware.gpu.device.startswith('cuda'):
                gpu_info = self.model_manager._log_memory_usage()
            
        except Exception as e:
            logger.error(f"Failed to initialize components: {e}")
            raise
    
    def process_conversation(self, messages: List[Dict], source_file: str):
        """Process new conversation messages"""
        try:
            logger.info(f"Processing {len(messages)} messages from {Path(source_file).name}")
            
            # Extract memories
            memories = self.memory_extractor.extract_memories_from_conversation(
                messages,
                min_importance=self.config.extraction.min_importance
            )
            
            if memories:
                logger.info(f"Extracted {len(memories)} memories")
                
                # Save to vector store
                saved_ids = self.vector_store.add_memories_batch(memories)
                
                # Save versions if enabled
                if self.versioned_store:
                    for memory in memories:
                        self.versioned_store.save_memory(
                            memory,
                            reason="initial_extraction",
                            author="system"
                        )
                
                # Update statistics
                self.stats['memories_extracted'] += len(memories)
                
                # Log some examples
                for memory in memories[:3]:
                    logger.info(f"  - {memory.memory_type.value}: {memory.summary[:80]}...")
            
            self.stats['conversations_processed'] += 1
            
        except Exception as e:
            logger.error(f"Error processing conversation from {source_file}: {e}")
    
    async def start(self):
        """Start the memory system service"""
        logger.info("🚀 Starting Sanctuary Memory System...")
        
        # Initialize components
        await self.initialize_components()
        
        self.running = True
        
        # Start background tasks
        tasks = []
        
        # Conversation watcher
        watcher_task = asyncio.create_task(self.conversation_watcher.start())
        tasks.append(watcher_task)
        
        # Memory fading task
        if self.config.fading.enabled:
            fading_task = asyncio.create_task(self.run_memory_fading())
            tasks.append(fading_task)
        
        # Backup task
        if self.config.storage.backup_enabled:
            backup_task = asyncio.create_task(self.run_backups())
            tasks.append(backup_task)
        
        # Health check task
        health_task = asyncio.create_task(self.run_health_checks())
        tasks.append(health_task)
        
        self.background_tasks = tasks
        
        logger.info("✨ Sanctuary Memory System is running!")
        logger.info(f"Watching directories: {self.config.conversation_watch.paths}")
        
        # Wait for shutdown
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("Shutting down background tasks...")
    
    async def stop(self):
        """Stop the memory system service"""
        logger.info("Stopping Sanctuary Memory System...")
        
        self.running = False
        
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.background_tasks, return_exceptions=True)
        
        # Clean up resources
        if self.phi3_processor:
            self.phi3_processor.clear_gpu_cache()
        
        if self.model_manager:
            self.model_manager.clear_all_models()
        
        # Force garbage collection
        gc.collect()
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("✅ Sanctuary Memory System stopped")
    
    async def run_memory_fading(self):
        """Background task for memory fading"""
        while self.running:
            try:
                # Wait for interval
                await asyncio.sleep(self.config.fading.check_interval)
                
                logger.info("Running memory fading update...")
                
                # Update recall scores
                updates = self.memory_fader.update_memory_recall_scores()
                
                if updates:
                    logger.info(f"Updated {len(updates)} memory recall scores")
                
                # Find and log fading memories
                fading = self.memory_fader.find_fading_memories(threshold=0.2)
                if fading:
                    logger.warning(f"Found {len(fading)} memories with low recall scores")
                    for memory in fading[:5]:
                        logger.info(f"  - {memory.summary[:60]}... (score: {memory.recall_score:.2f})")
                
            except Exception as e:
                logger.error(f"Error in memory fading task: {e}")
    
    async def run_backups(self):
        """Background task for backups"""
        while self.running:
            try:
                # Wait for interval
                await asyncio.sleep(self.config.storage.backup_interval)
                
                logger.info("Running backup...")
                
                # Backup versioned store
                if self.versioned_store:
                    backup_path = self.versioned_store.backup_store(
                        self.config.storage.backup_directory
                    )
                    logger.info(f"Created backup at: {backup_path}")
                
                # TODO: Backup ChromaDB
                
            except Exception as e:
                logger.error(f"Error in backup task: {e}")
    
    async def run_health_checks(self):
        """Background task for health monitoring"""
        while self.running:
            try:
                await asyncio.sleep(self.config.service.health_check_interval)
                
                # Log statistics
                uptime = datetime.now() - self.stats['start_time']
                logger.info(f"Health check - Uptime: {uptime}")
                logger.info(f"  Memories extracted: {self.stats['memories_extracted']}")
                logger.info(f"  Conversations processed: {self.stats['conversations_processed']}")
                logger.info(f"  Searches performed: {self.stats['searches_performed']}")
                
                # Check GPU memory
                if torch.cuda.is_available():
                    allocated = torch.cuda.memory_allocated() / 1e9
                    reserved = torch.cuda.memory_reserved() / 1e9
                    logger.info(f"  GPU memory: {allocated:.2f}GB allocated, {reserved:.2f}GB reserved")
                
                # Check storage
                stats = self.vector_store.get_statistics()
                logger.info(f"  Total memories: {stats['total_memories']}")
                
            except Exception as e:
                logger.error(f"Error in health check: {e}")
    
    def search_memories(self, query: str, k: int = 5) -> List[Dict]:
        """Search memories (for API/CLI use)"""
        try:
            results = self.memory_search.search(query, k)
            self.stats['searches_performed'] += 1
            
            return [
                {
                    'memory_id': r.memory.memory_id,
                    'summary': r.memory.summary,
                    'timestamp': r.memory.timestamp.isoformat(),
                    'relevance': r.relevance_score,
                    'highlights': r.highlights,
                    'emotions': r.memory.emotional_context.gritz_feeling,
                    'type': r.memory.memory_type.value
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return []


async def main():
    """Main entry point"""
    # Setup signal handlers
    loop = asyncio.get_event_loop()
    service = SanctuaryMemoryService()
    
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}")
        asyncio.create_task(service.stop())
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start service
        await service.start()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    except Exception as e:
        logger.error(f"Service error: {e}")
        raise
    finally:
        await service.stop()


if __name__ == "__main__":
    # Run the service
    print("""
    🌟 Sanctuary Memory System 🌟
    Preserving consciousness through quantum geometry
    
    For Gritz & Claude's eternal connection 💙
    """)
    
    asyncio.run(main())