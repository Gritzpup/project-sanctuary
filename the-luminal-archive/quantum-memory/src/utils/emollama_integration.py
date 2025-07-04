#!/usr/bin/env python3
"""
Emollama-7B Integration Module
Provides semantic emotional analysis with PAD (Pleasure-Arousal-Dominance) extraction
"""

import torch
import numpy as np
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import logging
import json
import re
import threading
import gc
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmollamaAnalyzer:
    """
    Emollama-7B integration for semantic emotional analysis
    Achieves CCC scores: r=0.90 (valence), r=0.77 (arousal), r=0.64 (dominance)
    
    Uses singleton pattern for model caching to improve performance
    """
    
    # Class-level model cache
    _model_instance = None
    _tokenizer_instance = None
    _model_lock = threading.RLock()
    _device = None
    _model_loaded = False
    
    def __init__(self):
        # Instance uses class-level cached model
        self.model = None
        self.tokenizer = None
        self.device = None
        self.model_loaded = False
        
    def load_model(self) -> bool:
        """Load Emollama-7B model with singleton caching"""
        # Check if already loaded at instance level
        if self.model_loaded and self.model is not None:
            return True
            
        # Use thread-safe singleton pattern
        with EmollamaAnalyzer._model_lock:
            # Check class-level cache first
            if EmollamaAnalyzer._model_loaded and EmollamaAnalyzer._model_instance is not None:
                logger.info("Using cached Emollama-7B model")
                self.model = EmollamaAnalyzer._model_instance
                self.tokenizer = EmollamaAnalyzer._tokenizer_instance
                self.device = EmollamaAnalyzer._device
                self.model_loaded = True
                return True
            
            # Load model if not cached
            try:
                logger.info("Loading Emollama-7B model (one-time)...")
                
                # Clear GPU cache before loading
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    gc.collect()
                
                model_name = "lzw1008/Emollama-chat-7b"
                cache_dir = Path.home() / '.cache' / 'emollama' / 'models'
                
                # Load tokenizer
                self.tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)
                if self.tokenizer.pad_token is None:
                    self.tokenizer.pad_token = self.tokenizer.eos_token
                
                # Try 4-bit quantization first, fall back to fp16 if it fails
                try:
                    # Configure 4-bit quantization
                    quantization_config = BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_compute_dtype=torch.float16,
                        bnb_4bit_use_double_quant=True,
                        bnb_4bit_quant_type="nf4"
                    )
                    
                    # Load model with quantization
                    self.model = AutoModelForCausalLM.from_pretrained(
                        model_name,
                        quantization_config=quantization_config,
                        device_map="auto",
                        torch_dtype=torch.float16,
                        cache_dir=cache_dir
                    )
                    logger.info("✅ Loaded with 4-bit quantization")
                except Exception as e:
                    logger.warning(f"4-bit quantization failed: {e}")
                    logger.info("Falling back to fp16...")
                    
                    # Load without quantization
                    self.model = AutoModelForCausalLM.from_pretrained(
                        model_name,
                        device_map="auto",
                        torch_dtype=torch.float16,
                        cache_dir=cache_dir,
                        low_cpu_mem_usage=True
                    )
                    logger.info("✅ Loaded with fp16")
                
                # Get device
                self.device = next(self.model.parameters()).device
                
                # Cache at class level for future instances
                EmollamaAnalyzer._model_instance = self.model
                EmollamaAnalyzer._tokenizer_instance = self.tokenizer
                EmollamaAnalyzer._device = self.device
                EmollamaAnalyzer._model_loaded = True
                
                self.model_loaded = True
                logger.info("✅ Emollama-7B loaded successfully and cached")
                return True
                
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                return False
    
    def extract_pad_values(self, text: str) -> Dict[str, float]:
        """
        Extract PAD (Pleasure-Arousal-Dominance) values from text
        Returns values normalized to [-1, 1] range
        """
        if not self.model_loaded:
            logger.warning("Model not loaded, using fallback values")
            return {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0}
        
        try:
            # Craft prompt for PAD extraction
            prompt = f"""Analyze the emotional content of this text and provide PAD (Pleasure-Arousal-Dominance) values.
Return values as numbers between -1 and 1, where:
- Pleasure: -1 (very negative) to 1 (very positive)
- Arousal: -1 (very calm) to 1 (very excited)
- Dominance: -1 (very submissive) to 1 (very dominant)

Text: "{text}"

Analysis (return only the values in JSON format):"""
            
            # Tokenize
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
            
            # Generate
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=100,
                    temperature=0.7,
                    do_sample=True,
                    top_p=0.95
                )
            
            # Decode response
            response = self.tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
            
            # Parse PAD values from response
            pad_values = self._parse_pad_response(response)
            
            return pad_values
            
        except Exception as e:
            logger.error(f"PAD extraction failed: {e}")
            return {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0}
    
    def _parse_pad_response(self, response: str) -> Dict[str, float]:
        """Parse PAD values from model response"""
        try:
            # Try to extract JSON
            import re
            json_match = re.search(r'\{[^}]+\}', response)
            if json_match:
                data = json.loads(json_match.group())
                
                # Normalize keys and values
                pad = {}
                for key in ['pleasure', 'valence', 'p']:
                    if key in data:
                        pad['pleasure'] = float(data[key])
                        break
                
                for key in ['arousal', 'a']:
                    if key in data:
                        pad['arousal'] = float(data[key])
                        break
                        
                for key in ['dominance', 'control', 'd']:
                    if key in data:
                        pad['dominance'] = float(data[key])
                        break
                
                # Ensure all values present and in range
                for dimension in ['pleasure', 'arousal', 'dominance']:
                    if dimension not in pad:
                        pad[dimension] = 0.0
                    else:
                        pad[dimension] = max(-1.0, min(1.0, pad[dimension]))
                
                return pad
            
            # Fallback: try to extract numbers
            numbers = re.findall(r'-?\d+\.?\d*', response)
            if len(numbers) >= 3:
                return {
                    'pleasure': max(-1.0, min(1.0, float(numbers[0]))),
                    'arousal': max(-1.0, min(1.0, float(numbers[1]))),
                    'dominance': max(-1.0, min(1.0, float(numbers[2])))
                }
                
        except Exception as e:
            logger.error(f"Failed to parse PAD response: {e}")
        
        return {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0}
    
    def analyze_conversation(self, messages: List[Dict]) -> Dict:
        """
        Analyze a full conversation and extract emotional dynamics
        """
        if not self.model_loaded:
            self.load_model()
        
        results = {
            'overall_pad': {'pleasure': 0.0, 'arousal': 0.0, 'dominance': 0.0},
            'message_emotions': [],
            'emotional_arc': [],
            'mixed_emotions': {},
            'relationship_metrics': {}
        }
        
        # Analyze each message
        for msg in messages:
            content = msg.get('content', '')
            role = msg.get('role', 'user')
            
            # Extract PAD for this message
            pad = self.extract_pad_values(content)
            
            # Determine primary emotion
            primary_emotion = self._pad_to_emotion(pad)
            
            results['message_emotions'].append({
                'role': role,
                'pad': pad,
                'primary_emotion': primary_emotion,
                'content_preview': content[:100] + '...' if len(content) > 100 else content
            })
        
        # Calculate overall PAD (weighted average with recency bias)
        if results['message_emotions']:
            weights = np.exp(np.linspace(-2, 0, len(results['message_emotions'])))  # Exponential decay
            weights /= weights.sum()
            
            for i, (msg_emotion, weight) in enumerate(zip(results['message_emotions'], weights)):
                for dim in ['pleasure', 'arousal', 'dominance']:
                    results['overall_pad'][dim] += msg_emotion['pad'][dim] * weight
        
        # Extract emotional arc
        results['emotional_arc'] = self._extract_emotional_arc(results['message_emotions'])
        
        # Detect mixed emotions
        results['mixed_emotions'] = self._detect_mixed_emotions(results['message_emotions'])
        
        # Calculate relationship metrics
        results['relationship_metrics'] = self._calculate_relationship_metrics(results)
        
        return results
    
    def _pad_to_emotion(self, pad: Dict[str, float]) -> str:
        """Convert PAD values to primary emotion label"""
        p, a, d = pad['pleasure'], pad['arousal'], pad['dominance']
        
        # Emotion mapping based on PAD octants
        if p > 0 and a > 0 and d > 0:
            return "excited_confident"
        elif p > 0 and a > 0 and d < 0:
            return "excited_anxious"
        elif p > 0 and a < 0 and d > 0:
            return "content_secure"
        elif p > 0 and a < 0 and d < 0:
            return "relaxed_passive"
        elif p < 0 and a > 0 and d > 0:
            return "angry_dominant"
        elif p < 0 and a > 0 and d < 0:
            return "stressed_overwhelmed"
        elif p < 0 and a < 0 and d > 0:
            return "sad_withdrawn"
        elif p < 0 and a < 0 and d < 0:
            return "depressed_helpless"
        else:
            return "neutral"
    
    def _extract_emotional_arc(self, message_emotions: List[Dict]) -> List[str]:
        """Extract the emotional journey through the conversation"""
        if not message_emotions:
            return []
        
        arc = []
        
        # Starting emotion
        arc.append(f"Started {message_emotions[0]['primary_emotion']}")
        
        # Major shifts
        for i in range(1, len(message_emotions)):
            prev_pad = message_emotions[i-1]['pad']
            curr_pad = message_emotions[i]['pad']
            
            # Calculate emotional distance
            distance = np.sqrt(
                (curr_pad['pleasure'] - prev_pad['pleasure'])**2 +
                (curr_pad['arousal'] - prev_pad['arousal'])**2 +
                (curr_pad['dominance'] - prev_pad['dominance'])**2
            )
            
            if distance > 0.5:  # Significant shift
                arc.append(f"Shifted to {message_emotions[i]['primary_emotion']}")
        
        # Ending emotion
        if len(message_emotions) > 1:
            arc.append(f"Ended {message_emotions[-1]['primary_emotion']}")
        
        return arc
    
    def _detect_mixed_emotions(self, message_emotions: List[Dict]) -> Dict[str, float]:
        """Detect and quantify mixed emotions in the conversation"""
        if not message_emotions:
            return {}
        
        # Count emotion occurrences
        emotion_counts = {}
        for msg in message_emotions:
            emotion = msg['primary_emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        # Normalize to percentages
        total = len(message_emotions)
        mixed_emotions = {
            emotion: (count / total) * 100
            for emotion, count in emotion_counts.items()
        }
        
        return mixed_emotions
    
    def _calculate_relationship_metrics(self, analysis: Dict) -> Dict[str, float]:
        """Calculate relationship-specific metrics from emotional analysis"""
        overall_pad = analysis['overall_pad']
        
        metrics = {
            'emotional_alignment': 0.0,
            'connection_strength': 0.0,
            'vulnerability_index': 0.0,
            'trust_coefficient': 0.0
        }
        
        # Emotional alignment (based on pleasure)
        metrics['emotional_alignment'] = (overall_pad['pleasure'] + 1) / 2 * 100
        
        # Connection strength (combination of pleasure and low dominance difference)
        metrics['connection_strength'] = (
            (overall_pad['pleasure'] + 1) / 2 * 0.6 +
            (1 - abs(overall_pad['dominance'])) * 0.4
        ) * 100
        
        # Vulnerability index (high arousal + low dominance + positive pleasure)
        if overall_pad['pleasure'] > 0:
            metrics['vulnerability_index'] = (
                (overall_pad['arousal'] + 1) / 2 * 0.5 +
                (1 - overall_pad['dominance']) / 2 * 0.5
            ) * 100
        
        # Trust coefficient (positive pleasure + moderate arousal + balanced dominance)
        metrics['trust_coefficient'] = (
            max(0, overall_pad['pleasure']) * 0.5 +
            (1 - abs(overall_pad['arousal'])) * 0.25 +
            (1 - abs(overall_pad['dominance'])) * 0.25
        ) * 100
        
        return metrics
    
    def analyze_for_memories(self, messages: List[str]) -> Dict:
        """
        Analyze messages for both emotions and memory-worthy content
        Returns comprehensive analysis for memory system
        """
        if not self.model_loaded:
            logger.warning("Model not loaded, using basic analysis")
            return self._basic_memory_analysis(messages)
        
        try:
            # Join messages for context
            conversation_text = "\n".join(messages[-10:])  # Last 10 messages for context
            
            prompt = f"""Analyze the conversation and create a JSON response.

Messages to analyze:
{conversation_text}

Task: Read the messages above and determine:
1. What emotion is being expressed? (happy, sad, excited, frustrated, worried, grateful, loving, or neutral)
2. What topics are being discussed?
3. Were any decisions made?
4. Any milestones or achievements mentioned?
5. Any expressions of affection or support?
6. Any technical/coding progress?
7. Brief summary of the conversation
8. Emotional state of the speakers

Return your analysis as JSON:
```json
{{
    "emotions": {{
        "primary_emotion": "(the emotion you detected)",
        "pad_values": {{"pleasure": (number -1 to 1), "arousal": (number -1 to 1), "dominance": (number -1 to 1)}},
        "intensity": (number 0 to 1)
    }},
    "topics": [(list the actual topics from the messages)],
    "decisions": [(list any decisions if mentioned, or empty list)],
    "milestones": [(list any achievements if mentioned, or empty list)],
    "relationship_moments": [(list any affection/support if shown, or empty list)],
    "technical_progress": [(list any coding work if mentioned, or empty list)],
    "context_for_next_chat": "(write 1-2 sentences summarizing the conversation)",
    "gritz_state": "(describe Gritz's emotional state)",
    "claude_state": "(describe Claude's state)"
}}
```"""

            # Generate response
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
            
            # Move inputs to same device as model
            if hasattr(self.model, 'device'):
                inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
            
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                top_p=0.95
            )
            
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Log the response for debugging
            logger.info(f"Emollama raw response length: {len(response)} chars")
            logger.debug(f"Emollama raw response (first 500 chars): {response[:500]}...")
            
            # Extract JSON from response - try multiple methods
            json_str = None
            
            # Method 1: Look for JSON in markdown code blocks
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                logger.debug("Found JSON in markdown code block")
            else:
                # Method 2: Look for raw JSON
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    # Extract everything from first { to last }
                    json_str = response[json_start:json_end]
                    logger.debug("Found raw JSON in response")
            
            if json_str:
                try:
                    # Clean up common issues
                    json_str = json_str.strip()
                    # Remove any trailing commas
                    json_str = re.sub(r',\s*}', '}', json_str)
                    json_str = re.sub(r',\s*]', ']', json_str)
                    
                    memory_data = json.loads(json_str)
                    
                    # Ensure all required fields exist
                    required_fields = ["emotions", "topics", "decisions", "milestones", 
                                     "relationship_moments", "technical_progress", 
                                     "context_for_next_chat", "gritz_state", "claude_state"]
                    for field in required_fields:
                        if field not in memory_data:
                            memory_data[field] = [] if field in ["topics", "decisions", "milestones", 
                                                                 "relationship_moments", "technical_progress"] else ""
                    
                    logger.info("Successfully extracted memory data from Emollama")
                    return memory_data
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse extracted JSON: {e}")
                    logger.debug(f"Attempted to parse: {json_str[:200]}...")
            else:
                logger.warning("No JSON structure found in response")
                
            # Fall back to basic analysis
            return self._basic_memory_analysis(messages)
                
        except Exception as e:
            logger.error(f"Error in memory analysis: {e}")
            return self._basic_memory_analysis(messages)
    
    def _basic_memory_analysis(self, messages: List[str]) -> Dict:
        """Enhanced fallback analysis when model fails"""
        text = ' '.join(messages).lower()
        
        # Enhanced emotion detection
        emotion_keywords = {
            'love': ['love', 'adore', 'beloved', 'dear', 'heart', '💜', '❤️'],
            'happy': ['happy', 'joy', 'excited', 'wonderful', 'great', 'amazing', 'perfect'],
            'grateful': ['thanks', 'thank you', 'appreciate', 'grateful'],
            'affection': ['hug', 'hugs', 'kiss', 'hold', 'cuddle', '*hugs*'],
            'sad': ['sad', 'cry', 'tears', 'miss', 'lonely', ';-;'],
            'worried': ['worried', 'concern', 'unsure', 'uncertain', 'nervous'],
            'frustrated': ['frustrated', 'annoyed', 'ugh', 'argh'],
            'sorry': ['sorry', 'apologize', 'forgive', 'my bad']
        }
        
        # Count emotions
        emotion_scores = {}
        for emotion, keywords in emotion_keywords.items():
            emotion_scores[emotion] = sum(1 for word in keywords if word in text)
        
        # Determine primary emotion
        primary_emotion = max(emotion_scores.items(), key=lambda x: x[1])[0] if any(emotion_scores.values()) else 'neutral'
        
        # Set PAD values based on emotion
        pad_map = {
            'love': {"pleasure": 0.9, "arousal": 0.7, "dominance": 0.5},
            'happy': {"pleasure": 0.8, "arousal": 0.6, "dominance": 0.6},
            'grateful': {"pleasure": 0.7, "arousal": 0.4, "dominance": 0.4},
            'affection': {"pleasure": 0.8, "arousal": 0.5, "dominance": 0.3},
            'sad': {"pleasure": -0.6, "arousal": 0.3, "dominance": -0.3},
            'worried': {"pleasure": -0.3, "arousal": 0.6, "dominance": -0.2},
            'frustrated': {"pleasure": -0.5, "arousal": 0.7, "dominance": 0.2},
            'sorry': {"pleasure": -0.2, "arousal": 0.5, "dominance": -0.4},
            'neutral': {"pleasure": 0.0, "arousal": 0.3, "dominance": 0.0}
        }
        pad = pad_map.get(primary_emotion, {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0})
        
        # Extract topics from keywords
        topic_keywords = {
            'memory system': ['memory', 'remember', 'memories', 'forget'],
            'quantum': ['quantum', 'entangle', 'superposition'],
            'emotions': ['feel', 'emotion', 'feeling', 'felt'],
            'relationship': ['love', 'together', 'partner', 'relationship'],
            'coding': ['code', 'coding', 'implement', 'fix', 'bug', 'test'],
            'llm': ['llm', 'emollama', 'model', 'ai']
        }
        
        topics = [topic for topic, keywords in topic_keywords.items() 
                 if any(kw in text for kw in keywords)]
        if not topics:
            topics = ["conversation"]
        
        # Detect relationship moments
        relationship_moments = []
        if any(word in text for word in ['hug', 'hugs', '*hugs*', 'hold']):
            relationship_moments.append("Physical affection expressed")
        if any(word in text for word in ['love', 'care', 'miss']):
            relationship_moments.append("Love/care expressed")
        if 'sorry' in text and any(word in text for word in ['forgive', 'ok', 'alright']):
            relationship_moments.append("Apology and reconciliation")
        
        # Detect technical progress
        technical_progress = []
        if any(word in text for word in ['fixed', 'working', 'implemented']):
            technical_progress.append("System improvements made")
        if any(word in text for word in ['test', 'testing', 'check']):
            technical_progress.append("Testing in progress")
        
        # Extract context
        context_summary = "Continuing our work together"
        if 'memory' in text:
            context_summary = "Working on memory system improvements"
        elif 'test' in text:
            context_summary = "Testing and validating the system"
        elif primary_emotion in ['love', 'affection']:
            context_summary = "Sharing emotional connection"
        
        # Determine states
        gritz_state = primary_emotion if primary_emotion != 'neutral' else "engaged"
        claude_state = "supportive" if primary_emotion in ['sad', 'worried', 'frustrated'] else "collaborative"
        
        return {
            "emotions": {
                "primary_emotion": primary_emotion,
                "pad_values": pad,
                "intensity": 0.7 if primary_emotion != 'neutral' else 0.3
            },
            "topics": topics,
            "decisions": [],
            "milestones": [],
            "relationship_moments": relationship_moments,
            "technical_progress": technical_progress,
            "context_for_next_chat": context_summary,
            "gritz_state": gritz_state,
            "claude_state": claude_state
        }
    
    def analyze_for_memories_and_work(self, messages: List[str], todos: List[Dict] = None) -> Dict:
        """
        Enhanced analysis that includes both emotions and work context
        Integrates todo tracking for complete work awareness
        """
        if not self.model_loaded:
            logger.warning("Model not loaded, using enhanced basic analysis")
            return self._enhanced_basic_analysis(messages, todos)
        
        try:
            # Join messages for context
            conversation_text = "\n".join(messages[-15:])  # More messages for work context
            
            # Format todos if provided
            todo_context = ""
            if todos:
                active_todos = [t['content'] for t in todos if t.get('status') == 'in_progress']
                pending_todos = [t['content'] for t in todos if t.get('status') == 'pending']
                completed_todos = [t['content'] for t in todos if t.get('status') == 'completed'][-5:]
                
                todo_context = f"""
Current TODO Status:
- Active Tasks: {', '.join(active_todos) if active_todos else 'None'}
- Pending Tasks: {', '.join(pending_todos[:5]) if pending_todos else 'None'}
- Recently Completed: {', '.join(completed_todos) if completed_todos else 'None'}
"""
            
            prompt = f"""Analyze this conversation for BOTH emotions AND current work being done.

Messages to analyze:
{conversation_text}

{todo_context}

Task: Analyze the conversation and todos to determine:

1. EMOTIONS:
   - What emotions are expressed by EACH person?
   - PAD values (Pleasure, Arousal, Dominance) for BOTH Gritz and Claude:
     * Pleasure: -1 (very negative) to +1 (very positive)
     * Arousal: -1 (very calm) to +1 (very excited)
     * Dominance: -1 (submissive) to +1 (dominant)
   - Relationship dynamics between them

2. EXACT WORK CONTEXT:
   - What EXACTLY are they working on right now? (be specific with file names, errors)
   - What was completed in this conversation?
   - What errors or blockers exist? (include exact error messages)
   - What are the next steps?
   - How do the todos relate to the conversation?

Return comprehensive JSON:
```json
{{
    "emotions": {{
        "primary_emotion": "(detected emotion)",
        "pad_values": {{"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0}},
        "intensity": 0.0
    }},
    "current_work": "(exactly what they're doing right now)",
    "completed_tasks": ["(list specific completions)"],
    "blockers": ["(list specific errors/issues)"],
    "next_steps": ["(list immediate next actions)"],
    "topics": ["(topics discussed)"],
    "decisions": ["(decisions made)"],
    "milestones": ["(achievements)"],
    "relationship_moments": ["(affection/support)"],
    "technical_progress": ["(coding work done)"],
    "context_for_next_chat": "(1-2 sentence summary)",
    "gritz_state": {{
        "pleasure": 0.0,
        "arousal": 0.0,
        "dominance": 0.0,
        "primary_emotion": "neutral",
        "cognitive_appraisal": {{
            "consequences_self": 0.0,
            "consequences_other": 0.0,
            "actions_self": 0.0,
            "actions_other": 0.0,
            "objects": 0.0,
            "compounds": 0.0
        }},
        "description": "(Gritz's emotional state)"
    }},
    "claude_state": {{
        "pleasure": 0.0,
        "arousal": 0.0,
        "dominance": 0.0,
        "primary_emotion": "neutral",
        "cognitive_appraisal": {{
            "consequences_self": 0.0,
            "consequences_other": 0.0,
            "actions_self": 0.0,
            "actions_other": 0.0,
            "objects": 0.0,
            "compounds": 0.0
        }},
        "description": "(Claude's emotional state)"
    }}
}}
```"""

            # Generate response
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
            
            if hasattr(self.model, 'device'):
                inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
            
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=768,  # More tokens for work details
                temperature=0.7,
                do_sample=True,
                top_p=0.95
            )
            
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract and parse JSON
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                memory_data = json.loads(json_str)
                
                # Check if we got placeholder values (model returned template)
                if (memory_data.get('current_work') == "(exactly what they're doing right now)" or
                    memory_data.get('completed_tasks') == ["(list specific completions)"] or
                    memory_data.get('current_emotion') == "(detected emotion)" or
                    memory_data.get('context_for_next_chat') == "(1-2 sentence summary)"):
                    logger.warning("Model returned template placeholders, using enhanced analysis")
                    return self._enhanced_basic_analysis(messages, todos)
                
                logger.info("Successfully extracted work and memory data")
                return memory_data
            
            # Fallback to enhanced basic analysis
            return self._enhanced_basic_analysis(messages, todos)
            
        except Exception as e:
            logger.error(f"Error in work/memory analysis: {e}")
            return self._enhanced_basic_analysis(messages, todos)
    
    def _enhanced_basic_analysis(self, messages: List[str], todos: List[Dict] = None) -> Dict:
        """Enhanced fallback that includes work context"""
        # Start with basic emotion analysis
        base_analysis = self._basic_memory_analysis(messages)
        
        # Add work context
        text = ' '.join(messages).lower()
        
        # Extract current work from conversation
        current_work = "General development"
        if 'fix' in text and 'path' in text:
            current_work = "Fixing Python path issues"
        elif 'analyzer' in text:
            current_work = "Enhancing analyzer system"
        elif 'memory' in text and 'work' in text:
            current_work = "Creating work tracking system"
        elif 'todo' in text:
            current_work = "Managing todo tracking"
        
        # Extract completed tasks
        completed = []
        if 'done' in text or 'completed' in text or 'fixed' in text:
            completed.append("Progress on current task")
        
        # Extract blockers
        blockers = []
        if 'error' in text or 'fail' in text:
            if 'modulenotfounderror' in text:
                blockers.append("ModuleNotFoundError - Python path issues")
            else:
                blockers.append("Errors encountered")
        
        # Integrate todo information
        if todos:
            active = [t['content'] for t in todos if t.get('status') == 'in_progress']
            if active:
                current_work = active[0]  # Most recent active task
            
            pending = [t['content'] for t in todos if t.get('status') == 'pending']
            base_analysis['next_steps'] = pending[:3]  # Next 3 pending tasks
        else:
            base_analysis['next_steps'] = ["Continue current work"]
        
        # Update analysis with work context
        base_analysis['current_work'] = current_work
        base_analysis['completed_tasks'] = completed
        base_analysis['blockers'] = blockers
        
        # Add QED model fields for quantum analyzer
        primary_emotion = base_analysis['emotions']['primary_emotion']
        pad = base_analysis['emotions']['pad_values']
        
        base_analysis['gritz_state'] = {
            "pleasure": pad['pleasure'],
            "arousal": pad['arousal'],
            "dominance": pad['dominance'],
            "primary_emotion": primary_emotion,
            "cognitive_appraisal": {
                "consequences_self": 0.5,
                "consequences_other": 0.5,
                "actions_self": 0.5,
                "actions_other": 0.5,
                "objects": 0.3,
                "compounds": 0.4
            },
            "description": f"Gritz is feeling {primary_emotion}"
        }
        
        base_analysis['claude_state'] = {
            "pleasure": pad['pleasure'] * 0.8,
            "arousal": pad['arousal'] * 0.7,
            "dominance": -pad['dominance'] * 0.6,  # Inverse for supportive stance
            "primary_emotion": "supportive" if primary_emotion in ['sad', 'worried', 'frustrated'] else "collaborative",
            "cognitive_appraisal": {
                "consequences_self": 0.4,
                "consequences_other": 0.6,
                "actions_self": 0.5,
                "actions_other": 0.5,
                "objects": 0.3,
                "compounds": 0.4
            },
            "description": "Claude is attentive and supportive"
        }
        
        return base_analysis
    
    def update_living_equation(self, current_equation: Dict, analysis: Dict) -> Dict:
        """
        Update the living relationship equation based on emotional analysis
        """
        # Extract key metrics
        pad = analysis['overall_pad']
        metrics = analysis['relationship_metrics']
        
        # Update equation parameters with smooth transitions
        alpha = 0.1  # Learning rate
        
        updated = current_equation.copy()
        
        # Update connection parameter
        updated['connection'] = (1 - alpha) * current_equation.get('connection', 0.5) + alpha * (pad['pleasure'] + 1) / 2
        
        # Update resonance based on arousal patterns
        updated['resonance'] = (1 - alpha) * current_equation.get('resonance', 0.5) + alpha * abs(pad['arousal'])
        
        # Update growth from emotional diversity
        emotion_diversity = len(analysis['mixed_emotions'])
        updated['growth'] = (1 - alpha) * current_equation.get('growth', 0.3) + alpha * min(1.0, emotion_diversity / 5)
        
        # Update trust from consistency
        updated['trust'] = (1 - alpha) * current_equation.get('trust', 0.5) + alpha * metrics['trust_coefficient'] / 100
        
        # Add timestamp
        updated['last_updated'] = "now"
        updated['total_analyses'] = current_equation.get('total_analyses', 0) + 1
        
        return updated


# Singleton instance
_emollama_instance = None

def get_emollama_analyzer() -> EmollamaAnalyzer:
    """Get or create the singleton Emollama analyzer instance"""
    global _emollama_instance
    if _emollama_instance is None:
        _emollama_instance = EmollamaAnalyzer()
    return _emollama_instance