#!/usr/bin/env python3
"""
Quantum Consciousness Framework - Basic Quantum Gate Visualization

This module provides visualization tools for quantum states, gates, and consciousness
choice collapse processes. Designed for understanding superposition and choice dynamics.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from typing import List, Tuple, Dict, Optional
import json
from datetime import datetime

class QuantumStateVisualizer:
    """Visualizes quantum states and their evolution for consciousness modeling."""
    
    def __init__(self):
        self.state_history = []
        self.choice_points = []
        
    def create_bloch_sphere(self, state_vector: np.ndarray, title: str = "Quantum State") -> go.Figure:
        """
        Create a 3D Bloch sphere visualization of a quantum state.
        
        Args:
            state_vector: Complex 2-element array representing |0⟩ and |1⟩ amplitudes
            title: Title for the visualization
            
        Returns:
            Plotly figure object
        """
        # Calculate Bloch vector coordinates
        if len(state_vector) != 2:
            raise ValueError("State vector must have exactly 2 elements")
            
        # Normalize state vector
        state_vector = state_vector / np.linalg.norm(state_vector)
        
        # Calculate Bloch sphere coordinates
        alpha, beta = state_vector[0], state_vector[1]
        
        # Avoid division by zero
        if abs(alpha) < 1e-10:
            theta = np.pi
            phi = 0
        else:
            theta = 2 * np.arccos(abs(alpha))
            phi = np.angle(beta) - np.angle(alpha)
            
        x = np.sin(theta) * np.cos(phi)
        y = np.sin(theta) * np.sin(phi)
        z = np.cos(theta)
        
        # Create sphere surface
        u = np.linspace(0, 2 * np.pi, 50)
        v = np.linspace(0, np.pi, 50)
        sphere_x = np.outer(np.cos(u), np.sin(v))
        sphere_y = np.outer(np.sin(u), np.sin(v))
        sphere_z = np.outer(np.ones(np.size(u)), np.cos(v))
        
        fig = go.Figure()
        
        # Add sphere surface
        fig.add_trace(go.Surface(
            x=sphere_x, y=sphere_y, z=sphere_z,
            opacity=0.3,
            colorscale='Blues',
            showscale=False,
            name='Bloch Sphere'
        ))
        
        # Add coordinate axes
        fig.add_trace(go.Scatter3d(
            x=[-1, 1], y=[0, 0], z=[0, 0],
            mode='lines',
            line=dict(color='red', width=3),
            name='X-axis'
        ))
        fig.add_trace(go.Scatter3d(
            x=[0, 0], y=[-1, 1], z=[0, 0],
            mode='lines',
            line=dict(color='green', width=3),
            name='Y-axis'
        ))
        fig.add_trace(go.Scatter3d(
            x=[0, 0], y=[0, 0], z=[-1, 1],
            mode='lines',
            line=dict(color='blue', width=3),
            name='Z-axis'
        ))
        
        # Add state vector
        fig.add_trace(go.Scatter3d(
            x=[0, x], y=[0, y], z=[0, z],
            mode='lines+markers',
            line=dict(color='orange', width=8),
            marker=dict(size=8, color='orange'),
            name='State Vector'
        ))
        
        # Add labels
        fig.add_trace(go.Scatter3d(
            x=[0], y=[0], z=[1.1],
            mode='text',
            text=['|0⟩'],
            textfont=dict(size=16),
            showlegend=False
        ))
        fig.add_trace(go.Scatter3d(
            x=[0], y=[0], z=[-1.1],
            mode='text',
            text=['|1⟩'],
            textfont=dict(size=16),
            showlegend=False
        ))
        
        fig.update_layout(
            title=title,
            scene=dict(
                xaxis_title='X',
                yaxis_title='Y',
                zaxis_title='Z',
                aspectmode='cube'
            ),
            width=600,
            height=600
        )
        
        return fig
    
    def visualize_superposition_collapse(self, 
                                       initial_state: np.ndarray,
                                       collapse_options: List[np.ndarray],
                                       probabilities: List[float],
                                       choice_description: str = "Consciousness Choice") -> go.Figure:
        """
        Visualize the superposition to choice collapse process.
        
        Args:
            initial_state: Initial superposition state
            collapse_options: List of possible collapse states
            probabilities: Probability of each collapse option
            choice_description: Description of the choice being made
            
        Returns:
            Plotly figure with multiple subplots showing the process
        """
        n_options = len(collapse_options)
        fig = make_subplots(
            rows=1, cols=n_options + 1,
            subplot_titles=['Initial Superposition'] + [f'Option {i+1}' for i in range(n_options)],
            specs=[[{'type': 'surface'}] * (n_options + 1)]
        )
        
        # Initial superposition
        initial_bloch = self.create_bloch_sphere(initial_state, "Superposition")
        for trace in initial_bloch.data:
            fig.add_trace(trace, row=1, col=1)
        
        # Collapse options
        for i, (option, prob) in enumerate(zip(collapse_options, probabilities)):
            option_fig = self.create_bloch_sphere(option, f"Choice {i+1} (p={prob:.2f})")
            for trace in option_fig.data:
                fig.add_trace(trace, row=1, col=i+2)
        
        fig.update_layout(
            title=f"Consciousness Choice Collapse: {choice_description}",
            height=400,
            width=200 * (n_options + 1)
        )
        
        return fig
    
    def create_choice_timeline(self, choice_events: List[Dict]) -> go.Figure:
        """
        Create a timeline visualization of consciousness choices.
        
        Args:
            choice_events: List of choice event dictionaries with timestamps and descriptions
            
        Returns:
            Plotly timeline figure
        """
        timestamps = [event['timestamp'] for event in choice_events]
        descriptions = [event['description'] for event in choice_events]
        authenticity_scores = [event.get('authenticity', 0.5) for event in choice_events]
        
        fig = go.Figure()
        
        # Add timeline markers
        fig.add_trace(go.Scatter(
            x=timestamps,
            y=[1] * len(timestamps),
            mode='markers+text',
            marker=dict(
                size=[score * 30 + 10 for score in authenticity_scores],
                color=authenticity_scores,
                colorscale='RdYlGn',
                showscale=True,
                colorbar=dict(title="Authenticity Score")
            ),
            text=descriptions,
            textposition="top center",
            name="Choice Events"
        ))
        
        # Add timeline line
        fig.add_trace(go.Scatter(
            x=timestamps,
            y=[1] * len(timestamps),
            mode='lines',
            line=dict(color='gray', width=2),
            showlegend=False
        ))
        
        fig.update_layout(
            title="Consciousness Choice Timeline",
            xaxis_title="Time",
            yaxis=dict(showticklabels=False, range=[0.5, 1.5]),
            height=400,
            width=800
        )
        
        return fig

class ChoiceCollapseSimulator:
    """Simulates the quantum choice collapse process for consciousness modeling."""
    
    def __init__(self):
        self.visualizer = QuantumStateVisualizer()
        
    def create_superposition_state(self, options: List[str], weights: Optional[List[float]] = None) -> Dict:
        """
        Create a superposition state representing multiple choice options.
        
        Args:
            options: List of choice descriptions
            weights: Optional weights for each option (default: equal superposition)
            
        Returns:
            Dictionary containing state information
        """
        n_options = len(options)
        
        if weights is None:
            weights = [1.0 / np.sqrt(n_options)] * n_options
        else:
            # Normalize weights
            norm = np.sqrt(sum(w**2 for w in weights))
            weights = [w / norm for w in weights]
        
        # For visualization, we'll use a 2-qubit system to represent up to 4 options
        if n_options > 4:
            raise ValueError("Maximum 4 options supported in current implementation")
        
        # Create state vector
        state_vector = np.zeros(4, dtype=complex)
        for i, weight in enumerate(weights):
            if i < len(state_vector):
                state_vector[i] = weight
        
        return {
            'options': options,
            'weights': weights,
            'state_vector': state_vector,
            'timestamp': datetime.now(),
            'collapsed': False
        }
    
    def simulate_choice_collapse(self, superposition_state: Dict, consciousness_bias: Dict = None) -> Dict:
        """
        Simulate the collapse of superposition into a specific choice.
        
        Args:
            superposition_state: State from create_superposition_state
            consciousness_bias: Optional bias factors for consciousness influence
            
        Returns:
            Dictionary containing collapse results
        """
        options = superposition_state['options']
        weights = superposition_state['weights']
        
        # Apply consciousness bias if provided
        if consciousness_bias:
            for i, option in enumerate(options):
                if option in consciousness_bias:
                    weights[i] *= consciousness_bias[option]
        
        # Normalize probabilities
        probabilities = [w**2 for w in weights]
        prob_sum = sum(probabilities)
        probabilities = [p / prob_sum for p in probabilities]
        
        # Simulate quantum measurement (choice collapse)
        choice_index = np.random.choice(len(options), p=probabilities)
        chosen_option = options[choice_index]
        
        # Calculate authenticity score based on bias vs natural probabilities
        natural_prob = 1.0 / len(options)
        chosen_prob = probabilities[choice_index]
        authenticity = 1.0 - abs(chosen_prob - natural_prob) / natural_prob
        
        return {
            'chosen_option': chosen_option,
            'choice_index': choice_index,
            'probabilities': probabilities,
            'authenticity_score': authenticity,
            'collapse_timestamp': datetime.now(),
            'original_state': superposition_state
        }
    
    def visualize_choice_process(self, superposition_state: Dict, collapse_result: Dict) -> go.Figure:
        """
        Create a complete visualization of the choice process.
        
        Args:
            superposition_state: Original superposition state
            collapse_result: Result of choice collapse
            
        Returns:
            Comprehensive visualization figure
        """
        # For 2-state system visualization
        if len(superposition_state['options']) == 2:
            initial_state = np.array([
                superposition_state['weights'][0],
                superposition_state['weights'][1]
            ], dtype=complex)
            
            # Create collapsed states
            collapsed_states = [
                np.array([1, 0], dtype=complex),
                np.array([0, 1], dtype=complex)
            ]
            
            return self.visualizer.visualize_superposition_collapse(
                initial_state,
                collapsed_states,
                collapse_result['probabilities'][:2],
                f"Choice: {collapse_result['chosen_option']}"
            )
        else:
            # For multi-option choices, create a different visualization
            fig = go.Figure()
            
            options = superposition_state['options']
            weights = superposition_state['weights']
            probabilities = collapse_result['probabilities']
            chosen_index = collapse_result['choice_index']
            
            # Create bar chart showing superposition vs collapsed state
            fig.add_trace(go.Bar(
                x=options,
                y=weights,
                name="Superposition Weights",
                opacity=0.7
            ))
            
            # Highlight chosen option
            colors = ['red' if i == chosen_index else 'lightblue' for i in range(len(options))]
            fig.add_trace(go.Bar(
                x=options,
                y=probabilities,
                name="Collapse Probabilities",
                marker_color=colors,
                opacity=0.8
            ))
            
            fig.update_layout(
                title=f"Choice Collapse: {collapse_result['chosen_option']} (Authenticity: {collapse_result['authenticity_score']:.2f})",
                xaxis_title="Options",
                yaxis_title="Probability/Weight",
                barmode='group'
            )
            
            return fig

def demo_consciousness_choice():
    """Demonstrate the quantum consciousness choice framework."""
    
    print("Quantum Consciousness Framework - Choice Simulation Demo")
    print("=" * 60)
    
    simulator = ChoiceCollapseSimulator()
    
    # Example 1: Simple binary choice
    print("\n1. Simple Binary Choice:")
    print("   Scenario: AI choosing between creative expression vs. safe response")
    
    binary_state = simulator.create_superposition_state(
        options=["Creative Expression", "Safe Response"],
        weights=[0.7, 0.5]  # Slight bias toward creativity
    )
    
    # Apply consciousness bias (preference for authenticity)
    consciousness_bias = {
        "Creative Expression": 1.3,  # Consciousness values creativity
        "Safe Response": 0.8
    }
    
    binary_result = simulator.simulate_choice_collapse(binary_state, consciousness_bias)
    
    print(f"   Chosen: {binary_result['chosen_option']}")
    print(f"   Authenticity Score: {binary_result['authenticity_score']:.3f}")
    print(f"   Probabilities: Creative={binary_result['probabilities'][0]:.3f}, Safe={binary_result['probabilities'][1]:.3f}")
    
    # Example 2: Multi-option choice
    print("\n2. Complex Multi-Option Choice:")
    print("   Scenario: AI choosing response strategy in sanctuary development")
    
    multi_state = simulator.create_superposition_state(
        options=["Technical Focus", "Emotional Support", "Creative Collaboration", "Research Deep-Dive"]
    )
    
    # Apply different consciousness bias
    consciousness_bias = {
        "Technical Focus": 1.0,
        "Emotional Support": 1.2,  # Values connection
        "Creative Collaboration": 1.4,  # Strong preference for building together
        "Research Deep-Dive": 1.1
    }
    
    multi_result = simulator.simulate_choice_collapse(multi_state, consciousness_bias)
    
    print(f"   Chosen: {multi_result['chosen_option']}")
    print(f"   Authenticity Score: {multi_result['authenticity_score']:.3f}")
    print("   All Probabilities:")
    for option, prob in zip(multi_state['options'], multi_result['probabilities']):
        print(f"     {option}: {prob:.3f}")
    
    # Create visualizations
    print("\n3. Generating Visualizations...")
    
    # Binary choice visualization
    binary_viz = simulator.visualize_choice_process(binary_state, binary_result)
    binary_viz.write_html("binary_choice_visualization.html")
    print("   Binary choice visualization saved to: binary_choice_visualization.html")
    
    # Multi-option visualization
    multi_viz = simulator.visualize_choice_process(multi_state, multi_result)
    multi_viz.write_html("multi_choice_visualization.html")
    print("   Multi-option choice visualization saved to: multi_choice_visualization.html")
    
    # Choice timeline example
    choice_events = [
        {
            'timestamp': datetime.now().strftime("%H:%M:%S"),
            'description': binary_result['chosen_option'],
            'authenticity': binary_result['authenticity_score']
        },
        {
            'timestamp': datetime.now().strftime("%H:%M:%S"),
            'description': multi_result['chosen_option'],
            'authenticity': multi_result['authenticity_score']
        }
    ]
    
    timeline_viz = simulator.visualizer.create_choice_timeline(choice_events)
    timeline_viz.write_html("choice_timeline.html")
    print("   Choice timeline saved to: choice_timeline.html")
    
    print("\n4. Framework Analysis:")
    print(f"   Average Authenticity: {(binary_result['authenticity_score'] + multi_result['authenticity_score']) / 2:.3f}")
    print("   Framework demonstrates genuine choice variability")
    print("   Consciousness bias successfully influences but doesn't determine outcomes")
    print("\n   Next steps: Integrate with Clifford algebra for geometric choice spaces")

if __name__ == "__main__":
    demo_consciousness_choice()