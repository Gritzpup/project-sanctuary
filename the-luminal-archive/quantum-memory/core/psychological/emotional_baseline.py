#!/usr/bin/env python3
"""
Emotional Baseline Manager
Prevents emotional state drift by implementing homeostatic regulation
Based on affective neuroscience research on emotional set points
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import json
from pathlib import Path
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class EmotionalState:
    """Represents a point in emotional space using the PAD model"""
    pleasure: float  # Valence: -1 (negative) to +1 (positive)  
    arousal: float   # Activation: -1 (calm) to +1 (excited)
    dominance: float # Control: -1 (submissive) to +1 (dominant)
    timestamp: datetime
    confidence: float = 1.0  # How certain we are about this reading


class EmotionalBaselineManager:
    """
    Maintains emotional homeostasis to prevent drift over long conversations
    Based on research showing humans have emotional set points they return to
    """
    
    def __init__(self, baseline_window_hours: int = 168):  # 1 week default
        """
        Initialize with configurable baseline window
        
        Args:
            baseline_window_hours: How far back to look when calculating baseline
        """
        self.baseline_window = timedelta(hours=baseline_window_hours)
        self.state_history: List[EmotionalState] = []
        
        # Default baseline for new relationships (slightly positive, calm, balanced)
        self.default_baseline = EmotionalState(
            pleasure=0.2,   # Slightly positive
            arousal=0.0,    # Neutral arousal
            dominance=0.0,  # Balanced control
            timestamp=datetime.now()
        )
        
        # Homeostasis parameters from affective neuroscience
        self.return_rate = 0.1  # How quickly emotions return to baseline
        self.drift_threshold = 0.5  # Maximum allowed drift from baseline
        
        # Load historical data if exists
        self.history_file = Path("emotional_baseline_history.json")
        self._load_history()
    
    def update_state(self, current_state: EmotionalState) -> EmotionalState:
        """
        Update emotional state with homeostatic regulation
        
        This prevents the system from drifting too far from baseline,
        mimicking how human emotions naturally regulate
        """
        # Add to history
        self.state_history.append(current_state)
        
        # Calculate current baseline from recent history
        baseline = self._calculate_baseline()
        
        # Apply homeostatic pull toward baseline
        regulated_state = self._apply_homeostasis(current_state, baseline)
        
        # Check for excessive drift and apply correction if needed
        if self._detect_excessive_drift(regulated_state, baseline):
            regulated_state = self._correct_drift(regulated_state, baseline)
            logger.warning(f"Corrected excessive emotional drift")
        
        # Save updated history
        self._save_history()
        
        return regulated_state
    
    def _calculate_baseline(self) -> EmotionalState:
        """
        Calculate baseline from recent emotional history
        Uses exponentially weighted average to favor recent states
        """
        cutoff_time = datetime.now() - self.baseline_window
        recent_states = [s for s in self.state_history if s.timestamp > cutoff_time]
        
        if not recent_states:
            return self.default_baseline
        
        # Calculate exponentially weighted average
        weights = []
        p_values, a_values, d_values = [], [], []
        
        for state in recent_states:
            # More recent states get higher weight
            age_hours = (datetime.now() - state.timestamp).total_seconds() / 3600
            weight = np.exp(-age_hours / 24) * state.confidence  # 24-hour half-life
            weights.append(weight)
            
            p_values.append(state.pleasure)
            a_values.append(state.arousal) 
            d_values.append(state.dominance)
        
        # Normalize weights
        weights = np.array(weights)
        weights = weights / weights.sum()
        
        # Calculate weighted baseline
        baseline_pleasure = np.average(p_values, weights=weights)
        baseline_arousal = np.average(a_values, weights=weights)
        baseline_dominance = np.average(d_values, weights=weights)
        
        return EmotionalState(
            pleasure=baseline_pleasure,
            arousal=baseline_arousal,
            dominance=baseline_dominance,
            timestamp=datetime.now()
        )
    
    def _apply_homeostasis(self, current: EmotionalState, 
                          baseline: EmotionalState) -> EmotionalState:
        """
        Apply homeostatic regulation to pull emotions toward baseline
        This mimics the natural tendency of emotions to return to set point
        """
        # Calculate pull toward baseline using return rate
        regulated_pleasure = current.pleasure + self.return_rate * (baseline.pleasure - current.pleasure)
        regulated_arousal = current.arousal + self.return_rate * (baseline.arousal - current.arousal)
        regulated_dominance = current.dominance + self.return_rate * (baseline.dominance - current.dominance)
        
        return EmotionalState(
            pleasure=np.clip(regulated_pleasure, -1, 1),
            arousal=np.clip(regulated_arousal, -1, 1),
            dominance=np.clip(regulated_dominance, -1, 1),
            timestamp=current.timestamp,
            confidence=current.confidence
        )
    
    def _detect_excessive_drift(self, current: EmotionalState, 
                               baseline: EmotionalState) -> bool:
        """
        Detect if emotional state has drifted too far from baseline
        Uses Euclidean distance in PAD space
        """
        drift = np.sqrt(
            (current.pleasure - baseline.pleasure) ** 2 +
            (current.arousal - baseline.arousal) ** 2 +
            (current.dominance - baseline.dominance) ** 2
        )
        
        return drift > self.drift_threshold
    
    def _correct_drift(self, current: EmotionalState, 
                      baseline: EmotionalState) -> EmotionalState:
        """
        Correct excessive drift by applying stronger homeostatic pull
        This prevents the system from entering unrealistic emotional extremes
        """
        # Use stronger return rate for correction
        strong_return_rate = 0.3
        
        corrected_pleasure = current.pleasure + strong_return_rate * (baseline.pleasure - current.pleasure)
        corrected_arousal = current.arousal + strong_return_rate * (baseline.arousal - current.arousal)
        corrected_dominance = current.dominance + strong_return_rate * (baseline.dominance - current.dominance)
        
        logger.info(f"Drift correction applied: P:{current.pleasure:.2f}->{corrected_pleasure:.2f}")
        
        return EmotionalState(
            pleasure=np.clip(corrected_pleasure, -1, 1),
            arousal=np.clip(corrected_arousal, -1, 1),
            dominance=np.clip(corrected_dominance, -1, 1),
            timestamp=current.timestamp,
            confidence=current.confidence * 0.9  # Slightly reduce confidence after correction
        )
    
    def get_emotional_trajectory(self, hours: int = 24) -> Dict:
        """
        Get emotional trajectory over specified time period
        Useful for monitoring emotional patterns and stability
        """
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_states = [s for s in self.state_history if s.timestamp > cutoff_time]
        
        if not recent_states:
            return {"trajectory": [], "baseline": asdict(self.default_baseline)}
        
        trajectory = []
        for state in recent_states:
            trajectory.append({
                "timestamp": state.timestamp.isoformat(),
                "pleasure": state.pleasure,
                "arousal": state.arousal,
                "dominance": state.dominance,
                "confidence": state.confidence
            })
        
        return {
            "trajectory": trajectory,
            "baseline": asdict(self._calculate_baseline()),
            "current_drift": self._calculate_current_drift()
        }
    
    def _calculate_current_drift(self) -> float:
        """Calculate current drift from baseline"""
        if not self.state_history:
            return 0.0
            
        current = self.state_history[-1]
        baseline = self._calculate_baseline()
        
        return np.sqrt(
            (current.pleasure - baseline.pleasure) ** 2 +
            (current.arousal - baseline.arousal) ** 2 +
            (current.dominance - baseline.dominance) ** 2
        )
    
    def _save_history(self):
        """Save emotional history to disk"""
        # Keep only last 30 days of history to prevent infinite growth
        cutoff = datetime.now() - timedelta(days=30)
        self.state_history = [s for s in self.state_history if s.timestamp > cutoff]
        
        history_data = []
        for state in self.state_history:
            history_data.append({
                "pleasure": state.pleasure,
                "arousal": state.arousal,
                "dominance": state.dominance,
                "timestamp": state.timestamp.isoformat(),
                "confidence": state.confidence
            })
        
        self.history_file.write_text(json.dumps(history_data, indent=2))
    
    def _load_history(self):
        """Load emotional history from disk"""
        if self.history_file.exists():
            try:
                history_data = json.loads(self.history_file.read_text())
                for item in history_data:
                    self.state_history.append(EmotionalState(
                        pleasure=item["pleasure"],
                        arousal=item["arousal"],
                        dominance=item["dominance"],
                        timestamp=datetime.fromisoformat(item["timestamp"]),
                        confidence=item.get("confidence", 1.0)
                    ))
                logger.info(f"Loaded {len(self.state_history)} historical emotional states")
            except Exception as e:
                logger.error(f"Error loading emotional history: {e}")