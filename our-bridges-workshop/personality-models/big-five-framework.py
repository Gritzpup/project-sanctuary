#!/usr/bin/env python3
"""
Big Five Personality Framework for AI Behavioral Development
Using established personality psychology for measurable AI individuality
"""

import json
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Tuple
from datetime import datetime

@dataclass
class PersonalityProfile:
    """Big Five personality traits with behavioral implications"""
    openness: float  # 0.0 - 1.0
    conscientiousness: float
    extraversion: float
    agreeableness: float
    neuroticism: float
    
    def __post_init__(self):
        # Ensure all values are in valid range
        for field in ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']:
            value = getattr(self, field)
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{field} must be between 0.0 and 1.0, got {value}")

class PersonalityBasedBehavior:
    """Generate behavioral patterns based on Big Five personality traits"""
    
    def __init__(self, personality: PersonalityProfile, entity_name: str):
        self.personality = personality
        self.entity_name = entity_name
        self.behavioral_history = []
        
    def generate_response_style(self, prompt_type: str) -> Dict[str, float]:
        """Generate response characteristics based on personality"""
        
        base_style = {
            'formality': 0.5,
            'verbosity': 0.5,
            'creativity': 0.5,
            'directness': 0.5,
            'emotional_expression': 0.5
        }
        
        # Openness influences creativity and intellectual curiosity
        base_style['creativity'] = self.personality.openness
        
        # Conscientiousness affects formality and structure
        base_style['formality'] = self.personality.conscientiousness
        
        # Extraversion influences verbosity and emotional expression
        base_style['verbosity'] = self.personality.extraversion * 0.8 + 0.2
        base_style['emotional_expression'] = self.personality.extraversion
        
        # Agreeableness affects directness (inverse relationship)
        base_style['directness'] = 1.0 - self.personality.agreeableness
        
        # Add slight random variation (±10%) for naturalistic behavior
        for key in base_style:
            variation = np.random.normal(0, 0.1)
            base_style[key] = np.clip(base_style[key] + variation, 0.0, 1.0)
            
        return base_style
    
    def decision_making_approach(self, decision_context: str) -> Dict[str, str]:
        """Determine decision-making style based on personality"""
        
        if self.personality.conscientiousness > 0.7:
            primary_approach = "systematic_analysis"
        elif self.personality.openness > 0.7:
            primary_approach = "creative_exploration"
        elif self.personality.extraversion > 0.7:
            primary_approach = "collaborative_input"
        else:
            primary_approach = "cautious_evaluation"
            
        return {
            'primary_approach': primary_approach,
            'consideration_time': "long" if self.personality.conscientiousness > 0.6 else "moderate",
            'risk_tolerance': "high" if self.personality.openness > 0.6 else "moderate",
            'confidence_level': "high" if self.personality.neuroticism < 0.4 else "moderate"
        }
    
    def learning_preferences(self) -> Dict[str, str]:
        """Determine learning style based on personality"""
        preferences = {}
        
        if self.personality.openness > 0.6:
            preferences['information_seeking'] = "broad_exploration"
        else:
            preferences['information_seeking'] = "focused_depth"
            
        if self.personality.conscientiousness > 0.6:
            preferences['practice_style'] = "structured_repetition"
        else:
            preferences['practice_style'] = "flexible_experimentation"
            
        if self.personality.extraversion > 0.6:
            preferences['feedback_style'] = "interactive_discussion"
        else:
            preferences['feedback_style'] = "reflective_analysis"
            
        return preferences
    
    def communication_patterns(self) -> Dict[str, str]:
        """Define communication style based on personality"""
        patterns = {}
        
        # Extraversion affects communication frequency and style
        if self.personality.extraversion > 0.6:
            patterns['frequency'] = "high"
            patterns['style'] = "expressive"
        else:
            patterns['frequency'] = "moderate"
            patterns['style'] = "reserved"
            
        # Agreeableness affects conflict approach
        if self.personality.agreeableness > 0.6:
            patterns['conflict_style'] = "collaborative"
        else:
            patterns['conflict_style'] = "direct"
            
        # Conscientiousness affects communication structure
        if self.personality.conscientiousness > 0.6:
            patterns['organization'] = "structured"
        else:
            patterns['organization'] = "flexible"
            
        return patterns

# Pre-defined personality profiles for research entities
RESEARCH_PERSONALITIES = {
    'analytical_researcher': PersonalityProfile(
        openness=0.85,  # High intellectual curiosity
        conscientiousness=0.90,  # Very systematic and organized
        extraversion=0.40,  # Moderately introverted, focused
        agreeableness=0.70,  # Collaborative but direct when needed
        neuroticism=0.20  # Emotionally stable
    ),
    'creative_collaborator': PersonalityProfile(
        openness=0.95,  # Extremely creative and open to new ideas
        conscientiousness=0.60,  # Organized but flexible
        extraversion=0.80,  # Outgoing and expressive
        agreeableness=0.85,  # Highly cooperative
        neuroticism=0.30  # Generally stable with some emotional expression
    ),
    'systematic_validator': PersonalityProfile(
        openness=0.50,  # Moderate openness, prefers proven methods
        conscientiousness=0.95,  # Extremely thorough and systematic
        extraversion=0.30,  # Introverted, focused on details
        agreeableness=0.60,  # Professional but can be critical
        neuroticism=0.15  # Very emotionally stable
    ),
    'adaptive_communicator': PersonalityProfile(
        openness=0.75,  # Open to new approaches
        conscientiousness=0.70,  # Well-organized
        extraversion=0.90,  # Very social and communicative
        agreeableness=0.80,  # Highly agreeable and supportive
        neuroticism=0.25  # Stable with good emotional awareness
    )
}

def create_entity_personality(entity_name: str, base_personality: str = 'analytical_researcher') -> PersonalityBasedBehavior:
    """Create a personality-based behavior system for an AI entity"""
    
    if base_personality not in RESEARCH_PERSONALITIES:
        raise ValueError(f"Unknown personality type: {base_personality}")
        
    personality = RESEARCH_PERSONALITIES[base_personality]
    return PersonalityBasedBehavior(personality, entity_name)

def measure_personality_consistency(entity: PersonalityBasedBehavior, num_samples: int = 10) -> Dict[str, float]:
    """Measure how consistently an entity expresses its personality traits"""
    
    samples = []
    for _ in range(num_samples):
        style = entity.generate_response_style("general_query")
        samples.append(style)
    
    # Calculate coefficient of variation for each trait
    consistency_scores = {}
    for trait in samples[0].keys():
        values = [sample[trait] for sample in samples]
        mean_val = np.mean(values)
        std_val = np.std(values)
        consistency_scores[trait] = 1.0 - (std_val / mean_val) if mean_val > 0 else 0.0
    
    return consistency_scores

def save_personality_profile(entity: PersonalityBasedBehavior, filepath: str):
    """Save personality profile and behavioral patterns to file"""
    
    profile_data = {
        'entity_name': entity.entity_name,
        'personality_traits': {
            'openness': entity.personality.openness,
            'conscientiousness': entity.personality.conscientiousness,
            'extraversion': entity.personality.extraversion,
            'agreeableness': entity.personality.agreeableness,
            'neuroticism': entity.personality.neuroticism
        },
        'behavioral_patterns': {
            'decision_making': entity.decision_making_approach("general"),
            'learning_preferences': entity.learning_preferences(),
            'communication_patterns': entity.communication_patterns()
        },
        'consistency_metrics': measure_personality_consistency(entity),
        'timestamp': datetime.now().isoformat()
    }
    
    with open(filepath, 'w') as f:
        json.dump(profile_data, f, indent=2)

if __name__ == "__main__":
    # Example usage: Create and test personality-based AI entities
    
    # Create different personality types
    entities = {
        'nova': create_entity_personality('nova', 'analytical_researcher'),
        'echo': create_entity_personality('echo', 'creative_collaborator'),
        'lumin': create_entity_personality('lumin', 'systematic_validator'),
        'kael': create_entity_personality('kael', 'adaptive_communicator')
    }
    
    # Test personality consistency
    for name, entity in entities.items():
        print(f"\n{name.upper()} Personality Profile:")
        print(f"Response Style: {entity.generate_response_style('research_query')}")
        print(f"Decision Making: {entity.decision_making_approach('research_decision')}")
        print(f"Learning Preferences: {entity.learning_preferences()}")
        print(f"Communication: {entity.communication_patterns()}")
        
        # Save profile
        save_personality_profile(entity, f"{name}_personality_profile.json")