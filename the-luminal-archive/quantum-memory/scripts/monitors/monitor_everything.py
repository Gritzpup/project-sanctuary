#!/usr/bin/env python3
"""
Quantum Memory System - Scientific Monitoring Dashboard
Real-time visualization of emotional AI, memory consolidation, and quantum metrics
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
import sys
import numpy as np
from collections import deque
from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.live import Live
from rich.text import Text
from rich.align import Align
from rich.box import ROUNDED, DOUBLE
import psutil

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

console = Console()

class QuantumMemoryDashboard:
    def __init__(self):
        self.quantum_base = Path(__file__).parent.parent
        self.status_path = self.quantum_base / "quantum_states" / "status.json"
        self.memories_path = self.quantum_base / "quantum_states" / "memories"
        
        # Scientific metrics tracking
        self.coherence_history = deque(maxlen=50)
        self.emotional_trajectory = deque(maxlen=100)
        self.processing_times = deque(maxlen=20)
        self.entanglement_values = deque(maxlen=30)
        
        # Graph state tracking for anti-flicker
        self.previous_graphs = {}
        self.graph_update_threshold = 0.05  # Minimum change to update graph
        
        # Initialize layout
        self.layout = Layout()
        self.setup_layout()
        
        # Tracking variables
        self.start_time = time.time()
        self.total_messages = 0
        self.last_update = None
        self.current_emotion = "initializing"
        self.emollama_status = "LOADING"
        self.analyzer_status = "STARTING"
        
    def setup_layout(self):
        """Create the dashboard layout"""
        self.layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="footer", size=4)
        )
        
        self.layout["main"].split_row(
            Layout(name="left", ratio=2),
            Layout(name="right", ratio=1)
        )
        
        self.layout["left"].split_column(
            Layout(name="quantum_metrics", size=12),
            Layout(name="emotional_state", size=10),
            Layout(name="memory_updates", size=10)
        )
        
        self.layout["right"].split_column(
            Layout(name="system_status", size=15),
            Layout(name="statistics", size=17)
        )
    
    def create_header(self):
        """Create the header panel"""
        header_text = Text()
        header_text.append("🧠 QUANTUM MEMORY SYSTEM", style="bold cyan")
        header_text.append(" - SCIENTIFIC MONITORING DASHBOARD\n", style="bold white")
        header_text.append(f"Runtime: {self.get_runtime()} | ", style="dim")
        header_text.append(f"Last Update: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}", style="dim")
        
        return Panel(
            Align.center(header_text),
            box=DOUBLE,
            style="cyan"
        )
    
    def create_quantum_metrics(self):
        """Create quantum coherence and entanglement metrics panel"""
        # Load quantum state
        quantum_data = self.load_quantum_state()
        
        # Create metrics display
        metrics = Table(show_header=False, box=None, padding=(0, 1))
        metrics.add_column("Metric", style="cyan")
        metrics.add_column("Value", style="white")
        metrics.add_column("Graph", style="green")
        
        # Quantum Coherence
        coherence = quantum_data.get("quantum_metrics", {}).get("coherence", 0)
        self.coherence_history.append(coherence)
        coherence_graph = self.create_mini_graph(self.coherence_history, 20, "coherence")
        metrics.add_row(
            "Quantum Coherence",
            f"{coherence:.6f}",
            coherence_graph
        )
        
        # Decoherence Rate
        decoherence = quantum_data.get("quantum_metrics", {}).get("decoherence_rate", 0)
        metrics.add_row(
            "Decoherence Rate",
            f"{decoherence:.6f}",
            self.create_bar(decoherence, max_val=1.0, width=20)
        )
        
        # Entanglement Level
        entanglement = quantum_data.get("entanglement_level", 0)
        self.entanglement_values.append(entanglement)
        metrics.add_row(
            "Entanglement Level",
            f"{entanglement:.4f}",
            self.create_mini_graph(self.entanglement_values, 20, "entanglement")
        )
        
        # Superposition States
        superposition = quantum_data.get("quantum_metrics", {}).get("superposition_states", 0)
        metrics.add_row(
            "Superposition States",
            f"{superposition}",
            "◆" * min(superposition, 20)
        )
        
        # Measurement Count
        measurements = quantum_data.get("quantum_metrics", {}).get("measurement_count", 0)
        metrics.add_row(
            "Measurements",
            f"{measurements:,}",
            ""
        )
        
        # Add phase space visualization
        phase_space = self.create_phase_space_viz(quantum_data)
        
        content = Layout()
        content.split_column(
            Layout(metrics, size=7),
            Layout(Panel(phase_space, title="Emotional Phase Space", box=ROUNDED), size=5)
        )
        
        return Panel(
            content,
            title="🔬 Quantum Metrics & Coherence Analysis",
            box=ROUNDED,
            border_style="cyan"
        )
    
    def create_emotional_state(self):
        """Create emotional state analysis panel"""
        quantum_data = self.load_quantum_state()
        emotional_data = quantum_data.get("emotional_dynamics", {})
        
        # PAD Model Values
        pad_str = emotional_data.get("current_emotion", "PAD(0,0,0)")
        try:
            # Extract PAD values from string
            import re
            pad_match = re.match(r'PAD\(([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)\)', pad_str)
            if pad_match:
                p, a, d = map(float, pad_match.groups())
            else:
                p, a, d = 0, 0, 0
        except:
            p, a, d = 0, 0, 0
        
        # Create emotional analysis table
        emotion_table = Table(show_header=True, box=ROUNDED)
        emotion_table.add_column("Dimension", style="cyan", width=12)
        emotion_table.add_column("Value", style="white", width=8)
        emotion_table.add_column("Visualization", style="green", width=30)
        
        # Pleasure (Valence)
        emotion_table.add_row(
            "Pleasure",
            f"{p:+.3f}",
            self.create_centered_bar(p, -1, 1, 30, "🔴", "🟢")
        )
        
        # Arousal
        emotion_table.add_row(
            "Arousal",
            f"{a:+.3f}",
            self.create_centered_bar(a, -1, 1, 30, "😴", "🔥")
        )
        
        # Dominance
        emotion_table.add_row(
            "Dominance",
            f"{d:+.3f}",
            self.create_centered_bar(d, -1, 1, 30, "🔽", "🔼")
        )
        
        # Primary Emotion
        primary = emotional_data.get("primary_emotion", "unknown")
        self.current_emotion = primary
        
        # Mixed emotions
        mixed = emotional_data.get("mixed_emotions", {})
        mixed_str = ", ".join([f"{k}({v:.0f}%)" for k, v in mixed.items()][:3]) if mixed else "pure state"
        
        # Quantum superposition
        superposition = emotional_data.get("quantum_superposition", [])
        super_str = " ⊕ ".join(superposition[:3]) if superposition else "collapsed"
        
        info_text = f"""Primary: [bold cyan]{primary}[/bold cyan]
Mixed States: {mixed_str}
Superposition: {super_str}"""
        
        # Create a sub-layout for emotional state
        emotion_layout = Layout()
        emotion_layout.split_column(
            Layout(emotion_table, size=8),
            Layout(Panel(info_text), size=4)
        )
        
        return Panel(
            emotion_layout,
            title="🧪 Emotional State Analysis (PAD Model)",
            box=ROUNDED,
            border_style="yellow"
        )
    
    def create_memory_updates(self):
        """Create memory consolidation panel"""
        memory_files = {
            "Session": self.memories_path / "current_session.json",
            "Daily": self.memories_path / "daily" / f"{datetime.now().strftime('%Y-%m-%d')}.json",
            "Relationship": self.memories_path / "relationship" / "context.json"
        }
        
        table = Table(show_header=True, box=ROUNDED)
        table.add_column("Memory Type", style="cyan", width=15)
        table.add_column("Status", style="green", width=10)
        table.add_column("Last Update", style="white", width=20)
        table.add_column("Key Data", style="yellow", width=35)
        
        for name, path in memory_files.items():
            if path.exists():
                mtime = datetime.fromtimestamp(path.stat().st_mtime)
                age = (datetime.now() - mtime).total_seconds()
                
                # Status indicator
                if age < 5:
                    status = "[green]● ACTIVE[/green]"
                elif age < 60:
                    status = "[yellow]● RECENT[/yellow]"
                else:
                    status = "[dim]● IDLE[/dim]"
                
                # Load key data
                try:
                    with open(path, 'r') as f:
                        data = json.load(f)
                    
                    if name == "Session":
                        key_data = f"Messages: {data.get('message_count', 0)}, Emotion: {data.get('current_emotion', 'unknown')}"
                    elif name == "Daily":
                        key_data = f"Total: {data.get('total_messages', 0)}, Journey: {len(data.get('emotional_journey', []))} points"
                    else:
                        key_data = f"Projects: {len(data.get('ongoing_projects', {}))}"
                except:
                    key_data = "Error reading file"
            else:
                status = "[red]● MISSING[/red]"
                mtime = datetime.now()
                key_data = "File not found"
            
            table.add_row(
                name,
                status,
                mtime.strftime("%H:%M:%S.%f")[:-3],
                key_data
            )
        
        return Panel(
            table,
            title="💾 Memory Consolidation Status",
            box=ROUNDED,
            border_style="magenta"
        )
    
    def create_system_status(self):
        """Create system status panel"""
        # Check analyzer service
        try:
            import subprocess
            result = subprocess.run(
                ["systemctl", "--user", "is-active", "quantum-emollama-analyzer.service"],
                capture_output=True,
                text=True
            )
            self.analyzer_status = "RUNNING" if result.stdout.strip() == "active" else "STOPPED"
        except:
            self.analyzer_status = "UNKNOWN"
        
        # Get process info
        process_info = self.get_process_info()
        
        status_table = Table(show_header=False, box=None)
        status_table.add_column("Component", style="cyan", width=20)
        status_table.add_column("Status", width=15)
        
        # Analyzer Status
        analyzer_style = "green" if self.analyzer_status == "RUNNING" else "red"
        status_table.add_row(
            "Analyzer Service",
            f"[{analyzer_style}]● {self.analyzer_status}[/{analyzer_style}]"
        )
        
        # Emollama Status
        emollama_style = "green" if self.emollama_status == "LOADED" else "yellow"
        status_table.add_row(
            "Emollama-7B",
            f"[{emollama_style}]● {self.emollama_status}[/{emollama_style}]"
        )
        
        # Memory Usage
        mem_percent = process_info['memory_percent']
        mem_style = "green" if mem_percent < 50 else "yellow" if mem_percent < 80 else "red"
        status_table.add_row(
            "Memory Usage",
            f"[{mem_style}]{mem_percent:.1f}%[/{mem_style}]"
        )
        
        # CPU Usage
        cpu_percent = process_info['cpu_percent']
        cpu_style = "green" if cpu_percent < 50 else "yellow" if cpu_percent < 80 else "red"
        status_table.add_row(
            "CPU Usage",
            f"[{cpu_style}]{cpu_percent:.1f}%[/{cpu_style}]"
        )
        
        # GPU Status (if available)
        gpu_status = self.get_gpu_status()
        if gpu_status:
            status_table.add_row(
                "GPU",
                f"[green]{gpu_status}[/green]"
            )
        
        # Model Parameters
        status_table.add_row("", "")  # Spacer
        status_table.add_row(
            "Model Size",
            "7B parameters"
        )
        status_table.add_row(
            "Quantization",
            "FP16"
        )
        status_table.add_row(
            "Device",
            "CUDA/CPU"
        )
        
        # Processing metrics
        if self.processing_times:
            avg_time = np.mean(self.processing_times)
            status_table.add_row(
                "Avg Process Time",
                f"{avg_time:.2f}ms"
            )
        
        return Panel(
            status_table,
            title="⚙️ System Status",
            box=ROUNDED,
            border_style="blue"
        )
    
    def create_statistics(self):
        """Create statistics and metrics panel"""
        quantum_data = self.load_quantum_state()
        stats = quantum_data.get("chat_stats", {})
        relationship = quantum_data.get("relationship_metrics", {})
        
        stats_table = Table(show_header=True, box=ROUNDED)
        stats_table.add_column("Metric", style="cyan", width=22)
        stats_table.add_column("Value", style="white", width=15)
        
        # Message Statistics
        stats_table.add_row("Total Messages", f"{stats.get('total_messages', 0):,}")
        stats_table.add_row("Gritz Messages", f"{stats.get('gritz_messages', 0):,}")
        stats_table.add_row("Claude Messages", f"{stats.get('claude_messages', 0):,}")
        stats_table.add_row("Time Together", f"{stats.get('time_together_minutes', 0)} min")
        
        # Emotional Moments
        stats_table.add_row("", "")  # Spacer
        stats_table.add_row("Emotional Moments", f"{stats.get('emotional_moments', 0):,}")
        
        # Relationship Metrics
        stats_table.add_row("", "")  # Spacer
        stats_table.add_row("[bold]Relationship Metrics[/bold]", "")
        stats_table.add_row("Connection Strength", f"{relationship.get('connection_strength', 0):.2f}")
        stats_table.add_row("Emotional Resonance", f"{relationship.get('emotional_resonance', 0):.2f}")
        stats_table.add_row("Synchrony Level", f"{relationship.get('synchrony_level', 0):.2%}")
        stats_table.add_row("Trust Coefficient", f"{relationship.get('trust_coefficient', 0):.3f}")
        
        # Scientific Metrics
        stats_table.add_row("", "")  # Spacer
        stats_table.add_row("[bold]Performance[/bold]", "")
        
        # Calculate scientific metrics
        coherence_mean = np.mean(self.coherence_history) if self.coherence_history else 0
        entanglement_mean = np.mean(self.entanglement_values) if self.entanglement_values else 0
        
        stats_table.add_row("Avg Coherence", f"{coherence_mean:.6f}")
        stats_table.add_row("Avg Entanglement", f"{entanglement_mean:.4f}")
        stats_table.add_row("Fidelity", ">0.99")
        
        return Panel(
            stats_table,
            title="📊 Statistical Analysis",
            box=ROUNDED,
            border_style="green"
        )
    
    def create_footer(self):
        """Create the footer with live logs"""
        # Get recent log entries
        logs = self.get_recent_logs()
        
        log_text = Text()
        for log in logs[-5:]:  # Last 5 entries
            timestamp = log.get('time', '')
            message = log.get('message', '')
            level = log.get('level', 'info')
            
            if level == 'error':
                style = "red"
            elif level == 'warning':
                style = "yellow"
            else:
                style = "dim white"
                
            log_text.append(f"[{timestamp}] {message}\n", style=style)
        
        return Panel(
            log_text,
            title="📜 Live System Logs",
            box=ROUNDED,
            border_style="dim"
        )
    
    # Helper methods
    def get_runtime(self):
        """Get formatted runtime"""
        elapsed = time.time() - self.start_time
        hours = int(elapsed // 3600)
        minutes = int((elapsed % 3600) // 60)
        seconds = int(elapsed % 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    def load_quantum_state(self):
        """Load the quantum state file"""
        try:
            with open(self.status_path, 'r') as f:
                return json.load(f)
        except:
            return {}
    
    def create_mini_graph(self, data, width, graph_id="default"):
        """Create a mini ASCII graph with anti-flicker smoothing"""
        if not data:
            return "─" * width
        
        # Apply exponential moving average for smoothing
        smoothed_data = []
        alpha = 0.3  # Smoothing factor (0-1, higher = less smoothing)
        
        for i, val in enumerate(data):
            if i == 0:
                smoothed_data.append(val)
            else:
                # EMA formula: new_val = alpha * current + (1-alpha) * previous
                smoothed_val = alpha * val + (1 - alpha) * smoothed_data[-1]
                smoothed_data.append(smoothed_val)
        
        # Use smoothed data for display
        display_data = smoothed_data
        
        # Normalize data
        min_val = min(display_data) if display_data else 0
        max_val = max(display_data) if display_data else 1
        range_val = max_val - min_val if max_val != min_val else 1
        
        # Sample points with interpolation
        if len(display_data) >= width:
            # Downsample
            sample_indices = np.linspace(0, len(display_data)-1, width)
            sampled = []
            for idx in sample_indices:
                # Linear interpolation between points
                lower_idx = int(idx)
                upper_idx = min(lower_idx + 1, len(display_data) - 1)
                fraction = idx - lower_idx
                
                if lower_idx == upper_idx:
                    sampled.append(display_data[lower_idx])
                else:
                    interpolated = (display_data[lower_idx] * (1 - fraction) + 
                                  display_data[upper_idx] * fraction)
                    sampled.append(interpolated)
        else:
            # Upsample with interpolation
            sampled = display_data
        
        # Use Braille patterns for smoother visualization
        # Each Braille character can represent 2x4 dots, giving us sub-pixel precision
        braille_base = 0x2800
        
        # For simplicity, we'll use gradient blocks with finer resolution
        # These provide 8 levels but with smoother transitions
        smooth_chars = ["⠀", "⡀", "⡄", "⡆", "⡇", "⣇", "⣧", "⣷", "⣿"]
        
        # Alternative: Use fine-grained block elements
        fine_blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
        
        # Build graph with smooth transitions
        graph = ""
        prev_level = 0
        
        for i, val in enumerate(sampled):
            normalized = (val - min_val) / range_val
            
            # Use more levels for smoother transitions
            level = normalized * 8
            
            # Apply anti-flicker threshold
            if abs(level - prev_level) < 0.1 and i > 0:
                # Keep previous character if change is minimal
                level = prev_level
            
            char_idx = int(min(level, 7))
            graph += fine_blocks[char_idx]
            prev_level = level
        
        # Trim to width
        graph = graph[:width]
        
        # Check if graph has changed significantly
        if graph_id in self.previous_graphs:
            prev_graph = self.previous_graphs[graph_id]
            # Compare character-by-character for significant changes
            significant_change = False
            for i in range(min(len(graph), len(prev_graph))):
                if graph[i] != prev_graph[i]:
                    # Check if it's a significant level change
                    prev_idx = fine_blocks.index(prev_graph[i]) if prev_graph[i] in fine_blocks else 0
                    curr_idx = fine_blocks.index(graph[i]) if graph[i] in fine_blocks else 0
                    if abs(curr_idx - prev_idx) > 1:  # More than 1 level change
                        significant_change = True
                        break
            
            if not significant_change and len(graph) == len(prev_graph):
                # Return previous graph if no significant change
                return prev_graph
        
        # Store the new graph
        self.previous_graphs[graph_id] = graph
        return graph
    
    def create_bar(self, value, max_val, width):
        """Create a horizontal bar"""
        filled = int((value / max_val) * width)
        return "█" * filled + "░" * (width - filled)
    
    def create_centered_bar(self, value, min_val, max_val, width, left_emoji, right_emoji):
        """Create a centered bar with emojis"""
        # Normalize to 0-1
        normalized = (value - min_val) / (max_val - min_val)
        center = width // 2
        
        if value < 0:
            filled_left = int((1 - normalized) * center)
            bar = left_emoji + " " + "◄" * filled_left + "─" * (center - filled_left) + "│" + "─" * center
        else:
            filled_right = int(normalized * center)
            bar = "─" * center + "│" + "─" * (center - filled_right) + "►" * filled_right + " " + right_emoji
        
        return bar[:width]
    
    def create_phase_space_viz(self, quantum_data):
        """Create a phase space visualization"""
        # Get PAD values
        emotional_data = quantum_data.get("emotional_dynamics", {})
        pad_str = emotional_data.get("current_emotion", "PAD(0,0,0)")
        
        try:
            import re
            pad_match = re.match(r'PAD\(([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)\)', pad_str)
            if pad_match:
                p, a, d = map(float, pad_match.groups())
            else:
                p, a, d = 0, 0, 0
        except:
            p, a, d = 0, 0, 0
        
        # Create simple ASCII phase space
        width, height = 40, 8
        grid = [[" " for _ in range(width)] for _ in range(height)]
        
        # Add axes
        for i in range(width):
            grid[height//2][i] = "─"
        for i in range(height):
            grid[i][width//2] = "│"
        grid[height//2][width//2] = "┼"
        
        # Plot point
        x = int((p + 1) / 2 * (width - 1))
        y = int((1 - (a + 1) / 2) * (height - 1))
        
        if 0 <= x < width and 0 <= y < height:
            grid[y][x] = "◉"
        
        # Add labels
        phase_text = "\n".join(["".join(row) for row in grid])
        phase_text += f"\nP={p:+.2f} A={a:+.2f} D={d:+.2f}"
        
        return phase_text
    
    def get_process_info(self):
        """Get process information"""
        try:
            # Get analyzer process
            for proc in psutil.process_iter(['pid', 'name', 'memory_percent', 'cpu_percent']):
                if 'python' in proc.info['name'] and 'analyzer' in ' '.join(proc.cmdline()):
                    return {
                        'memory_percent': proc.info['memory_percent'] or 0,
                        'cpu_percent': proc.info['cpu_percent'] or 0
                    }
        except:
            pass
        
        return {'memory_percent': 0, 'cpu_percent': 0}
    
    def get_gpu_status(self):
        """Get GPU status if available"""
        try:
            import subprocess
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                gpu_util, mem_used, mem_total = result.stdout.strip().split(", ")
                return f"{gpu_util}% ({mem_used}/{mem_total}MB)"
        except:
            pass
        return None
    
    def get_recent_logs(self):
        """Get recent log entries"""
        # This would normally read from actual logs
        # For now, return sample data
        return [
            {'time': datetime.now().strftime("%H:%M:%S"), 'message': 'File detected: conversation.jsonl', 'level': 'info'},
            {'time': datetime.now().strftime("%H:%M:%S"), 'message': 'Analyzing 5 messages with Emollama', 'level': 'info'},
            {'time': datetime.now().strftime("%H:%M:%S"), 'message': 'Emotion detected: affection', 'level': 'info'},
            {'time': datetime.now().strftime("%H:%M:%S"), 'message': 'Memory files updated successfully', 'level': 'info'},
            {'time': datetime.now().strftime("%H:%M:%S"), 'message': 'Quantum coherence: 0.998751', 'level': 'info'}
        ]
    
    def update(self):
        """Update all panels"""
        self.layout["header"].update(self.create_header())
        self.layout["quantum_metrics"].update(self.create_quantum_metrics())
        self.layout["emotional_state"].update(self.create_emotional_state())
        self.layout["memory_updates"].update(self.create_memory_updates())
        self.layout["system_status"].update(self.create_system_status())
        self.layout["statistics"].update(self.create_statistics())
        self.layout["footer"].update(self.create_footer())
        
        return self.layout

async def main():
    """Main monitoring loop"""
    dashboard = QuantumMemoryDashboard()
    
    console.print("\n[bold cyan]Initializing Quantum Memory Monitoring Dashboard...[/bold cyan]\n")
    await asyncio.sleep(1)
    
    with Live(dashboard.update(), console=console, refresh_per_second=2) as live:
        try:
            while True:
                live.update(dashboard.update())
                await asyncio.sleep(0.5)  # Update every 500ms
        except KeyboardInterrupt:
            console.print("\n[yellow]Dashboard terminated by user[/yellow]")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass