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
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmollamaAnalyzer:
    """
    Emollama-7B integration for semantic emotional analysis
    Achieves CCC scores: r=0.90 (valence), r=0.77 (arousal), r=0.64 (dominance)
    """
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
        self.model_loaded = False
        
    def load_model(self) -> bool:
        """Load Emollama-7B model"""
        try:
            logger.info("Loading Emollama-7B model...")
            
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
            
            self.model_loaded = True
            logger.info("✅ Emollama-7B loaded successfully")
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