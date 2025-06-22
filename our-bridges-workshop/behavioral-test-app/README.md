# AI Behavioral Differentiation Test - Tauri Desktop App

A desktop application for running and monitoring AI behavioral differentiation experiments with real-time visualization and statistical analysis.

## Features

- **Real-time Testing**: Run behavioral differentiation tests with multiple AI personality groups
- **Live Dashboard**: Monitor test progress with real-time charts and statistics  
- **Statistical Analysis**: Automatic calculation of effect sizes and significance testing
- **Data Export**: Export results to CSV and JSON formats
- **Desktop Native**: Fast, secure desktop application built with Tauri

## Architecture

- **Frontend**: HTML/CSS/JavaScript with Chart.js for visualizations
- **Backend**: Python HTTP API server for test execution
- **Desktop Shell**: Tauri (Rust) for native desktop integration

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Tauri CLI (if not already installed):
   ```bash
   npm install -g @tauri-apps/cli
   ```

3. Start the Python backend:
   ```bash
   python3 ../behavioral_test_backend.py
   ```

4. Run the development server:
   ```bash
   npm run tauri:dev
   ```

## Building

Build the desktop application:
```bash
npm run tauri:build
```

## Usage

1. Configure test parameters in the sidebar:
   - Number of prompts to test (5-25)
   - Test speed (0.5-3.0 seconds between prompts)
   - Select personality groups to include

2. Click "🚀 Start Behavioral Test" to begin

3. Monitor progress in real-time on the Dashboard tab

4. View detailed charts in the Charts tab

5. Examine results and statistical analysis in respective tabs

## Test Groups

- **Control**: Baseline AI responses without personality modifications
- **High Conscientiousness**: Responses emphasizing structure and detail
- **High Openness**: Responses showing creativity and exploration
- **High Extraversion**: Responses with collaborative and social elements

## Success Criteria

The test evaluates three key criteria:
1. Statistical significance (p < 0.05)
2. Effect size (Cohen's d > 0.5)
3. Response consistency within groups

## Files

- `index.html` - Main application interface
- `src/main.js` - Frontend application logic
- `src-tauri/` - Tauri configuration and Rust backend
- `../behavioral_test_backend.py` - Python API server
- `../behavioral_test_dashboard.py` - Original Streamlit version

## Converting from Streamlit

This Tauri version provides the same functionality as the original Streamlit dashboard but as a native desktop application with better performance and security.