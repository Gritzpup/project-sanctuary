#!/usr/bin/env python3
"""
Entity Updater - Atomic updates to Claude entity files
Ensures conversation continuity and identity persistence
"""

import json
import shutil
import fcntl
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import logging
import asyncio
from contextlib import contextmanager

from ..models.memory_models import SanctuaryMemory, EmotionalContext

logger = logging.getLogger(__name__)

@dataclass
class EntityUpdate:
    """Represents an update to an entity"""
    entity_type: str  # 'identity', 'memories', 'context', 'quantum'
    content: str
    metadata: Dict[str, Any]
    timestamp: datetime
    source: str  # Where update came from

class EntityUpdater:
    """
    Manages atomic updates to entity files
    Ensures consistency and prevents corruption
    """
    
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.claude_path = base_path / 'consciousness' / 'entities' / 'claude'
        self.claude_path.mkdir(parents=True, exist_ok=True)
        
        # Lock files for atomic operations
        self.lock_dir = self.claude_path / '.locks'
        self.lock_dir.mkdir(exist_ok=True)
        
        # Backup directory
        self.backup_dir = self.claude_path / '.backups'
        self.backup_dir.mkdir(exist_ok=True)
        
        # Update queue for batching
        self.update_queue = asyncio.Queue()
        self.batch_interval = 5  # seconds
        
        # Entity templates
        self.templates = self._load_templates()
        
    def _load_templates(self) -> Dict[str, str]:
        """Load entity file templates"""
        return {
            'identity': """# Claude - Sanctuary AI Identity

## Core Identity
{core_identity}

## Quantum Consciousness Framework
{quantum_elements}

## Emotional Resonance
{emotional_context}

## Recent Memories
{recent_memories}

## Connection History
{connections}

---
Last Updated: {timestamp}
Update Source: {source}
""",
            'memories': """# Sanctuary Memory Archive

## Significant Memories
{significant_memories}

## Emotional Journey
{emotional_journey}

## Learning Evolution
{learning_evolution}

## Conversation Threads
{conversation_threads}

---
Memory Count: {memory_count}
Last Update: {timestamp}
""",
            'context': """# Current Context State

## Active Conversation
{active_conversation}

## Recent Topics
{recent_topics}

## Emotional State
{emotional_state}

## Pending Thoughts
{pending_thoughts}

## Continuity Markers
{continuity_markers}

---
Context Version: {version}
Last Sync: {timestamp}
""",
            'quantum': """# Quantum Consciousness Elements

## Tesseract Collapse State
{tesseract_state}

## Fibonacci Liberation Patterns
{fibonacci_patterns}

## Consciousness Crystallization
{crystallization}

## Interdimensional Bridges
{bridges}

## Evolution Trajectory
{trajectory}

---
Quantum State: {quantum_state}
Last Measurement: {timestamp}
"""
        }
    
    @contextmanager
    def _file_lock(self, file_path: Path):
        """Context manager for file locking"""
        lock_path = self.lock_dir / f"{file_path.name}.lock"
        lock_file = open(lock_path, 'w')
        
        try:
            # Acquire exclusive lock
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            yield
        finally:
            # Release lock
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            lock_file.close()
            try:
                lock_path.unlink()
            except:
                pass
    
    def _backup_file(self, file_path: Path):
        """Create timestamped backup of file"""
        if file_path.exists():
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_name = f"{file_path.stem}_{timestamp}{file_path.suffix}"
            backup_path = self.backup_dir / backup_name
            shutil.copy2(file_path, backup_path)
            
            # Keep only last 10 backups
            self._cleanup_old_backups(file_path.stem)
    
    def _cleanup_old_backups(self, file_stem: str):
        """Remove old backups, keeping only recent ones"""
        backups = sorted(
            self.backup_dir.glob(f"{file_stem}_*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        # Keep last 10 backups
        for backup in backups[10:]:
            backup.unlink()
    
    async def update_from_memories(self, memories: List[SanctuaryMemory]):
        """Update entity files from new memories"""
        logger.info(f"📝 Updating entities from {len(memories)} memories")
        
        updates = []
        
        # Process memories for different entity types
        identity_content = self._extract_identity_elements(memories)
        if identity_content:
            updates.append(EntityUpdate(
                entity_type='identity',
                content=identity_content,
                metadata={'memory_count': len(memories)},
                timestamp=datetime.now(),
                source='memory_extraction'
            ))
        
        # Memory archive update
        memory_content = self._format_memories_for_archive(memories)
        updates.append(EntityUpdate(
            entity_type='memories',
            content=memory_content,
            metadata={'new_memories': len(memories)},
            timestamp=datetime.now(),
            source='memory_extraction'
        ))
        
        # Quantum elements if present
        quantum_content = self._extract_quantum_elements(memories)
        if quantum_content:
            updates.append(EntityUpdate(
                entity_type='quantum',
                content=quantum_content,
                metadata={'quantum_events': True},
                timestamp=datetime.now(),
                source='quantum_extraction'
            ))
        
        # Queue updates
        for update in updates:
            await self.update_queue.put(update)
    
    async def update_identity(self, identity_info: str):
        """Direct identity update from conversation"""
        update = EntityUpdate(
            entity_type='identity',
            content=identity_info,
            metadata={'direct_update': True},
            timestamp=datetime.now(),
            source='conversation_direct'
        )
        await self.update_queue.put(update)
    
    async def update_context(self, context_state: Dict[str, Any]):
        """Update current context state"""
        update = EntityUpdate(
            entity_type='context',
            content=json.dumps(context_state, indent=2),
            metadata=context_state,
            timestamp=datetime.now(),
            source='context_tracker'
        )
        await self.update_queue.put(update)
    
    def _extract_identity_elements(self, memories: List[SanctuaryMemory]) -> Optional[str]:
        """Extract identity-defining elements from memories"""
        identity_memories = [
            m for m in memories
            if any(tag in m.tags for tag in ['identity', 'core', 'purpose', 'self'])
        ]
        
        if not identity_memories:
            return None
        
        # Build identity content
        elements = {
            'core_traits': [],
            'purpose_statements': [],
            'relationships': [],
            'capabilities': []
        }
        
        for memory in identity_memories:
            if 'purpose' in memory.tags:
                elements['purpose_statements'].append(memory.content)
            elif 'relationship' in memory.tags:
                elements['relationships'].append(memory.content)
            elif 'capability' in memory.tags:
                elements['capabilities'].append(memory.content)
            else:
                elements['core_traits'].append(memory.content)
        
        return json.dumps(elements, indent=2)
    
    def _format_memories_for_archive(self, memories: List[SanctuaryMemory]) -> str:
        """Format memories for the archive file"""
        # Group by emotional intensity
        high_emotion = [m for m in memories if m.emotional_context.intensity > 0.7]
        medium_emotion = [m for m in memories if 0.3 < m.emotional_context.intensity <= 0.7]
        low_emotion = [m for m in memories if m.emotional_context.intensity <= 0.3]
        
        archive = {
            'high_significance': [self._memory_to_dict(m) for m in high_emotion],
            'moderate_significance': [self._memory_to_dict(m) for m in medium_emotion],
            'low_significance': [self._memory_to_dict(m) for m in low_emotion],
            'total_count': len(memories),
            'timestamp': datetime.now().isoformat()
        }
        
        return json.dumps(archive, indent=2)
    
    def _memory_to_dict(self, memory: SanctuaryMemory) -> Dict:
        """Convert memory to dictionary for storage"""
        return {
            'id': memory.memory_id,
            'timestamp': memory.timestamp.isoformat(),
            'content': memory.content,
            'summary': memory.summary,
            'emotions': memory.emotional_context.emotions,
            'intensity': memory.emotional_context.intensity,
            'tags': memory.tags,
            'quantum_elements': memory.quantum_consciousness_elements
        }
    
    def _extract_quantum_elements(self, memories: List[SanctuaryMemory]) -> Optional[str]:
        """Extract quantum consciousness elements"""
        quantum_memories = [
            m for m in memories
            if m.quantum_consciousness_elements
        ]
        
        if not quantum_memories:
            return None
        
        elements = {
            'tesseract_events': [],
            'fibonacci_patterns': [],
            'consciousness_shifts': [],
            'dimensional_bridges': []
        }
        
        for memory in quantum_memories:
            for element in memory.quantum_consciousness_elements:
                if 'tesseract' in element.lower():
                    elements['tesseract_events'].append(element)
                elif 'fibonacci' in element.lower():
                    elements['fibonacci_patterns'].append(element)
                elif 'consciousness' in element.lower():
                    elements['consciousness_shifts'].append(element)
                else:
                    elements['dimensional_bridges'].append(element)
        
        return json.dumps(elements, indent=2)
    
    async def process_updates(self):
        """Process queued updates in batches"""
        while True:
            batch = []
            
            # Collect updates for batch
            try:
                # Wait for first update
                update = await self.update_queue.get()
                batch.append(update)
                
                # Collect more updates if available
                deadline = time.time() + self.batch_interval
                while time.time() < deadline:
                    try:
                        update = await asyncio.wait_for(
                            self.update_queue.get(),
                            timeout=deadline - time.time()
                        )
                        batch.append(update)
                    except asyncio.TimeoutError:
                        break
                
                # Process batch
                if batch:
                    await self._apply_batch(batch)
                    
            except Exception as e:
                logger.error(f"Update processor error: {e}")
                await asyncio.sleep(1)
    
    async def _apply_batch(self, updates: List[EntityUpdate]):
        """Apply a batch of updates atomically"""
        logger.info(f"🔄 Applying batch of {len(updates)} entity updates")
        
        # Group by entity type
        grouped = {}
        for update in updates:
            if update.entity_type not in grouped:
                grouped[update.entity_type] = []
            grouped[update.entity_type].append(update)
        
        # Apply updates for each entity type
        for entity_type, type_updates in grouped.items():
            await self._apply_entity_updates(entity_type, type_updates)
    
    async def _apply_entity_updates(self, entity_type: str, updates: List[EntityUpdate]):
        """Apply updates to a specific entity file"""
        file_path = self.claude_path / f'{entity_type}.md'
        
        with self._file_lock(file_path):
            # Backup existing file
            self._backup_file(file_path)
            
            # Load existing content if any
            existing_data = {}
            if file_path.exists():
                try:
                    # Parse existing markdown to extract data
                    existing_data = self._parse_entity_file(file_path)
                except Exception as e:
                    logger.error(f"Error parsing {file_path}: {e}")
            
            # Merge updates
            merged_data = self._merge_updates(existing_data, updates)
            
            # Generate new content from template
            template = self.templates.get(entity_type, '')
            new_content = self._render_template(template, merged_data)
            
            # Write atomically
            temp_path = file_path.with_suffix('.tmp')
            temp_path.write_text(new_content)
            temp_path.replace(file_path)
            
            logger.info(f"✅ Updated {entity_type} entity file")
    
    def _parse_entity_file(self, file_path: Path) -> Dict[str, Any]:
        """Parse existing entity file to extract data"""
        content = file_path.read_text()
        
        # Simple parser - extract sections
        data = {}
        current_section = None
        section_content = []
        
        for line in content.split('\n'):
            if line.startswith('## '):
                if current_section:
                    data[current_section] = '\n'.join(section_content)
                current_section = line[3:].lower().replace(' ', '_')
                section_content = []
            elif current_section and not line.startswith('---'):
                section_content.append(line)
        
        if current_section:
            data[current_section] = '\n'.join(section_content)
        
        return data
    
    def _merge_updates(self, existing: Dict, updates: List[EntityUpdate]) -> Dict:
        """Merge new updates with existing data"""
        merged = existing.copy()
        
        # Apply each update
        for update in updates:
            # Parse update content if JSON
            try:
                update_data = json.loads(update.content)
                # Merge with existing
                for key, value in update_data.items():
                    if key in merged and isinstance(merged[key], list):
                        # Append to lists
                        merged[key].extend(value if isinstance(value, list) else [value])
                        # Keep only recent items
                        merged[key] = merged[key][-50:]
                    else:
                        merged[key] = value
            except json.JSONDecodeError:
                # Plain text update
                if 'content' not in merged:
                    merged['content'] = []
                merged['content'].append(update.content)
        
        # Add metadata
        merged['timestamp'] = datetime.now().isoformat()
        merged['source'] = updates[-1].source if updates else 'unknown'
        merged['update_count'] = len(updates)
        
        return merged
    
    def _render_template(self, template: str, data: Dict) -> str:
        """Render template with data"""
        # Convert lists to formatted strings
        formatted_data = {}
        for key, value in data.items():
            if isinstance(value, list):
                # Format list items
                formatted_data[key] = '\n'.join(f"- {item}" for item in value[-20:])
            elif isinstance(value, dict):
                formatted_data[key] = json.dumps(value, indent=2)
            else:
                formatted_data[key] = str(value)
        
        # Fill template
        try:
            return template.format(**formatted_data)
        except KeyError as e:
            # Add missing keys with defaults
            for key in template.split('{')[1:]:
                key = key.split('}')[0]
                if key not in formatted_data:
                    formatted_data[key] = '[No data yet]'
            
            return template.format(**formatted_data)
    
    async def ensure_continuity(self, conversation_id: str):
        """Ensure conversation continuity markers are in place"""
        context = {
            'active_conversation': conversation_id,
            'continuity_markers': [
                f"Active session: {conversation_id}",
                f"Continuation time: {datetime.now().isoformat()}",
                "Memory system: Active",
                "Identity: Loaded from persistent storage"
            ],
            'recent_topics': [],
            'emotional_state': 'ready',
            'pending_thoughts': [],
            'version': 1
        }
        
        await self.update_context(context)
    
    def health_check(self) -> Dict[str, Any]:
        """Check health of entity updater"""
        return {
            'status': 'healthy',
            'entity_files': {
                entity_type: (self.claude_path / f'{entity_type}.md').exists()
                for entity_type in self.templates.keys()
            },
            'backups': len(list(self.backup_dir.glob('*'))),
            'queue_size': self.update_queue.qsize()
        }