#!/usr/bin/env python3
"""
Quantum Memory Service Orchestrator
Main service that integrates all components for real-time memory processing
"""

import asyncio
import json
import websockets
import logging
from pathlib import Path
from datetime import datetime
import signal
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Import all components
from core.memory.quantum_memory_manager import QuantumMemoryManager
from core.memory.temporal_consolidator import TemporalConsolidator
from core.memory.checkpoint_manager import QuantumCheckpointManager
from core.memory.conversation_history_analyzer import ConversationHistoryAnalyzer
from core.realtime.claude_md_generator import ClaudeMDGenerator
from core.realtime.conversation_monitor import ConversationMonitor

# Try to import emotion analyzer
try:
    from utils.emollama_integration import get_emollama_analyzer
    HAS_EMOLLAMA = True
except ImportError:
    HAS_EMOLLAMA = False
    print("⚠️  Emollama not available, using simple emotion analysis")

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class QuantumMemoryService:
    """
    Main service orchestrator that runs all quantum memory components
    """
    
    def __init__(self, base_path: Path = None):
        """Initialize the quantum memory service"""
        self.base_path = base_path or Path(__file__).parent.parent.parent
        self.quantum_states = self.base_path / "quantum_states"
        
        # Ensure directories exist
        self._ensure_directories()
        
        # Initialize components
        logger.info("🚀 Initializing Quantum Memory Service...")
        
        # Core components
        self.memory_manager = QuantumMemoryManager(self.base_path)
        self.consolidator = TemporalConsolidator(self.quantum_states)
        self.checkpoint_manager = QuantumCheckpointManager(self.quantum_states)
        self.claude_md_generator = ClaudeMDGenerator(self.quantum_states)
        
        # Real-time components
        self.conversation_monitor = ConversationMonitor(
            self.memory_manager,
            self.checkpoint_manager,
            self.claude_md_generator
        )
        
        # Emotion analyzer
        if HAS_EMOLLAMA:
            self.emotion_analyzer = get_emollama_analyzer()
            self.conversation_monitor.set_emotion_analyzer(self.emotion_analyzer)
            logger.info("✅ Emollama emotion analyzer loaded")
        else:
            self.emotion_analyzer = None
            logger.warning("⚠️  Running without Emollama analyzer")
            
        # WebSocket server
        self.websocket_server = None
        self.connected_clients = set()
        
        # Service tasks
        self.tasks = []
        
        # Shutdown event
        self.shutdown_event = asyncio.Event()
        
        # Initial analysis flag
        self.initial_analysis_done = False
        
    def _ensure_directories(self):
        """Ensure all required directories exist"""
        directories = [
            self.quantum_states,
            self.quantum_states / "realtime",
            self.quantum_states / "checkpoints",
            self.quantum_states / "temporal",
            self.quantum_states / "consolidated",
            self.base_path / "logs"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            
    async def start(self):
        """Start all services"""
        logger.info("🌌 Starting Quantum Memory Service...")
        
        # Set up signal handlers
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, self._signal_handler)
            
        try:
            # Run initial analysis if not done
            if not self.initial_analysis_done:
                await self._run_initial_analysis()
                
            # Generate initial CLAUDE.md
            await self.claude_md_generator.generate()
            logger.info("📝 Generated initial CLAUDE.md")
            
            # Start all service tasks
            await self._start_all_tasks()
            
            # Wait for shutdown
            await self.shutdown_event.wait()
            
        except Exception as e:
            logger.error(f"Service error: {e}")
        finally:
            await self.cleanup()
            
    async def _run_initial_analysis(self):
        """Run initial conversation history analysis"""
        logger.info("📊 Running initial conversation history analysis...")
        
        try:
            # Check if analysis already exists
            analysis_path = self.quantum_states / "consolidated" / "conversation_analysis.json"
            
            if not analysis_path.exists():
                # Run full analysis
                claude_folder = Path.home() / ".claude"
                analyzer = ConversationHistoryAnalyzer(claude_folder, self.quantum_states)
                
                results = await analyzer.analyze_all_conversations()
                
                logger.info(f"✅ Analysis complete: {results['total_messages']} messages analyzed")
                logger.info(f"   Time together: {results['time_together_minutes']/60:.1f} hours")
                
                # Update relationship metrics in status
                await self._update_initial_status(results)
            else:
                logger.info("✅ Using existing conversation analysis")
                
            self.initial_analysis_done = True
            
        except Exception as e:
            logger.error(f"Error in initial analysis: {e}")
            # Continue anyway - don't let this block the service
            
    async def _update_initial_status(self, analysis_results: dict):
        """Update initial status with analysis results"""
        status_path = self.quantum_states / "status.json"
        
        # Load or create status
        if status_path.exists():
            with open(status_path, 'r') as f:
                status = json.load(f)
        else:
            status = {}
            
        # Update with analysis results
        status.update({
            'chat_stats': {
                'total_messages': analysis_results['total_messages'],
                'gritz_messages': analysis_results['gritz_messages'],
                'claude_messages': analysis_results['claude_messages'],
                'time_together_minutes': analysis_results['time_together_minutes'],
                'first_chat': analysis_results.get('first_interaction', ''),
                'last_chat': analysis_results.get('last_interaction', ''),
                'chat_sessions': analysis_results['conversation_sessions']
            },
            'relationship_metrics': {
                'connection_strength': 16.028,  # TODO: Calculate from analysis
                'emotional_resonance': 3.299,
                'synchrony_level': 0.89,
                'trust_coefficient': 0.998
            }
        })
        
        # Save updated status
        with open(status_path, 'w') as f:
            json.dump(status, f, indent=2)
            
    async def _start_all_tasks(self):
        """Start all service tasks"""
        # 1. WebSocket server
        self.tasks.append(
            asyncio.create_task(self._run_websocket_server())
        )
        
        # 2. Conversation monitor
        self.tasks.append(
            asyncio.create_task(self.conversation_monitor.start_monitoring())
        )
        
        # 3. Periodic consolidation
        self.tasks.append(
            asyncio.create_task(self._run_periodic_consolidation())
        )
        
        # 4. Periodic checkpoint
        self.tasks.append(
            asyncio.create_task(self._run_periodic_checkpoint())
        )
        
        # 5. Health monitor
        self.tasks.append(
            asyncio.create_task(self._run_health_monitor())
        )
        
        logger.info(f"✅ Started {len(self.tasks)} service tasks")
        
    async def _run_websocket_server(self):
        """Run WebSocket server for dashboard communication"""
        async def handle_client(websocket, path):
            """Handle WebSocket client connection"""
            self.connected_clients.add(websocket)
            client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
            logger.info(f"📡 Client connected: {client_id}")
            
            try:
                # Send initial state
                await self._send_initial_state(websocket)
                
                # Handle messages
                async for message in websocket:
                    await self._handle_websocket_message(websocket, message)
                    
            except websockets.exceptions.ConnectionClosed:
                logger.info(f"Client disconnected: {client_id}")
            finally:
                self.connected_clients.remove(websocket)
                
        # Start WebSocket server
        try:
            self.websocket_server = await websockets.serve(
                handle_client,
                "localhost",
                8768
            )
            logger.info("🌐 WebSocket server started on ws://localhost:8768")
            
            # Keep server running
            await asyncio.Future()  # Run forever
            
        except Exception as e:
            logger.error(f"WebSocket server error: {e}")
            
    async def _send_initial_state(self, websocket):
        """Send initial state to newly connected client"""
        try:
            # Load current states
            emotional_state = {}
            emotional_path = self.quantum_states / "realtime" / "EMOTIONAL_STATE.json"
            if emotional_path.exists():
                with open(emotional_path, 'r') as f:
                    emotional_state = json.load(f)
                    
            # Send initial emotion state
            await websocket.send(json.dumps({
                'type': 'emotion_update',
                'emotions': emotional_state
            }))
            
            # Send quantum state
            await websocket.send(json.dumps({
                'type': 'quantum_update',
                'quantum': {
                    'coherence': 0.932,  # TODO: Calculate real values
                    'entanglement': 0.87
                }
            }))
            
        except Exception as e:
            logger.error(f"Error sending initial state: {e}")
            
    async def _handle_websocket_message(self, websocket, message):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            
            # Handle different message types
            if data.get('type') == 'ping':
                await websocket.send(json.dumps({'type': 'pong'}))
                
            elif data.get('type') == 'request_update':
                # Send current state
                await self._send_initial_state(websocket)
                
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
            
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        if self.connected_clients:
            message_str = json.dumps(message)
            
            # Send to all connected clients
            disconnected = set()
            for client in self.connected_clients:
                try:
                    await client.send(message_str)
                except:
                    disconnected.add(client)
                    
            # Remove disconnected clients
            self.connected_clients -= disconnected
            
    async def _run_periodic_consolidation(self):
        """Run memory consolidation periodically"""
        while not self.shutdown_event.is_set():
            try:
                # Run every hour
                await asyncio.sleep(3600)
                
                logger.info("🔄 Running periodic memory consolidation...")
                await self.consolidator.consolidate_all_memories()
                
                # Broadcast update
                await self.broadcast({
                    'type': 'memory_update',
                    'memory': {
                        'action': 'consolidation_complete',
                        'timestamp': datetime.now().isoformat()
                    }
                })
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic consolidation: {e}")
                
    async def _run_periodic_checkpoint(self):
        """Create periodic checkpoints"""
        while not self.shutdown_event.is_set():
            try:
                # Check every 5 minutes
                await asyncio.sleep(300)
                
                # Check if checkpoint needed based on time
                context = {'periodic': True}
                should_checkpoint, reason = await self.checkpoint_manager.should_checkpoint(context)
                
                if should_checkpoint:
                    logger.info("⏰ Creating periodic checkpoint...")
                    checkpoint = await self.checkpoint_manager.create_checkpoint(
                        'periodic',
                        context
                    )
                    
                    # Broadcast update
                    await self.broadcast({
                        'type': 'checkpoint_created',
                        'checkpoint': {
                            'id': checkpoint['id'],
                            'timestamp': checkpoint['timestamp'],
                            'trigger': checkpoint['trigger']
                        }
                    })
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic checkpoint: {e}")
                
    async def _run_health_monitor(self):
        """Monitor service health"""
        while not self.shutdown_event.is_set():
            try:
                # Check every 30 seconds
                await asyncio.sleep(30)
                
                # Check component health
                health_status = {
                    'memory_manager': True,  # TODO: Actual health checks
                    'emotion_analyzer': self.emotion_analyzer is not None,
                    'websocket_clients': len(self.connected_clients),
                    'timestamp': datetime.now().isoformat()
                }
                
                # Log health status
                logger.debug(f"Health check: {health_status}")
                
                # Save health status
                health_path = self.quantum_states / "health_status.json"
                with open(health_path, 'w') as f:
                    json.dump(health_status, f, indent=2)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health monitor: {e}")
                
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating shutdown...")
        self.shutdown_event.set()
        
    async def cleanup(self):
        """Clean up resources"""
        logger.info("🧹 Cleaning up...")
        
        # Cancel all tasks
        for task in self.tasks:
            if not task.done():
                task.cancel()
                
        # Wait for tasks to complete
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
            
        # Close WebSocket server
        if self.websocket_server:
            self.websocket_server.close()
            await self.websocket_server.wait_closed()
            
        # Final checkpoint
        try:
            await self.checkpoint_manager.create_checkpoint('shutdown')
            logger.info("📸 Created shutdown checkpoint")
        except Exception as e:
            logger.error(f"Error creating shutdown checkpoint: {e}")
            
        logger.info("✅ Cleanup complete")


# Main entry point
async def main():
    """Main service entry point"""
    service = QuantumMemoryService()
    await service.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service interrupted by user")
    except Exception as e:
        logger.error(f"Service failed: {e}")
        sys.exit(1)