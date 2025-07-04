#!/usr/bin/env python3
"""Test script to demonstrate graph smoothing improvements"""

import time
import math
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.table import Table

console = Console()

def create_graph_old(data, width):
    """Old graph method without smoothing"""
    if not data:
        return "─" * width
    
    min_val = min(data) if data else 0
    max_val = max(data) if data else 1
    range_val = max_val - min_val if max_val != min_val else 1
    
    chars = " ▁▂▃▄▅▆▇█"
    graph = ""
    
    # Simple sampling
    step = max(1, len(data) // width)
    for i in range(0, min(len(data), width * step), step):
        val = data[i]
        normalized = (val - min_val) / range_val
        char_idx = int(normalized * (len(chars) - 1))
        graph += chars[char_idx]
    
    return graph[:width]

def create_graph_new(data, width, smooth_factor=0.3):
    """New graph method with smoothing"""
    if not data:
        return "─" * width
    
    # Apply exponential moving average
    smoothed = []
    for i, val in enumerate(data):
        if i == 0:
            smoothed.append(val)
        else:
            smoothed.append(smooth_factor * val + (1 - smooth_factor) * smoothed[-1])
    
    min_val = min(smoothed) if smoothed else 0
    max_val = max(smoothed) if smoothed else 1
    range_val = max_val - min_val if max_val != min_val else 1
    
    fine_blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
    graph = ""
    
    # Better sampling with interpolation
    step = max(1, len(smoothed) // width)
    for i in range(0, min(len(smoothed), width * step), step):
        val = smoothed[i]
        normalized = (val - min_val) / range_val
        level = normalized * 8
        char_idx = int(min(level, 7))
        graph += fine_blocks[char_idx]
    
    return graph[:width]

def main():
    # Generate test data with noise
    data = []
    
    table = Table(title="Graph Smoothing Comparison")
    table.add_column("Type", style="cyan", width=20)
    table.add_column("Graph", style="green", width=50)
    
    with Live(table, console=console, refresh_per_second=10) as live:
        for frame in range(200):
            # Generate wave with noise
            t = frame * 0.1
            value = math.sin(t) * 0.5 + 0.5  # Base sine wave
            value += (hash(frame) % 20 - 10) * 0.02  # Add noise
            data.append(value)
            
            if len(data) > 50:
                data.pop(0)
            
            # Update table
            table = Table(title=f"Graph Smoothing Comparison (Frame {frame})")
            table.add_column("Type", style="cyan", width=20)
            table.add_column("Graph", style="green", width=50)
            
            # Show both versions
            old_graph = create_graph_old(data, 40)
            new_graph = create_graph_new(data, 40)
            
            table.add_row("Original (Flickery)", old_graph)
            table.add_row("Smoothed (Stable)", new_graph)
            
            # Show raw values
            recent_values = [f"{v:.2f}" for v in data[-5:]]
            table.add_row("Recent Values", " ".join(recent_values))
            
            live.update(table)
            time.sleep(0.05)

if __name__ == "__main__":
    console.print("\n[bold cyan]Graph Smoothing Demonstration[/bold cyan]")
    console.print("Watch how the smoothed graph reduces flicker while maintaining the signal shape\n")
    
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Demo stopped[/yellow]")