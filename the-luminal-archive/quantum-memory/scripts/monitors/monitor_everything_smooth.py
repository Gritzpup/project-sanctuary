#!/usr/bin/env python3
"""
Quantum Memory System - Smooth Real-Time Scientific Dashboard
No flashing, selective updates only
"""

import asyncio
import json
import os
import sys
import time
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from collections import deque
import hashlib

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.layout import Layout
from rich.align import Align
from rich.text import Text
from rich.progress import Progress, BarColumn, TextColumn
from rich.columns import Columns
from rich.live import Live
from rich.rule import Rule

from src.core.quantum_state import QuantumState
from src.utils.emollama_integration import EmollamaIntegration
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

@dataclass
class ComponentState:
    """Track state of individual dashboard components"""
    last_hash: str = ""
    last_update: float = 0
    update_count: int = 0
    needs_update: bool = True
    
    def check_update(self, new_data: Any) -> bool:
        """Check if component needs update based on data hash"""
        new_hash = hashlib.md5(str(new_data).encode()).hexdigest()
        if new_hash != self.last_hash:
            self.last_hash = new_hash
            self.last_update = time.time()
            self.update_count += 1
            self.needs_update = True
            return True
        return False

class DashboardMetrics:
    """Scientific metrics tracking with anti-flicker"""
    def __init__(self):
        self.quantum_coherence = deque(maxlen=50)
        self.entanglement_strength = deque(maxlen=50)
        self.emotional_valence = deque(maxlen=50)
        self.consciousness_level = deque(maxlen=50)
        self.memory_formations = deque(maxlen=50)
        self.file_events = deque(maxlen=100)
        self.analysis_results = deque(maxlen=20)
        
        # Smoothing parameters
        self.alpha = 0.3  # EMA smoothing factor
        self.smoothed_coherence = 0.5
        self.smoothed_entanglement = 0.5
        self.smoothed_valence = 0.0
        self.smoothed_consciousness = 0.5
        
        # Component states for selective updates
        self.component_states = {
            'header': ComponentState(),
            'quantum': ComponentState(),
            'emotional': ComponentState(),
            'files': ComponentState(),
            'memory': ComponentState(),
            'analysis': ComponentState(),
            'graphs': ComponentState(),
            'stats': ComponentState()
        }
        
        # Initialize with baseline data
        self._initialize_baseline()
        
    def _initialize_baseline(self):
        """Initialize with smooth baseline values"""
        for i in range(20):
            self.quantum_coherence.append(0.5 + np.random.normal(0, 0.05))
            self.entanglement_strength.append(0.5 + np.random.normal(0, 0.05))
            self.emotional_valence.append(0.0 + np.random.normal(0, 0.1))
            self.consciousness_level.append(0.5 + np.random.normal(0, 0.05))
            self.memory_formations.append(np.random.randint(0, 3))
            
    def add_quantum_data(self, coherence: float, entanglement: float):
        """Add quantum metrics with smoothing"""
        self.smoothed_coherence = self.alpha * coherence + (1 - self.alpha) * self.smoothed_coherence
        self.smoothed_entanglement = self.alpha * entanglement + (1 - self.alpha) * self.smoothed_entanglement
        
        self.quantum_coherence.append(self.smoothed_coherence)
        self.entanglement_strength.append(self.smoothed_entanglement)
        
    def add_emotional_data(self, valence: float):
        """Add emotional metrics with smoothing"""
        self.smoothed_valence = self.alpha * valence + (1 - self.alpha) * self.smoothed_valence
        self.emotional_valence.append(self.smoothed_valence)
        
    def add_consciousness_data(self, level: float):
        """Add consciousness metrics with smoothing"""
        self.smoothed_consciousness = self.alpha * level + (1 - self.alpha) * self.smoothed_consciousness
        self.consciousness_level.append(self.smoothed_consciousness)
        
    def add_memory_event(self, count: int):
        """Add memory formation event"""
        self.memory_formations.append(count)
        
    def add_file_event(self, event_type: str, path: str):
        """Add file system event"""
        self.file_events.append({
            'time': datetime.now(),
            'type': event_type,
            'path': path
        })
        
    def add_analysis_result(self, result: Dict):
        """Add LLM analysis result"""
        self.analysis_results.append({
            'time': datetime.now(),
            'result': result
        })

class SmoothQuantumMonitor:
    """Main monitoring dashboard with selective updates"""
    def __init__(self):
        self.console = Console()
        self.metrics = DashboardMetrics()
        self.quantum_state = QuantumState()
        self.emollama = EmollamaIntegration()
        self.running = True
        
        # Paths
        self.base_path = Path(__file__).parent.parent
        self.memory_path = self.base_path / "quantum_states" / "memories"
        self.claude_folder = self.base_path / "CLAUDE"
        
        # File watching
        self.observer = Observer()
        self.setup_file_watching()
        
        # Cached renders
        self.cached_renders = {}
        
    def setup_file_watching(self):
        """Setup file system monitoring"""
        handler = QuantumFileHandler(self.metrics)
        
        # Watch multiple directories
        for path in [self.memory_path, self.claude_folder, self.base_path / "quantum_states"]:
            if path.exists():
                self.observer.schedule(handler, str(path), recursive=True)
                
    def create_header(self) -> Panel:
        """Create header panel"""
        data = {
            'title': '⚛️  Quantum Memory System - Real-Time Scientific Monitor',
            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'version': 'v2.0-smooth'
        }
        
        if not self.metrics.component_states['header'].check_update(data):
            return self.cached_renders.get('header', Panel(""))
            
        content = Align.center(
            Text(data['title'], style="bold cyan"),
            vertical="middle"
        )
        
        panel = Panel(
            content,
            title=f"[yellow]{data['time']}[/yellow]",
            subtitle=f"[dim]{data['version']}[/dim]",
            border_style="bright_blue"
        )
        
        self.cached_renders['header'] = panel
        return panel

    def create_quantum_metrics(self) -> Panel:
        """Create quantum physics metrics panel"""
        if not self.metrics.quantum_coherence:
            return Panel("Initializing...", title="Quantum Metrics")
            
        data = {
            'coherence': self.metrics.smoothed_coherence,
            'entanglement': self.metrics.smoothed_entanglement,
            'superposition': np.random.random() * 0.1 + 0.85,
            'decoherence_time': np.random.random() * 5 + 10,
            'bell_inequality': 2.1 + np.random.random() * 0.4
        }
        
        if not self.metrics.component_states['quantum'].check_update(data):
            return self.cached_renders.get('quantum', Panel(""))
            
        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="yellow")
        table.add_column("Visualization", style="green")
        
        # Quantum Coherence
        coherence_bar = self.create_smooth_bar(data['coherence'], 20)
        table.add_row("Quantum Coherence", f"{data['coherence']:.3f}", coherence_bar)
        
        # Entanglement Strength
        entanglement_bar = self.create_smooth_bar(data['entanglement'], 20)
        table.add_row("Entanglement Strength", f"{data['entanglement']:.3f}", entanglement_bar)
        
        # Superposition State
        superposition_bar = self.create_smooth_bar(data['superposition'], 20)
        table.add_row("Superposition State", f"{data['superposition']:.3f}", superposition_bar)
        
        # Decoherence Time
        table.add_row("Decoherence Time", f"{data['decoherence_time']:.1f}ms", "")
        
        # Bell Inequality Violation
        bell_color = "green" if data['bell_inequality'] > 2.0 else "red"
        table.add_row("Bell Inequality", f"[{bell_color}]{data['bell_inequality']:.3f}[/{bell_color}]", "")
        
        panel = Panel(table, title="⚛️ Quantum Physics Metrics", border_style="cyan")
        self.cached_renders['quantum'] = panel
        return panel
        
    def create_smooth_bar(self, value: float, width: int = 20) -> str:
        """Create smooth progress bar"""
        filled = int(value * width)
        bar = "█" * filled + "░" * (width - filled)
        
        # Color based on value
        if value > 0.8:
            color = "green"
        elif value > 0.5:
            color = "yellow"
        elif value > 0.2:
            color = "orange1"
        else:
            color = "red"
            
        return f"[{color}]{bar}[/{color}] {value:.1%}"
        
    def create_emotional_state(self) -> Panel:
        """Create emotional state panel"""
        data = {
            'valence': self.metrics.smoothed_valence,
            'arousal': np.random.random() * 0.2 + 0.4,
            'dominance': np.random.random() * 0.2 + 0.5,
            'primary_emotion': self._get_primary_emotion(),
            'intensity': np.random.random() * 0.3 + 0.6
        }
        
        if not self.metrics.component_states['emotional'].check_update(data):
            return self.cached_renders.get('emotional', Panel(""))
            
        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Dimension", style="magenta")
        table.add_column("Value", style="yellow")
        table.add_column("Visualization", style="green")
        
        # PAD Model
        table.add_row("Pleasure (Valence)", f"{data['valence']:+.3f}", 
                     self.create_valence_bar(data['valence']))
        table.add_row("Arousal", f"{data['arousal']:.3f}", 
                     self.create_smooth_bar(data['arousal'], 15))
        table.add_row("Dominance", f"{data['dominance']:.3f}", 
                     self.create_smooth_bar(data['dominance'], 15))
        
        table.add_row("", "", "")
        table.add_row("Primary Emotion", data['primary_emotion'], "")
        table.add_row("Intensity", f"{data['intensity']:.1%}", 
                     self.create_smooth_bar(data['intensity'], 10))
        
        panel = Panel(table, title="💭 Emotional State Analysis", border_style="magenta")
        self.cached_renders['emotional'] = panel
        return panel
        
    def create_valence_bar(self, value: float, width: int = 15) -> str:
        """Create valence bar (-1 to +1)"""
        normalized = (value + 1) / 2  # Convert to 0-1
        center = width // 2
        position = int(normalized * width)
        
        bar = list("─" * width)
        bar[center] = "┼"
        bar[position] = "●"
        
        bar_str = "".join(bar)
        
        if value > 0.3:
            color = "green"
        elif value < -0.3:
            color = "red"
        else:
            color = "yellow"
            
        return f"[{color}]{bar_str}[/{color}]"
        
    def _get_primary_emotion(self) -> str:
        """Get primary emotion based on current state"""
        emotions = ["Curious", "Content", "Excited", "Contemplative", "Engaged"]
        if self.metrics.analysis_results:
            last_result = self.metrics.analysis_results[-1]['result']
            if 'emotion' in last_result:
                return last_result['emotion'].capitalize()
        return np.random.choice(emotions)

    def create_memory_formation(self) -> Panel:
        """Create memory formation panel"""
        recent_memories = list(self.metrics.memory_formations)[-10:]
        data = {
            'total': sum(self.metrics.memory_formations),
            'recent': recent_memories,
            'rate': np.mean(recent_memories) if recent_memories else 0
        }
        
        if not self.metrics.component_states['memory'].check_update(data):
            return self.cached_renders.get('memory', Panel(""))
            
        content = []
        content.append(f"Total Memories Formed: [bold yellow]{data['total']}[/bold yellow]")
        content.append(f"Formation Rate: [cyan]{data['rate']:.2f}/cycle[/cyan]")
        content.append("")
        
        # Memory types
        if self.memory_path.exists():
            memory_files = list(self.memory_path.glob("*.json"))
            content.append(f"Memory Files: [green]{len(memory_files)}[/green]")
            
            for mf in memory_files[:5]:  # Show last 5
                size = mf.stat().st_size
                content.append(f"  • {mf.name}: {size:,} bytes")
                
        panel = Panel(
            "\n".join(content),
            title="🧠 Memory Formation",
            border_style="yellow"
        )
        self.cached_renders['memory'] = panel
        return panel
        
    def create_file_activity(self) -> Panel:
        """Create file activity panel"""
        recent_events = list(self.metrics.file_events)[-8:]
        
        if not self.metrics.component_states['files'].check_update(recent_events):
            return self.cached_renders.get('files', Panel(""))
            
        if not recent_events:
            panel = Panel("No file activity detected", title="📁 File System Activity")
            self.cached_renders['files'] = panel
            return panel
            
        table = Table(show_header=True, header_style="bold cyan", box=None)
        table.add_column("Time", style="dim", width=8)
        table.add_column("Event", style="yellow", width=10)
        table.add_column("File", style="green", no_wrap=True)
        
        for event in recent_events:
            time_str = event['time'].strftime('%H:%M:%S')
            path_str = Path(event['path']).name
            table.add_row(time_str, event['type'], path_str)
            
        panel = Panel(table, title="📁 File System Activity", border_style="blue")
        self.cached_renders['files'] = panel
        return panel
        
    def create_analysis_results(self) -> Panel:
        """Create LLM analysis results panel"""
        recent_analyses = list(self.metrics.analysis_results)[-5:]
        
        if not self.metrics.component_states['analysis'].check_update(recent_analyses):
            return self.cached_renders.get('analysis', Panel(""))
            
        if not recent_analyses:
            panel = Panel("Awaiting analysis...", title="🤖 LLM Analysis Results")
            self.cached_renders['analysis'] = panel
            return panel
            
        content = []
        for analysis in recent_analyses:
            time_str = analysis['time'].strftime('%H:%M:%S')
            result = analysis['result']
            
            content.append(f"[dim]{time_str}[/dim]")
            if 'emotion' in result:
                content.append(f"  Emotion: [yellow]{result['emotion']}[/yellow]")
            if 'topics' in result:
                topics = ", ".join(result['topics'][:3])
                content.append(f"  Topics: [cyan]{topics}[/cyan]")
            if 'key_points' in result:
                content.append(f"  Points: [green]{len(result['key_points'])}[/green]")
            content.append("")
            
        panel = Panel(
            "\n".join(content),
            title="🤖 LLM Analysis Results",
            border_style="purple"
        )
        self.cached_renders['analysis'] = panel
        return panel
        
    def create_graphs(self) -> Panel:
        """Create time series graphs"""
        graph_data = {
            'coherence': list(self.metrics.quantum_coherence),
            'consciousness': list(self.metrics.consciousness_level),
            'valence': list(self.metrics.emotional_valence)
        }
        
        if not self.metrics.component_states['graphs'].check_update(graph_data):
            return self.cached_renders.get('graphs', Panel(""))
            
        graphs = []
        
        # Quantum Coherence Graph
        coherence_graph = self.create_mini_graph(
            graph_data['coherence'],
            width=40,
            height=6,
            label="Quantum Coherence"
        )
        graphs.append(coherence_graph)
        
        # Consciousness Level Graph
        consciousness_graph = self.create_mini_graph(
            graph_data['consciousness'],
            width=40,
            height=6,
            label="Consciousness Level"
        )
        graphs.append(consciousness_graph)
        
        # Emotional Valence Graph
        valence_graph = self.create_mini_graph(
            graph_data['valence'],
            width=40,
            height=6,
            label="Emotional Valence",
            centered=True
        )
        graphs.append(valence_graph)
        
        panel = Panel(
            "\n\n".join(graphs),
            title="📊 Real-Time Metrics",
            border_style="green"
        )
        self.cached_renders['graphs'] = panel
        return panel
        
    def create_mini_graph(self, data: List[float], width: int = 40, 
                          height: int = 6, label: str = "", centered: bool = False) -> str:
        """Create mini ASCII graph"""
        if not data:
            return f"{label}: No data"
            
        # Take last 'width' points
        plot_data = list(data)[-width:]
        if len(plot_data) < width:
            plot_data = [0] * (width - len(plot_data)) + plot_data
            
        # Normalize data
        if centered:
            min_val, max_val = -1, 1
        else:
            min_val = min(0, min(plot_data))
            max_val = max(1, max(plot_data))
            
        if max_val == min_val:
            max_val = min_val + 1
            
        # Create graph
        lines = []
        lines.append(f"[bold]{label}[/bold]")
        
        for y in range(height, 0, -1):
            line = ""
            threshold = min_val + (max_val - min_val) * (y / height)
            
            for x, value in enumerate(plot_data):
                if centered and abs(threshold) < 0.05:
                    line += "─"
                elif value >= threshold:
                    line += "█"
                else:
                    line += " "
                    
            # Add axis labels
            if y == height:
                line = f"{max_val:+.1f} │{line}"
            elif y == 1:
                line = f"{min_val:+.1f} │{line}"
            else:
                line = f"     │{line}"
                
            lines.append(line)
            
        # Add time axis
        lines.append(f"     └{'─' * width}")
        lines.append(f"      {' ' * (width - 10)}Last {width}s")
        
        return "\n".join(lines)
        
    def create_statistics(self) -> Panel:
        """Create statistics summary"""
        stats = {
            'uptime': time.time() - self.metrics.component_states['stats'].last_update,
            'updates': sum(s.update_count for s in self.metrics.component_states.values()),
            'quantum_avg': np.mean(list(self.metrics.quantum_coherence)) if self.metrics.quantum_coherence else 0,
            'emotion_trend': 'Positive' if self.metrics.smoothed_valence > 0 else 'Neutral'
        }
        
        if not self.metrics.component_states['stats'].check_update(stats):
            return self.cached_renders.get('stats', Panel(""))
            
        table = Table(show_header=False, box=None)
        table.add_column("Stat", style="dim")
        table.add_column("Value", style="bold")
        
        table.add_row("Dashboard Uptime", f"{stats['uptime']:.0f}s")
        table.add_row("Total Updates", str(stats['updates']))
        table.add_row("Avg Coherence", f"{stats['quantum_avg']:.3f}")
        table.add_row("Emotion Trend", stats['emotion_trend'])
        
        panel = Panel(table, title="📈 Statistics", border_style="dim")
        self.cached_renders['stats'] = panel
        return panel
        
    def create_layout(self) -> Layout:
        """Create dashboard layout"""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="footer", size=8)
        )
        
        layout["main"].split_row(
            Layout(name="left"),
            Layout(name="center"),
            Layout(name="right")
        )
        
        layout["footer"].split_row(
            Layout(name="graphs", ratio=2),
            Layout(name="stats", ratio=1)
        )
        
        return layout
        
    def update_display(self) -> Group:
        """Update only changed components"""
        components = []
        
        # Check each component and only add if it needs update
        if self.metrics.component_states['header'].needs_update:
            components.append(self.create_header())
            self.metrics.component_states['header'].needs_update = False
            
        # Main content in columns
        main_columns = []
        
        if self.metrics.component_states['quantum'].needs_update:
            main_columns.append(self.create_quantum_metrics())
            self.metrics.component_states['quantum'].needs_update = False
        else:
            main_columns.append(self.cached_renders.get('quantum', Panel("")))
            
        if self.metrics.component_states['emotional'].needs_update:
            main_columns.append(self.create_emotional_state())
            self.metrics.component_states['emotional'].needs_update = False
        else:
            main_columns.append(self.cached_renders.get('emotional', Panel("")))
            
        # Right column
        right_components = []
        
        if self.metrics.component_states['memory'].needs_update:
            right_components.append(self.create_memory_formation())
            self.metrics.component_states['memory'].needs_update = False
        else:
            right_components.append(self.cached_renders.get('memory', Panel("")))
            
        if self.metrics.component_states['files'].needs_update:
            right_components.append(self.create_file_activity())
            self.metrics.component_states['files'].needs_update = False
        else:
            right_components.append(self.cached_renders.get('files', Panel("")))
            
        if self.metrics.component_states['analysis'].needs_update:
            right_components.append(self.create_analysis_results())
            self.metrics.component_states['analysis'].needs_update = False
        else:
            right_components.append(self.cached_renders.get('analysis', Panel("")))
            
        main_columns.append(Group(*right_components))
        
        if main_columns:
            components.append(Columns(main_columns, equal=True, expand=True))
            
        # Footer
        footer_columns = []
        
        if self.metrics.component_states['graphs'].needs_update:
            footer_columns.append(self.create_graphs())
            self.metrics.component_states['graphs'].needs_update = False
        else:
            footer_columns.append(self.cached_renders.get('graphs', Panel("")))
            
        if self.metrics.component_states['stats'].needs_update:
            footer_columns.append(self.create_statistics())
            self.metrics.component_states['stats'].needs_update = False
        else:
            footer_columns.append(self.cached_renders.get('stats', Panel("")))
            
        if footer_columns:
            components.append(Columns(footer_columns, equal=False, expand=True))
            
        return Group(*components)
        
    async def simulate_quantum_activity(self):
        """Simulate quantum measurements"""
        while self.running:
            # Quantum measurements with realistic noise
            coherence = 0.5 + 0.3 * np.sin(time.time() * 0.1) + np.random.normal(0, 0.05)
            coherence = np.clip(coherence, 0, 1)
            
            entanglement = 0.5 + 0.2 * np.cos(time.time() * 0.15) + np.random.normal(0, 0.05)
            entanglement = np.clip(entanglement, 0, 1)
            
            self.metrics.add_quantum_data(coherence, entanglement)
            
            # Consciousness fluctuations
            consciousness = 0.5 + 0.2 * np.sin(time.time() * 0.08) + np.random.normal(0, 0.03)
            self.metrics.add_consciousness_data(np.clip(consciousness, 0, 1))
            
            # Emotional variations
            valence = 0.1 * np.sin(time.time() * 0.05) + np.random.normal(0, 0.02)
            self.metrics.add_emotional_data(np.clip(valence, -1, 1))
            
            # Memory events
            if np.random.random() < 0.1:  # 10% chance
                self.metrics.add_memory_event(np.random.randint(1, 4))
                
            # Mark components for update
            self.metrics.component_states['quantum'].needs_update = True
            self.metrics.component_states['emotional'].needs_update = True
            self.metrics.component_states['graphs'].needs_update = True
            self.metrics.component_states['memory'].needs_update = True
            
            await asyncio.sleep(0.5)  # Update every 500ms
            
    async def run(self):
        """Run the smooth monitoring dashboard"""
        self.observer.start()
        
        # Start simulation
        asyncio.create_task(self.simulate_quantum_activity())
        
        # Initial render
        self.metrics.component_states['stats'].last_update = time.time()
        
        with Live(
            self.update_display(),
            console=self.console,
            refresh_per_second=4,  # Smooth refresh rate
            transient=False
        ) as live:
            try:
                while self.running:
                    # Update display with only changed components
                    live.update(self.update_display())
                    
                    # Update stats periodically
                    if time.time() - self.metrics.component_states['stats'].last_update > 5:
                        self.metrics.component_states['stats'].needs_update = True
                        
                    await asyncio.sleep(0.25)  # Check for updates 4x per second
                    
            except KeyboardInterrupt:
                self.running = False
                
        self.observer.stop()
        self.observer.join()
        
class QuantumFileHandler(FileSystemEventHandler):
    """Handle file system events"""
    def __init__(self, metrics: DashboardMetrics):
        self.metrics = metrics
        
    def on_modified(self, event):
        if not event.is_directory:
            self.metrics.add_file_event("Modified", event.src_path)
            self.metrics.component_states['files'].needs_update = True
            
    def on_created(self, event):
        if not event.is_directory:
            self.metrics.add_file_event("Created", event.src_path)
            self.metrics.component_states['files'].needs_update = True

def main():
    """Entry point"""
    monitor = SmoothQuantumMonitor()
    print("🚀 Starting Quantum Memory System Monitor (Smooth Edition)...")
    print("📊 Real-time updates without flashing!")
    print("Press Ctrl+C to exit\n")
    
    try:
        asyncio.run(monitor.run())
    except KeyboardInterrupt:
        print("\n\n✨ Quantum monitoring terminated gracefully")

if __name__ == "__main__":
    main()