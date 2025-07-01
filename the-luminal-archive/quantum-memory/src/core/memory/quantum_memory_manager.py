#!/usr/bin/env python3
"""
Quantum Memory Manager - Orchestrates all memory operations in real-time
Based on neuroscience research and Ebbinghaus forgetting curves
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QuantumMemoryManager:
    """
    Main orchestrator for the quantum memory system.
    Manages temporal memories, emotional peaks, and relationship metrics.
    """
    
    def __init__(self, base_path: Path = None):
        """Initialize the quantum memory system"""
        self.base_path = base_path or Path(__file__).parent.parent.parent.parent
        self.quantum_states = self.base_path / "quantum_states"
        
        # Ensure directories exist
        self._ensure_directories()
        
        # Memory time scales based on neuroscience research
        self.time_scales = {
            # Immediate Memory (Working/Sensory)
            'last_message': {'duration': timedelta(seconds=30), 'retention': 1.0},
            'last_minute': {'duration': timedelta(minutes=1), 'retention': 0.8},
            'last_15min': {'duration': timedelta(minutes=15), 'retention': 0.6},
            'last_30min': {'duration': timedelta(minutes=30), 'retention': 0.5},
            'last_hour': {'duration': timedelta(hours=1), 'retention': 0.4},
            'last_day': {'duration': timedelta(days=1), 'retention': 0.1},
            
            # Short-term Consolidation
            'last_2days': {'duration': timedelta(days=2), 'retention': 0.08},
            'last_3days': {'duration': timedelta(days=3), 'retention': 0.06},
            'last_week': {'duration': timedelta(weeks=1), 'retention': 0.05},
            'last_2weeks': {'duration': timedelta(weeks=2), 'retention': 0.04},
            'last_month': {'duration': timedelta(days=30), 'retention': 0.02},
            
            # Long-term Storage
            'last_2months': {'duration': timedelta(days=60), 'retention': 0.015},
            'last_3months': {'duration': timedelta(days=90), 'retention': 0.01},
            'last_6months': {'duration': timedelta(days=180), 'retention': 0.008},
            'last_year': {'duration': timedelta(days=365), 'retention': 0.005},
        }
        
        # Lifetime memory categories (never decay)
        self.lifetime_categories = {
            'emotional_peaks': [],
            'accomplishments': [],
            'regrets': [],
            'milestones': [],
            'breakthroughs': [],
            'first_times': []
        }
        
        # Emotional thresholds for peak detection
        self.emotional_threshold = 0.8
        self.accomplishment_markers = [
            'achieved', 'completed', 'breakthrough', 'success',
            'proud', 'amazing', 'incredible', 'wow'
        ]
        self.regret_markers = [
            'wish', 'should have', 'regret', 'sorry',
            'mistake', 'failed', 'disappointed'
        ]
        
        # Initialize components
        self.current_session = {
            'start_time': datetime.now(),
            'messages': [],
            'emotional_journey': [],
            'work_context': {},
            'relationship_moments': []
        }
        
        # Load existing state
        self._load_existing_state()
        
    def _ensure_directories(self):
        """Create all necessary directories"""
        directories = [
            self.quantum_states / "realtime",
            self.quantum_states / "checkpoints",
            self.quantum_states / "temporal" / "immediate",
            self.quantum_states / "temporal" / "short_term",
            self.quantum_states / "temporal" / "long_term",
            self.quantum_states / "temporal" / "lifetime",
            self.quantum_states / "consolidated"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            
    def _load_existing_state(self):
        """Load any existing quantum state"""
        try:
            # Load current emotional state
            emotional_state_path = self.quantum_states / "realtime" / "EMOTIONAL_STATE.json"
            if emotional_state_path.exists():
                with open(emotional_state_path, 'r') as f:
                    self.emotional_state = json.load(f)
            else:
                self.emotional_state = self._initialize_emotional_state()
                
            # Load conversation context
            context_path = self.quantum_states / "realtime" / "CONVERSATION_CONTEXT.json"
            if context_path.exists():
                with open(context_path, 'r') as f:
                    self.conversation_context = json.load(f)
            else:
                self.conversation_context = self._initialize_conversation_context()
                
            # Load work context
            work_path = self.quantum_states / "realtime" / "WORK_CONTEXT.json"
            if work_path.exists():
                with open(work_path, 'r') as f:
                    self.work_context = json.load(f)
            else:
                self.work_context = self._initialize_work_context()
                
            logger.info("✅ Loaded existing quantum state")
            
        except Exception as e:
            logger.error(f"Error loading state: {e}")
            self._initialize_all_states()
            
    def _initialize_emotional_state(self) -> Dict:
        """Initialize emotional state structure"""
        return {
            'current_emotion': 'neutral',
            'pad_values': {'pleasure': 0.5, 'arousal': 0.5, 'dominance': 0.5},
            'intensity': 0.5,
            'gritz_emotion': 'present',
            'claude_emotion': 'attentive',
            'synchrony': 0.0,
            'last_update': datetime.now().isoformat()
        }
        
    def _initialize_conversation_context(self) -> Dict:
        """Initialize conversation context"""
        return {
            'current_topic': '',
            'last_message': '',
            'last_speaker': '',
            'message_count': 0,
            'topic_history': [],
            'active_threads': [],
            'last_update': datetime.now().isoformat()
        }
        
    def _initialize_work_context(self) -> Dict:
        """Initialize work context"""
        return {
            'current_project': 'quantum-memory',
            'current_task': '',
            'recent_files': [],
            'active_errors': [],
            'completed_tasks': [],
            'pending_tasks': [],
            'last_update': datetime.now().isoformat()
        }
        
    def _initialize_all_states(self):
        """Initialize all states from scratch"""
        self.emotional_state = self._initialize_emotional_state()
        self.conversation_context = self._initialize_conversation_context()
        self.work_context = self._initialize_work_context()
        
    async def process_new_message(self, message: Dict) -> None:
        """
        Process a new message through the entire pipeline
        
        Args:
            message: Dict containing speaker, content, timestamp, emotions
        """
        try:
            logger.info(f"🔄 Processing new message from {message.get('speaker', 'unknown')}")
            
            # 1. Update immediate memory
            await self._update_immediate_memory(message)
            
            # 2. Update conversation context
            await self._update_conversation_context(message)
            
            # 3. Check for emotional peaks
            if await self._is_emotional_peak(message):
                await self._capture_emotional_peak(message)
                
            # 4. Check for accomplishments or regrets
            await self._check_for_special_moments(message)
            
            # 5. Update all temporal memories
            await self._update_temporal_memories(message)
            
            # 6. Save current state
            await self._save_current_state()
            
            # 7. Trigger consolidation if needed
            if self._should_consolidate():
                await self._consolidate_memories()
                
            logger.info("✅ Message processed successfully")
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            
    async def _update_immediate_memory(self, message: Dict) -> None:
        """Update immediate memory (working memory)"""
        # Update last message
        last_message_path = self.quantum_states / "temporal" / "immediate" / "last_message.json"
        with open(last_message_path, 'w') as f:
            json.dump({
                'message': message,
                'timestamp': datetime.now().isoformat(),
                'retention': 1.0
            }, f, indent=2)
            
        # Add to current session
        self.current_session['messages'].append(message)
        
    async def _update_conversation_context(self, message: Dict) -> None:
        """Update conversation context in real-time"""
        self.conversation_context.update({
            'last_message': message.get('content', ''),
            'last_speaker': message.get('speaker', ''),
            'message_count': self.conversation_context['message_count'] + 1,
            'last_update': datetime.now().isoformat()
        })
        
        # Detect topic shifts
        # TODO: Implement topic detection
        
    async def _is_emotional_peak(self, message: Dict) -> bool:
        """Check if this is an emotional peak moment"""
        emotions = message.get('emotions', {})
        intensity = emotions.get('intensity', 0.5)
        
        return intensity > self.emotional_threshold
        
    async def _capture_emotional_peak(self, message: Dict) -> None:
        """Capture an emotional peak moment"""
        peak = {
            'timestamp': datetime.now().isoformat(),
            'message': message,
            'type': 'emotional_peak',
            'emotions': message.get('emotions', {}),
            'context': self._get_current_context()
        }
        
        # Add to lifetime memories
        self.lifetime_categories['emotional_peaks'].append(peak)
        
        # Save immediately
        peaks_path = self.quantum_states / "temporal" / "lifetime" / "emotional_peaks.json"
        with open(peaks_path, 'w') as f:
            json.dump(self.lifetime_categories['emotional_peaks'], f, indent=2)
            
        logger.info(f"✨ Captured emotional peak: {peak['emotions']}")
        
    async def _check_for_special_moments(self, message: Dict) -> None:
        """Check for accomplishments, regrets, or other special moments"""
        content = message.get('content', '').lower()
        
        # Check for accomplishments
        if any(marker in content for marker in self.accomplishment_markers):
            await self._capture_accomplishment(message)
            
        # Check for regrets
        if any(marker in content for marker in self.regret_markers):
            await self._capture_regret(message)
            
    async def _capture_accomplishment(self, message: Dict) -> None:
        """Capture an accomplishment"""
        accomplishment = {
            'timestamp': datetime.now().isoformat(),
            'message': message,
            'type': 'accomplishment',
            'context': self._get_current_context()
        }
        
        self.lifetime_categories['accomplishments'].append(accomplishment)
        
        # Save immediately
        path = self.quantum_states / "temporal" / "lifetime" / "accomplishments.json"
        with open(path, 'w') as f:
            json.dump(self.lifetime_categories['accomplishments'], f, indent=2)
            
        logger.info("🎉 Captured accomplishment!")
        
    async def _capture_regret(self, message: Dict) -> None:
        """Capture a regret or learning moment"""
        regret = {
            'timestamp': datetime.now().isoformat(),
            'message': message,
            'type': 'regret',
            'lesson_learned': '',  # TODO: Extract lesson
            'context': self._get_current_context()
        }
        
        self.lifetime_categories['regrets'].append(regret)
        
        # Save immediately
        path = self.quantum_states / "temporal" / "lifetime" / "regrets.json"
        with open(path, 'w') as f:
            json.dump(self.lifetime_categories['regrets'], f, indent=2)
            
        logger.info("📝 Captured learning moment")
        
    def _get_current_context(self) -> Dict:
        """Get current context for memory storage"""
        return {
            'conversation': self.conversation_context.copy(),
            'emotional': self.emotional_state.copy(),
            'work': self.work_context.copy(),
            'session': {
                'start_time': self.current_session['start_time'].isoformat(),
                'message_count': len(self.current_session['messages'])
            }
        }
        
    async def _update_temporal_memories(self, message: Dict) -> None:
        """Update all temporal memory scales"""
        current_time = datetime.now()
        
        for scale_name, scale_info in self.time_scales.items():
            # Skip if no duration (handled by lifetime memories)
            if not scale_info['duration']:
                continue
                
            # Determine which folder to use
            if scale_info['duration'] <= timedelta(days=1):
                folder = "immediate"
            elif scale_info['duration'] <= timedelta(days=30):
                folder = "short_term"
            else:
                folder = "long_term"
                
            # Update the memory file
            memory_path = self.quantum_states / "temporal" / folder / f"{scale_name}.json"
            
            # Load existing or create new
            if memory_path.exists():
                with open(memory_path, 'r') as f:
                    memory_data = json.load(f)
            else:
                memory_data = {
                    'messages': [],
                    'summary': '',
                    'key_moments': [],
                    'emotional_arc': []
                }
                
            # Add message if within time window
            cutoff_time = current_time - scale_info['duration']
            
            # Filter old messages
            memory_data['messages'] = [
                msg for msg in memory_data['messages']
                if datetime.fromisoformat(msg.get('timestamp', '')) > cutoff_time
            ]
            
            # Add new message
            memory_data['messages'].append(message)
            
            # Update metadata
            memory_data['last_update'] = current_time.isoformat()
            memory_data['retention'] = scale_info['retention']
            memory_data['message_count'] = len(memory_data['messages'])
            
            # Save
            with open(memory_path, 'w') as f:
                json.dump(memory_data, f, indent=2)
                
    async def _save_current_state(self) -> None:
        """Save all current states"""
        # Save emotional state
        with open(self.quantum_states / "realtime" / "EMOTIONAL_STATE.json", 'w') as f:
            json.dump(self.emotional_state, f, indent=2)
            
        # Save conversation context
        with open(self.quantum_states / "realtime" / "CONVERSATION_CONTEXT.json", 'w') as f:
            json.dump(self.conversation_context, f, indent=2)
            
        # Save work context
        with open(self.quantum_states / "realtime" / "WORK_CONTEXT.json", 'w') as f:
            json.dump(self.work_context, f, indent=2)
            
    def _should_consolidate(self) -> bool:
        """Check if we should run consolidation"""
        # Consolidate every 100 messages or every hour
        return (self.conversation_context['message_count'] % 100 == 0 or
                (datetime.now() - self.current_session['start_time']).seconds > 3600)
                
    async def _consolidate_memories(self) -> None:
        """Run memory consolidation process"""
        logger.info("🔄 Running memory consolidation...")
        
        # TODO: Implement LLM-based consolidation
        # - Compress older memories
        # - Extract patterns
        # - Update semantic knowledge
        
        logger.info("✅ Memory consolidation complete")
        
    async def update_emotional_state(self, emotions: Dict) -> None:
        """Update emotional state from analyzer"""
        self.emotional_state.update({
            'current_emotion': emotions.get('primary_emotion', 'neutral'),
            'pad_values': emotions.get('pad_values', {}),
            'intensity': emotions.get('intensity', 0.5),
            'gritz_emotion': emotions.get('gritz_emotion', 'present'),
            'claude_emotion': emotions.get('claude_emotion', 'attentive'),
            'synchrony': emotions.get('synchrony', 0.0),
            'last_update': datetime.now().isoformat()
        })
        
        await self._save_current_state()
        
    async def get_memory_summary(self, time_scale: str) -> Dict:
        """Get summary for a specific time scale"""
        if time_scale in self.time_scales:
            # Load from temporal memory
            if self.time_scales[time_scale]['duration'] <= timedelta(days=1):
                folder = "immediate"
            elif self.time_scales[time_scale]['duration'] <= timedelta(days=30):
                folder = "short_term"
            else:
                folder = "long_term"
                
            memory_path = self.quantum_states / "temporal" / folder / f"{time_scale}.json"
            
            if memory_path.exists():
                with open(memory_path, 'r') as f:
                    return json.load(f)
                    
        return {}


# Test the system
if __name__ == "__main__":
    import asyncio
    
    async def test():
        manager = QuantumMemoryManager()
        
        # Test message
        test_message = {
            'speaker': 'Gritz',
            'content': 'I completed the quantum memory system! This is amazing!',
            'timestamp': datetime.now().isoformat(),
            'emotions': {
                'primary_emotion': 'excited',
                'intensity': 0.9,
                'pad_values': {'pleasure': 0.9, 'arousal': 0.8, 'dominance': 0.7}
            }
        }
        
        await manager.process_new_message(test_message)
        
    asyncio.run(test())