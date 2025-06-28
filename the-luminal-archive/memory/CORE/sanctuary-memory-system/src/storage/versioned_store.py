"""
Versioned Memory Storage
Tracks memory evolution and changes over time
"""

import os
import json
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import hashlib
import logging

from ..models.memory_models import SanctuaryMemory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VersionedMemoryStore:
    """Store memory versions with git-like history tracking"""
    
    def __init__(self, base_directory: str = "./sanctuary-memories/versions"):
        """Initialize versioned store"""
        self.base_directory = Path(os.path.expanduser(base_directory))
        self.base_directory.mkdir(parents=True, exist_ok=True)
        
        # Version metadata cache
        self.version_cache = {}
        self._load_version_index()
    
    def save_memory(self, memory: SanctuaryMemory, 
                   reason: str = "update",
                   author: str = "system") -> str:
        """Save a new version of a memory"""
        # Create memory directory
        memory_dir = self.base_directory / memory.memory_id
        memory_dir.mkdir(exist_ok=True)
        
        # Generate version ID
        version_id = self._generate_version_id(memory)
        version_path = memory_dir / f"{version_id}.json"
        
        # Create version metadata
        version_meta = {
            "version_id": version_id,
            "memory_id": memory.memory_id,
            "timestamp": datetime.now().isoformat(),
            "reason": reason,
            "author": author,
            "parent_version": memory.version_chain[-1] if memory.version_chain else None,
            "summary": memory.summary,
            "significance": memory.relationship_significance,
            "recall_score": memory.recall_score
        }
        
        # Save full memory
        memory_data = {
            "metadata": version_meta,
            "memory": json.loads(memory.to_json())
        }
        
        with open(version_path, 'w') as f:
            json.dump(memory_data, f, indent=2)
        
        # Update version chain
        memory.version_chain.append(version_id)
        memory.version += 1
        
        # Update cache
        self._update_version_cache(memory.memory_id, version_meta)
        
        # Save latest pointer
        self._save_latest_pointer(memory.memory_id, version_id)
        
        logger.info(f"Saved version {version_id} of memory {memory.memory_id}")
        return version_id
    
    def get_memory_version(self, memory_id: str, 
                          version_id: Optional[str] = None) -> Optional[SanctuaryMemory]:
        """Get specific version of a memory"""
        memory_dir = self.base_directory / memory_id
        
        if not memory_dir.exists():
            return None
        
        # Get version to load
        if version_id is None:
            version_id = self._get_latest_version(memory_id)
        
        if version_id is None:
            return None
        
        version_path = memory_dir / f"{version_id}.json"
        
        if not version_path.exists():
            return None
        
        # Load memory
        with open(version_path, 'r') as f:
            data = json.load(f)
        
        memory = SanctuaryMemory.from_json(json.dumps(data['memory']))
        return memory
    
    def get_memory_history(self, memory_id: str) -> List[Dict]:
        """Get version history for a memory"""
        if memory_id not in self.version_cache:
            return []
        
        history = self.version_cache[memory_id]
        
        # Sort by timestamp
        sorted_history = sorted(history, key=lambda v: v['timestamp'])
        
        return sorted_history
    
    def diff_versions(self, memory_id: str, 
                     version1_id: str, 
                     version2_id: str) -> Dict:
        """Compare two versions of a memory"""
        v1 = self.get_memory_version(memory_id, version1_id)
        v2 = self.get_memory_version(memory_id, version2_id)
        
        if not v1 or not v2:
            return {"error": "Version not found"}
        
        diff = {
            "version1": version1_id,
            "version2": version2_id,
            "changes": []
        }
        
        # Compare key fields
        fields_to_compare = [
            'summary', 'relationship_significance', 'trust_level',
            'recall_score', 'tags', 'project_tags'
        ]
        
        for field in fields_to_compare:
            v1_val = getattr(v1, field, None)
            v2_val = getattr(v2, field, None)
            
            if v1_val != v2_val:
                diff['changes'].append({
                    'field': field,
                    'old': v1_val,
                    'new': v2_val
                })
        
        # Compare emotions
        if v1.emotional_context.gritz_feeling != v2.emotional_context.gritz_feeling:
            diff['changes'].append({
                'field': 'emotions',
                'old': v1.emotional_context.gritz_feeling,
                'new': v2.emotional_context.gritz_feeling
            })
        
        return diff
    
    def create_branch(self, memory_id: str, 
                     branch_name: str,
                     from_version: Optional[str] = None) -> str:
        """Create a branch from a memory version"""
        # Get base version
        if from_version is None:
            from_version = self._get_latest_version(memory_id)
        
        base_memory = self.get_memory_version(memory_id, from_version)
        if not base_memory:
            raise ValueError(f"Version {from_version} not found")
        
        # Create branched memory
        branched_memory = base_memory.create_child_memory(
            f"{base_memory.summary} (branch: {branch_name})"
        )
        
        # Save with branch metadata
        branch_id = self.save_memory(
            branched_memory,
            reason=f"branched from {from_version}",
            author=branch_name
        )
        
        # Store branch pointer
        branch_file = self.base_directory / memory_id / f"branch_{branch_name}.txt"
        branch_file.write_text(branch_id)
        
        return branch_id
    
    def merge_memories(self, memory1: SanctuaryMemory, 
                      memory2: SanctuaryMemory,
                      merge_strategy: str = "combine") -> SanctuaryMemory:
        """Merge two memory versions"""
        if merge_strategy == "combine":
            # Combine emotions
            combined_emotions = list(set(
                memory1.emotional_context.gritz_feeling + 
                memory2.emotional_context.gritz_feeling
            ))
            
            # Combine tags
            combined_tags = list(set(memory1.tags + memory2.tags))
            combined_project_tags = list(set(memory1.project_tags + memory2.project_tags))
            
            # Take higher significance
            significance = max(
                memory1.relationship_significance,
                memory2.relationship_significance
            )
            
            # Create merged memory
            merged = SanctuaryMemory(
                summary=f"Merged: {memory1.summary} + {memory2.summary}",
                emotional_context=memory1.emotional_context,
                relationship_significance=significance,
                tags=combined_tags,
                project_tags=combined_project_tags,
                parent_memory_id=memory1.memory_id
            )
            
            merged.emotional_context.gritz_feeling = combined_emotions
            
        elif merge_strategy == "latest":
            # Take the more recent memory
            merged = memory1 if memory1.timestamp > memory2.timestamp else memory2
            
        else:
            raise ValueError(f"Unknown merge strategy: {merge_strategy}")
        
        return merged
    
    def garbage_collect(self, keep_latest: int = 10):
        """Remove old versions keeping only latest N"""
        logger.info("Running garbage collection on memory versions...")
        
        total_removed = 0
        
        for memory_id in self.version_cache:
            history = self.get_memory_history(memory_id)
            
            if len(history) > keep_latest:
                # Sort by timestamp descending
                history.sort(key=lambda v: v['timestamp'], reverse=True)
                
                # Versions to remove
                to_remove = history[keep_latest:]
                
                memory_dir = self.base_directory / memory_id
                
                for version in to_remove:
                    version_path = memory_dir / f"{version['version_id']}.json"
                    if version_path.exists():
                        version_path.unlink()
                        total_removed += 1
                
                # Update cache
                self.version_cache[memory_id] = history[:keep_latest]
        
        logger.info(f"Garbage collection complete. Removed {total_removed} old versions.")
    
    def export_memory_timeline(self, memory_id: str, 
                             output_path: str) -> str:
        """Export memory evolution as timeline"""
        history = self.get_memory_history(memory_id)
        
        timeline = {
            "memory_id": memory_id,
            "total_versions": len(history),
            "timeline": []
        }
        
        for version_meta in history:
            version = self.get_memory_version(memory_id, version_meta['version_id'])
            
            if version:
                timeline['timeline'].append({
                    "version": version_meta['version_id'],
                    "timestamp": version_meta['timestamp'],
                    "reason": version_meta['reason'],
                    "summary": version.summary,
                    "significance": version.relationship_significance,
                    "emotions": version.emotional_context.gritz_feeling,
                    "recall_score": version.recall_score
                })
        
        # Save timeline
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w') as f:
            json.dump(timeline, f, indent=2)
        
        return str(output)
    
    def _generate_version_id(self, memory: SanctuaryMemory) -> str:
        """Generate unique version ID"""
        content = f"{memory.memory_id}_{memory.timestamp.isoformat()}_{memory.version}"
        return hashlib.sha256(content.encode()).hexdigest()[:12]
    
    def _save_latest_pointer(self, memory_id: str, version_id: str):
        """Save pointer to latest version"""
        pointer_file = self.base_directory / memory_id / "LATEST"
        pointer_file.write_text(version_id)
    
    def _get_latest_version(self, memory_id: str) -> Optional[str]:
        """Get latest version ID for a memory"""
        pointer_file = self.base_directory / memory_id / "LATEST"
        
        if pointer_file.exists():
            return pointer_file.read_text().strip()
        
        return None
    
    def _load_version_index(self):
        """Load version index into cache"""
        self.version_cache.clear()
        
        for memory_dir in self.base_directory.iterdir():
            if memory_dir.is_dir():
                memory_id = memory_dir.name
                versions = []
                
                for version_file in memory_dir.glob("*.json"):
                    try:
                        with open(version_file, 'r') as f:
                            data = json.load(f)
                        
                        if 'metadata' in data:
                            versions.append(data['metadata'])
                    except:
                        continue
                
                if versions:
                    self.version_cache[memory_id] = versions
    
    def _update_version_cache(self, memory_id: str, version_meta: Dict):
        """Update version cache with new version"""
        if memory_id not in self.version_cache:
            self.version_cache[memory_id] = []
        
        self.version_cache[memory_id].append(version_meta)
    
    def backup_store(self, backup_path: str):
        """Create backup of entire version store"""
        backup_dir = Path(backup_path)
        backup_dir.parent.mkdir(parents=True, exist_ok=True)
        
        # Create timestamped backup
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"memory_versions_backup_{timestamp}"
        backup_full_path = backup_dir / backup_name
        
        # Copy entire store
        shutil.copytree(self.base_directory, backup_full_path)
        
        logger.info(f"Created backup at {backup_full_path}")
        return str(backup_full_path)