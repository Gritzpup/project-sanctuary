#!/usr/bin/env python3
"""
Relationship Phase Detection and Tracking System
Based on social psychology research on relationship development
Tracks progression through natural relationship phases
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from enum import Enum, auto
from dataclasses import dataclass, field
import json
from pathlib import Path
import logging
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class RelationshipPhase(Enum):
    """
    Relationship phases based on Knapp's Relational Development Model
    and modern relationship psychology research
    """
    INITIATING = auto()      # First contact, greetings
    EXPERIMENTING = auto()   # Small talk, discovering commonalities  
    INTENSIFYING = auto()    # Deeper sharing, emotional connection
    INTEGRATING = auto()     # Shared identity, inside jokes
    BONDING = auto()         # Deep commitment, partnership
    # Also track potential negative phases
    DIFFERENTIATING = auto() # Re-establishing individual boundaries
    STAGNATING = auto()      # Communication breakdown
    AVOIDING = auto()        # Deliberate separation
    
    def __str__(self):
        return self.name.lower().replace('_', ' ').title()


@dataclass
class PhaseTransition:
    """Records a transition between relationship phases"""
    from_phase: RelationshipPhase
    to_phase: RelationshipPhase
    timestamp: datetime
    confidence: float
    trigger_events: List[str] = field(default_factory=list)
    markers_detected: Dict[str, float] = field(default_factory=dict)


@dataclass
class RelationshipMarker:
    """Behavioral/linguistic marker indicating a relationship phase"""
    marker_type: str
    content: str
    phase_indicators: Dict[RelationshipPhase, float]  # Phase -> strength
    timestamp: datetime
    context: Dict = field(default_factory=dict)


class RelationshipPhaseTracker:
    """
    Tracks and detects relationship phases based on interaction patterns,
    emotional depth, communication style, and behavioral markers
    """
    
    def __init__(self, initial_phase: RelationshipPhase = RelationshipPhase.INITIATING):
        """
        Initialize tracker with starting phase
        
        Args:
            initial_phase: Starting relationship phase
        """
        self.current_phase = initial_phase
        self.phase_history: List[PhaseTransition] = []
        self.markers: deque = deque(maxlen=1000)  # Keep last 1000 markers
        
        # Phase-specific counters and metrics
        self.phase_metrics = defaultdict(lambda: {
            'duration': timedelta(),
            'entry_count': 0,
            'interaction_count': 0,
            'emotional_depth': 0.0,
            'stability': 1.0
        })
        
        # Initialize behavioral markers for each phase
        self.phase_markers = self._initialize_phase_markers()
        
        # Transition probability matrix (from research)
        self.transition_probabilities = self._initialize_transition_matrix()
        
        # Load or initialize persistent state
        self.state_file = Path("relationship_phase_state.json")
        self._load_state()
        
        # Phase entry timestamp
        self.phase_entry_time = datetime.now()
    
    def analyze_interaction(self, speaker: str, content: str, 
                          emotional_state: Dict) -> Dict:
        """
        Analyze an interaction to detect phase markers and potential transitions
        
        Returns:
            Dict with current phase, detected markers, and transition probability
        """
        # Extract markers from the interaction
        detected_markers = self._extract_markers(content, emotional_state)
        
        # Store markers for history
        for marker in detected_markers:
            self.markers.append(marker)
        
        # Update phase metrics
        self._update_phase_metrics(detected_markers, emotional_state)
        
        # Check for phase transition
        transition_probability = self._calculate_transition_probability()
        
        # Perform transition if probability exceeds threshold
        new_phase = None
        if transition_probability['max_probability'] > 0.7:
            new_phase = transition_probability['most_likely_phase']
            if new_phase != self.current_phase:
                self._transition_to_phase(new_phase, detected_markers)
        
        # Prepare analysis result
        result = {
            'current_phase': str(self.current_phase),
            'phase_confidence': self._calculate_phase_confidence(),
            'detected_markers': [
                {
                    'type': m.marker_type,
                    'content': m.content,
                    'phase_affinity': max(m.phase_indicators.items(), 
                                        key=lambda x: x[1])
                }
                for m in detected_markers
            ],
            'transition_probability': transition_probability,
            'phase_duration': self._get_current_phase_duration(),
            'relationship_trajectory': self._analyze_trajectory()
        }
        
        # Save state after each interaction
        self._save_state()
        
        return result
    
    def _extract_markers(self, content: str, emotional_state: Dict) -> List[RelationshipMarker]:
        """
        Extract relationship markers from content and emotional state
        """
        markers = []
        content_lower = content.lower()
        
        # Check each predefined marker pattern
        for marker_def in self.phase_markers:
            if self._matches_marker(content_lower, marker_def):
                marker = RelationshipMarker(
                    marker_type=marker_def['type'],
                    content=content[:100],  # Store snippet
                    phase_indicators=marker_def['phase_weights'],
                    timestamp=datetime.now(),
                    context={'emotional_valence': emotional_state.get('valence', 0)}
                )
                markers.append(marker)
        
        # Analyze emotional depth as a marker
        emotional_depth = self._calculate_emotional_depth(emotional_state)
        if emotional_depth > 0.5:
            emotion_marker = RelationshipMarker(
                marker_type='emotional_depth',
                content=f"High emotional engagement: {emotional_depth:.2f}",
                phase_indicators={
                    RelationshipPhase.INTENSIFYING: emotional_depth * 0.6,
                    RelationshipPhase.INTEGRATING: emotional_depth * 0.8,
                    RelationshipPhase.BONDING: emotional_depth * 1.0
                },
                timestamp=datetime.now(),
                context=emotional_state
            )
            markers.append(emotion_marker)
        
        # Detect vulnerability/trust markers
        if self._contains_vulnerability_marker(content):
            trust_marker = RelationshipMarker(
                marker_type='vulnerability',
                content='Personal disclosure detected',
                phase_indicators={
                    RelationshipPhase.EXPERIMENTING: 0.3,
                    RelationshipPhase.INTENSIFYING: 0.8,
                    RelationshipPhase.INTEGRATING: 0.9
                },
                timestamp=datetime.now(),
                context={'trust_level': 'high'}
            )
            markers.append(trust_marker)
        
        return markers
    
    def _initialize_phase_markers(self) -> List[Dict]:
        """
        Initialize behavioral and linguistic markers for each phase
        Based on relationship psychology research
        """
        return [
            # Initiating phase markers
            {
                'type': 'greeting',
                'patterns': ['hello', 'hi', 'hey', 'nice to meet'],
                'phase_weights': {
                    RelationshipPhase.INITIATING: 0.9,
                    RelationshipPhase.EXPERIMENTING: 0.3
                }
            },
            # Experimenting phase markers
            {
                'type': 'small_talk',
                'patterns': ['how are you', "what's up", 'how was your', 'weather'],
                'phase_weights': {
                    RelationshipPhase.EXPERIMENTING: 0.8,
                    RelationshipPhase.INITIATING: 0.4
                }
            },
            {
                'type': 'interest_discovery',
                'patterns': ['i like', 'do you like', 'favorite', 'what do you think'],
                'phase_weights': {
                    RelationshipPhase.EXPERIMENTING: 0.7,
                    RelationshipPhase.INTENSIFYING: 0.5
                }
            },
            # Intensifying phase markers
            {
                'type': 'emotional_expression',
                'patterns': ['i feel', 'makes me', 'i love', 'i hate', 'excited', 'worried'],
                'phase_weights': {
                    RelationshipPhase.INTENSIFYING: 0.8,
                    RelationshipPhase.INTEGRATING: 0.6
                }
            },
            {
                'type': 'personal_disclosure',
                'patterns': ['to be honest', 'never told anyone', 'secret', 'confession'],
                'phase_weights': {
                    RelationshipPhase.INTENSIFYING: 0.9,
                    RelationshipPhase.INTEGRATING: 0.7,
                    RelationshipPhase.BONDING: 0.5
                }
            },
            # Integrating phase markers
            {
                'type': 'shared_identity',
                'patterns': ['we', 'us', 'our', 'together', 'both'],
                'phase_weights': {
                    RelationshipPhase.INTEGRATING: 0.8,
                    RelationshipPhase.BONDING: 0.9,
                    RelationshipPhase.INTENSIFYING: 0.4
                }
            },
            {
                'type': 'inside_reference',
                'patterns': ['remember when we', 'like we discussed', 'our joke', 'as always'],
                'phase_weights': {
                    RelationshipPhase.INTEGRATING: 0.9,
                    RelationshipPhase.BONDING: 0.8
                }
            },
            # Bonding phase markers
            {
                'type': 'commitment_language',
                'patterns': ['always', 'forever', 'promise', 'committed', 'partnership'],
                'phase_weights': {
                    RelationshipPhase.BONDING: 0.9,
                    RelationshipPhase.INTEGRATING: 0.5
                }
            },
            {
                'type': 'future_planning',
                'patterns': ['when we', 'we will', 'our future', 'planning to', 'someday we'],
                'phase_weights': {
                    RelationshipPhase.BONDING: 0.8,
                    RelationshipPhase.INTEGRATING: 0.6
                }
            },
            # Potential concern markers
            {
                'type': 'distancing_language',
                'patterns': ['i need space', 'different', 'not the same', 'used to'],
                'phase_weights': {
                    RelationshipPhase.DIFFERENTIATING: 0.8,
                    RelationshipPhase.STAGNATING: 0.6
                }
            }
        ]
    
    def _matches_marker(self, content: str, marker_def: Dict) -> bool:
        """Check if content matches any marker patterns"""
        return any(pattern in content for pattern in marker_def['patterns'])
    
    def _calculate_emotional_depth(self, emotional_state: Dict) -> float:
        """
        Calculate emotional depth from state
        Higher values indicate deeper emotional engagement
        """
        valence = abs(emotional_state.get('valence', 0))  # Intensity matters
        arousal = emotional_state.get('arousal', 0)
        complexity = emotional_state.get('mixed_emotions', False)
        
        depth = (valence * 0.4 + arousal * 0.3 + (0.3 if complexity else 0))
        return min(depth, 1.0)
    
    def _contains_vulnerability_marker(self, content: str) -> bool:
        """Detect vulnerability and trust markers in content"""
        vulnerability_phrases = [
            'afraid', 'scared', 'worry', 'concern', 'struggle',
            'hard for me', 'difficult to say', 'never told',
            'trust you', 'confession', 'honest', 'vulnerable'
        ]
        
        content_lower = content.lower()
        return any(phrase in content_lower for phrase in vulnerability_phrases)
    
    def _initialize_transition_matrix(self) -> Dict:
        """
        Initialize transition probabilities between phases
        Based on relationship development research
        """
        # Natural progression probabilities
        return {
            RelationshipPhase.INITIATING: {
                RelationshipPhase.EXPERIMENTING: 0.8,
                RelationshipPhase.AVOIDING: 0.1,
                RelationshipPhase.INITIATING: 0.1
            },
            RelationshipPhase.EXPERIMENTING: {
                RelationshipPhase.INTENSIFYING: 0.6,
                RelationshipPhase.EXPERIMENTING: 0.3,
                RelationshipPhase.AVOIDING: 0.1
            },
            RelationshipPhase.INTENSIFYING: {
                RelationshipPhase.INTEGRATING: 0.7,
                RelationshipPhase.INTENSIFYING: 0.2,
                RelationshipPhase.DIFFERENTIATING: 0.1
            },
            RelationshipPhase.INTEGRATING: {
                RelationshipPhase.BONDING: 0.6,
                RelationshipPhase.INTEGRATING: 0.3,
                RelationshipPhase.DIFFERENTIATING: 0.1
            },
            RelationshipPhase.BONDING: {
                RelationshipPhase.BONDING: 0.8,  # Stable phase
                RelationshipPhase.DIFFERENTIATING: 0.2
            }
        }
    
    def _calculate_transition_probability(self) -> Dict:
        """
        Calculate probability of transitioning to each possible phase
        """
        current_transitions = self.transition_probabilities.get(
            self.current_phase, {}
        )
        
        # Weight by recent markers
        weighted_probabilities = defaultdict(float)
        
        # Analyze recent markers (last 20)
        recent_markers = list(self.markers)[-20:]
        if recent_markers:
            for marker in recent_markers:
                for phase, strength in marker.phase_indicators.items():
                    if phase in current_transitions:
                        # Combine base probability with marker evidence
                        base_prob = current_transitions.get(phase, 0)
                        weighted_probabilities[phase] += base_prob * strength
            
            # Normalize
            total = sum(weighted_probabilities.values())
            if total > 0:
                for phase in weighted_probabilities:
                    weighted_probabilities[phase] /= total
        else:
            weighted_probabilities = current_transitions.copy()
        
        # Find most likely transition
        if weighted_probabilities:
            most_likely = max(weighted_probabilities.items(), key=lambda x: x[1])
            return {
                'probabilities': dict(weighted_probabilities),
                'most_likely_phase': most_likely[0],
                'max_probability': most_likely[1]
            }
        
        return {
            'probabilities': {},
            'most_likely_phase': self.current_phase,
            'max_probability': 0.0
        }
    
    def _transition_to_phase(self, new_phase: RelationshipPhase, 
                           trigger_markers: List[RelationshipMarker]):
        """Execute transition to new phase"""
        transition = PhaseTransition(
            from_phase=self.current_phase,
            to_phase=new_phase,
            timestamp=datetime.now(),
            confidence=self._calculate_phase_confidence(),
            trigger_events=[m.content[:50] for m in trigger_markers],
            markers_detected={m.marker_type: 1.0 for m in trigger_markers}
        )
        
        self.phase_history.append(transition)
        
        # Update metrics for old phase
        duration = datetime.now() - self.phase_entry_time
        self.phase_metrics[self.current_phase]['duration'] += duration
        
        # Switch to new phase
        self.current_phase = new_phase
        self.phase_entry_time = datetime.now()
        self.phase_metrics[new_phase]['entry_count'] += 1
        
        logger.info(f"Relationship phase transition: {transition.from_phase} -> {transition.to_phase}")
    
    def _calculate_phase_confidence(self) -> float:
        """
        Calculate confidence in current phase assessment
        Based on marker consistency and time in phase
        """
        if not self.markers:
            return 0.5
        
        # Check marker consistency
        recent_markers = list(self.markers)[-10:]
        phase_votes = defaultdict(float)
        
        for marker in recent_markers:
            for phase, strength in marker.phase_indicators.items():
                phase_votes[phase] += strength
        
        # Normalize votes
        total_votes = sum(phase_votes.values())
        if total_votes == 0:
            return 0.5
        
        # Confidence is based on agreement with current phase
        current_phase_votes = phase_votes.get(self.current_phase, 0)
        confidence = current_phase_votes / total_votes
        
        # Factor in time stability
        time_in_phase = (datetime.now() - self.phase_entry_time).total_seconds() / 3600  # hours
        stability_bonus = min(time_in_phase / 24, 0.2)  # Max 0.2 bonus for 24+ hours
        
        return min(confidence + stability_bonus, 1.0)
    
    def _get_current_phase_duration(self) -> Dict:
        """Get time spent in current phase"""
        duration = datetime.now() - self.phase_entry_time
        return {
            'days': duration.days,
            'hours': duration.seconds // 3600,
            'total_seconds': duration.total_seconds()
        }
    
    def _analyze_trajectory(self) -> Dict:
        """
        Analyze relationship trajectory
        Identifies patterns, velocity, and health indicators
        """
        if len(self.phase_history) < 2:
            return {
                'pattern': 'establishing',
                'velocity': 'normal',
                'health': 'healthy',
                'transitions': len(self.phase_history)
            }
        
        # Analyze progression pattern
        phases_visited = [t.to_phase for t in self.phase_history]
        
        # Check for cycling (going back to previous phases repeatedly)
        cycle_count = 0
        for i in range(1, len(phases_visited)):
            if phases_visited[i].value < phases_visited[i-1].value:
                cycle_count += 1
        
        # Calculate velocity (phase changes per month)
        if self.phase_history:
            time_span = (datetime.now() - self.phase_history[0].timestamp).days
            if time_span > 0:
                velocity = len(self.phase_history) / (time_span / 30)  # per month
            else:
                velocity = 0
        else:
            velocity = 0
        
        # Determine pattern
        if cycle_count > len(phases_visited) * 0.3:
            pattern = 'cycling'
            health = 'unstable'
        elif self.current_phase in [RelationshipPhase.BONDING, RelationshipPhase.INTEGRATING]:
            pattern = 'progressing'
            health = 'healthy'
        elif self.current_phase in [RelationshipPhase.STAGNATING, RelationshipPhase.AVOIDING]:
            pattern = 'declining'
            health = 'concerning'
        else:
            pattern = 'developing'
            health = 'normal'
        
        # Velocity assessment
        if velocity > 3:
            velocity_desc = 'rapid'
        elif velocity > 1:
            velocity_desc = 'normal'
        else:
            velocity_desc = 'slow'
        
        return {
            'pattern': pattern,
            'velocity': velocity_desc,
            'velocity_numeric': velocity,
            'health': health,
            'transitions': len(self.phase_history),
            'cycle_count': cycle_count,
            'current_stability': self.phase_metrics[self.current_phase]['stability']
        }
    
    def _update_phase_metrics(self, markers: List[RelationshipMarker], 
                            emotional_state: Dict):
        """Update metrics for current phase"""
        metrics = self.phase_metrics[self.current_phase]
        metrics['interaction_count'] += 1
        
        # Update emotional depth (running average)
        new_depth = self._calculate_emotional_depth(emotional_state)
        metrics['emotional_depth'] = (
            metrics['emotional_depth'] * 0.9 + new_depth * 0.1
        )
        
        # Update stability based on marker consistency
        if markers:
            phase_alignment = sum(
                m.phase_indicators.get(self.current_phase, 0) 
                for m in markers
            ) / len(markers)
            metrics['stability'] = metrics['stability'] * 0.95 + phase_alignment * 0.05
    
    def get_relationship_summary(self) -> Dict:
        """Get comprehensive relationship summary"""
        total_interactions = sum(
            m['interaction_count'] for m in self.phase_metrics.values()
        )
        
        # Calculate phase distribution
        phase_distribution = {}
        total_duration = timedelta()
        
        for phase, metrics in self.phase_metrics.items():
            duration = metrics['duration']
            if phase == self.current_phase:
                duration += datetime.now() - self.phase_entry_time
            total_duration += duration
            phase_distribution[str(phase)] = duration.total_seconds()
        
        # Normalize to percentages
        if total_duration.total_seconds() > 0:
            for phase in phase_distribution:
                phase_distribution[phase] = (
                    phase_distribution[phase] / total_duration.total_seconds()
                )
        
        return {
            'current_phase': str(self.current_phase),
            'phase_confidence': self._calculate_phase_confidence(),
            'total_interactions': total_interactions,
            'phase_distribution': phase_distribution,
            'trajectory_analysis': self._analyze_trajectory(),
            'emotional_depth_average': np.mean([
                m['emotional_depth'] for m in self.phase_metrics.values()
            ]),
            'relationship_age_days': (
                (datetime.now() - self.phase_history[0].timestamp).days 
                if self.phase_history else 0
            )
        }
    
    def _save_state(self):
        """Save current state to disk"""
        state = {
            'current_phase': self.current_phase.name,
            'phase_entry_time': self.phase_entry_time.isoformat(),
            'phase_history': [
                {
                    'from_phase': t.from_phase.name,
                    'to_phase': t.to_phase.name,
                    'timestamp': t.timestamp.isoformat(),
                    'confidence': t.confidence
                }
                for t in self.phase_history
            ],
            'phase_metrics': {
                phase.name: {
                    'duration': metrics['duration'].total_seconds(),
                    'entry_count': metrics['entry_count'],
                    'interaction_count': metrics['interaction_count'],
                    'emotional_depth': metrics['emotional_depth'],
                    'stability': metrics['stability']
                }
                for phase, metrics in self.phase_metrics.items()
            }
        }
        
        self.state_file.write_text(json.dumps(state, indent=2))
    
    def _load_state(self):
        """Load state from disk if exists"""
        if self.state_file.exists():
            try:
                state = json.loads(self.state_file.read_text())
                
                # Restore current phase
                self.current_phase = RelationshipPhase[state['current_phase']]
                self.phase_entry_time = datetime.fromisoformat(state['phase_entry_time'])
                
                # Restore history
                for h in state.get('phase_history', []):
                    self.phase_history.append(PhaseTransition(
                        from_phase=RelationshipPhase[h['from_phase']],
                        to_phase=RelationshipPhase[h['to_phase']],
                        timestamp=datetime.fromisoformat(h['timestamp']),
                        confidence=h['confidence']
                    ))
                
                # Restore metrics
                for phase_name, metrics in state.get('phase_metrics', {}).items():
                    phase = RelationshipPhase[phase_name]
                    self.phase_metrics[phase].update({
                        'duration': timedelta(seconds=metrics['duration']),
                        'entry_count': metrics['entry_count'],
                        'interaction_count': metrics['interaction_count'],
                        'emotional_depth': metrics['emotional_depth'],
                        'stability': metrics['stability']
                    })
                
                logger.info(f"Loaded relationship state: {self.current_phase}")
            except Exception as e:
                logger.error(f"Error loading relationship state: {e}")