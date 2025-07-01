"""
Configuration Loading and Management
Handles YAML config, environment variables, and validation
"""

import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List
import logging
from dataclasses import dataclass, field
from pydantic import BaseModel, Field, validator
import torch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GPUConfig(BaseModel):
    """GPU hardware configuration"""
    device: str = "cuda:0"
    memory_limit: float = 7.5
    use_mixed_precision: bool = True
    use_8bit_quantization: bool = True
    flash_attention: str = "auto"
    compile_models: bool = False
    
    @validator('device')
    def validate_device(cls, v):
        if v.startswith('cuda') and not torch.cuda.is_available():
            logger.warning("CUDA requested but not available, falling back to CPU")
            return "cpu"
        return v


class CPUConfig(BaseModel):
    """CPU hardware configuration"""
    threads: int = Field(default_factory=lambda: os.cpu_count() or 8)
    batch_processing: bool = True
    parallel_extraction: bool = True


class RAMConfig(BaseModel):
    """RAM configuration"""
    model_cache_size: int = 8192
    embedding_cache_size: int = 4096
    conversation_buffer_size: int = 1024


class HardwareConfig(BaseModel):
    """Combined hardware configuration"""
    gpu: GPUConfig = Field(default_factory=GPUConfig)
    cpu: CPUConfig = Field(default_factory=CPUConfig)
    ram: RAMConfig = Field(default_factory=RAMConfig)


class ModelConfig(BaseModel):
    """Model-specific configuration"""
    path: str
    quantization: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    model: Optional[str] = None  # For emotion/embedding models
    dimension: Optional[int] = None
    batch_size: Optional[int] = None
    threshold: Optional[float] = None


class ConversationWatchConfig(BaseModel):
    """File watching configuration"""
    paths: List[str] = Field(default_factory=list)
    patterns: List[str] = Field(default_factory=lambda: ["*.json", "*.jsonl"])
    debounce_seconds: float = 2.0
    scan_interval: int = 60
    process_existing: bool = True


class ExtractionConfig(BaseModel):
    """Memory extraction configuration"""
    min_importance: float = 0.3
    batch_size: int = 10
    context_window: int = 3
    pattern_confidence: float = 0.5
    emotion_threshold: float = 0.3
    enabled_types: List[str] = Field(default_factory=lambda: [
        "emotional_breakthrough", "technical_victory", "quantum_moment",
        "vulnerability", "collaboration", "teaching_moment"
    ])


class StorageConfig(BaseModel):
    """Storage configuration"""
    persist_directory: str = "~/.sanctuary-memory/chromadb"
    collection_name: str = "gritz_claude_memories"
    enable_versioning: bool = True
    version_directory: str = "~/.sanctuary-memory/versions"
    keep_versions: int = 10
    backup_enabled: bool = True
    backup_directory: str = "~/.sanctuary-memory/backups"
    backup_interval: int = 604800
    keep_backups: int = 4


class SearchConfig(BaseModel):
    """Search configuration"""
    default_results: int = 5
    max_results: int = 20
    use_query_expansion: bool = True
    similarity_threshold: float = 0.5
    rerank_results: bool = True
    cache_embeddings: bool = True
    cache_size: int = 1000


class FadingConfig(BaseModel):
    """Memory fading configuration"""
    enabled: bool = True
    check_interval: int = 86400
    base_decay_rate: float = 0.05
    emotional_decay_rate: float = 0.02
    technical_decay_rate: float = 0.08
    minimum_recall: float = 0.1
    significance_threshold: float = 7.0
    recent_window_days: int = 7


class EmotionConfig(BaseModel):
    """Emotion tracking configuration"""
    connection_patterns: List[str] = Field(default_factory=list)
    preservation_weights: Dict[str, float] = Field(default_factory=dict)


class LoggingConfig(BaseModel):
    """Logging configuration"""
    level: str = "INFO"
    file: str = "~/.sanctuary-memory/logs/sanctuary.log"
    max_size: int = 10485760
    backup_count: int = 5


class ServiceConfig(BaseModel):
    """Service configuration"""
    api: Dict[str, Any] = Field(default_factory=lambda: {
        "enabled": False,
        "host": "127.0.0.1",
        "port": 8081
    })
    metrics_enabled: bool = True
    metrics_port: int = 9090
    health_check_interval: int = 300


class PrivacyConfig(BaseModel):
    """Privacy configuration"""
    local_only: bool = True
    encryption: Dict[str, Any] = Field(default_factory=lambda: {
        "enabled": False,
        "method": "aes256",
        "key_file": "~/.sanctuary-memory/.key"
    })
    retention_days: int = 0


class DevelopmentConfig(BaseModel):
    """Development configuration"""
    debug_mode: bool = False
    profile_gpu: bool = False
    trace_memory: bool = False
    save_intermediate: bool = False


class SanctuaryConfig(BaseModel):
    """Complete Sanctuary Memory configuration"""
    hardware: HardwareConfig = Field(default_factory=HardwareConfig)
    models: Dict[str, ModelConfig] = Field(default_factory=dict)
    conversation_watch: ConversationWatchConfig = Field(default_factory=ConversationWatchConfig)
    extraction: ExtractionConfig = Field(default_factory=ExtractionConfig)
    storage: StorageConfig = Field(default_factory=StorageConfig)
    search: SearchConfig = Field(default_factory=SearchConfig)
    fading: FadingConfig = Field(default_factory=FadingConfig)
    emotions: EmotionConfig = Field(default_factory=EmotionConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    service: ServiceConfig = Field(default_factory=ServiceConfig)
    privacy: PrivacyConfig = Field(default_factory=PrivacyConfig)
    development: DevelopmentConfig = Field(default_factory=DevelopmentConfig)


class ConfigLoader:
    """Load and manage configuration with environment variable support"""
    
    DEFAULT_CONFIG_PATHS = [
        "config/settings.yaml",
        "~/.sanctuary-memory/configs/settings.yaml",
        "/etc/sanctuary-memory/settings.yaml"
    ]
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize config loader"""
        self.config_path = self._find_config_file(config_path)
        self.raw_config = {}
        self.config: Optional[SanctuaryConfig] = None
        self.environment = os.getenv("SANCTUARY_ENV", "production")
    
    def _find_config_file(self, custom_path: Optional[str] = None) -> Optional[Path]:
        """Find configuration file"""
        if custom_path:
            path = Path(os.path.expanduser(custom_path))
            if path.exists():
                return path
            else:
                logger.warning(f"Config file not found: {custom_path}")
        
        # Check default locations
        for path_str in self.DEFAULT_CONFIG_PATHS:
            path = Path(os.path.expanduser(path_str))
            if path.exists():
                logger.info(f"Found config at: {path}")
                return path
        
        logger.warning("No config file found, using defaults")
        return None
    
    def load(self) -> SanctuaryConfig:
        """Load configuration from file and environment"""
        # Load from file
        if self.config_path:
            with open(self.config_path, 'r') as f:
                self.raw_config = yaml.safe_load(f)
        
        # Get sanctuary_memory section
        config_dict = self.raw_config.get('sanctuary_memory', {})
        
        # Apply environment overrides
        if 'environments' in self.raw_config:
            env_config = self.raw_config['environments'].get(self.environment, {})
            config_dict = self._deep_merge(config_dict, env_config)
        
        # Apply environment variable overrides
        config_dict = self._apply_env_overrides(config_dict)
        
        # Create validated config
        self.config = SanctuaryConfig(**config_dict)
        
        # Expand paths
        self._expand_paths()
        
        # Setup logging
        self._setup_logging()
        
        return self.config
    
    def _deep_merge(self, base: Dict, override: Dict) -> Dict:
        """Deep merge two dictionaries"""
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        
        return result
    
    def _apply_env_overrides(self, config: Dict) -> Dict:
        """Apply environment variable overrides"""
        # Format: SANCTUARY_SECTION_KEY=value
        # Example: SANCTUARY_HARDWARE_GPU_DEVICE=cuda:1
        
        prefix = "SANCTUARY_"
        
        for env_key, env_value in os.environ.items():
            if env_key.startswith(prefix):
                # Parse the key path
                key_parts = env_key[len(prefix):].lower().split('_')
                
                # Navigate to the right location in config
                current = config
                for part in key_parts[:-1]:
                    if part not in current:
                        current[part] = {}
                    current = current[part]
                
                # Set the value
                final_key = key_parts[-1]
                
                # Try to parse the value
                try:
                    # Try boolean
                    if env_value.lower() in ['true', 'false']:
                        current[final_key] = env_value.lower() == 'true'
                    # Try int
                    elif env_value.isdigit():
                        current[final_key] = int(env_value)
                    # Try float
                    elif '.' in env_value:
                        try:
                            current[final_key] = float(env_value)
                        except ValueError:
                            current[final_key] = env_value
                    else:
                        current[final_key] = env_value
                except:
                    current[final_key] = env_value
        
        return config
    
    def _expand_paths(self):
        """Expand all path configurations"""
        if not self.config:
            return
        
        # Expand storage paths
        self.config.storage.persist_directory = os.path.expanduser(
            self.config.storage.persist_directory
        )
        self.config.storage.version_directory = os.path.expanduser(
            self.config.storage.version_directory
        )
        self.config.storage.backup_directory = os.path.expanduser(
            self.config.storage.backup_directory
        )
        
        # Expand conversation watch paths
        self.config.conversation_watch.paths = [
            os.path.expanduser(p) for p in self.config.conversation_watch.paths
        ]
        
        # Expand logging path
        self.config.logging.file = os.path.expanduser(self.config.logging.file)
        
        # Expand privacy key file
        if self.config.privacy.encryption.get('key_file'):
            self.config.privacy.encryption['key_file'] = os.path.expanduser(
                self.config.privacy.encryption['key_file']
            )
    
    def _setup_logging(self):
        """Setup logging based on configuration"""
        if not self.config:
            return
        
        # Create log directory
        log_path = Path(self.config.logging.file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Configure logging
        log_level = getattr(logging, self.config.logging.level.upper(), logging.INFO)
        
        # File handler with rotation
        from logging.handlers import RotatingFileHandler
        
        file_handler = RotatingFileHandler(
            self.config.logging.file,
            maxBytes=self.config.logging.max_size,
            backupCount=self.config.logging.backup_count
        )
        
        # Format
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        
        # Configure root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(log_level)
        root_logger.addHandler(file_handler)
        
        # Also log to console in debug mode
        if self.config.development.debug_mode:
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            root_logger.addHandler(console_handler)
    
    def save(self, path: Optional[str] = None):
        """Save current configuration to file"""
        save_path = Path(path) if path else self.config_path
        
        if not save_path:
            raise ValueError("No save path specified")
        
        # Convert to dict
        config_dict = {
            'sanctuary_memory': self.config.dict() if self.config else {}
        }
        
        # Save
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(save_path, 'w') as f:
            yaml.dump(config_dict, f, default_flow_style=False, sort_keys=False)
        
        logger.info(f"Configuration saved to: {save_path}")
    
    def get_gpu_info(self) -> Dict[str, Any]:
        """Get current GPU information"""
        info = {
            'available': torch.cuda.is_available(),
            'device_count': 0,
            'devices': []
        }
        
        if torch.cuda.is_available():
            info['device_count'] = torch.cuda.device_count()
            
            for i in range(info['device_count']):
                device_info = {
                    'index': i,
                    'name': torch.cuda.get_device_name(i),
                    'memory_total': torch.cuda.get_device_properties(i).total_memory / 1e9,
                    'memory_allocated': torch.cuda.memory_allocated(i) / 1e9,
                    'memory_reserved': torch.cuda.memory_reserved(i) / 1e9
                }
                info['devices'].append(device_info)
        
        return info


# Singleton instance
_config_instance: Optional[ConfigLoader] = None


def get_config(config_path: Optional[str] = None) -> SanctuaryConfig:
    """Get or create configuration instance"""
    global _config_instance
    
    if _config_instance is None:
        _config_instance = ConfigLoader(config_path)
        _config_instance.load()
    
    return _config_instance.config


def reload_config():
    """Reload configuration from file"""
    global _config_instance
    
    if _config_instance:
        _config_instance.load()
        logger.info("Configuration reloaded")