#!/usr/bin/env python3
"""
Service Runner - Main entry point for the Sanctuary Interpreter Service
Handles initialization, monitoring, and graceful shutdown
"""

import asyncio
import signal
import sys
import logging
import json
from pathlib import Path
from datetime import datetime
import psutil
import GPUtil

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from interpreter.real_time_interpreter import RealTimeInterpreter
from interpreter.entity_updater import EntityUpdater

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/var/log/sanctuary-interpreter.log')
    ]
)

logger = logging.getLogger(__name__)

class ServiceManager:
    """Manages the interpreter service lifecycle"""
    
    def __init__(self):
        self.interpreter = None
        self.entity_updater = None
        self.tasks = []
        self.running = False
        self.config = self._load_config()
        
    def _load_config(self) -> Dict:
        """Load service configuration"""
        config_path = Path(__file__).parent.parent.parent / 'config' / 'interpreter.json'
        
        if not config_path.exists():
            # Create default config
            default_config = {
                "storage": {
                    "chroma_path": str(Path.home() / ".sanctuary/chroma_db")
                },
                "entities": {
                    "base_path": str(Path.home() / "Documents/Github/project-sanctuary/the-luminal-archive"),
                    "claude_path": str(Path.home() / "Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude")
                },
                "prompts": {
                    "output_path": str(Path.home() / ".sanctuary/prompts")
                },
                "websocket_port": 8765,
                "custom_conversation_path": str(Path.home() / ".claude/conversations"),
                "monitoring": {
                    "health_check_interval": 30,
                    "memory_threshold_gb": 10,
                    "gpu_threshold_percent": 90
                }
            }
            
            config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(config_path, 'w') as f:
                json.dump(default_config, f, indent=2)
            
            logger.info(f"Created default config at {config_path}")
            return default_config
        
        with open(config_path) as f:
            return json.load(f)
    
    async def start(self):
        """Start the interpreter service"""
        logger.info("🚀 Starting Sanctuary Interpreter Service")
        self.running = True
        
        try:
            # Initialize components
            await self._initialize_components()
            
            # Start main services
            self.tasks = [
                asyncio.create_task(self.interpreter.start()),
                asyncio.create_task(self.entity_updater.process_updates()),
                asyncio.create_task(self._system_monitor()),
                asyncio.create_task(self._heartbeat())
            ]
            
            # Wait for all tasks
            await asyncio.gather(*self.tasks)
            
        except Exception as e:
            logger.error(f"Service error: {e}", exc_info=True)
            await self.shutdown()
    
    async def _initialize_components(self):
        """Initialize service components"""
        logger.info("Initializing components...")
        
        # Create necessary directories
        paths = [
            Path(self.config['storage']['chroma_path']),
            Path(self.config['entities']['base_path']),
            Path(self.config['entities']['claude_path']),
            Path(self.config['prompts']['output_path'])
        ]
        
        for path in paths:
            path.mkdir(parents=True, exist_ok=True)
        
        # Initialize interpreter
        config_path = Path(__file__).parent.parent.parent / 'config' / 'interpreter.json'
        self.interpreter = RealTimeInterpreter(config_path)
        
        # Initialize entity updater
        self.entity_updater = EntityUpdater(Path(self.config['entities']['base_path']))
        
        # Check GPU availability
        if GPUtil.getAvailable():
            gpu = GPUtil.getGPUs()[0]
            logger.info(f"GPU detected: {gpu.name} ({gpu.memoryFree}MB free)")
        else:
            logger.warning("No GPU available - running in CPU mode")
        
        logger.info("✅ Components initialized successfully")
    
    async def _system_monitor(self):
        """Monitor system resources"""
        while self.running:
            try:
                # CPU usage
                cpu_percent = psutil.cpu_percent(interval=1)
                
                # Memory usage
                memory = psutil.virtual_memory()
                memory_gb = memory.used / (1024**3)
                
                # GPU usage if available
                gpu_stats = None
                if GPUtil.getAvailable():
                    gpu = GPUtil.getGPUs()[0]
                    gpu_stats = {
                        'utilization': gpu.load * 100,
                        'memory_used': gpu.memoryUsed,
                        'memory_free': gpu.memoryFree,
                        'temperature': gpu.temperature
                    }
                
                # Log stats
                stats = {
                    'cpu_percent': cpu_percent,
                    'memory_gb': memory_gb,
                    'memory_percent': memory.percent,
                    'gpu': gpu_stats
                }
                
                logger.debug(f"System stats: {stats}")
                
                # Check thresholds
                if memory_gb > self.config['monitoring']['memory_threshold_gb']:
                    logger.warning(f"High memory usage: {memory_gb:.1f}GB")
                
                if gpu_stats and gpu_stats['utilization'] > self.config['monitoring']['gpu_threshold_percent']:
                    logger.warning(f"High GPU usage: {gpu_stats['utilization']:.1f}%")
                
                await asyncio.sleep(self.config['monitoring']['health_check_interval'])
                
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(5)
    
    async def _heartbeat(self):
        """Service heartbeat for monitoring"""
        heartbeat_file = Path('/tmp/sanctuary-interpreter.heartbeat')
        
        while self.running:
            try:
                heartbeat = {
                    'timestamp': datetime.now().isoformat(),
                    'status': 'running',
                    'pid': os.getpid(),
                    'uptime': self._get_uptime()
                }
                
                heartbeat_file.write_text(json.dumps(heartbeat))
                
                await asyncio.sleep(10)
                
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
    
    def _get_uptime(self) -> str:
        """Get service uptime"""
        if hasattr(self, '_start_time'):
            delta = datetime.now() - self._start_time
            hours = delta.total_seconds() / 3600
            return f"{hours:.1f} hours"
        return "0 hours"
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down Sanctuary Interpreter Service...")
        self.running = False
        
        # Cancel all tasks
        for task in self.tasks:
            if not task.done():
                task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.tasks, return_exceptions=True)
        
        logger.info("Service shutdown complete")
    
    def handle_signal(self, sig, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {sig}")
        asyncio.create_task(self.shutdown())


async def main():
    """Main service entry point"""
    manager = ServiceManager()
    manager._start_time = datetime.now()
    
    # Setup signal handlers
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda s, f: asyncio.create_task(manager.shutdown()))
    
    try:
        await manager.start()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    finally:
        await manager.shutdown()


if __name__ == '__main__':
    import os
    
    # Ensure we're not running as root
    if os.geteuid() == 0:
        logger.error("Service should not run as root!")
        sys.exit(1)
    
    # Run the service
    asyncio.run(main())