#!/usr/bin/env python3
"""
Emotional State Tracker with Stochastic Differential Equations
Implements continuous emotion dynamics based on peer-reviewed research
for the Classical LLM Emotional Continuity Engine
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Deque
from collections import deque
import json
from pathlib import Path
from dataclasses import dataclass, asdict, field
import logging
import asyncio
import threading
from enum import Enum

# Import existing emotional baseline components
from .emotional_baseline import EmotionalState, EmotionalBaselineManager

logger = logging.getLogger(__name__)


class EmotionType(Enum):
    """Primary emotion types mapped to PAD space"""
    JOY = "joy"
    LOVE = "love"
    TRUST = "trust"
    FEAR = "fear"
    SADNESS = "sadness"
    ANGER = "anger"
    SURPRISE = "surprise"
    ANTICIPATION = "anticipation"
    DISGUST = "disgust"
    NEUTRAL = "neutral"


@dataclass
class MixedEmotion:
    """Represents mixed emotional states with primary and secondary components"""
    primary: EmotionType
    secondary: Optional[EmotionType]
    primary_weight: float = 0.7
    secondary_weight: float = 0.3
    ambivalence: float = 0.0  # 0-1, healthy range 0.15-0.25
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class EmotionalContext:
    """Context that influences emotional dynamics"""
    user_input: str
    conversation_topic: str
    relationship_phase: str  # "new", "developing", "established", "intimate"
    recent_events: List[str] = field(default_factory=list)
    emotional_triggers: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)


class EmotionalStateTracker:
    """
    Tracks emotional states using stochastic differential equations
    Based on research in affective computing and emotional dynamics
    """
    
    # PAD mappings based on peer-reviewed research
    EMOTION_PAD_MAPPINGS = {
        EmotionType.JOY: {"pleasure": 0.76, "arousal": 0.48, "dominance": 0.35},
        EmotionType.LOVE: {"pleasure": 0.85, "arousal": 0.13, "dominance": 0.32},
        EmotionType.TRUST: {"pleasure": 0.69, "arousal": -0.34, "dominance": 0.47},
        EmotionType.FEAR: {"pleasure": -0.64, "arousal": 0.60, "dominance": -0.43},
        EmotionType.SADNESS: {"pleasure": -0.63, "arousal": -0.27, "dominance": -0.33},
        EmotionType.ANGER: {"pleasure": -0.51, "arousal": 0.59, "dominance": 0.25},
        EmotionType.SURPRISE: {"pleasure": 0.18, "arousal": 0.67, "dominance": -0.15},
        EmotionType.ANTICIPATION: {"pleasure": 0.23, "arousal": 0.47, "dominance": 0.15},
        EmotionType.DISGUST: {"pleasure": -0.60, "arousal": 0.35, "dominance": 0.11},
        EmotionType.NEUTRAL: {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0}
    }
    
    def __init__(self, 
                 mean_reversion_rate: float = 0.2,  # α = 0.2/hour
                 input_sensitivity: float = 1.0,     # β = 1.0
                 emotional_volatility: float = 0.1,  # σ = 0.1
                 update_interval_ms: int = 100):     # 100ms updates
        """
        Initialize emotional state tracker with SDE parameters
        
        Args:
            mean_reversion_rate: How quickly emotions return to baseline (α)
            input_sensitivity: How strongly inputs affect emotions (β)
            emotional_volatility: Random fluctuations in emotions (σ)
            update_interval_ms: How often to update emotional state
        """
        # SDE parameters
        self.alpha = mean_reversion_rate
        self.beta = input_sensitivity
        self.sigma = emotional_volatility
        
        # State tracking
        self.current_state = EmotionalState(
            pleasure=0.0,
            arousal=0.0,
            dominance=0.0,
            timestamp=datetime.now()
        )
        
        # History tracking with maxlen for memory efficiency
        self.emotion_history: Deque[EmotionalState] = deque(maxlen=1000)
        self.mixed_emotion_history: Deque[MixedEmotion] = deque(maxlen=500)
        
        # Baseline manager for homeostasis
        self.baseline_manager = EmotionalBaselineManager()
        
        # Personalized baselines (learned over time)
        self.personalized_baseline = {
            "pleasure": 0.2,
            "arousal": 0.0,
            "dominance": 0.0
        }
        self.baseline_learning_rate = 0.01  # α for adaptive learning
        
        # Real-time update configuration
        self.update_interval = update_interval_ms / 1000.0  # Convert to seconds
        self.update_thread = None
        self.running = False
        
        # Consolidation triggers
        self.consolidation_callbacks = []
        
        # State persistence
        self.state_file = Path("emotional_state_checkpoint.json")
        self._load_state()
    
    def update_emotional_state(self, 
                              context: EmotionalContext,
                              detected_emotion: Optional[EmotionType] = None) -> EmotionalState:
        """
        Update emotional state using stochastic differential equation
        
        dE/dt = α(B - E) + βI + σW
        where:
        - E: current emotional state
        - B: baseline emotional state
        - I: input from current context
        - W: Wiener process (random fluctuations)
        """
        # Get input influence from context
        input_influence = self._calculate_input_influence(context, detected_emotion)
        
        # Calculate time delta since last update
        dt = self.update_interval
        
        # Apply SDE for each PAD dimension
        new_pleasure = self._update_dimension(
            self.current_state.pleasure,
            self.personalized_baseline["pleasure"],
            input_influence["pleasure"],
            dt
        )
        
        new_arousal = self._update_dimension(
            self.current_state.arousal,
            self.personalized_baseline["arousal"],
            input_influence["arousal"],
            dt
        )
        
        new_dominance = self._update_dimension(
            self.current_state.dominance,
            self.personalized_baseline["dominance"],
            input_influence["dominance"],
            dt
        )
        
        # Create new state
        new_state = EmotionalState(
            pleasure=np.clip(new_pleasure, -1, 1),
            arousal=np.clip(new_arousal, -1, 1),
            dominance=np.clip(new_dominance, -1, 1),
            timestamp=datetime.now(),
            confidence=self._calculate_confidence(context)
        )
        
        # Apply homeostatic regulation
        regulated_state = self.baseline_manager.update_state(new_state)
        
        # Update current state and history
        self.current_state = regulated_state
        self.emotion_history.append(regulated_state)
        
        # Check for consolidation triggers
        self._check_consolidation_triggers(regulated_state, context)
        
        # Update personalized baseline
        self._update_personalized_baseline(regulated_state)
        
        # Save state periodically
        if len(self.emotion_history) % 10 == 0:
            self._save_state()
        
        return regulated_state
    
    def _update_dimension(self, current: float, baseline: float, 
                         input_val: float, dt: float) -> float:
        """
        Update single PAD dimension using SDE
        """
        # Mean reversion term
        mean_reversion = self.alpha * (baseline - current) * dt
        
        # Input influence term
        input_term = self.beta * input_val * dt
        
        # Stochastic term (Wiener process)
        random_term = self.sigma * np.random.normal(0, np.sqrt(dt))
        
        # Update value
        new_value = current + mean_reversion + input_term + random_term
        
        return new_value
    
    def _calculate_input_influence(self, 
                                  context: EmotionalContext,
                                  detected_emotion: Optional[EmotionType]) -> Dict[str, float]:
        """
        Calculate how current input influences emotional state
        """
        influence = {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0}
        
        # If emotion is detected, use its PAD values
        if detected_emotion and detected_emotion in self.EMOTION_PAD_MAPPINGS:
            pad_values = self.EMOTION_PAD_MAPPINGS[detected_emotion]
            influence.update(pad_values)
        
        # Modify based on relationship phase
        phase_modifiers = {
            "new": {"arousal": 0.1, "dominance": -0.1},
            "developing": {"pleasure": 0.1, "arousal": 0.05},
            "established": {"pleasure": 0.15, "dominance": 0.1},
            "intimate": {"pleasure": 0.2, "arousal": -0.1, "dominance": 0.15}
        }
        
        if context.relationship_phase in phase_modifiers:
            for dim, mod in phase_modifiers[context.relationship_phase].items():
                influence[dim] += mod
        
        # Check for emotional triggers
        trigger_effects = {
            "personal_revelation": {"pleasure": 0.3, "arousal": 0.2},
            "conflict": {"pleasure": -0.4, "arousal": 0.5, "dominance": -0.2},
            "achievement": {"pleasure": 0.5, "arousal": 0.3, "dominance": 0.4},
            "vulnerability": {"pleasure": 0.2, "arousal": -0.2, "dominance": -0.3}
        }
        
        for trigger in context.emotional_triggers:
            if trigger in trigger_effects:
                for dim, effect in trigger_effects[trigger].items():
                    influence[dim] += effect
        
        return influence
    
    def track_mixed_emotions(self, 
                           primary: EmotionType,
                           secondary: Optional[EmotionType] = None,
                           context: Optional[EmotionalContext] = None) -> MixedEmotion:
        """
        Track mixed emotional states with proper ambivalence measurement
        """
        # Calculate weights based on context
        if secondary:
            # Measure ambivalence as distance between emotions in PAD space
            primary_pad = self.EMOTION_PAD_MAPPINGS[primary]
            secondary_pad = self.EMOTION_PAD_MAPPINGS[secondary]
            
            ambivalence = np.sqrt(
                (primary_pad["pleasure"] - secondary_pad["pleasure"]) ** 2 +
                (primary_pad["arousal"] - secondary_pad["arousal"]) ** 2 +
                (primary_pad["dominance"] - secondary_pad["dominance"]) ** 2
            ) / np.sqrt(3)  # Normalize to 0-1
            
            # Adjust weights based on ambivalence
            primary_weight = 0.5 + (1 - ambivalence) * 0.2
            secondary_weight = 1 - primary_weight
        else:
            ambivalence = 0.0
            primary_weight = 1.0
            secondary_weight = 0.0
        
        mixed_emotion = MixedEmotion(
            primary=primary,
            secondary=secondary,
            primary_weight=primary_weight,
            secondary_weight=secondary_weight,
            ambivalence=ambivalence
        )
        
        self.mixed_emotion_history.append(mixed_emotion)
        
        # Check if ambivalence is in healthy range
        if 0.15 <= ambivalence <= 0.25:
            logger.info(f"Healthy emotional ambivalence detected: {ambivalence:.2f}")
        elif ambivalence > 0.5:
            logger.warning(f"High emotional ambivalence: {ambivalence:.2f}")
        
        return mixed_emotion
    
    def _check_consolidation_triggers(self, 
                                    state: EmotionalState,
                                    context: EmotionalContext):
        """
        Check if current state should trigger memory consolidation
        """
        triggers_activated = []
        
        # Emotional peak detection (|PAD| > 0.7)
        emotional_magnitude = np.sqrt(
            state.pleasure ** 2 + 
            state.arousal ** 2 + 
            state.dominance ** 2
        ) / np.sqrt(3)
        
        if emotional_magnitude > 0.7:
            triggers_activated.append("emotional_peak")
        
        # Personal revelation detection
        revelation_keywords = ["realized", "understand now", "never told", 
                             "first time", "secret", "confession"]
        if any(keyword in context.user_input.lower() for keyword in revelation_keywords):
            triggers_activated.append("personal_revelation")
        
        # Relationship milestone detection
        milestone_keywords = ["love you", "trust you", "important to me",
                            "changed my life", "grateful", "appreciate"]
        if any(keyword in context.user_input.lower() for keyword in milestone_keywords):
            triggers_activated.append("relationship_milestone")
        
        # Notify consolidation callbacks
        if triggers_activated:
            for callback in self.consolidation_callbacks:
                callback(state, context, triggers_activated)
    
    def add_consolidation_callback(self, callback):
        """Add callback for memory consolidation triggers"""
        self.consolidation_callbacks.append(callback)
    
    def _update_personalized_baseline(self, state: EmotionalState):
        """
        Adaptively update personalized emotional baseline
        """
        # Use exponential moving average to update baseline
        self.personalized_baseline["pleasure"] += self.baseline_learning_rate * (
            state.pleasure - self.personalized_baseline["pleasure"]
        )
        self.personalized_baseline["arousal"] += self.baseline_learning_rate * (
            state.arousal - self.personalized_baseline["arousal"]
        )
        self.personalized_baseline["dominance"] += self.baseline_learning_rate * (
            state.dominance - self.personalized_baseline["dominance"]
        )
    
    def _calculate_confidence(self, context: EmotionalContext) -> float:
        """
        Calculate confidence in emotional assessment
        """
        confidence = 0.8  # Base confidence
        
        # Increase confidence for clear emotional triggers
        if context.emotional_triggers:
            confidence += 0.1 * min(len(context.emotional_triggers), 2)
        
        # Decrease confidence for ambiguous contexts
        ambiguous_indicators = ["maybe", "not sure", "kind of", "sort of", "perhaps"]
        if any(indicator in context.user_input.lower() for indicator in ambiguous_indicators):
            confidence -= 0.2
        
        return np.clip(confidence, 0.1, 1.0)
    
    def get_emotional_synchrony(self, window_minutes: int = 10) -> float:
        """
        Measure emotional synchrony over recent window
        Returns value 0-1 indicating how aligned emotions are
        """
        if len(self.emotion_history) < 2:
            return 1.0
        
        cutoff_time = datetime.now() - timedelta(minutes=window_minutes)
        recent_states = [s for s in self.emotion_history if s.timestamp > cutoff_time]
        
        if len(recent_states) < 2:
            return 1.0
        
        # Calculate variance in each dimension
        pleasure_var = np.var([s.pleasure for s in recent_states])
        arousal_var = np.var([s.arousal for s in recent_states])
        dominance_var = np.var([s.dominance for s in recent_states])
        
        # Convert to synchrony score (low variance = high synchrony)
        avg_variance = (pleasure_var + arousal_var + dominance_var) / 3
        synchrony = 1.0 - min(avg_variance * 2, 1.0)  # Scale and cap at 1
        
        return synchrony
    
    async def start_realtime_updates(self):
        """
        Start real-time emotional state updates
        """
        self.running = True
        
        while self.running:
            try:
                # Create minimal context for autonomous updates
                auto_context = EmotionalContext(
                    user_input="",
                    conversation_topic="ongoing",
                    relationship_phase="established"
                )
                
                # Update state
                self.update_emotional_state(auto_context)
                
                # Wait for next update
                await asyncio.sleep(self.update_interval)
                
            except Exception as e:
                logger.error(f"Error in realtime update: {e}")
                await asyncio.sleep(self.update_interval)
    
    def stop_realtime_updates(self):
        """Stop real-time updates"""
        self.running = False
    
    def get_current_pad_state(self) -> Dict[str, float]:
        """Get current PAD values"""
        return {
            "pleasure": self.current_state.pleasure,
            "arousal": self.current_state.arousal,
            "dominance": self.current_state.dominance,
            "confidence": self.current_state.confidence
        }
    
    def get_emotion_trajectory(self, window_minutes: int = 60) -> List[Dict]:
        """Get emotion trajectory over time window"""
        cutoff_time = datetime.now() - timedelta(minutes=window_minutes)
        recent_states = [s for s in self.emotion_history if s.timestamp > cutoff_time]
        
        trajectory = []
        for state in recent_states:
            trajectory.append({
                "timestamp": state.timestamp.isoformat(),
                "pleasure": state.pleasure,
                "arousal": state.arousal,
                "dominance": state.dominance,
                "confidence": state.confidence
            })
        
        return trajectory
    
    def _save_state(self):
        """Save current emotional state to disk"""
        state_data = {
            "current_state": asdict(self.current_state),
            "personalized_baseline": self.personalized_baseline,
            "emotion_history": [asdict(s) for s in list(self.emotion_history)[-100:]],
            "timestamp": datetime.now().isoformat()
        }
        
        self.state_file.write_text(json.dumps(state_data, indent=2))
    
    def _load_state(self):
        """Load emotional state from disk"""
        if self.state_file.exists():
            try:
                state_data = json.loads(self.state_file.read_text())
                
                # Restore personalized baseline
                self.personalized_baseline = state_data.get(
                    "personalized_baseline", 
                    self.personalized_baseline
                )
                
                # Restore current state
                if "current_state" in state_data:
                    cs = state_data["current_state"]
                    self.current_state = EmotionalState(
                        pleasure=cs["pleasure"],
                        arousal=cs["arousal"],
                        dominance=cs["dominance"],
                        timestamp=datetime.fromisoformat(cs["timestamp"]),
                        confidence=cs.get("confidence", 1.0)
                    )
                
                logger.info("Loaded emotional state from checkpoint")
            except Exception as e:
                logger.error(f"Error loading emotional state: {e}")