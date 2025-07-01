"""
Model Loading and Management for Sanctuary Memory System
Handles all AI models with GPU optimization
"""

import torch
from transformers import (
    AutoModel,
    AutoTokenizer,
    pipeline,
    logging as transformers_logging
)
from sentence_transformers import SentenceTransformer
import logging
from typing import Dict, Optional, Any
import os
import gc

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
transformers_logging.set_verbosity_error()  # Reduce transformer verbosity


class ModelManager:
    """Centralized model management with GPU optimization"""
    
    MODEL_CONFIGS = {
        "phi3": {
            "name": "microsoft/Phi-3-mini-4k-instruct",
            "type": "causal_lm",
            "use_8bit": True,
            "trust_remote": True
        },
        "embeddings": {
            "name": "sentence-transformers/all-MiniLM-L6-v2",
            "type": "sentence_transformer",
            "dimension": 384
        },
        "emotion": {
            "name": "j-hartmann/emotion-english-distilroberta-base",
            "type": "pipeline",
            "task": "text-classification"
        },
        "sentiment": {
            "name": "cardiffnlp/twitter-roberta-base-sentiment-latest",
            "type": "pipeline",
            "task": "sentiment-analysis"
        },
        "code": {
            "name": "microsoft/codebert-base",
            "type": "feature_extraction"
        }
    }
    
    def __init__(self, cache_dir: Optional[str] = None):
        """Initialize model manager"""
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.cache_dir = cache_dir or os.path.expanduser("~/.cache/sanctuary-memory")
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Model storage
        self.models: Dict[str, Any] = {}
        self.tokenizers: Dict[str, Any] = {}
        
        # GPU info
        if torch.cuda.is_available():
            self.gpu_name = torch.cuda.get_device_name(0)
            self.gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
            logger.info(f"GPU: {self.gpu_name} ({self.gpu_memory:.2f}GB)")
        else:
            logger.warning("No GPU available - models will run on CPU (slower)")
    
    def load_model(self, model_key: str) -> Any:
        """Load a model by key with caching"""
        if model_key in self.models:
            logger.info(f"Model '{model_key}' already loaded")
            return self.models[model_key]
        
        if model_key not in self.MODEL_CONFIGS:
            raise ValueError(f"Unknown model key: {model_key}")
        
        config = self.MODEL_CONFIGS[model_key]
        logger.info(f"Loading model '{model_key}': {config['name']}")
        
        try:
            model = self._load_by_type(config)
            self.models[model_key] = model
            
            # Log memory usage
            self._log_memory_usage()
            
            return model
            
        except Exception as e:
            logger.error(f"Failed to load model '{model_key}': {e}")
            raise
    
    def _load_by_type(self, config: Dict) -> Any:
        """Load model based on type"""
        model_type = config["type"]
        model_name = config["name"]
        
        if model_type == "sentence_transformer":
            return self._load_sentence_transformer(model_name)
        
        elif model_type == "pipeline":
            return self._load_pipeline(config)
        
        elif model_type == "causal_lm":
            # Handled by Phi3MemoryProcessor
            logger.info(f"Causal LM '{model_name}' should be loaded via Phi3MemoryProcessor")
            return None
        
        elif model_type == "feature_extraction":
            return self._load_feature_extractor(model_name)
        
        else:
            raise ValueError(f"Unknown model type: {model_type}")
    
    def _load_sentence_transformer(self, model_name: str) -> SentenceTransformer:
        """Load sentence transformer model"""
        model = SentenceTransformer(
            model_name,
            device=self.device,
            cache_folder=self.cache_dir
        )
        
        # Enable eval mode
        model.eval()
        
        # Half precision on GPU
        if self.device.type == "cuda":
            model.half()
        
        return model
    
    def _load_pipeline(self, config: Dict) -> pipeline:
        """Load HuggingFace pipeline"""
        return pipeline(
            config["task"],
            model=config["name"],
            device=0 if self.device.type == "cuda" else -1,
            model_kwargs={"cache_dir": self.cache_dir}
        )
    
    def _load_feature_extractor(self, model_name: str) -> AutoModel:
        """Load feature extraction model"""
        model = AutoModel.from_pretrained(
            model_name,
            cache_dir=self.cache_dir
        ).to(self.device)
        
        # Enable eval mode
        model.eval()
        
        # Half precision on GPU
        if self.device.type == "cuda":
            model.half()
        
        # Also load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=self.cache_dir
        )
        self.tokenizers[model_name] = tokenizer
        
        return model
    
    def get_embeddings_model(self) -> SentenceTransformer:
        """Get embeddings model"""
        return self.load_model("embeddings")
    
    def get_emotion_model(self) -> pipeline:
        """Get emotion classification model"""
        return self.load_model("emotion")
    
    def get_sentiment_model(self) -> pipeline:
        """Get sentiment analysis model"""
        return self.load_model("sentiment")
    
    def embed_texts(self, texts: list, batch_size: int = 32) -> torch.Tensor:
        """Generate embeddings for texts"""
        model = self.get_embeddings_model()
        
        # Process in batches
        embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            with torch.no_grad():
                if self.device.type == "cuda":
                    with torch.cuda.amp.autocast():
                        batch_embeddings = model.encode(
                            batch,
                            convert_to_tensor=True,
                            show_progress_bar=False
                        )
                else:
                    batch_embeddings = model.encode(
                        batch,
                        convert_to_tensor=True,
                        show_progress_bar=False
                    )
            
            embeddings.append(batch_embeddings)
        
        # Concatenate all embeddings
        return torch.cat(embeddings, dim=0)
    
    def clear_model(self, model_key: str):
        """Clear a specific model from memory"""
        if model_key in self.models:
            del self.models[model_key]
            gc.collect()
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            logger.info(f"Cleared model '{model_key}' from memory")
    
    def clear_all_models(self):
        """Clear all models from memory"""
        model_keys = list(self.models.keys())
        
        for key in model_keys:
            self.clear_model(key)
        
        logger.info("Cleared all models from memory")
    
    def _log_memory_usage(self):
        """Log current memory usage"""
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1e9
            reserved = torch.cuda.memory_reserved() / 1e9
            free = self.gpu_memory - reserved
            
            logger.info(f"GPU Memory: {allocated:.2f}GB used, {free:.2f}GB free")
        
        # CPU memory
        import psutil
        process = psutil.Process()
        cpu_memory = process.memory_info().rss / 1e9
        logger.info(f"CPU Memory: {cpu_memory:.2f}GB")
    
    def optimize_for_memory(self):
        """Optimize models for memory efficiency"""
        logger.info("Optimizing models for memory efficiency...")
        
        # Enable gradient checkpointing where possible
        for model in self.models.values():
            if hasattr(model, 'gradient_checkpointing_enable'):
                model.gradient_checkpointing_enable()
        
        # Clear cache
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        self._log_memory_usage()


class EmbeddingManager:
    """Specialized manager for embedding operations"""
    
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
        self.model = None
        self.dimension = 384  # all-MiniLM-L6-v2 dimension
    
    def ensure_loaded(self):
        """Ensure embedding model is loaded"""
        if self.model is None:
            self.model = self.model_manager.get_embeddings_model()
    
    def embed_memory(self, memory_text: str) -> torch.Tensor:
        """Generate embedding for a single memory"""
        self.ensure_loaded()
        
        with torch.no_grad():
            if self.model_manager.device.type == "cuda":
                with torch.cuda.amp.autocast():
                    embedding = self.model.encode(
                        memory_text,
                        convert_to_tensor=True,
                        show_progress_bar=False
                    )
            else:
                embedding = self.model.encode(
                    memory_text,
                    convert_to_tensor=True,
                    show_progress_bar=False
                )
        
        return embedding
    
    def embed_memories_batch(self, memory_texts: list, 
                           batch_size: int = 32) -> torch.Tensor:
        """Generate embeddings for multiple memories"""
        self.ensure_loaded()
        return self.model_manager.embed_texts(memory_texts, batch_size)
    
    def compute_similarity(self, embedding1: torch.Tensor, 
                         embedding2: torch.Tensor) -> float:
        """Compute cosine similarity between embeddings"""
        # Ensure same device
        if embedding1.device != embedding2.device:
            embedding2 = embedding2.to(embedding1.device)
        
        # Normalize
        embedding1_norm = embedding1 / embedding1.norm()
        embedding2_norm = embedding2 / embedding2.norm()
        
        # Cosine similarity
        similarity = torch.dot(embedding1_norm, embedding2_norm).item()
        
        return similarity
    
    def find_similar_embeddings(self, query_embedding: torch.Tensor,
                              embedding_pool: torch.Tensor,
                              top_k: int = 5) -> list:
        """Find most similar embeddings from a pool"""
        # Ensure same device
        if query_embedding.device != embedding_pool.device:
            embedding_pool = embedding_pool.to(query_embedding.device)
        
        # Normalize
        query_norm = query_embedding / query_embedding.norm()
        pool_norm = embedding_pool / embedding_pool.norm(dim=1, keepdim=True)
        
        # Compute similarities
        similarities = torch.matmul(pool_norm, query_norm)
        
        # Get top k
        top_values, top_indices = torch.topk(similarities, min(top_k, len(similarities)))
        
        results = []
        for i in range(len(top_indices)):
            results.append({
                'index': top_indices[i].item(),
                'similarity': top_values[i].item()
            })
        
        return results