"""
Quantum Emotional Dynamics (QED) Model
Combines PAD dimensions with OCC cognitive appraisals for enhanced emotional representation
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Any
import logging
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class AppraisalCategory(Enum):
    """OCC-based cognitive appraisal categories"""
    CONSEQUENCES_SELF = "consequences_self"
    CONSEQUENCES_OTHER = "consequences_other"
    ACTIONS_SELF = "actions_self"
    ACTIONS_OTHER = "actions_other"
    OBJECTS = "objects"
    COMPOUNDS = "compounds"


@dataclass
class EmotionalState:
    """Complete emotional state with PAD and cognitive components"""
    # PAD dimensions (continuous)
    pleasure: float  # Valence [-1, 1]
    arousal: float   # Activation [-1, 1]
    dominance: float # Control [-1, 1]
    
    # Cognitive appraisals
    primary_emotion: str
    secondary_emotions: List[str]
    appraisal_weights: Dict[AppraisalCategory, float]
    
    # Quantum properties
    coherence: float = 1.0
    entanglement: float = 0.0
    
    # Metadata
    timestamp: Optional[float] = None
    context: Optional[Dict[str, Any]] = None


class QuantumEmotionalDynamics:
    """
    Enhanced emotional model combining dimensional (PAD) and categorical (OCC) approaches
    Optimized for quantum representation and our memory system
    """
    
    def __init__(self):
        # Initialize emotion prototypes from psychological research
        self._init_emotion_prototypes()
        
        # OCC cognitive appraisal structure
        self.appraisal_structure = {
            AppraisalCategory.CONSEQUENCES_SELF: ['joy', 'distress', 'hope', 'fear'],
            AppraisalCategory.CONSEQUENCES_OTHER: ['happy-for', 'sorry-for', 'resentment', 'gloating'],
            AppraisalCategory.ACTIONS_SELF: ['pride', 'shame', 'guilt', 'remorse'],
            AppraisalCategory.ACTIONS_OTHER: ['admiration', 'reproach', 'gratitude', 'anger'],
            AppraisalCategory.OBJECTS: ['love', 'hate', 'liking', 'disliking'],
            AppraisalCategory.COMPOUNDS: ['relief', 'disappointment', 'grief', 'joy-relief']
        }
        
        # Quantum encoding parameters
        self.n_qubits = 27  # Compatible with existing system
        self.pad_qubits = 18  # 6 qubits per dimension
        self.cognitive_qubits = 9  # For appraisal encoding
        
        logger.info("Quantum Emotional Dynamics initialized")
        
    def _init_emotion_prototypes(self):
        """Initialize emotion prototypes in PAD space from research"""
        self.emotion_prototypes = {
            # Positive emotions
            'joy': [0.81, 0.51, 0.46],
            'excitement': [0.75, 0.89, 0.52],
            'contentment': [0.87, -0.15, 0.18],
            'pride': [0.63, 0.09, 0.71],
            'admiration': [0.52, 0.30, -0.19],
            'love': [0.90, 0.54, 0.20],
            'gratitude': [0.64, 0.16, -0.29],
            'hope': [0.51, 0.23, 0.14],
            'relief': [0.61, -0.15, 0.24],
            'liking': [0.45, 0.10, 0.15],
            'happy-for': [0.64, 0.25, 0.00],
            
            # Negative emotions
            'anger': [-0.43, 0.67, 0.34],
            'fear': [-0.64, 0.60, -0.43],
            'disgust': [-0.60, 0.35, 0.11],
            'contempt': [-0.55, 0.10, 0.44],
            'sadness': [-0.63, -0.27, -0.33],
            'distress': [-0.61, 0.28, -0.36],
            'shame': [-0.29, 0.05, -0.61],
            'guilt': [-0.37, 0.12, -0.44],
            'remorse': [-0.41, 0.00, -0.37],
            'disappointment': [-0.49, -0.10, -0.36],
            'sorry-for': [-0.45, 0.15, -0.18],
            'resentment': [-0.35, 0.29, 0.05],
            'gloating': [0.32, 0.24, 0.28],
            'reproach': [-0.30, 0.11, 0.27],
            'hate': [-0.60, 0.35, 0.25],
            'disliking': [-0.40, 0.18, 0.10],
            'grief': [-0.63, -0.00, -0.40],
            
            # Complex/neutral emotions  
            'surprise': [0.16, 0.85, -0.29],
            'curiosity': [0.22, 0.62, 0.00],
            'boredom': [-0.65, -0.62, -0.33],
            'frustration': [-0.47, 0.52, -0.06],
            'nostalgia': [0.10, -0.10, -0.10],
            'melancholy': [-0.25, -0.05, -0.20],
            'anticipation': [0.21, 0.61, 0.15],
            'neutral': [0.00, 0.00, 0.00]
        }
        
    def analyze_emotional_state(self, text: str, context: Dict[str, Any]) -> EmotionalState:
        """
        Analyze text to extract emotional state using QED model
        
        Args:
            text: Text to analyze
            context: Contextual information (speaker, situation, history)
            
        Returns:
            Complete emotional state with PAD and cognitive components
        """
        # This would integrate with emollama but returns enhanced format
        # For now, return example structure
        pad_values = self._extract_pad_from_text(text, context)
        cognitive_analysis = self._cognitive_appraisal(text, context, pad_values)
        
        return EmotionalState(
            pleasure=pad_values[0],
            arousal=pad_values[1],
            dominance=pad_values[2],
            primary_emotion=cognitive_analysis['primary'],
            secondary_emotions=cognitive_analysis['secondary'],
            appraisal_weights=cognitive_analysis['weights'],
            context=context
        )
        
    def _extract_pad_from_text(self, text: str, context: Dict[str, Any]) -> List[float]:
        """Extract PAD values from text (placeholder for emollama integration)"""
        # This would call emollama with enhanced prompts
        # For now, return example values
        return [0.0, 0.0, 0.0]
        
    def _cognitive_appraisal(self, text: str, context: Dict[str, Any], 
                            pad_values: List[float]) -> Dict[str, Any]:
        """Perform cognitive appraisal based on OCC model"""
        # Find closest emotion prototypes
        distances = {}
        for emotion, prototype in self.emotion_prototypes.items():
            dist = np.linalg.norm(np.array(pad_values) - np.array(prototype))
            distances[emotion] = dist
            
        # Get top emotions
        sorted_emotions = sorted(distances.items(), key=lambda x: x[1])
        primary = sorted_emotions[0][0]
        secondary = [e[0] for e in sorted_emotions[1:4]]
        
        # Calculate appraisal weights
        weights = {}
        for category in AppraisalCategory:
            category_emotions = self.appraisal_structure[category]
            weight = 0.0
            for emotion, distance in sorted_emotions[:5]:
                if emotion in category_emotions:
                    weight += 1.0 / (1.0 + distance)
            weights[category] = weight
            
        return {
            'primary': primary,
            'secondary': secondary,
            'weights': weights
        }
        
    def encode_to_quantum_state(self, emotional_state: EmotionalState) -> np.ndarray:
        """
        Encode emotional state into quantum representation
        
        Args:
            emotional_state: Complete emotional state
            
        Returns:
            Quantum state amplitudes (2^27 complex values)
        """
        # Initialize quantum state
        n_states = 2**self.n_qubits
        amplitudes = np.zeros(n_states, dtype=complex)
        
        # Encode PAD dimensions (first 18 qubits)
        pad_encoding = self._encode_pad_continuous(emotional_state)
        
        # Encode cognitive appraisals (last 9 qubits)
        cognitive_encoding = self._encode_cognitive_discrete(emotional_state)
        
        # Combine encodings with entanglement
        for i in range(n_states):
            # Extract qubit states
            pad_bits = i & ((1 << self.pad_qubits) - 1)
            cognitive_bits = (i >> self.pad_qubits) & ((1 << self.cognitive_qubits) - 1)
            
            # Calculate amplitude based on both encodings
            pad_amp = pad_encoding[pad_bits % len(pad_encoding)]
            cognitive_amp = cognitive_encoding[cognitive_bits % len(cognitive_encoding)]
            
            # Combine with interference term
            amplitudes[i] = pad_amp * cognitive_amp * np.exp(1j * np.pi * i / n_states)
            
        # Normalize
        norm = np.sqrt(np.sum(np.abs(amplitudes)**2))
        if norm > 0:
            amplitudes /= norm
            
        return amplitudes
        
    def _encode_pad_continuous(self, emotional_state: EmotionalState) -> np.ndarray:
        """Encode PAD values into continuous quantum representation"""
        # Map PAD values to quantum amplitudes
        p_normalized = (emotional_state.pleasure + 1) / 2
        a_normalized = (emotional_state.arousal + 1) / 2  
        d_normalized = (emotional_state.dominance + 1) / 2
        
        # Create amplitude distribution
        n_pad_states = 2**self.pad_qubits
        pad_amplitudes = np.zeros(n_pad_states, dtype=complex)
        
        for i in range(n_pad_states):
            # Use Gaussian-like distribution centered on PAD values
            p_component = np.exp(-((i % 64) / 64 - p_normalized)**2 / 0.1)
            a_component = np.exp(-(((i // 64) % 64) / 64 - a_normalized)**2 / 0.1)
            d_component = np.exp(-((i // 4096) / 64 - d_normalized)**2 / 0.1)
            
            pad_amplitudes[i] = np.sqrt(p_component * a_component * d_component)
            
        # Normalize
        norm = np.sqrt(np.sum(np.abs(pad_amplitudes)**2))
        if norm > 0:
            pad_amplitudes /= norm
            
        return pad_amplitudes
        
    def _encode_cognitive_discrete(self, emotional_state: EmotionalState) -> np.ndarray:
        """Encode cognitive appraisals into discrete quantum states"""
        n_cognitive_states = 2**self.cognitive_qubits
        cognitive_amplitudes = np.zeros(n_cognitive_states, dtype=complex)
        
        # Map appraisal categories to qubit ranges
        qubits_per_category = self.cognitive_qubits // len(AppraisalCategory)
        
        for i in range(n_cognitive_states):
            amplitude = 1.0
            
            # Calculate contribution from each category
            for idx, category in enumerate(AppraisalCategory):
                category_bits = (i >> (idx * qubits_per_category)) & ((1 << qubits_per_category) - 1)
                weight = emotional_state.appraisal_weights.get(category, 0.0)
                
                # Higher weight = higher amplitude for "active" states
                if category_bits > (1 << (qubits_per_category - 1)):
                    amplitude *= np.sqrt(weight)
                else:
                    amplitude *= np.sqrt(1 - weight)
                    
            cognitive_amplitudes[i] = amplitude
            
        # Normalize
        norm = np.sqrt(np.sum(np.abs(cognitive_amplitudes)**2))
        if norm > 0:
            cognitive_amplitudes /= norm
            
        return cognitive_amplitudes
        
    def create_mixed_emotional_state(self, states: List[Tuple[EmotionalState, float]]) -> np.ndarray:
        """
        Create quantum superposition of multiple emotional states
        
        Args:
            states: List of (emotional_state, weight) tuples
            
        Returns:
            Superposed quantum state
        """
        # Normalize weights
        weights = np.array([w for _, w in states])
        weights = weights / np.sum(weights)
        
        # Encode each state
        quantum_states = []
        for state, _ in states:
            quantum_states.append(self.encode_to_quantum_state(state))
            
        # Create superposition with proper Born rule amplitudes
        superposed = np.zeros_like(quantum_states[0])
        for state, weight in zip(quantum_states, weights):
            superposed += np.sqrt(weight) * state
            
        # Normalize final state
        norm = np.sqrt(np.sum(np.abs(superposed)**2))
        if norm > 0:
            superposed /= norm
            
        return superposed
        
    def measure_emotional_coherence(self, quantum_state: np.ndarray) -> float:
        """
        Measure emotional coherence from quantum state
        
        Higher coherence = more definite emotional state
        Lower coherence = mixed/uncertain emotions
        """
        # Calculate off-diagonal sum (coherence measure)
        n = int(np.sqrt(len(quantum_state)))
        if n * n != len(quantum_state):
            # Not a perfect square, use l1-norm instead
            return np.sum(np.abs(quantum_state)) - 1.0
            
        # Reshape to density matrix
        rho = np.outer(quantum_state, np.conj(quantum_state))
        
        # Calculate coherence as normalized off-diagonal sum
        diagonal_sum = np.sum(np.abs(np.diag(rho)))
        total_sum = np.sum(np.abs(rho))
        
        if total_sum > 0:
            coherence = (total_sum - diagonal_sum) / total_sum
        else:
            coherence = 0.0
            
        return coherence
        
    def evolve_emotional_state(self, current_state: np.ndarray, 
                              influence: EmotionalState,
                              coupling_strength: float = 0.1) -> np.ndarray:
        """
        Evolve current emotional state based on new influence
        
        Args:
            current_state: Current quantum emotional state
            influence: New emotional influence
            coupling_strength: How strongly the influence affects current state
            
        Returns:
            Evolved quantum state
        """
        # Encode influence
        influence_state = self.encode_to_quantum_state(influence)
        
        # Create interaction Hamiltonian
        # H = (1 - coupling) * |current><current| + coupling * |influence><influence|
        # Plus interference terms
        
        evolved = np.zeros_like(current_state)
        
        # Direct contribution
        evolved += np.sqrt(1 - coupling_strength) * current_state
        evolved += np.sqrt(coupling_strength) * influence_state
        
        # Interference term (creates emotional blending)
        overlap = np.vdot(current_state, influence_state)
        evolved += 0.1 * overlap * (current_state + influence_state)
        
        # Normalize
        norm = np.sqrt(np.sum(np.abs(evolved)**2))
        if norm > 0:
            evolved /= norm
            
        return evolved
        
    def extract_pad_from_quantum(self, quantum_state: np.ndarray) -> Tuple[float, float, float]:
        """
        Extract PAD values from quantum state
        
        Returns:
            (pleasure, arousal, dominance) values
        """
        # Calculate expectation values for PAD observables
        n_states = len(quantum_state)
        probabilities = np.abs(quantum_state)**2
        
        pleasure_sum = 0.0
        arousal_sum = 0.0
        dominance_sum = 0.0
        
        for i in range(n_states):
            if probabilities[i] < 1e-10:
                continue
                
            # Extract PAD bits
            pad_bits = i & ((1 << self.pad_qubits) - 1)
            
            # Map to PAD values
            p_bits = pad_bits & 0x3F  # 6 bits
            a_bits = (pad_bits >> 6) & 0x3F  # 6 bits
            d_bits = (pad_bits >> 12) & 0x3F  # 6 bits
            
            # Convert to [-1, 1] range
            p_value = 2 * (p_bits / 63.0) - 1
            a_value = 2 * (a_bits / 63.0) - 1
            d_value = 2 * (d_bits / 63.0) - 1
            
            # Weighted sum
            pleasure_sum += p_value * probabilities[i]
            arousal_sum += a_value * probabilities[i]
            dominance_sum += d_value * probabilities[i]
            
        return (pleasure_sum, arousal_sum, dominance_sum)
        
    def get_emotion_distribution(self, quantum_state: np.ndarray, 
                                threshold: float = 0.1) -> Dict[str, float]:
        """
        Get probability distribution over emotion categories
        
        Args:
            quantum_state: Quantum emotional state
            threshold: Minimum probability to include emotion
            
        Returns:
            Dict mapping emotion names to probabilities
        """
        # Extract PAD values
        pad_values = self.extract_pad_from_quantum(quantum_state)
        
        # Calculate distances to all prototypes
        emotion_probs = {}
        total_weight = 0.0
        
        for emotion, prototype in self.emotion_prototypes.items():
            # Calculate similarity (inverse distance)
            distance = np.linalg.norm(np.array(pad_values) - np.array(prototype))
            similarity = np.exp(-distance**2 / 0.5)  # Gaussian kernel
            
            if similarity > threshold:
                emotion_probs[emotion] = similarity
                total_weight += similarity
                
        # Normalize to probabilities
        if total_weight > 0:
            for emotion in emotion_probs:
                emotion_probs[emotion] /= total_weight
                
        return emotion_probs


# Integration with existing emollama
def create_enhanced_prompt(text: str, context: Dict[str, Any]) -> str:
    """
    Create enhanced prompt for emollama that extracts both PAD and cognitive components
    """
    prompt = f"""Analyze the emotional content of this message considering both dimensional (PAD) and cognitive aspects.

Message: "{text}"
Speaker: {context.get('speaker', 'Unknown')}
Context: {context.get('situation', 'General conversation')}

Provide emotional analysis in this exact JSON format:
{{
    "gritz_state": {{
        "pleasure": 0.0,
        "arousal": 0.0,
        "dominance": 0.0,
        "primary_emotion": "emotion_name",
        "cognitive_appraisal": {{
            "consequences_self": 0.0,
            "consequences_other": 0.0,
            "actions_self": 0.0,
            "actions_other": 0.0,
            "objects": 0.0,
            "compounds": 0.0
        }},
        "description": "Brief description"
    }},
    "claude_state": {{
        "pleasure": 0.0,
        "arousal": 0.0, 
        "dominance": 0.0,
        "primary_emotion": "emotion_name",
        "cognitive_appraisal": {{
            "consequences_self": 0.0,
            "consequences_other": 0.0,
            "actions_self": 0.0,
            "actions_other": 0.0,
            "objects": 0.0,
            "compounds": 0.0
        }},
        "description": "Brief description"
    }}
}}

Consider:
- Pleasure: hedonic tone, valence (-1 very negative to +1 very positive)
- Arousal: activation level (-1 very calm to +1 very excited)
- Dominance: sense of control (-1 submissive to +1 dominant)
- Cognitive appraisals: relevance of each category (0.0 to 1.0)
- Primary emotion should be the closest match from standard emotions"""
    
    return prompt