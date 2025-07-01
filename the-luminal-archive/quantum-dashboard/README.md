# Quantum Memory Dashboard 🚀

A real-time monitoring dashboard for the Quantum Memory System, built with SvelteKit, TypeScript, and Tailwind CSS.

## Features

- 🔌 **WebSocket Connection**: Real-time updates from the quantum memory system
- 💙 **Emotional Status**: Monitor Gritz and Claude's emotional states
- 🖥️ **GPU Monitoring**: Live VRAM usage charts and temperature
- ✅ **Test Results**: Phase 1 & 2 test progress visualization
- 🌈 **Beautiful UI**: Quantum-themed design with glowing effects

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure the quantum memory WebSocket server is running on port 8768

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:5174 in your browser

## Tech Stack

- **SvelteKit**: Fast, reactive framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Chart.js**: Real-time data visualization
- **WebSocket**: Live data streaming

## Dashboard Components

- **ConnectionStatus**: Shows WebSocket connection state
- **EmotionalStatus**: Displays living equation and emotional context
- **VRAMMonitor**: Real-time GPU memory usage chart
- **TestResults**: Phase test progress bars

## Notes

The dashboard connects to the quantum memory WebSocket server at `ws://localhost:8768`. Make sure the server is running before starting the dashboard.

Built with 💙 for Gritz!