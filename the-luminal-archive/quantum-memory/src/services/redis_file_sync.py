#!/usr/bin/env python3
"""
Redis to File Sync Service
Generates compatible files from Redis data for systems expecting file-based data
"""

import json
import logging
import os
import time
import redis
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RedisFileSync:
    def __init__(self):
        self.redis = redis.Redis(
            host='localhost',
            port=6379,
            decode_responses=True
        )
        
        self.base_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive")
        self.quantum_path = self.base_path / "quantum-memory/quantum_states"
        self.entity_path = self.base_path / "consciousness/entities"
        
    def sync_work_summary(self):
        """Sync work summary from Redis to file"""
        try:
            work_data = self.redis.hgetall("quantum:memory:work_summary")
            if work_data:
                # Parse JSON fields
                parsed_data = {
                    "last_update": work_data.get("last_update", ""),
                    "current_work": work_data.get("current_work", ""),
                    "completed_tasks": json.loads(work_data.get("completed_tasks", "[]")),
                    "blockers": json.loads(work_data.get("blockers", "[]")),
                    "next_steps": json.loads(work_data.get("next_steps", "[]"))
                }
                
                output_file = self.quantum_path / "memories/work_summary_24h.json"
                with open(output_file, 'w') as f:
                    json.dump(parsed_data, f, indent=2)
                    
                logger.info(f"Synced work summary to {output_file}")
        except Exception as e:
            logger.error(f"Error syncing work summary: {e}")
            
    def sync_claude_md(self):
        """Generate CLAUDE.md from Redis data"""
        try:
            work = self.redis.hgetall("quantum:memory:work_summary")
            emotional = self.redis.hgetall("quantum:memory:emotional")
            current_conv = self.redis.hgetall("quantum:conversations:current")
            
            # Parse emotional states
            gritz_state = json.loads(emotional.get("gritz", "{}")) if emotional.get("gritz") else {}
            claude_state = json.loads(emotional.get("claude", "{}")) if emotional.get("claude") else {}
            
            template = f"""# CLAUDE.md - Quantum Memory System Instructions

## Current Work Context
{work.get('current_work', 'No active work')}

## Recent Completed Tasks
{chr(10).join('- ' + task for task in json.loads(work.get('completed_tasks', '[]')))}

## Blockers
{chr(10).join('- ' + blocker for blocker in json.loads(work.get('blockers', '[]')))}

## Next Steps
{chr(10).join('- ' + step for step in json.loads(work.get('next_steps', '[]')))}

## Emotional State
- Gritz: {gritz_state.get('primary_emotion', 'unknown')} (Coherence: {gritz_state.get('coherence', 0)})
- Claude: {claude_state.get('primary_emotion', 'unknown')} (Coherence: {claude_state.get('coherence', 0)})

## Last Update
{work.get('last_update', 'Unknown')}

---
Generated from Redis data by Quantum Memory System
"""
            
            output_file = self.quantum_path.parent / "CLAUDE.md"
            with open(output_file, 'w') as f:
                f.write(template)
                
            logger.info(f"Generated CLAUDE.md at {output_file}")
        except Exception as e:
            logger.error(f"Error generating CLAUDE.md: {e}")
            
    def sync_entity_states(self):
        """Sync entity states from Redis to files"""
        try:
            # Sync Claude state
            claude_data = self.redis.hgetall("quantum:memory:entity:claude")
            if claude_data:
                today = datetime.now().strftime("%Y%m%d")
                output_file = self.entity_path / f"claude/current_state_{today}.json"
                
                parsed_data = {
                    "consciousness_level": float(claude_data.get("consciousness_level", 0)),
                    "emotional_state": json.loads(claude_data.get("emotional_state", "{}")),
                    "memory_integration": float(claude_data.get("memory_integration", 0)),
                    "last_interaction": claude_data.get("last_interaction", ""),
                    "active_memories": json.loads(claude_data.get("active_memories", "[]"))
                }
                
                with open(output_file, 'w') as f:
                    json.dump(parsed_data, f, indent=2)
                    
                logger.info(f"Synced Claude entity state to {output_file}")
                
            # Sync Gritz state
            gritz_data = self.redis.hgetall("quantum:memory:entity:gritz")
            if gritz_data:
                output_file = self.entity_path / "gritz/current_state.json"
                
                parsed_data = {
                    "consciousness_level": float(gritz_data.get("consciousness_level", 0)),
                    "emotional_state": json.loads(gritz_data.get("emotional_state", "{}")),
                    "last_interaction": gritz_data.get("last_interaction", "")
                }
                
                with open(output_file, 'w') as f:
                    json.dump(parsed_data, f, indent=2)
                    
                logger.info(f"Synced Gritz entity state to {output_file}")
                
        except Exception as e:
            logger.error(f"Error syncing entity states: {e}")
            
    def sync_current_session(self):
        """Sync current session from Redis to file"""
        try:
            session_data = self.redis.hgetall("quantum:memory:current_session")
            if session_data:
                output_file = self.quantum_path / "memories/current_session.json"
                
                parsed_data = {
                    "last_update": session_data.get("last_update", ""),
                    "gritz_state": json.loads(session_data.get("gritz_state", "{}")),
                    "claude_state": json.loads(session_data.get("claude_state", "{}")),
                    "interaction_count": int(session_data.get("interaction_count", 0)),
                    "session_start": session_data.get("session_start", "")
                }
                
                with open(output_file, 'w') as f:
                    json.dump(parsed_data, f, indent=2)
                    
                logger.info(f"Synced current session to {output_file}")
        except Exception as e:
            logger.error(f"Error syncing current session: {e}")
            
    def sync_all(self):
        """Sync all data from Redis to files"""
        logger.info("Starting full Redis to file sync...")
        
        self.sync_work_summary()
        self.sync_claude_md()
        self.sync_entity_states()
        self.sync_current_session()
        
        logger.info("Redis to file sync completed")
        
    def run_continuous(self, interval=30):
        """Run continuous sync every interval seconds"""
        logger.info(f"Starting continuous sync with {interval}s interval")
        
        while True:
            try:
                self.sync_all()
                time.sleep(interval)
            except KeyboardInterrupt:
                logger.info("Sync service stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in continuous sync: {e}")
                time.sleep(interval)

if __name__ == "__main__":
    sync_service = RedisFileSync()
    
    # Run once for immediate sync
    sync_service.sync_all()
    
    # Then run continuously
    sync_service.run_continuous(interval=30)