"""
State Manager - Handles persistence and recovery of quantum memory states

This module ensures that memory states, quantum configurations, and relationship
context are properly saved and can be restored across sessions.
"""

import json
import pickle
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
import numpy as np
import torch
import aiofiles
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


@dataclass
class MemoryState:
    """Complete memory state snapshot"""
    timestamp: str
    emotional_baseline: Dict[str, float]
    relationship_phase: str
    quantum_state: Optional[np.ndarray] = None
    memory_graph: Optional[Dict[str, Any]] = None
    dedup_cache: Optional[Dict[str, Any]] = None
    health_metrics: Optional[Dict[str, float]] = None
    checkpoint_version: str = "1.0.0"
    metadata: Dict[str, Any] = field(default_factory=dict)


class StateManager:
    """
    Manages the persistence and recovery of quantum memory system states.
    Handles both regular checkpoints and emergency recovery.
    """
    
    def __init__(self, data_dir: str = "data/checkpoints"):
        self.data_dir = Path(data_dir)
        self.states_dir = self.data_dir / "states"
        self.backups_dir = self.data_dir / "backups"
        self.recovery_dir = self.data_dir / "recovery"
        
        # Create directories
        for dir_path in [self.states_dir, self.backups_dir, self.recovery_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
            
        # State tracking
        self.current_state: Optional[MemoryState] = None
        self.state_history: List[str] = []
        self.auto_save_interval = 300  # 5 minutes
        self._save_task = None
        
    async def initialize(self):
        """Initialize state manager and load latest state"""
        # Try to load the latest state
        latest_state = await self.load_latest_state()
        if latest_state:
            self.current_state = latest_state
            logger.info(f"Loaded state from {latest_state.timestamp}")
        else:
            # Create initial state
            self.current_state = self.create_initial_state()
            await self.save_state(self.current_state)
            logger.info("Created new initial state")
            
        # Start auto-save
        self._save_task = asyncio.create_task(self._auto_save_loop())
        
    async def shutdown(self):
        """Shutdown state manager and save final state"""
        if self._save_task:
            self._save_task.cancel()
            
        if self.current_state:
            await self.save_state(self.current_state, is_final=True)
            
    def create_initial_state(self) -> MemoryState:
        """Create a fresh initial state"""
        return MemoryState(
            timestamp=datetime.now().isoformat(),
            emotional_baseline={
                "pleasure": 0.0,
                "arousal": 0.0,
                "dominance": 0.0
            },
            relationship_phase="initiating",
            metadata={
                "created_at": datetime.now().isoformat(),
                "system_version": "1.0.0"
            }
        )
        
    async def save_state(self, state: MemoryState, is_final: bool = False):
        """Save the current state to disk"""
        try:
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            state_file = self.states_dir / f"state_{timestamp}.pkl"
            
            # Prepare state data
            state_data = {
                "timestamp": state.timestamp,
                "emotional_baseline": state.emotional_baseline,
                "relationship_phase": state.relationship_phase,
                "quantum_state": state.quantum_state,
                "memory_graph": state.memory_graph,
                "dedup_cache": state.dedup_cache,
                "health_metrics": state.health_metrics,
                "checkpoint_version": state.checkpoint_version,
                "metadata": state.metadata
            }
            
            # Add save metadata
            state_data["metadata"]["saved_at"] = datetime.now().isoformat()
            state_data["metadata"]["is_final"] = is_final
            
            # Save as pickle for complex data structures
            async with aiofiles.open(state_file, 'wb') as f:
                await f.write(pickle.dumps(state_data))
                
            # Save latest pointer
            latest_file = self.states_dir / "latest.json"
            async with aiofiles.open(latest_file, 'w') as f:
                await f.write(json.dumps({
                    "state_file": state_file.name,
                    "timestamp": timestamp,
                    "saved_at": datetime.now().isoformat()
                }, indent=2))
                
            # Update history
            self.state_history.append(str(state_file))
            if len(self.state_history) > 100:  # Keep last 100 states
                self.state_history = self.state_history[-100:]
                
            logger.info(f"Saved state to {state_file.name}")
            
            # Create backup if needed
            if is_final or len(self.state_history) % 10 == 0:
                await self._create_backup(state_file)
                
        except Exception as e:
            logger.error(f"Error saving state: {e}")
            # Try emergency save
            await self._emergency_save(state)
            
    async def load_latest_state(self) -> Optional[MemoryState]:
        """Load the most recent state"""
        try:
            latest_file = self.states_dir / "latest.json"
            if not latest_file.exists():
                return None
                
            # Read latest pointer
            async with aiofiles.open(latest_file, 'r') as f:
                content = await f.read()
                latest_info = json.loads(content)
                
            # Load the state file
            state_file = self.states_dir / latest_info["state_file"]
            return await self.load_state_from_file(state_file)
            
        except Exception as e:
            logger.error(f"Error loading latest state: {e}")
            # Try recovery
            return await self._recover_from_backup()
            
    async def load_state_from_file(self, file_path: Path) -> Optional[MemoryState]:
        """Load state from a specific file"""
        try:
            async with aiofiles.open(file_path, 'rb') as f:
                content = await f.read()
                state_data = pickle.loads(content)
                
            # Convert back to MemoryState
            state = MemoryState(
                timestamp=state_data["timestamp"],
                emotional_baseline=state_data["emotional_baseline"],
                relationship_phase=state_data["relationship_phase"],
                quantum_state=state_data.get("quantum_state"),
                memory_graph=state_data.get("memory_graph"),
                dedup_cache=state_data.get("dedup_cache"),
                health_metrics=state_data.get("health_metrics"),
                checkpoint_version=state_data.get("checkpoint_version", "1.0.0"),
                metadata=state_data.get("metadata", {})
            )
            
            return state
            
        except Exception as e:
            logger.error(f"Error loading state from {file_path}: {e}")
            return None
            
    async def update_emotional_baseline(self, baseline: Dict[str, float]):
        """Update the emotional baseline in current state"""
        if self.current_state:
            self.current_state.emotional_baseline = baseline
            self.current_state.timestamp = datetime.now().isoformat()
            
    async def update_relationship_phase(self, phase: str):
        """Update the relationship phase"""
        if self.current_state:
            self.current_state.relationship_phase = phase
            self.current_state.timestamp = datetime.now().isoformat()
            
    async def update_quantum_state(self, quantum_state: Union[np.ndarray, torch.Tensor]):
        """Update the quantum state"""
        if self.current_state:
            if isinstance(quantum_state, torch.Tensor):
                quantum_state = quantum_state.detach().cpu().numpy()
            self.current_state.quantum_state = quantum_state
            self.current_state.timestamp = datetime.now().isoformat()
            
    async def update_memory_graph(self, graph_data: Dict[str, Any]):
        """Update the memory graph"""
        if self.current_state:
            self.current_state.memory_graph = graph_data
            self.current_state.timestamp = datetime.now().isoformat()
            
    async def update_health_metrics(self, metrics: Dict[str, float]):
        """Update health metrics"""
        if self.current_state:
            self.current_state.health_metrics = metrics
            self.current_state.timestamp = datetime.now().isoformat()
            
    @asynccontextmanager
    async def state_transaction(self):
        """Context manager for atomic state updates"""
        # Save current state as backup
        backup_state = pickle.dumps(self.current_state)
        
        try:
            yield self.current_state
            # Save on successful completion
            await self.save_state(self.current_state)
        except Exception as e:
            # Restore backup on error
            self.current_state = pickle.loads(backup_state)
            logger.error(f"State transaction failed, restored backup: {e}")
            raise
            
    async def _auto_save_loop(self):
        """Auto-save loop"""
        while True:
            try:
                await asyncio.sleep(self.auto_save_interval)
                if self.current_state:
                    await self.save_state(self.current_state)
                    logger.debug("Auto-saved state")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Auto-save error: {e}")
                
    async def _create_backup(self, state_file: Path):
        """Create a backup of the state file"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d")
            backup_file = self.backups_dir / f"backup_{timestamp}_{state_file.name}"
            
            # Copy file
            content = state_file.read_bytes()
            backup_file.write_bytes(content)
            
            logger.info(f"Created backup: {backup_file.name}")
            
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            
    async def _emergency_save(self, state: MemoryState):
        """Emergency save when normal save fails"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            emergency_file = self.recovery_dir / f"emergency_{timestamp}.json"
            
            # Save as JSON (simpler format)
            emergency_data = {
                "timestamp": state.timestamp,
                "emotional_baseline": state.emotional_baseline,
                "relationship_phase": state.relationship_phase,
                "metadata": state.metadata
            }
            
            async with aiofiles.open(emergency_file, 'w') as f:
                await f.write(json.dumps(emergency_data, indent=2))
                
            logger.warning(f"Emergency save completed: {emergency_file.name}")
            
        except Exception as e:
            logger.critical(f"Emergency save failed: {e}")
            
    async def _recover_from_backup(self) -> Optional[MemoryState]:
        """Try to recover from backup files"""
        try:
            # Check recovery directory first
            recovery_files = sorted(self.recovery_dir.glob("emergency_*.json"), reverse=True)
            if recovery_files:
                latest_recovery = recovery_files[0]
                logger.info(f"Recovering from emergency save: {latest_recovery.name}")
                
                async with aiofiles.open(latest_recovery, 'r') as f:
                    content = await f.read()
                    data = json.loads(content)
                    
                return MemoryState(
                    timestamp=data["timestamp"],
                    emotional_baseline=data["emotional_baseline"],
                    relationship_phase=data["relationship_phase"],
                    metadata=data.get("metadata", {})
                )
                
            # Check backup directory
            backup_files = sorted(self.backups_dir.glob("backup_*.pkl"), reverse=True)
            if backup_files:
                latest_backup = backup_files[0]
                logger.info(f"Recovering from backup: {latest_backup.name}")
                return await self.load_state_from_file(latest_backup)
                
            return None
            
        except Exception as e:
            logger.error(f"Recovery failed: {e}")
            return None
            
    def get_state_summary(self) -> Dict[str, Any]:
        """Get a summary of the current state"""
        if not self.current_state:
            return {"status": "no_state"}
            
        return {
            "timestamp": self.current_state.timestamp,
            "relationship_phase": self.current_state.relationship_phase,
            "emotional_baseline": self.current_state.emotional_baseline,
            "has_quantum_state": self.current_state.quantum_state is not None,
            "has_memory_graph": self.current_state.memory_graph is not None,
            "health_metrics": self.current_state.health_metrics,
            "state_history_count": len(self.state_history)
        }