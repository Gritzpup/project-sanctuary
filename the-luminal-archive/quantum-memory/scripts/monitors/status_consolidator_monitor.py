#!/usr/bin/env python3
"""
Status Consolidator Monitor - Runs periodically to merge service status files
"""

import time
import sys
from pathlib import Path

# Add path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))
from src.utils.status_consolidator import StatusConsolidator

def main():
    """Run status consolidator periodically"""
    consolidator = StatusConsolidator()
    print("✅ Starting Status Consolidator Monitor")
    print("   Consolidating status every 5 seconds...")
    
    while True:
        try:
            # Consolidate status
            status = consolidator.consolidate_status()
            num_services = len(status.get('services', {}))
            
            # Show brief status
            print(f"\r📊 Consolidated {num_services} services | "
                  f"Quantum: {status.get('quantum_state', 'unknown')} | "
                  f"Messages: {status.get('real_time_tracking', {}).get('current_session_messages', 0)}", 
                  end='', flush=True)
            
        except Exception as e:
            print(f"\n❌ Error consolidating status: {e}")
        
        # Wait 5 seconds before next consolidation
        time.sleep(5)


if __name__ == "__main__":
    main()