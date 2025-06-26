#!/bin/bash
# Script to identify files that can be removed when migrating from Streamlit to Dash

echo "=== Files to Remove (Streamlit-specific) ==="
echo ""
echo "These files import streamlit and are not needed for a pure Dash application:"
echo ""

# List of Streamlit files
streamlit_files=(
    "services/dashboard_service.py"
    "core/app_config.py"
    "components/sidebar_components.py"
    "components/strategies/always_gain_components.py"
    "components/strategy_dashboards.py"
    "components/dashboard_widgets.py"
    "components/drag_drop_dashboard.py"
    "components/market_data.py"
    "components/backtesting/chart_components.py"
    "components/dashboard_components.py"
    "components/backtest_components.py"
    "components/backtesting/analysis_components.py"
    "components/order_book_streamlit_old.py"
)

for file in "${streamlit_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (not found)"
    fi
done

echo ""
echo "=== Files to Keep (Dash-specific with plotly) ==="
echo ""
echo "These files use plotly for Dash components and should be kept:"
echo ""

dash_files=(
    "pages/dashboard.py"
    "pages/live_trading.py"
    "pages/paper_trading.py"
    "pages/backtesting.py"
    "components/webgl_charts.py"
)

for file in "${dash_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (not found)"
    fi
done

echo ""
echo "=== Files to Review ==="
echo ""
echo "These files need manual review to determine if they're Dash or Streamlit specific:"
echo ""

review_files=(
    "dash_components/bitcoin_chart.py"
    "dash_components/chart_cards_simple.py"
    "dash_components/chart_cards.py"
    "dash_components/draggable_layout.py"
    "components/order_book_dash.py"
)

for file in "${review_files[@]}"; do
    if [ -f "$file" ]; then
        echo "? $file"
    fi
done

echo ""
echo "To remove all Streamlit files, run:"
echo "rm -f ${streamlit_files[*]}"
echo ""
echo "WARNING: Make sure to backup your code before removing files!"