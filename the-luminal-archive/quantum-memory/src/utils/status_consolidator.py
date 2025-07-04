#!/usr/bin/env python3
"""
Status Consolidator - Safely reads all service status files and creates a merged view
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional
import logging
from datetime import datetime

# Add safe JSON handler
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))
from src.utils.safe_json_handler import safe_read_json, safe_write_json

logger = logging.getLogger(__name__)

class StatusConsolidator:
    """Consolidates status from multiple services into a single view"""
    
    def __init__(self):
        self.quantum_base = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory")
        self.service_status_dir = self.quantum_base / "quantum_states" / "service_status"
        self.consolidated_path = self.service_status_dir / "consolidated" / "status.json"
        
        # Ensure consolidated directory exists
        self.consolidated_path.parent.mkdir(parents=True, exist_ok=True)
        
    def consolidate_status(self) -> Dict[str, Any]:
        """Read all service status files and merge them"""
        consolidated = {
            "last_update": datetime.now().isoformat(),
            "services": {},
            "quantum_state": "unknown",
            "emotional_dynamics": {},
            "real_time_tracking": {},
            "quantum_metrics": {},
            "memory_timeline": {},
            "chat_stats": {},
            "relationship_metrics": {},
            "entity_sync": {}
        }
        
        # Read analyzer status
        analyzer_status_path = self.service_status_dir / "analyzer" / "status.json"
        if analyzer_status_path.exists():
            analyzer_data = safe_read_json(analyzer_status_path)
            if analyzer_data:
                consolidated["services"]["analyzer"] = {
                    "status": "running",
                    "last_update": analyzer_data.get("real_time_tracking", {}).get("last_analysis", "unknown")
                }
                
                # Merge important fields
                for key in ["quantum_state", "emotional_dynamics", "real_time_tracking", 
                           "quantum_metrics", "memory_timeline", "chat_stats", 
                           "relationship_metrics", "entity_sync"]:
                    if key in analyzer_data:
                        consolidated[key] = analyzer_data[key]
        
        # Read entity updater status (if it has one)
        entity_status_path = self.service_status_dir / "entity_updater" / "status.json"
        if entity_status_path.exists():
            entity_data = safe_read_json(entity_status_path)
            if entity_data:
                consolidated["services"]["entity_updater"] = {
                    "status": "running",
                    "last_update": entity_data.get("last_update", "unknown")
                }
        
        # Read websocket status (if it has one)
        websocket_status_path = self.service_status_dir / "websocket" / "status.json"
        if websocket_status_path.exists():
            websocket_data = safe_read_json(websocket_status_path)
            if websocket_data:
                consolidated["services"]["websocket"] = {
                    "status": "running",
                    "last_update": websocket_data.get("last_update", "unknown")
                }
        
        # Save consolidated status
        safe_write_json(self.consolidated_path, consolidated)
        
        return consolidated
    
    def get_consolidated_status(self) -> Optional[Dict[str, Any]]:
        """Get the most recent consolidated status"""
        if self.consolidated_path.exists():
            return safe_read_json(self.consolidated_path)
        else:
            # Generate new consolidation
            return self.consolidate_status()


# Convenience function
def get_quantum_status() -> Optional[Dict[str, Any]]:
    """Get consolidated quantum memory status"""
    consolidator = StatusConsolidator()
    return consolidator.get_consolidated_status()


if __name__ == "__main__":
    # Test the consolidator
    consolidator = StatusConsolidator()
    status = consolidator.consolidate_status()
    print(f"✅ Consolidated status from {len(status.get('services', {}))} services")
    print(json.dumps(status, indent=2))