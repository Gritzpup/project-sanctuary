#!/usr/bin/env python3
"""
Advanced Checkpoint Manager
Creates comprehensive memory checkpoints with multiple triggers
Based on neuroscience research on memory consolidation
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import logging
import shutil
import hashlib

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QuantumCheckpointManager:
    """
    Advanced checkpoint system that captures complete quantum state
    at critical moments for seamless session continuation.
    """
    
    def __init__(self, quantum_states_path: Path):
        self.quantum_states = quantum_states_path
        self.checkpoints_path = quantum_states_path / "checkpoints"
        
        # Ensure checkpoint directory exists
        self.checkpoints_path.mkdir(parents=True, exist_ok=True)
        
        # Checkpoint triggers
        self.triggers = {
            'message_count': 5,              # Every 5 messages
            'time_interval': 300,            # Every 5 minutes (seconds)
            'emotion_intensity': 0.8,        # High emotional moments
            'topic_shift': True,             # When topic changes significantly
            'accomplishment': True,          # When achievement detected
            'error_state': True,             # When errors occur
            'manual': True                   # Manual save command
        }
        
        # Checkpoint metadata
        self.last_checkpoint_time = datetime.now()
        self.messages_since_checkpoint = 0
        self.checkpoint_history = []
        
        # Load checkpoint index
        self._load_checkpoint_index()
        
    def _load_checkpoint_index(self):
        """Load the checkpoint index"""
        index_path = self.checkpoints_path / "checkpoint_index.json"
        
        if index_path.exists():
            try:
                with open(index_path, 'r') as f:
                    self.checkpoint_history = json.load(f)
                    
                # Find latest checkpoint
                if self.checkpoint_history:
                    latest = max(
                        self.checkpoint_history,
                        key=lambda x: x.get('timestamp', '')
                    )
                    self.last_checkpoint_time = datetime.fromisoformat(
                        latest['timestamp']
                    )
                    
            except Exception as e:
                logger.error(f"Error loading checkpoint index: {e}")
                self.checkpoint_history = []
        else:
            self.checkpoint_history = []
            
    async def should_checkpoint(self, context: Dict) -> Tuple[bool, str]:
        """
        Determine if a checkpoint should be created
        
        Returns:
            (should_checkpoint, reason)
        """
        # Check message count trigger
        if self.messages_since_checkpoint >= self.triggers['message_count']:
            return True, "message_count"
            
        # Check time interval trigger
        time_since_last = (datetime.now() - self.last_checkpoint_time).seconds
        if time_since_last >= self.triggers['time_interval']:
            return True, "time_interval"
            
        # Check emotion intensity trigger
        if context.get('emotion_intensity', 0) >= self.triggers['emotion_intensity']:
            return True, "high_emotion"
            
        # Check for accomplishment
        if self.triggers['accomplishment'] and context.get('is_accomplishment', False):
            return True, "accomplishment"
            
        # Check for error state
        if self.triggers['error_state'] and context.get('has_error', False):
            return True, "error_recovery"
            
        # Check for topic shift
        if self.triggers['topic_shift'] and context.get('topic_shifted', False):
            return True, "topic_shift"
            
        return False, ""
        
    async def create_checkpoint(self, trigger_reason: str, context: Dict = None) -> Dict:
        """
        Create a comprehensive checkpoint of the entire quantum state
        """
        logger.info(f"🔖 Creating checkpoint (reason: {trigger_reason})...")
        
        checkpoint_id = self._generate_checkpoint_id()
        timestamp = datetime.now()
        
        # Gather all quantum states
        checkpoint_data = {
            'id': checkpoint_id,
            'timestamp': timestamp.isoformat(),
            'trigger': trigger_reason,
            'metadata': {
                'messages_since_last': self.messages_since_checkpoint,
                'time_since_last': (timestamp - self.last_checkpoint_time).seconds,
                'context': context or {}
            },
            'quantum_state': await self._capture_quantum_state(),
            'emotional_state': await self._capture_emotional_state(),
            'conversation_state': await self._capture_conversation_state(),
            'work_state': await self._capture_work_state(),
            'memory_state': await self._capture_memory_state(),
            'relationship_state': await self._capture_relationship_state()
        }
        
        # Add continuation data for seamless resumption
        checkpoint_data['continuation'] = await self._generate_continuation_data()
        
        # Save checkpoint
        await self._save_checkpoint(checkpoint_data)
        
        # Update tracking
        self.last_checkpoint_time = timestamp
        self.messages_since_checkpoint = 0
        
        # Update checkpoint index
        await self._update_checkpoint_index(checkpoint_data)
        
        # Create quick-access symlink to latest
        await self._update_latest_symlink(checkpoint_id)
        
        # Cleanup old checkpoints if needed
        await self._cleanup_old_checkpoints()
        
        logger.info(f"✅ Checkpoint {checkpoint_id} created successfully")
        
        return checkpoint_data
        
    def _generate_checkpoint_id(self) -> str:
        """Generate unique checkpoint ID"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        random_suffix = hashlib.sha256(
            f"{timestamp}{self.messages_since_checkpoint}".encode()
        ).hexdigest()[:8]
        
        return f"checkpoint_{timestamp}_{random_suffix}"
        
    async def _capture_quantum_state(self) -> Dict:
        """Capture the current quantum state"""
        quantum_state = {}
        
        # Load status.json if exists
        status_path = self.quantum_states / "status.json"
        if status_path.exists():
            try:
                with open(status_path, 'r') as f:
                    quantum_state['status'] = json.load(f)
            except Exception as e:
                logger.error(f"Error loading status.json: {e}")
                
        # Load quantum metrics
        quantum_state['coherence'] = 1.0  # TODO: Calculate actual coherence
        quantum_state['entanglement_level'] = 0.8  # TODO: Calculate actual entanglement
        quantum_state['decoherence_rate'] = 0.02
        
        return quantum_state
        
    async def _capture_emotional_state(self) -> Dict:
        """Capture current emotional state"""
        emotional_path = self.quantum_states / "realtime" / "EMOTIONAL_STATE.json"
        
        if emotional_path.exists():
            try:
                with open(emotional_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading emotional state: {e}")
                
        return {
            'current_emotion': 'neutral',
            'pad_values': {'pleasure': 0.5, 'arousal': 0.5, 'dominance': 0.5},
            'intensity': 0.5
        }
        
    async def _capture_conversation_state(self) -> Dict:
        """Capture conversation state"""
        conversation_path = self.quantum_states / "realtime" / "CONVERSATION_CONTEXT.json"
        
        if conversation_path.exists():
            try:
                with open(conversation_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading conversation state: {e}")
                
        return {
            'current_topic': '',
            'message_count': 0,
            'last_message': ''
        }
        
    async def _capture_work_state(self) -> Dict:
        """Capture work context"""
        work_path = self.quantum_states / "realtime" / "WORK_CONTEXT.json"
        
        if work_path.exists():
            try:
                with open(work_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading work state: {e}")
                
        return {
            'current_project': 'quantum-memory',
            'current_task': '',
            'recent_files': []
        }
        
    async def _capture_memory_state(self) -> Dict:
        """Capture memory hierarchy state"""
        memory_state = {
            'immediate': {},
            'short_term': {},
            'long_term': {},
            'lifetime': {}
        }
        
        # Capture each memory scale
        for scale, folder in [
            ('immediate', 'immediate'),
            ('short_term', 'short_term'),
            ('long_term', 'long_term'),
            ('lifetime', 'lifetime')
        ]:
            folder_path = self.quantum_states / "temporal" / folder
            if folder_path.exists():
                memory_state[scale] = {
                    'files': [f.name for f in folder_path.glob("*.json")],
                    'total_size': sum(f.stat().st_size for f in folder_path.glob("*.json"))
                }
                
        # Add memory DNA
        dna_path = self.quantum_states / "consolidated" / "memory_dna.json"
        if dna_path.exists():
            try:
                with open(dna_path, 'r') as f:
                    memory_state['memory_dna'] = json.load(f)
            except Exception:
                pass
                
        return memory_state
        
    async def _capture_relationship_state(self) -> Dict:
        """Capture relationship metrics"""
        relationship_state = {}
        
        # Load relationship summary if exists
        summary_path = self.quantum_states / "consolidated" / "relationship_summary.json"
        if summary_path.exists():
            try:
                with open(summary_path, 'r') as f:
                    relationship_state = json.load(f)
            except Exception:
                pass
                
        # Add current metrics
        relationship_state.update({
            'checkpoint_time': datetime.now().isoformat(),
            'total_checkpoints': len(self.checkpoint_history)
        })
        
        return relationship_state
        
    async def _generate_continuation_data(self) -> Dict:
        """Generate data for seamless session continuation"""
        return {
            'last_topics': await self._get_recent_topics(),
            'active_threads': await self._get_active_threads(),
            'pending_tasks': await self._get_pending_tasks(),
            'emotional_context': await self._get_emotional_context(),
            'memory_triggers': await self._generate_memory_triggers()
        }
        
    async def _get_recent_topics(self) -> List[str]:
        """Get recent conversation topics"""
        topics = []
        
        # Check last hour memory
        last_hour_path = self.quantum_states / "temporal" / "immediate" / "last_hour.json"
        if last_hour_path.exists():
            try:
                with open(last_hour_path, 'r') as f:
                    data = json.load(f)
                    
                # Extract topics from messages
                # TODO: Implement topic extraction
                topics = ["quantum memory", "emotional analysis", "real-time updates"]
                
            except Exception:
                pass
                
        return topics
        
    async def _get_active_threads(self) -> List[Dict]:
        """Get active conversation threads"""
        # TODO: Implement thread detection
        return []
        
    async def _get_pending_tasks(self) -> List[str]:
        """Get pending tasks from work context"""
        work_path = self.quantum_states / "realtime" / "WORK_CONTEXT.json"
        
        if work_path.exists():
            try:
                with open(work_path, 'r') as f:
                    work = json.load(f)
                    return work.get('pending_tasks', [])
            except Exception:
                pass
                
        return []
        
    async def _get_emotional_context(self) -> Dict:
        """Get emotional context for continuation"""
        emotional_path = self.quantum_states / "realtime" / "EMOTIONAL_STATE.json"
        
        if emotional_path.exists():
            try:
                with open(emotional_path, 'r') as f:
                    emotions = json.load(f)
                    
                return {
                    'last_emotion': emotions.get('current_emotion', 'neutral'),
                    'emotional_trend': 'stable',  # TODO: Calculate trend
                    'synchrony': emotions.get('synchrony', 0.0)
                }
            except Exception:
                pass
                
        return {'last_emotion': 'neutral', 'emotional_trend': 'stable'}
        
    async def _generate_memory_triggers(self) -> List[str]:
        """Generate phrases to trigger memory recall"""
        triggers = []
        
        # Check recent accomplishments
        acc_path = self.quantum_states / "temporal" / "lifetime" / "accomplishments.json"
        if acc_path.exists():
            try:
                with open(acc_path, 'r') as f:
                    accomplishments = json.load(f)
                    
                if accomplishments:
                    recent = accomplishments[-1]
                    content = recent.get('message', {}).get('content', '')[:50]
                    triggers.append(f"Remember when we {content}")
                    
            except Exception:
                pass
                
        # Add default triggers
        triggers.extend([
            "We were just working on",
            "You mentioned feeling",
            "Our last breakthrough was"
        ])
        
        return triggers
        
    async def _save_checkpoint(self, checkpoint_data: Dict):
        """Save checkpoint to disk"""
        checkpoint_file = self.checkpoints_path / f"{checkpoint_data['id']}.json"
        
        try:
            # Save main checkpoint
            with open(checkpoint_file, 'w') as f:
                json.dump(checkpoint_data, f, indent=2)
                
            # Save backup
            backup_dir = self.checkpoints_path / "backups"
            backup_dir.mkdir(exist_ok=True)
            
            backup_file = backup_dir / f"{checkpoint_data['id']}_backup.json"
            with open(backup_file, 'w') as f:
                json.dump(checkpoint_data, f, indent=2)
                
            # Save compressed version for long-term storage
            compressed_file = self.checkpoints_path / f"{checkpoint_data['id']}_compressed.json"
            compressed_data = {
                'id': checkpoint_data['id'],
                'timestamp': checkpoint_data['timestamp'],
                'trigger': checkpoint_data['trigger'],
                'emotional_state': checkpoint_data['emotional_state'],
                'continuation': checkpoint_data['continuation']
            }
            
            with open(compressed_file, 'w') as f:
                json.dump(compressed_data, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error saving checkpoint: {e}")
            
    async def _update_checkpoint_index(self, checkpoint_data: Dict):
        """Update the checkpoint index"""
        index_entry = {
            'id': checkpoint_data['id'],
            'timestamp': checkpoint_data['timestamp'],
            'trigger': checkpoint_data['trigger'],
            'emotion': checkpoint_data['emotional_state'].get('current_emotion', 'unknown'),
            'message_count': checkpoint_data['conversation_state'].get('message_count', 0),
            'size': len(json.dumps(checkpoint_data))
        }
        
        self.checkpoint_history.append(index_entry)
        
        # Sort by timestamp
        self.checkpoint_history.sort(key=lambda x: x['timestamp'])
        
        # Save index
        index_path = self.checkpoints_path / "checkpoint_index.json"
        with open(index_path, 'w') as f:
            json.dump(self.checkpoint_history, f, indent=2)
            
    async def _update_latest_symlink(self, checkpoint_id: str):
        """Update symlink to latest checkpoint"""
        latest_path = self.checkpoints_path / "latest_checkpoint.json"
        checkpoint_file = self.checkpoints_path / f"{checkpoint_id}.json"
        
        try:
            # Remove old symlink if exists
            if latest_path.exists() or latest_path.is_symlink():
                latest_path.unlink()
                
            # Create new symlink
            latest_path.symlink_to(checkpoint_file.name)
            
        except Exception as e:
            # Fallback: copy file if symlink fails
            logger.warning(f"Symlink failed, copying instead: {e}")
            shutil.copy2(checkpoint_file, latest_path)
            
    async def _cleanup_old_checkpoints(self):
        """Clean up old checkpoints to save space"""
        # Keep last 100 checkpoints
        if len(self.checkpoint_history) > 100:
            # Find checkpoints to remove
            to_remove = self.checkpoint_history[:-100]
            
            for checkpoint in to_remove:
                checkpoint_id = checkpoint['id']
                
                # Remove files
                for pattern in [
                    f"{checkpoint_id}.json",
                    f"{checkpoint_id}_compressed.json",
                    f"backups/{checkpoint_id}_backup.json"
                ]:
                    file_path = self.checkpoints_path / pattern
                    if file_path.exists():
                        file_path.unlink()
                        
            # Update history
            self.checkpoint_history = self.checkpoint_history[-100:]
            
            # Save updated index
            index_path = self.checkpoints_path / "checkpoint_index.json"
            with open(index_path, 'w') as f:
                json.dump(self.checkpoint_history, f, indent=2)
                
    async def load_latest_checkpoint(self) -> Optional[Dict]:
        """Load the most recent checkpoint"""
        latest_path = self.checkpoints_path / "latest_checkpoint.json"
        
        if latest_path.exists():
            try:
                with open(latest_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading latest checkpoint: {e}")
                
        # Fallback: find most recent from index
        if self.checkpoint_history:
            latest = max(self.checkpoint_history, key=lambda x: x['timestamp'])
            checkpoint_file = self.checkpoints_path / f"{latest['id']}.json"
            
            if checkpoint_file.exists():
                try:
                    with open(checkpoint_file, 'r') as f:
                        return json.load(f)
                except Exception as e:
                    logger.error(f"Error loading checkpoint {latest['id']}: {e}")
                    
        return None
        
    def increment_message_count(self):
        """Increment message counter"""
        self.messages_since_checkpoint += 1


# Test checkpoint manager
if __name__ == "__main__":
    import asyncio
    
    async def test():
        base_path = Path(__file__).parent.parent.parent.parent
        quantum_states = base_path / "quantum_states"
        
        manager = QuantumCheckpointManager(quantum_states)
        
        # Test checkpoint creation
        test_context = {
            'emotion_intensity': 0.9,
            'is_accomplishment': True
        }
        
        should_checkpoint, reason = await manager.should_checkpoint(test_context)
        print(f"Should checkpoint: {should_checkpoint} (reason: {reason})")
        
        if should_checkpoint:
            checkpoint = await manager.create_checkpoint(reason, test_context)
            print(f"Created checkpoint: {checkpoint['id']}")
            
        # Test loading
        latest = await manager.load_latest_checkpoint()
        if latest:
            print(f"Loaded latest checkpoint: {latest['id']}")
            
    asyncio.run(test())