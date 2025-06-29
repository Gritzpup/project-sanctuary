"""
Base classes for all quantum memory system components

Provides common functionality, interfaces, and patterns that all
components should follow for consistency and maintainability.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
import json
from pathlib import Path


@dataclass
class ComponentConfig:
    """Base configuration for all components"""
    name: str
    version: str = "1.0.0"
    enabled: bool = True
    debug: bool = False
    config_path: Optional[Path] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseComponent(ABC):
    """
    Base class for all quantum memory system components.
    Provides common functionality like logging, configuration, and lifecycle management.
    """
    
    def __init__(self, config: Optional[ComponentConfig] = None):
        self.config = config or ComponentConfig(name=self.__class__.__name__)
        self.logger = logging.getLogger(self.config.name)
        self._initialized = False
        self._running = False
        self._tasks: List[asyncio.Task] = []
        self._event_handlers: Dict[str, List[Callable]] = {}
        
        # Component metrics
        self.metrics = {
            "created_at": datetime.now().isoformat(),
            "operations_count": 0,
            "errors_count": 0,
            "last_operation": None
        }
        
    async def initialize(self) -> None:
        """Initialize the component"""
        if self._initialized:
            self.logger.warning(f"{self.config.name} already initialized")
            return
            
        self.logger.info(f"Initializing {self.config.name} v{self.config.version}")
        
        try:
            # Load configuration if path provided
            if self.config.config_path and self.config.config_path.exists():
                await self._load_config()
                
            # Component-specific initialization
            await self._initialize()
            
            self._initialized = True
            self.logger.info(f"{self.config.name} initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize {self.config.name}: {e}")
            raise
            
    @abstractmethod
    async def _initialize(self) -> None:
        """Component-specific initialization logic"""
        pass
        
    async def start(self) -> None:
        """Start the component"""
        if not self._initialized:
            await self.initialize()
            
        if self._running:
            self.logger.warning(f"{self.config.name} already running")
            return
            
        self.logger.info(f"Starting {self.config.name}")
        
        try:
            # Component-specific start logic
            await self._start()
            
            self._running = True
            self.emit_event("component_started", {"name": self.config.name})
            
        except Exception as e:
            self.logger.error(f"Failed to start {self.config.name}: {e}")
            raise
            
    @abstractmethod
    async def _start(self) -> None:
        """Component-specific start logic"""
        pass
        
    async def stop(self) -> None:
        """Stop the component"""
        if not self._running:
            self.logger.warning(f"{self.config.name} not running")
            return
            
        self.logger.info(f"Stopping {self.config.name}")
        
        try:
            # Cancel all tasks
            for task in self._tasks:
                if not task.done():
                    task.cancel()
                    
            # Wait for tasks to complete
            if self._tasks:
                await asyncio.gather(*self._tasks, return_exceptions=True)
                
            # Component-specific stop logic
            await self._stop()
            
            self._running = False
            self.emit_event("component_stopped", {"name": self.config.name})
            
        except Exception as e:
            self.logger.error(f"Error stopping {self.config.name}: {e}")
            raise
            
    @abstractmethod
    async def _stop(self) -> None:
        """Component-specific stop logic"""
        pass
        
    async def _load_config(self) -> None:
        """Load configuration from file"""
        try:
            with open(self.config.config_path, 'r') as f:
                config_data = json.load(f)
                
            # Update config with loaded data
            for key, value in config_data.items():
                if hasattr(self.config, key):
                    setattr(self.config, key, value)
                    
            self.logger.info(f"Loaded configuration from {self.config.config_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to load configuration: {e}")
            
    def register_event_handler(self, event: str, handler: Callable) -> None:
        """Register an event handler"""
        if event not in self._event_handlers:
            self._event_handlers[event] = []
            
        self._event_handlers[event].append(handler)
        self.logger.debug(f"Registered handler for event: {event}")
        
    def emit_event(self, event: str, data: Any = None) -> None:
        """Emit an event to all registered handlers"""
        if event in self._event_handlers:
            for handler in self._event_handlers[event]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        asyncio.create_task(handler(data))
                    else:
                        handler(data)
                except Exception as e:
                    self.logger.error(f"Error in event handler for {event}: {e}")
                    
    def create_task(self, coro: Callable, name: Optional[str] = None) -> asyncio.Task:
        """Create and track an async task"""
        task = asyncio.create_task(coro, name=name)
        self._tasks.append(task)
        
        # Clean up completed tasks
        self._tasks = [t for t in self._tasks if not t.done()]
        
        return task
        
    def update_metrics(self, operation: str, error: bool = False) -> None:
        """Update component metrics"""
        self.metrics["operations_count"] += 1
        self.metrics["last_operation"] = {
            "name": operation,
            "timestamp": datetime.now().isoformat(),
            "error": error
        }
        
        if error:
            self.metrics["errors_count"] += 1
            
    def get_status(self) -> Dict[str, Any]:
        """Get component status"""
        return {
            "name": self.config.name,
            "version": self.config.version,
            "initialized": self._initialized,
            "running": self._running,
            "enabled": self.config.enabled,
            "metrics": self.metrics,
            "active_tasks": len([t for t in self._tasks if not t.done()])
        }


class BaseMemoryComponent(BaseComponent):
    """Base class for memory-specific components"""
    
    def __init__(self, config: Optional[ComponentConfig] = None, 
                 memory_system=None):
        super().__init__(config)
        self.memory_system = memory_system
        self.memory_metrics = {
            "memories_processed": 0,
            "memories_stored": 0,
            "memories_retrieved": 0,
            "compression_ratio": 0.0
        }
        
    async def process_memory(self, content: str, metadata: Dict[str, Any]) -> Any:
        """Process a memory through this component"""
        try:
            self.update_metrics("process_memory")
            self.memory_metrics["memories_processed"] += 1
            
            # Component-specific processing
            result = await self._process_memory(content, metadata)
            
            return result
            
        except Exception as e:
            self.update_metrics("process_memory", error=True)
            self.logger.error(f"Error processing memory: {e}")
            raise
            
    @abstractmethod
    async def _process_memory(self, content: str, metadata: Dict[str, Any]) -> Any:
        """Component-specific memory processing"""
        pass
        
    def get_memory_status(self) -> Dict[str, Any]:
        """Get memory-specific status"""
        status = self.get_status()
        status["memory_metrics"] = self.memory_metrics
        return status


class BaseQuantumComponent(BaseComponent):
    """Base class for quantum-enhanced components"""
    
    def __init__(self, config: Optional[ComponentConfig] = None,
                 n_qubits: int = 8):
        super().__init__(config)
        self.n_qubits = n_qubits
        self.quantum_device = None
        self.quantum_metrics = {
            "circuits_executed": 0,
            "average_fidelity": 0.0,
            "entanglement_depth": 0,
            "coherence_time": 0.0
        }
        
    async def _initialize(self) -> None:
        """Initialize quantum resources"""
        try:
            # Initialize quantum device (implementation-specific)
            self.quantum_device = await self._init_quantum_device()
            self.logger.info(f"Initialized {self.n_qubits}-qubit quantum device")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize quantum device: {e}")
            raise
            
    @abstractmethod
    async def _init_quantum_device(self) -> Any:
        """Initialize the specific quantum backend"""
        pass
        
    async def execute_circuit(self, circuit: Any) -> Any:
        """Execute a quantum circuit"""
        try:
            self.update_metrics("execute_circuit")
            self.quantum_metrics["circuits_executed"] += 1
            
            # Execute on quantum device
            result = await self._execute_circuit(circuit)
            
            return result
            
        except Exception as e:
            self.update_metrics("execute_circuit", error=True)
            self.logger.error(f"Circuit execution failed: {e}")
            raise
            
    @abstractmethod
    async def _execute_circuit(self, circuit: Any) -> Any:
        """Device-specific circuit execution"""
        pass
        
    def get_quantum_status(self) -> Dict[str, Any]:
        """Get quantum-specific status"""
        status = self.get_status()
        status["quantum_metrics"] = self.quantum_metrics
        status["n_qubits"] = self.n_qubits
        status["device_available"] = self.quantum_device is not None
        return status


class BaseProcessor(BaseComponent):
    """Base class for data processors"""
    
    def __init__(self, config: Optional[ComponentConfig] = None,
                 input_queue: Optional[asyncio.Queue] = None,
                 output_queue: Optional[asyncio.Queue] = None):
        super().__init__(config)
        self.input_queue = input_queue or asyncio.Queue()
        self.output_queue = output_queue or asyncio.Queue()
        self._processing = False
        
    async def _start(self) -> None:
        """Start processing loop"""
        self._processing = True
        self.create_task(self._process_loop(), name=f"{self.config.name}_process_loop")
        
    async def _stop(self) -> None:
        """Stop processing"""
        self._processing = False
        
    async def _process_loop(self) -> None:
        """Main processing loop"""
        while self._processing:
            try:
                # Get item from input queue
                item = await asyncio.wait_for(
                    self.input_queue.get(), 
                    timeout=1.0
                )
                
                # Process item
                result = await self.process_item(item)
                
                # Put result in output queue
                if result is not None:
                    await self.output_queue.put(result)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                self.logger.error(f"Processing error: {e}")
                self.update_metrics("process_item", error=True)
                
    @abstractmethod
    async def process_item(self, item: Any) -> Any:
        """Process a single item"""
        pass