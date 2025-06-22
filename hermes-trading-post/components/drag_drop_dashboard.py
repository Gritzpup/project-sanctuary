"""
Interactive Drag & Drop Dashboard Components

This module provides a fully interactive drag-and-drop dashboard system where every component
can be moved in real-time with animated move icons and grid-based positioning.

Features:
- Real-time drag-and-drop with JavaScript integration
- Grid-based positioning with snap-to-grid
- Animated move icons and visual feedback
- Persistent component positions
- Editable section headers
- Move mode toggle for design/view modes

NOTE: This module is deprecated. Use components.interactive_dashboard instead.
"""

import streamlit as st
import json
import uuid
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

# Import data services
from services.data_service import get_enhanced_bitcoin_data
from components.strategies import generate_always_gain_backtest_trades, calculate_portfolio_metrics

# Import the new interactive dashboard
from components.interactive_dashboard import InteractiveDragDropDashboard, create_interactive_dashboard


# Legacy compatibility
class DragDropDashboard(InteractiveDragDropDashboard):
    """Legacy wrapper for backward compatibility"""
    
    def __init__(self, dashboard_id: str = "main"):
        super().__init__(dashboard_id)
        st.warning("⚠️ DragDropDashboard is deprecated. Use InteractiveDragDropDashboard instead.")


# Legacy function for backward compatibility
def create_drag_drop_dashboard(dashboard_id: str = "main") -> DragDropDashboard:
    """Create a legacy drag-drop dashboard (deprecated)"""
    st.warning("⚠️ create_drag_drop_dashboard is deprecated. Use create_interactive_dashboard instead.")
    return DragDropDashboard(dashboard_id)
    """Fully interactive dashboard with real-time drag-and-drop functionality"""
    
    def __init__(self, dashboard_id: str = "main"):
        self.dashboard_id = dashboard_id
        self.session_key = f"dashboard_layout_{dashboard_id}"
        self.move_mode_key = f"move_mode_{dashboard_id}"
        self.component_positions_key = f"component_positions_{dashboard_id}"
        self.unique_id = str(uuid.uuid4())[:8]
        self.initialize_layout()
    
    def initialize_layout(self):
        """Initialize the dashboard layout and component positions"""
        if self.session_key not in st.session_state:
            # Default grid layout
            st.session_state[self.session_key] = {
                "sections": {
                    "config": {
                        "title": "⚙️ Backtest Configuration",
                        "editable": True,
                        "row": 0,
                        "components": []
                    },
                    "results": {
                        "title": "📊 Backtest Results", 
                        "editable": True,
                        "row": 1,
                        "components": []
                    },
                    "analysis": {
                        "title": "📈 Analysis & Growth",
                        "editable": True,
                        "row": 2,
                        "components": []
                    }
                }
            }
        
        # Initialize component positions
        if self.component_positions_key not in st.session_state:
            st.session_state[self.component_positions_key] = {
                "strategy_params": {"section": "config", "order": 0, "width": 6},
                "backtest_period": {"section": "config", "order": 1, "width": 6},
                "portfolio_performance": {"section": "results", "order": 0, "width": 12},
                "bitcoin_chart": {"section": "results", "order": 1, "width": 6},
                "portfolio_growth": {"section": "analysis", "order": 0, "width": 6},
                "vault_growth": {"section": "analysis", "order": 1, "width": 6},
                "trade_summary": {"section": "analysis", "order": 2, "width": 6},
                "detailed_trade_summary": {"section": "analysis", "order": 3, "width": 6}
            }
        
        # Initialize move mode
        if self.move_mode_key not in st.session_state:
            st.session_state[self.move_mode_key] = False
    
    def inject_drag_drop_css(self):
        """Inject custom CSS for drag and drop functionality"""
        st.markdown("""
        <style>
        /* Drag and Drop Styles */
        .moveable-component {
            position: relative;
            border: 2px solid transparent;
            border-radius: 8px;
            padding: 10px;
            margin: 5px;
            background: var(--background-color);
            transition: all 0.3s ease;
        }
        
        .moveable-component.move-mode {
            border: 2px dashed #ff6b6b;
            background: rgba(255, 107, 107, 0.05);
            cursor: grab;
        }
        
        .moveable-component.move-mode:hover {
            border-color: #ff5252;
            background: rgba(255, 107, 107, 0.1);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
        }
        
        .moveable-component.dragging {
            cursor: grabbing;
            transform: rotate(3deg);
            opacity: 0.8;
            z-index: 1000;
        }
        
        .component-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .component-title {
            font-weight: bold;
            font-size: 1.1em;
            color: var(--text-color);
        }
        
        .move-icon {
            cursor: pointer;
            padding: 5px;
            border-radius: 4px;
            transition: all 0.3s ease;
            opacity: 0.6;
        }
        
        .move-icon:hover {
            opacity: 1;
            background: rgba(255, 107, 107, 0.2);
        }
        
        .move-icon.active {
            opacity: 1;
            background: #ff6b6b;
            color: white;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .section-header {
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0 10px 0;
            position: relative;
            cursor: default;
        }
        
        .section-header.move-mode {
            cursor: grab;
            border: 2px dashed #ffd93d;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        }
        
        .section-header.move-mode:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 217, 61, 0.3);
        }
        
        .section-title {
            font-size: 1.3em;
            font-weight: bold;
        }
        
        .editable-title {
            background: transparent;
            border: none;
            color: white;
            font-size: 1.3em;
            font-weight: bold;
            width: 100%;
        }
        
        .editable-title:focus {
            outline: 1px solid #ffd93d;
            background: rgba(255, 255, 255, 0.1);
        }
        
        .drop-zone {
            min-height: 50px;
            border: 2px dashed transparent;
            border-radius: 8px;
            margin: 5px;
            transition: all 0.3s ease;
        }
        
        .drop-zone.active {
            border-color: #4ecdc4;
            background: rgba(78, 205, 196, 0.1);
        }
        
        .move-mode-toggle {
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 1000;
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 50px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        
        .move-mode-toggle:hover {
            background: #ff5252;
            transform: scale(1.05);
        }
        
        .move-mode-toggle.active {
            background: #4ecdc4;
            animation: pulse 2s infinite;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def render_move_mode_toggle(self):
        """Render the move mode toggle button"""
        move_mode = st.session_state[self.move_mode_key]
        
        toggle_html = f"""
        <div class="move-mode-toggle {'active' if move_mode else ''}" 
             onclick="toggleMoveMode()">
            {'🔒 Exit Move Mode' if move_mode else '✋ Move Mode'}
        </div>
        
        <script>
        function toggleMoveMode() {{
            // This would trigger a Streamlit rerun with move mode toggled
            // In a real implementation, this would communicate back to Streamlit
            alert('Move mode toggle clicked! In a full implementation, this would toggle the move mode.');
        }}
        </script>
        """
        
        st.markdown(toggle_html, unsafe_allow_html=True)
        
        # Streamlit toggle for functionality
        move_mode_col1, move_mode_col2 = st.columns([4, 1])
        with move_mode_col2:
            if st.button("✋ Toggle Move Mode", key=f"move_toggle_{self.dashboard_id}"):
                st.session_state[self.move_mode_key] = not st.session_state[self.move_mode_key]
                st.rerun()
    
    def render_moveable_component(self, component_id: str, title: str, content_func, **kwargs):
        """Render a moveable component with drag functionality"""
        move_mode = st.session_state[self.move_mode_key]
        
        # Component wrapper with move functionality
        component_class = "moveable-component"
        if move_mode:
            component_class += " move-mode"
        
        # Component HTML structure
        component_html = f"""
        <div class="{component_class}" id="component_{component_id}">
            <div class="component-header">
                <span class="component-title">{title}</span>
                <span class="move-icon {'active' if move_mode else ''}" 
                      onclick="toggleComponentMove('{component_id}')">
                    {'🔓' if move_mode else '✋'}
                </span>
            </div>
        </div>
        """
        
        st.markdown(component_html, unsafe_allow_html=True)
        
        # Render the actual component content
        with st.container():
            content_func(**kwargs)
        
        # Add move controls if in move mode
        if move_mode:
            self.render_move_controls(component_id)
    
    def render_move_controls(self, component_id: str):
        """Render move controls for a component"""
        st.markdown("---")
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            if st.button(f"⬆️ Up", key=f"move_up_{component_id}"):
                self.move_component(component_id, "up")
        
        with col2:
            if st.button(f"⬇️ Down", key=f"move_down_{component_id}"):
                self.move_component(component_id, "down")
        
        with col3:
            if st.button(f"⬅️ Left", key=f"move_left_{component_id}"):
                self.move_component(component_id, "left")
        
        with col4:
            if st.button(f"➡️ Right", key=f"move_right_{component_id}"):
                self.move_component(component_id, "right")
    
    def move_component(self, component_id: str, direction: str):
        """Move a component in the specified direction"""
        layout = st.session_state[self.session_key]
        
        if component_id in layout["components"]:
            component = layout["components"][component_id]
            current_row = component["row"]
            current_pos = component["position"]
            
            if direction == "up":
                # Move to previous row
                rows = list(layout["grid"].keys())
                current_idx = rows.index(current_row)
                if current_idx > 0:
                    new_row = rows[current_idx - 1]
                    layout["grid"][new_row]["components"].append(component_id)
                    layout["grid"][current_row]["components"].remove(component_id)
                    component["row"] = new_row
                    component["position"] = len(layout["grid"][new_row]["components"]) - 1
            
            elif direction == "down":
                # Move to next row
                rows = list(layout["grid"].keys())
                current_idx = rows.index(current_row)
                if current_idx < len(rows) - 1:
                    new_row = rows[current_idx + 1]
                    layout["grid"][new_row]["components"].append(component_id)
                    layout["grid"][current_row]["components"].remove(component_id)
                    component["row"] = new_row
                    component["position"] = len(layout["grid"][new_row]["components"]) - 1
            
            elif direction == "left" and current_pos > 0:
                # Move left within row
                component["position"] = current_pos - 1
                self.reorder_row_components(current_row)
            
            elif direction == "right":
                # Move right within row
                row_components = layout["grid"][current_row]["components"]
                if current_pos < len(row_components) - 1:
                    component["position"] = current_pos + 1
                    self.reorder_row_components(current_row)
            
            st.rerun()
    
    def reorder_row_components(self, row_id: str):
        """Reorder components in a row based on position"""
        layout = st.session_state[self.session_key]
        row_components = layout["grid"][row_id]["components"]
        
        # Sort components by position
        sorted_components = sorted(
            [(comp_id, layout["components"][comp_id]["position"]) for comp_id in row_components],
            key=lambda x: x[1]
        )
        
        # Update the row's component list
        layout["grid"][row_id]["components"] = [comp[0] for comp in sorted_components]
    
    def render_editable_header(self, row_id: str):
        """Render an editable section header"""
        move_mode = st.session_state[self.move_mode_key]
        layout = st.session_state[self.session_key]
        
        if row_id in layout["grid"]:
            header_data = layout["grid"][row_id]
            current_title = header_data["content"]
            
            header_class = "section-header"
            if move_mode:
                header_class += " move-mode"
            
            if header_data.get("editable", False) and move_mode:
                # Editable title in move mode
                col1, col2 = st.columns([4, 1])
                with col1:
                    new_title = st.text_input(
                        "Section Title",
                        value=current_title,
                        key=f"header_edit_{row_id}",
                        label_visibility="collapsed"
                    )
                    if new_title != current_title:
                        layout["grid"][row_id]["content"] = new_title
                
                with col2:
                    if st.button("✋ Move Section", key=f"move_section_{row_id}"):
                        st.info(f"Move section: {row_id}")
            else:
                # Static header
                header_html = f"""
                <div class="{header_class}">
                    <div class="section-title">{current_title}</div>
                    {f'<span class="move-icon {"active" if move_mode else ""}" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%);">✋</span>' if move_mode else ''}
                </div>
                """
                st.markdown(header_html, unsafe_allow_html=True)


# =============================================================================
# INDIVIDUAL MOVEABLE COMPONENTS
# =============================================================================

def component_strategy_params(dashboard: DragDropDashboard, **kwargs):
    """Strategy parameters component"""
    st.markdown("### Strategy Parameters")
    
    col1, col2 = st.columns(2)
    
    with col1:
        entry_threshold = st.slider(
            "Entry Threshold (%)",
            min_value=1.0, max_value=10.0, value=2.0, step=0.1,
            key="moveable_entry_threshold"
        )
        
        vault_allocation = st.slider(
            "Vault Allocation (%)",
            min_value=0.0, max_value=100.0, value=1.0, step=0.1,
            key="moveable_vault_allocation"
        )
    
    with col2:
        exit_target = st.slider(
            "Exit Target (%)",
            min_value=1.0, max_value=20.0, value=5.0, step=0.1,
            key="moveable_exit_target"
        )
    
    return {
        'entry_threshold': entry_threshold,
        'exit_target': exit_target,
        'vault_allocation': vault_allocation
    }


def component_backtest_period(dashboard: DragDropDashboard, **kwargs):
    """Backtest period and actions component"""
    st.markdown("### Backtest Period & Actions")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        timeframes = {
            "1 Week": 7,
            "2 Weeks": 14,
            "1 Month": 30,
            "3 Months": 90,
            "6 Months": 180,
            "1 Year": 365
        }
        
        selected_timeframe = st.selectbox(
            "Timeframe",
            options=list(timeframes.keys()),
            index=2,
            key="moveable_timeframe"
        )
        
        days_count = timeframes[selected_timeframe]
    
    with col2:
        run_backtest = st.button(
            "🔄 Run Backtest",
            type="primary",
            use_container_width=True,
            key="moveable_run_backtest"
        )
        
        st.button(
            "⚡ Quick Test",
            use_container_width=True,
            key="moveable_quick_test"
        )
    
    return {
        'selected_timeframe': selected_timeframe,
        'days_count': days_count,
        'run_backtest': run_backtest
    }


def component_portfolio_performance(dashboard: DragDropDashboard, metrics=None, **kwargs):
    """Portfolio performance metrics component"""
    st.markdown("### 💼 Portfolio Performance")
    
    if not metrics:
        st.info("Run a backtest to see portfolio performance")
        return
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        final_balance = metrics.get('final_balance', 0)
        initial_balance = metrics.get('initial_balance', 10000)
        balance_change = final_balance - initial_balance
        balance_pct = (balance_change / initial_balance) * 100 if initial_balance > 0 else 0
        
        st.metric(
            "Portfolio Value",
            f"${final_balance:,.2f}",
            f"${balance_change:+,.2f} ({balance_pct:+.2f}%)"
        )
    
    with col2:
        available_cash = metrics.get('available_cash', 0)
        st.metric("Available Cash", f"${available_cash:,.2f}")
    
    with col3:
        btc_balance = metrics.get('current_btc_balance', 0)
        btc_value = metrics.get('current_btc_value', 0)
        if btc_balance > 0:
            st.metric(
                "BTC Position",
                f"{btc_balance:.8f} BTC",
                f"${btc_value:,.2f} value"
            )
        else:
            st.metric("BTC Position", "0.00000000 BTC", "No position")
    
    with col4:
        vault_allocation = kwargs.get('vault_allocation', 1.0)
        vault_value = final_balance * (vault_allocation / 100)
        st.metric("USDC Vault", f"${vault_value:,.2f}", f"{vault_allocation}% allocation")


def component_bitcoin_chart(dashboard: DragDropDashboard, dates=None, prices=None, trades=None, **kwargs):
    """Bitcoin price chart component"""
    st.markdown("### 📈 Bitcoin Price Chart")
    
    if not dates or not prices:
        st.info("Load data to see Bitcoin price chart")
        return
    
    import plotly.graph_objects as go
    
    # Create the chart
    fig = go.Figure()
    
    # Add Bitcoin price line
    fig.add_trace(go.Scatter(
        x=dates,
        y=prices,
        mode='lines',
        name='Bitcoin Price',
        line=dict(color='orange', width=2),
        hovertemplate='<b>%{x}</b><br>Price: $%{y:,.2f}<extra></extra>'
    ))
    
    # Add trade markers if available
    if trades:
        buy_dates = [trade['date'] for trade in trades if trade['action'] == 'BUY']
        buy_prices = [trade['price'] for trade in trades if trade['action'] == 'BUY']
        sell_dates = [trade['date'] for trade in trades if trade['action'] == 'SELL']
        sell_prices = [trade['price'] for trade in trades if trade['action'] == 'SELL']
        
        if buy_dates:
            fig.add_trace(go.Scatter(
                x=buy_dates,
                y=buy_prices,
                mode='markers',
                name='Buy Signal',
                marker=dict(color='green', size=10, symbol='triangle-up'),
                hovertemplate='<b>BUY</b><br>%{x}<br>Price: $%{y:,.2f}<extra></extra>'
            ))
        
        if sell_dates:
            fig.add_trace(go.Scatter(
                x=sell_dates,
                y=sell_prices,
                mode='markers',
                name='Sell Signal',
                marker=dict(color='red', size=10, symbol='triangle-down'),
                hovertemplate='<b>SELL</b><br>%{x}<br>Price: $%{y:,.2f}<extra></extra>'
            ))
    
    fig.update_layout(
        title='Bitcoin Price with Trade Signals',
        xaxis_title='Date',
        yaxis_title='Price (USD)',
        hovermode='x unified',
        height=400
    )
    
    st.plotly_chart(fig, use_container_width=True)


def component_portfolio_growth(dashboard: DragDropDashboard, trades=None, **kwargs):
    """Portfolio growth chart component"""
    st.markdown("### 📊 Portfolio Growth")
    
    if not trades:
        st.info("Run a backtest to see portfolio growth")
        return
    
    import plotly.graph_objects as go
    
    # Calculate portfolio value over time
    portfolio_values = []
    current_balance = 10000  # Starting balance
    
    for trade in trades:
        current_balance = trade.get('balance_after', current_balance)
        portfolio_values.append(current_balance)
    
    if not portfolio_values:
        st.info("No portfolio data to display")
        return
    
    # Create chart
    fig = go.Figure()
    
    dates = [trade['date'] for trade in trades]
    
    fig.add_trace(go.Scatter(
        x=dates,
        y=portfolio_values,
        mode='lines+markers',
        name='Portfolio Value',
        line=dict(color='blue', width=2),
        marker=dict(size=4),
        hovertemplate='<b>%{x}</b><br>Value: $%{y:,.2f}<extra></extra>'
    ))
    
    fig.update_layout(
        title='Portfolio Value Over Time',
        xaxis_title='Date',
        yaxis_title='Portfolio Value (USD)',
        hovermode='x unified',
        height=300
    )
    
    st.plotly_chart(fig, use_container_width=True)


def component_vault_growth(dashboard: DragDropDashboard, trades=None, vault_allocation=1.0, **kwargs):
    """Vault growth chart component"""
    st.markdown("### 🏦 Vault Growth")
    
    if not trades:
        st.info("Run a backtest to see vault growth")
        return
    
    import plotly.graph_objects as go
    
    # Calculate vault value over time
    vault_values = []
    
    for trade in trades:
        portfolio_balance = trade.get('balance_after', 10000)
        vault_value = portfolio_balance * (vault_allocation / 100)
        vault_values.append(vault_value)
    
    if not vault_values:
        st.info("No vault data to display")
        return
    
    # Create chart
    fig = go.Figure()
    
    dates = [trade['date'] for trade in trades]
    
    fig.add_trace(go.Scatter(
        x=dates,
        y=vault_values,
        mode='lines+markers',
        name='Vault Value',
        line=dict(color='green', width=2),
        marker=dict(size=4),
        fill='tonexty',
        hovertemplate='<b>%{x}</b><br>Vault: $%{y:,.2f}<extra></extra>'
    ))
    
    fig.update_layout(
        title=f'USDC Vault Growth ({vault_allocation}%)',
        xaxis_title='Date',
        yaxis_title='Vault Value (USD)',
        hovermode='x unified',
        height=300
    )
    
    st.plotly_chart(fig, use_container_width=True)


def component_trade_summary(dashboard: DragDropDashboard, metrics=None, **kwargs):
    """Trade summary component"""
    st.markdown("### 📋 Trade Summary")
    
    if not metrics:
        st.info("Run a backtest to see trade summary")
        return
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        total_trades = metrics.get('total_trades', 0)
        st.metric("Total Trades", total_trades)
    
    with col2:
        win_rate = metrics.get('win_rate', 0)
        st.metric("Win Rate", f"{win_rate:.1f}%")
    
    with col3:
        total_profit = metrics.get('total_profit', 0)
        st.metric("Total Profit", f"${total_profit:,.2f}")


def component_detailed_trade_summary(dashboard: DragDropDashboard, trades=None, metrics=None, **kwargs):
    """Detailed trade summary component"""
    st.markdown("### 📊 Detailed Trade Analysis")
    
    if not trades or not metrics:
        st.info("Run a backtest to see detailed trade analysis")
        return
    
    # Advanced metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        profit_per_trade = metrics.get('total_profit', 0) / len(trades) if trades else 0
        st.metric("Avg Profit/Trade", f"${profit_per_trade:.2f}")
    
    with col2:
        total_fees = sum(trade.get('fee', 0) for trade in trades)
        st.metric("Total Fees", f"${total_fees:.2f}")
    
    with col3:
        buy_trades = [t for t in trades if t['action'] == 'BUY']
        sell_trades = [t for t in trades if t['action'] == 'SELL']
        st.metric("Buy/Sell Ratio", f"{len(buy_trades)}/{len(sell_trades)}")
    
    with col4:
        if trades:
            avg_trade_size = sum(trade.get('amount', 0) for trade in trades) / len(trades)
            st.metric("Avg Trade Size", f"{avg_trade_size:.6f} BTC")
    
    # Trade history table
    if st.checkbox("Show Trade History", key="detailed_trade_history"):
        import pandas as pd
        trades_df = pd.DataFrame(trades)
        
        if not trades_df.empty:
            # Format columns
            display_columns = ['date', 'action', 'price', 'amount', 'fee', 'balance_after']
            available_columns = [col for col in display_columns if col in trades_df.columns]
            
            if available_columns:
                display_df = trades_df[available_columns].copy()
                
                # Format numeric columns
                if 'price' in display_df.columns:
                    display_df['price'] = display_df['price'].apply(lambda x: f"${x:,.2f}")
                if 'amount' in display_df.columns:
                    display_df['amount'] = display_df['amount'].apply(lambda x: f"{x:.8f}")
                if 'fee' in display_df.columns:
                    display_df['fee'] = display_df['fee'].apply(lambda x: f"${x:.2f}")
                if 'balance_after' in display_df.columns:
                    display_df['balance_after'] = display_df['balance_after'].apply(lambda x: f"${x:,.2f}")
                
                st.dataframe(display_df, use_container_width=True, hide_index=True)
