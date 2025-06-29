"""
Secure environment variable loader

Handles loading sensitive configuration from .env file
Only use sudo when absolutely necessary for system operations
"""

import os
from pathlib import Path
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


class EnvLoader:
    """Securely load environment variables"""
    
    def __init__(self):
        self.env_path = Path(__file__).parent.parent / ".env"
        self._loaded = False
        self._env_vars: Dict[str, str] = {}
        
    def load(self) -> bool:
        """Load environment variables from .env file"""
        if self._loaded:
            return True
            
        if not self.env_path.exists():
            logger.warning(".env file not found")
            return False
            
        try:
            # Read .env file
            with open(self.env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        self._env_vars[key.strip()] = value.strip().strip('"\'')
                        
            self._loaded = True
            logger.info("Environment variables loaded")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load .env: {e}")
            return False
            
    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get environment variable value"""
        if not self._loaded:
            self.load()
            
        # Check environment first, then loaded vars
        return os.environ.get(key, self._env_vars.get(key, default))
        
    def has_sudo_access(self) -> bool:
        """Check if sudo password is available"""
        return bool(self.get("SUDO_PASSWORD"))


# Global instance
env_loader = EnvLoader()


# When sudo might be needed for quantum memory system:
SUDO_OPERATIONS = {
    "gpu_memory_lock": "Lock GPU memory pages for quantum state coherence",
    "realtime_priority": "Set real-time process priority for quantum operations", 
    "system_monitoring": "Access system-level performance counters",
    "hugepages": "Allocate huge memory pages for quantum state vectors",
    "numa_pinning": "Pin quantum processes to specific CPU cores"
}


def requires_sudo(operation: str) -> bool:
    """Check if an operation requires sudo"""
    return operation in SUDO_OPERATIONS