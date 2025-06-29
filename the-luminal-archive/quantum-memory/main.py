"""
Quantum Memory System - Main Integration

This is the main entry point for the quantum-enhanced memory system.
It integrates all components and provides a unified interface.
"""

import asyncio
import logging
import signal
import sys
from pathlib import Path
from typing import Optional

# Core components
from core import (
    EmotionalBaselineManager,
    RelationshipPhaseTracker,
    SemanticDeduplicator,
    EnhancedMVPMemorySystem,
    MemoryHealthMonitor,
    QuantumEmotionalEncoder
)

# Services
from services.websocket import QuantumMemoryWebSocketServer, WebSocketBroadcaster

# Utilities
from utils.checkpoint import ClaudeFolderSync, StateManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class QuantumMemorySystem:
    """
    Main quantum memory system integrating all components.
    
    This class orchestrates:
    - Psychological foundation (emotional baseline, phase tracking)
    - Memory management (storage, deduplication, retrieval)
    - Quantum enhancements (emotional encoding, compression)
    - Real-time monitoring (WebSocket, health checks)
    - State persistence (.claude folder sync, checkpoints)
    """
    
    def __init__(self):
        # Core components
        self.emotional_baseline = None
        self.phase_tracker = None
        self.semantic_dedup = None
        self.memory_system = None
        self.health_monitor = None
        self.quantum_encoder = None
        
        # Services
        self.websocket_server = None
        self.ws_broadcaster = None
        
        # Utilities
        self.claude_sync = None
        self.state_manager = None
        
        # System state
        self._initialized = False
        self._running = False
        
    async def initialize(self):
        """Initialize all system components"""
        logger.info("Initializing Quantum Memory System...")
        
        try:
            # Initialize psychological foundation
            logger.info("Initializing psychological foundation...")
            self.emotional_baseline = EmotionalBaselineManager()
            self.phase_tracker = RelationshipPhaseTracker()
            self.semantic_dedup = SemanticDeduplicator()
            
            # Initialize memory system
            logger.info("Initializing memory system...")
            self.memory_system = EnhancedMVPMemorySystem(
                checkpoint_dir="data/checkpoints/memory"
            )
            await self.memory_system.initialize()
            
            # Initialize health monitor
            logger.info("Initializing health monitor...")
            self.health_monitor = MemoryHealthMonitor(
                memory_system=self.memory_system,
                emotional_baseline=self.emotional_baseline
            )
            
            # Initialize quantum components
            logger.info("Initializing quantum encoder...")
            self.quantum_encoder = QuantumEmotionalEncoder(n_qubits=28)
            await self.quantum_encoder.initialize()
            
            # Initialize WebSocket server
            logger.info("Initializing WebSocket server...")
            self.websocket_server = QuantumMemoryWebSocketServer(port=8765)
            self.ws_broadcaster = WebSocketBroadcaster(self.websocket_server)
            
            # Initialize state management
            logger.info("Initializing state management...")
            self.state_manager = StateManager()
            await self.state_manager.initialize()
            
            # Initialize Claude folder sync
            logger.info("Initializing Claude folder sync...")
            self.claude_sync = ClaudeFolderSync(memory_system=self.memory_system)
            
            # Wire up event handlers
            self._setup_event_handlers()
            
            self._initialized = True
            logger.info("Quantum Memory System initialized successfully!")
            
        except Exception as e:
            logger.error(f"Failed to initialize system: {e}")
            raise
            
    def _setup_event_handlers(self):
        """Set up event handlers between components"""
        # Emotional updates -> WebSocket broadcast
        async def on_emotional_update(state):
            await self.ws_broadcaster.emotional_update(
                emotional_state=state,
                component="emotional_baseline"
            )
            # Update state manager
            await self.state_manager.update_emotional_baseline(state)
            
        self.emotional_baseline.on_state_update = on_emotional_update
        
        # Phase updates -> WebSocket broadcast
        async def on_phase_update(phase, confidence):
            await self.ws_broadcaster.phase_update(
                phase=phase,
                confidence=confidence,
                component="phase_tracker"
            )
            # Update state manager
            await self.state_manager.update_relationship_phase(phase)
            
        self.phase_tracker.on_phase_change = on_phase_update
        
        # Health updates -> WebSocket broadcast
        async def on_health_update(metrics):
            await self.ws_broadcaster.health_update(
                health_metrics=metrics,
                component="health_monitor"
            )
            # Update state manager
            await self.state_manager.update_health_metrics(metrics)
            
        self.health_monitor.on_health_update = on_health_update
        
    async def start(self):
        """Start all system components"""
        if not self._initialized:
            await self.initialize()
            
        logger.info("Starting Quantum Memory System...")
        
        try:
            # Start WebSocket server
            await self.websocket_server.start()
            
            # Start Claude folder monitoring
            await self.claude_sync.start_monitoring()
            
            # Start health monitoring
            asyncio.create_task(self.health_monitor.start_monitoring())
            
            self._running = True
            logger.info("Quantum Memory System started successfully!")
            
            # Broadcast system ready
            await self.ws_broadcaster.health_update(
                health_metrics={
                    "status": "ready",
                    "message": "Quantum Memory System online"
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to start system: {e}")
            raise
            
    async def stop(self):
        """Stop all system components"""
        logger.info("Stopping Quantum Memory System...")
        
        self._running = False
        
        # Stop Claude sync
        if self.claude_sync:
            self.claude_sync.stop_monitoring()
            
        # Stop WebSocket server
        if self.websocket_server:
            await self.websocket_server.stop()
            
        # Stop health monitor
        if self.health_monitor:
            await self.health_monitor.stop_monitoring()
            
        # Shutdown state manager
        if self.state_manager:
            await self.state_manager.shutdown()
            
        # Shutdown memory system
        if self.memory_system:
            await self.memory_system.shutdown()
            
        logger.info("Quantum Memory System stopped.")
        
    async def process_interaction(self, speaker: str, content: str):
        """
        Process a new interaction through the entire system.
        
        This is the main entry point for new conversations.
        """
        logger.info(f"Processing interaction from {speaker}")
        
        try:
            # 1. Analyze emotional content
            emotional_state = self.emotional_baseline.update_state({
                "content": content,
                "speaker": speaker
            })
            
            # 2. Quantum encode emotional state
            quantum_state = await self.quantum_encoder.encode_emotional_state(
                emotional_state
            )
            
            # 3. Detect relationship phase
            phase_info = self.phase_tracker.analyze_interaction(
                speaker, content, emotional_state
            )
            
            # 4. Check for deduplication
            should_dedup, similar = self.semantic_dedup.should_deduplicate(
                content, 
                await self.memory_system.get_recent_memories()
            )
            
            # 5. Store in memory system if not duplicate
            if not should_dedup:
                memory_id = await self.memory_system.add_memory(
                    speaker=speaker,
                    content=content,
                    memory_type="conversation",
                    importance=phase_info.get("importance", 0.5),
                    metadata={
                        "emotional_state": emotional_state,
                        "quantum_state": quantum_state.tolist() if hasattr(quantum_state, 'tolist') else str(quantum_state),
                        "phase": phase_info["phase"],
                        "phase_confidence": phase_info["confidence"]
                    }
                )
                
                # Broadcast memory update
                await self.ws_broadcaster.memory_update(
                    memory_data={
                        "id": memory_id,
                        "speaker": speaker,
                        "content": content[:100] + "..." if len(content) > 100 else content,
                        "importance": phase_info.get("importance", 0.5),
                        "deduplicated": False
                    }
                )
            else:
                logger.info(f"Deduplicated similar content: {similar['content'][:50]}...")
                
            # 6. Update quantum state in state manager
            await self.state_manager.update_quantum_state(quantum_state)
            
            # 7. Check system health
            health_metrics = await self.health_monitor.get_system_health()
            if health_metrics.get("status") == "critical":
                logger.warning("System health critical - triggering maintenance")
                await self.health_monitor.trigger_maintenance()
                
            return {
                "success": True,
                "memory_stored": not should_dedup,
                "emotional_state": emotional_state,
                "phase": phase_info["phase"],
                "health_status": health_metrics.get("status", "unknown")
            }
            
        except Exception as e:
            logger.error(f"Error processing interaction: {e}")
            return {
                "success": False,
                "error": str(e)
            }
            
    async def get_relevant_memories(self, query: str, limit: int = 10):
        """Retrieve relevant memories for a query"""
        # Get memories from system
        memories = await self.memory_system.search_memories(
            query=query,
            limit=limit
        )
        
        # Enhance with quantum reconstruction if available
        for memory in memories:
            if "quantum_state" in memory.get("metadata", {}):
                # Reconstruct emotional state from quantum data
                reconstructed = await self.quantum_encoder.reconstruct_emotional_state(
                    memory["metadata"]["quantum_state"]
                )
                memory["reconstructed_emotion"] = reconstructed
                
        return memories
        
    def get_system_status(self):
        """Get comprehensive system status"""
        return {
            "initialized": self._initialized,
            "running": self._running,
            "components": {
                "emotional_baseline": self.emotional_baseline.get_baseline() if self.emotional_baseline else None,
                "phase_tracker": self.phase_tracker.current_phase if self.phase_tracker else None,
                "memory_system": self.memory_system.get_stats() if self.memory_system else None,
                "quantum_encoder": self.quantum_encoder.get_device_info() if self.quantum_encoder else None,
                "websocket_server": {
                    "clients": len(self.websocket_server.clients) if self.websocket_server else 0,
                    "stats": self.websocket_server.stats if self.websocket_server else None
                }
            },
            "state_manager": self.state_manager.get_state_summary() if self.state_manager else None
        }


async def main():
    """Main entry point"""
    # Create system
    quantum_memory = QuantumMemorySystem()
    
    # Handle shutdown gracefully
    def signal_handler(sig, frame):
        logger.info("Shutdown signal received")
        asyncio.create_task(quantum_memory.stop())
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start system
        await quantum_memory.start()
        
        # Example: Process a test interaction
        result = await quantum_memory.process_interaction(
            speaker="Gritz",
            content="Hey love! I'm so excited about our quantum memory system working!"
        )
        logger.info(f"Test interaction result: {result}")
        
        # Keep running
        while quantum_memory._running:
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"System error: {e}")
        await quantum_memory.stop()
        

if __name__ == "__main__":
    asyncio.run(main())