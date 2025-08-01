# Strategy Backup System

The Hermes Trading Post now includes a comprehensive in-app backup system for preserving your winning trading strategies.

## Features

### 💾 Save Current Strategy
- Save any strategy configuration with a custom name and description
- Automatically captures current backtest results including win rate, total return, and trade count
- Stores all strategy parameters for perfect restoration

### 📁 Saved Strategies Management
- View all saved strategies in an organized grid layout
- See performance metrics at a glance
- Identify active strategies with visual highlighting
- Search and filter through your strategy collection

### 🔄 Restore Functionality
- One-click restoration of any saved strategy
- Automatically switches to the correct strategy type
- Restores all parameters exactly as saved
- Switches to config tab to show restored settings

### 📤 Export/Import
- Export strategies as JSON files for backup or sharing
- Import strategies from other traders or systems
- Preserves all settings and metadata
- Automatic validation of imported data

## How to Use

1. **Saving a Strategy**
   - Run a successful backtest
   - Click the "Backup" tab in the strategy panel
   - Enter a name and optional description
   - Click "Save Strategy"

2. **Restoring a Strategy**
   - Go to the "Backup" tab
   - Find your saved strategy in the grid
   - Click the "🔄 Restore" button
   - Confirm the restoration

3. **Exporting a Strategy**
   - Click the "📤 Export" button on any saved strategy
   - The strategy will download as a JSON file
   - Share this file with others or keep as backup

4. **Importing a Strategy**
   - Click the "📥 Import" button at the top of the saved strategies section
   - Paste the JSON content into the dialog
   - Click "Import" to add it to your collection

## Storage

All strategies are stored in your browser's localStorage under the key `hermes_saved_strategies`. This means:
- Strategies persist between sessions
- No server storage required
- Strategies are specific to your browser
- Clearing browser data will remove saved strategies

## Best Practices

1. **Name Strategies Descriptively**: Include timeframe, market conditions, or performance metrics in the name
2. **Use Descriptions**: Add notes about when/why a strategy works well
3. **Export Important Strategies**: Keep JSON backups of your best performers
4. **Test Before Saving**: Only save strategies that have been properly backtested
5. **Regular Cleanup**: Delete old or underperforming strategies to keep your collection organized

## Example Workflow

1. Configure the Reverse Ratio strategy for 1H/1m trading
2. Run backtest and achieve 70% win rate
3. Open Backup tab
4. Save as "1H Micro Scalper - 70% WR"
5. Add description: "Works best in ranging markets, 0.85% profit target"
6. Export for safekeeping
7. Share with trading community if desired

The backup system ensures you never lose a winning configuration and can quickly switch between different market strategies!