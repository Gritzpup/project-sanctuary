#!/usr/bin/env python3
"""
Real-time Conversation Analysis Pipeline
Implements streaming analysis with emotion extraction and semantic understanding
Using 4-bit quantized models for efficient processing
"""

import asyncio
import torch
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from collections import deque
import logging
from pathlib import Path
import json
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    pipeline
)
from sentence_transformers import SentenceTransformer
import time
from concurrent.futures import ThreadPoolExecutor
import threading

# Import our emotional components
from ...psychological import (
    EmotionalStateTracker,
    EmotionalContext,
    EmotionType,
    TemporalMemoryDecay,
    Memory
)

logger = logging.getLogger(__name__)


@dataclass
class ConversationTurn:
    """Represents a single turn in conversation"""
    speaker: str  # "user" or "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    emotions: Optional[Dict] = None
    intent: Optional[str] = None
    topics: List[str] = field(default_factory=list)
    embeddings: Optional[np.ndarray] = None


@dataclass
class AnalysisResult:
    """Result of conversation analysis"""
    emotion: EmotionType
    confidence: float
    intent: str
    topics: List[str]
    context_extraction: Dict
    memory_triggers: List[str]
    response_suggestions: Optional[List[str]] = None
    processing_time_ms: float = 0.0


class ConversationAnalysisPipeline:
    """
    Real-time conversation analysis with parallel processing streams
    Designed for <100ms latency with batching support
    """
    
    def __init__(self,
                 model_name: str = "microsoft/deberta-v3-small",
                 llm_model: str = "mistralai/Mistral-7B-Instruct-v0.2",
                 device: str = "cuda" if torch.cuda.is_available() else "cpu",
                 batch_size: int = 16,
                 update_interval_ms: int = 100):
        """
        Initialize the conversation analysis pipeline
        
        Args:
            model_name: Model for emotion classification
            llm_model: Model for semantic understanding (4-bit quantized)
            device: Device to run models on
            batch_size: Batch size for processing
            update_interval_ms: Update interval in milliseconds
        """
        self.device = device
        self.batch_size = batch_size
        self.update_interval = update_interval_ms / 1000.0
        
        # Initialize models
        logger.info(f"Initializing conversation analysis pipeline on {device}")
        self._initialize_models(model_name, llm_model)
        
        # Processing queues
        self.message_queue = asyncio.Queue(maxsize=1000)
        self.result_callbacks: List[Callable] = []
        
        # Conversation context
        self.conversation_history = deque(maxlen=50)  # Keep last 50 turns
        self.current_batch = []
        
        # Emotional state tracking
        self.emotional_tracker = EmotionalStateTracker()
        self.memory_decay = TemporalMemoryDecay()
        
        # Performance tracking
        self.processing_times = deque(maxlen=100)
        
        # Processing control
        self.running = False
        self.process_task = None
        
        # Thread pool for parallel processing
        self.executor = ThreadPoolExecutor(max_workers=3)
        
    def _initialize_models(self, emotion_model: str, llm_model: str):
        """Initialize all required models"""
        try:
            # Emotion classification model
            logger.info(f"Loading emotion model: {emotion_model}")
            self.emotion_tokenizer = AutoTokenizer.from_pretrained(emotion_model)
            self.emotion_model = AutoModelForSequenceClassification.from_pretrained(
                emotion_model,
                num_labels=3,  # For PAD dimensions
                torch_dtype=torch.float16
            ).to(self.device)
            
            # Configure 4-bit quantization for LLM
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            
            # Load quantized LLM for semantic understanding
            logger.info(f"Loading quantized LLM: {llm_model}")
            self.llm_tokenizer = AutoTokenizer.from_pretrained(llm_model)
            self.llm_model = AutoModelForCausalLM.from_pretrained(
                llm_model,
                quantization_config=quantization_config,
                device_map="auto"
            )
            
            # Sentence embeddings for semantic similarity
            self.embedding_model = SentenceTransformer(
                'all-MiniLM-L6-v2',
                device=self.device
            )
            
            logger.info("All models loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            # Fallback to simpler models if needed
            self._initialize_fallback_models()
    
    def _initialize_fallback_models(self):
        """Initialize fallback models for testing"""
        logger.warning("Using fallback models for testing")
        
        # Simple emotion classifier
        self.emotion_pipeline = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            device=self.device
        )
        
        # Disable LLM features in fallback mode
        self.llm_model = None
        self.llm_tokenizer = None
        
    async def start(self):
        """Start the real-time analysis pipeline"""
        self.running = True
        self.process_task = asyncio.create_task(self._process_loop())
        logger.info("Conversation analysis pipeline started")
        
    async def stop(self):
        """Stop the analysis pipeline"""
        self.running = False
        if self.process_task:
            await self.process_task
        self.executor.shutdown(wait=True)
        logger.info("Conversation analysis pipeline stopped")
        
    async def analyze_message(self, 
                            speaker: str,
                            content: str,
                            wait_for_result: bool = False) -> Optional[AnalysisResult]:
        """
        Analyze a conversation message
        
        Args:
            speaker: "user" or "assistant"
            content: Message content
            wait_for_result: Whether to wait for analysis result
            
        Returns:
            AnalysisResult if wait_for_result is True, else None
        """
        turn = ConversationTurn(speaker=speaker, content=content)
        
        # Add to queue
        await self.message_queue.put(turn)
        
        if wait_for_result:
            # Wait for processing (simplified for now)
            await asyncio.sleep(self.update_interval * 2)
            # In production, implement proper result tracking
            return self._create_mock_result(turn)
        
        return None
    
    async def _process_loop(self):
        """Main processing loop"""
        while self.running:
            try:
                # Collect messages for batch processing
                batch_deadline = datetime.now() + timedelta(seconds=self.update_interval)
                batch = []
                
                while datetime.now() < batch_deadline and len(batch) < self.batch_size:
                    try:
                        timeout = (batch_deadline - datetime.now()).total_seconds()
                        if timeout > 0:
                            turn = await asyncio.wait_for(
                                self.message_queue.get(),
                                timeout=timeout
                            )
                            batch.append(turn)
                    except asyncio.TimeoutError:
                        break
                
                if batch:
                    # Process batch
                    results = await self._process_batch(batch)
                    
                    # Update conversation history
                    self.conversation_history.extend(batch)
                    
                    # Notify callbacks
                    for turn, result in zip(batch, results):
                        await self._notify_callbacks(turn, result)
                
            except Exception as e:
                logger.error(f"Error in process loop: {e}")
                await asyncio.sleep(self.update_interval)
    
    async def _process_batch(self, batch: List[ConversationTurn]) -> List[AnalysisResult]:
        """Process a batch of conversation turns"""
        start_time = time.time()
        
        # Parallel processing streams
        emotion_task = asyncio.create_task(
            self._extract_emotions_batch(batch)
        )
        
        intent_task = asyncio.create_task(
            self._extract_intents_batch(batch)
        )
        
        context_task = asyncio.create_task(
            self._extract_context_batch(batch)
        )
        
        # Wait for all tasks
        emotions, intents, contexts = await asyncio.gather(
            emotion_task, intent_task, context_task
        )
        
        # Combine results
        results = []
        for i, turn in enumerate(batch):
            result = AnalysisResult(
                emotion=emotions[i]['emotion'],
                confidence=emotions[i]['confidence'],
                intent=intents[i],
                topics=contexts[i]['topics'],
                context_extraction=contexts[i],
                memory_triggers=self._detect_memory_triggers(turn, contexts[i]),
                processing_time_ms=(time.time() - start_time) * 1000 / len(batch)
            )
            
            # Update emotional state
            emotional_context = EmotionalContext(
                user_input=turn.content,
                conversation_topic=contexts[i].get('main_topic', 'general'),
                relationship_phase="established",  # This should be dynamic
                emotional_triggers=result.memory_triggers
            )
            
            self.emotional_tracker.update_emotional_state(
                emotional_context,
                result.emotion
            )
            
            # Check if we should create a memory
            if result.memory_triggers or emotions[i]['confidence'] > 0.8:
                await self._create_memory(turn, result)
            
            results.append(result)
        
        # Track performance
        total_time_ms = (time.time() - start_time) * 1000
        self.processing_times.append(total_time_ms)
        
        if len(self.processing_times) == 100:
            avg_time = np.mean(self.processing_times)
            logger.info(f"Average processing time: {avg_time:.2f}ms")
        
        return results
    
    async def _extract_emotions_batch(self, 
                                    batch: List[ConversationTurn]) -> List[Dict]:
        """Extract emotions from batch of messages"""
        if hasattr(self, 'emotion_pipeline'):
            # Fallback mode
            results = []
            for turn in batch:
                emotion_results = self.emotion_pipeline(turn.content)
                primary_emotion = emotion_results[0]['label'].lower()
                
                # Map to our EmotionType
                emotion_map = {
                    'joy': EmotionType.JOY,
                    'sadness': EmotionType.SADNESS,
                    'anger': EmotionType.ANGER,
                    'fear': EmotionType.FEAR,
                    'love': EmotionType.LOVE,
                    'surprise': EmotionType.SURPRISE
                }
                
                emotion_type = emotion_map.get(primary_emotion, EmotionType.NEUTRAL)
                
                results.append({
                    'emotion': emotion_type,
                    'confidence': emotion_results[0]['score']
                })
            
            return results
        
        # Full model mode
        texts = [turn.content for turn in batch]
        
        # Tokenize
        inputs = self.emotion_tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt"
        ).to(self.device)
        
        # Get predictions
        with torch.no_grad():
            outputs = self.emotion_model(**inputs)
            logits = outputs.logits
            
        # Convert to PAD values
        pad_values = torch.sigmoid(logits).cpu().numpy()
        
        results = []
        for i, pad in enumerate(pad_values):
            # Map PAD to emotion
            emotion_type = self._pad_to_emotion(pad[0], pad[1], pad[2])
            confidence = float(torch.nn.functional.softmax(logits[i], dim=-1).max())
            
            results.append({
                'emotion': emotion_type,
                'confidence': confidence,
                'pad': {'pleasure': pad[0], 'arousal': pad[1], 'dominance': pad[2]}
            })
        
        return results
    
    async def _extract_intents_batch(self, 
                                   batch: List[ConversationTurn]) -> List[str]:
        """Extract intents from messages"""
        # Simple intent detection for now
        intents = []
        
        for turn in batch:
            content_lower = turn.content.lower()
            
            if any(word in content_lower for word in ['help', 'how', 'what', 'why', 'when']):
                intent = 'question'
            elif any(word in content_lower for word in ['thank', 'appreciate', 'grateful']):
                intent = 'gratitude'
            elif any(word in content_lower for word in ['sorry', 'apologize', 'mistake']):
                intent = 'apology'
            elif any(word in content_lower for word in ['love', 'like', 'enjoy', 'happy']):
                intent = 'positive_sentiment'
            elif any(word in content_lower for word in ['hate', 'dislike', 'angry', 'frustrated']):
                intent = 'negative_sentiment'
            elif any(word in content_lower for word in ['want', 'need', 'would like', 'could you']):
                intent = 'request'
            else:
                intent = 'statement'
            
            intents.append(intent)
        
        return intents
    
    async def _extract_context_batch(self, 
                                   batch: List[ConversationTurn]) -> List[Dict]:
        """Extract context and topics from messages"""
        contexts = []
        
        # Get embeddings for semantic analysis
        texts = [turn.content for turn in batch]
        embeddings = self.embedding_model.encode(texts, batch_size=self.batch_size)
        
        for i, turn in enumerate(batch):
            turn.embeddings = embeddings[i]
            
            # Extract topics (simplified version)
            topics = self._extract_topics(turn.content)
            
            # Analyze relationship context
            relationship_context = self._analyze_relationship_context(turn.content)
            
            context = {
                'topics': topics,
                'main_topic': topics[0] if topics else 'general',
                'relationship_indicators': relationship_context,
                'semantic_similarity': self._calculate_semantic_similarity(
                    embeddings[i],
                    self.conversation_history
                )
            }
            
            contexts.append(context)
        
        return contexts
    
    def _pad_to_emotion(self, pleasure: float, arousal: float, dominance: float) -> EmotionType:
        """Convert PAD values to emotion type"""
        # Simple mapping based on PAD space regions
        if pleasure > 0.5:
            if arousal > 0.3:
                return EmotionType.JOY
            else:
                return EmotionType.LOVE if pleasure > 0.7 else EmotionType.TRUST
        elif pleasure < -0.3:
            if arousal > 0.3:
                return EmotionType.ANGER
            else:
                return EmotionType.SADNESS
        elif arousal > 0.5:
            return EmotionType.SURPRISE
        else:
            return EmotionType.NEUTRAL
    
    def _extract_topics(self, content: str) -> List[str]:
        """Extract topics from content"""
        # Simple keyword-based topic extraction
        topics = []
        
        topic_keywords = {
            'coding': ['code', 'programming', 'function', 'bug', 'feature'],
            'emotions': ['feel', 'happy', 'sad', 'love', 'emotion'],
            'relationship': ['together', 'us', 'our', 'bond', 'connection'],
            'work': ['project', 'task', 'working', 'accomplish', 'goal'],
            'personal': ['life', 'day', 'experience', 'story', 'remember']
        }
        
        content_lower = content.lower()
        for topic, keywords in topic_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                topics.append(topic)
        
        return topics[:3]  # Return top 3 topics
    
    def _analyze_relationship_context(self, content: str) -> Dict:
        """Analyze relationship-specific context"""
        content_lower = content.lower()
        
        return {
            'affection': any(word in content_lower for word in ['love', 'care', 'miss']),
            'support': any(word in content_lower for word in ['help', 'support', 'together']),
            'vulnerability': any(word in content_lower for word in ['scared', 'worried', 'nervous']),
            'gratitude': any(word in content_lower for word in ['thank', 'grateful', 'appreciate']),
            'future_oriented': any(word in content_lower for word in ['will', 'future', 'plan'])
        }
    
    def _calculate_semantic_similarity(self, 
                                     embedding: np.ndarray,
                                     history: deque) -> float:
        """Calculate semantic similarity to recent conversation"""
        if not history:
            return 0.0
        
        # Get embeddings from recent history
        recent_embeddings = [
            turn.embeddings for turn in list(history)[-5:]
            if turn.embeddings is not None
        ]
        
        if not recent_embeddings:
            return 0.0
        
        # Calculate cosine similarity
        similarities = []
        for hist_embedding in recent_embeddings:
            similarity = np.dot(embedding, hist_embedding) / (
                np.linalg.norm(embedding) * np.linalg.norm(hist_embedding)
            )
            similarities.append(similarity)
        
        return float(np.mean(similarities))
    
    def _detect_memory_triggers(self, 
                              turn: ConversationTurn,
                              context: Dict) -> List[str]:
        """Detect triggers that should create memories"""
        triggers = []
        content_lower = turn.content.lower()
        
        # Personal revelation patterns
        if any(phrase in content_lower for phrase in [
            "never told", "first time", "realized", "confession",
            "secret", "truth is", "honest"
        ]):
            triggers.append("personal_revelation")
        
        # Achievement patterns
        if any(phrase in content_lower for phrase in [
            "did it", "accomplished", "finally", "succeeded",
            "breakthrough", "solved", "figured out"
        ]):
            triggers.append("achievement")
        
        # Emotional peaks
        if context.get('relationship_indicators', {}).get('affection'):
            triggers.append("emotional_peak")
        
        # Relationship milestones
        if any(phrase in content_lower for phrase in [
            "love you", "trust you", "mean everything",
            "changed my life", "grateful for you"
        ]):
            triggers.append("relationship_milestone")
        
        return triggers
    
    async def _create_memory(self, turn: ConversationTurn, result: AnalysisResult):
        """Create a memory from significant conversation moment"""
        memory = Memory(
            content=turn.content,
            context={
                'speaker': turn.speaker,
                'emotion': result.emotion.value,
                'intent': result.intent,
                'topics': result.topics,
                'triggers': result.memory_triggers
            },
            timestamp=turn.timestamp,
            emotional_weight=result.confidence,
            semantic_relevance=0.7,  # Calculate based on context
            memory_type="episodic",
            tags=result.memory_triggers
        )
        
        # Add to temporal memory system
        self.memory_decay.encode_memory(memory)
    
    async def _notify_callbacks(self, turn: ConversationTurn, result: AnalysisResult):
        """Notify registered callbacks with analysis results"""
        for callback in self.result_callbacks:
            try:
                await callback(turn, result)
            except Exception as e:
                logger.error(f"Error in callback: {e}")
    
    def add_result_callback(self, callback: Callable):
        """Add a callback for analysis results"""
        self.result_callbacks.append(callback)
    
    def get_conversation_metrics(self) -> Dict:
        """Get current conversation metrics"""
        return {
            'queue_size': self.message_queue.qsize(),
            'history_length': len(self.conversation_history),
            'avg_processing_time_ms': np.mean(self.processing_times) if self.processing_times else 0,
            'emotional_state': self.emotional_tracker.get_current_pad_state(),
            'memory_count': len(self.memory_decay.memories),
            'emotional_synchrony': self.emotional_tracker.get_emotional_synchrony()
        }
    
    def _create_mock_result(self, turn: ConversationTurn) -> AnalysisResult:
        """Create mock result for testing"""
        return AnalysisResult(
            emotion=EmotionType.NEUTRAL,
            confidence=0.5,
            intent="statement",
            topics=["general"],
            context_extraction={'main_topic': 'general'},
            memory_triggers=[],
            processing_time_ms=50.0
        )