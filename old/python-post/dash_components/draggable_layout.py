"""
Draggable Layout Components for Dash Dashboard
Creates movable cards with layout persistence
"""

import dash
from dash import html, dcc, callback, Input, Output, State
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import json
import os
from typing import Dict, List, Any


class DraggableCard:
    """Create draggable card components"""
    
    @staticmethod
    def create_price_card(coin_data: Dict[str, Any], card_id: str):
        """Create a price display card"""
        price = coin_data.get('current_price', 0)
        change = coin_data.get('change', 0)
        change_pct = coin_data.get('change_pct', 0)
        
        color = "success" if change >= 0 else "danger"
        arrow = "↗" if change >= 0 else "↘"
        
        return dbc.Card([
            dbc.CardHeader([
                html.H5(f"💰 {card_id}", className="mb-0"),
                html.Small("Live Price", className="text-muted")
            ]),
            dbc.CardBody([
                html.H2(f"${price:,.2f}", className="text-center mb-2"),
                html.P([
                    html.Span(f"{arrow} ${change:+,.2f} ", className=f"text-{color}"),
                    html.Span(f"({change_pct:+.2f}%)", className=f"text-{color}")
                ], className="text-center mb-0"),
                html.Hr(),
                html.Small([
                    html.Strong("24h High: "), f"${coin_data.get('high_24h', 0):,.2f}", html.Br(),
                    html.Strong("24h Low: "), f"${coin_data.get('low_24h', 0):,.2f}", html.Br(),
                    html.Strong("Volume: "), f"{coin_data.get('volume_24h', 0):,.0f}"
                ], className="text-muted")
            ])
        ], id=f"price-card-{card_id.lower()}", className="mb-3 draggable-card")
    
    @staticmethod
    def create_chart_card(figure: go.Figure, card_id: str, title: str):
        """Create a chart card"""
        return dbc.Card([
            dbc.CardHeader([
                html.H5(f"📈 {title}", className="mb-0"),
                html.Small("Historical Data", className="text-muted")
            ]),
            dbc.CardBody([
                dcc.Graph(
                    figure=figure,
                    id=f"chart-{card_id.lower()}",
                    config={'displayModeBar': False}
                )
            ])
        ], id=f"chart-card-{card_id.lower()}", className="mb-3 draggable-card")
    
    @staticmethod
    def create_portfolio_card(portfolio_data: Dict[str, Any]):
        """Create portfolio overview card"""
        total_value = portfolio_data.get('total_value', 0)
        available_cash = portfolio_data.get('available_cash', 0)
        positions = portfolio_data.get('positions', [])
        
        return dbc.Card([
            dbc.CardHeader([
                html.H5("💼 Portfolio", className="mb-0"),
                html.Small("Overview", className="text-muted")
            ]),
            dbc.CardBody([
                html.H3(f"${total_value:,.2f}", className="text-center text-primary mb-3"),
                html.Div([
                    dbc.Row([
                        dbc.Col([
                            html.P([
                                html.Strong("Available Cash:"), html.Br(),
                                html.Span(f"${available_cash:,.2f}", className="text-success")
                            ], className="mb-2")
                        ], width=6),
                        dbc.Col([
                            html.P([
                                html.Strong("Positions:"), html.Br(),
                                html.Span(f"{len(positions)}", className="text-info")
                            ], className="mb-2")
                        ], width=6)
                    ])
                ])
            ])
        ], id="portfolio-card", className="mb-3 draggable-card")
    
    @staticmethod
    def create_trading_controls_card():
        """Create trading controls card"""
        return dbc.Card([
            dbc.CardHeader([
                html.H5("⚡ Quick Trade", className="mb-0"),
                html.Small("Paper Trading", className="text-muted")
            ]),
            dbc.CardBody([
                dbc.Row([
                    dbc.Col([
                        dbc.Label("Trading Pair"),
                        dcc.Dropdown(
                            id="trading-pair-dropdown",
                            options=[
                                {"label": "BTC-USD", "value": "BTC-USD"},
                                {"label": "ETH-USD", "value": "ETH-USD"},
                                {"label": "SOL-USD", "value": "SOL-USD"}
                            ],
                            value="BTC-USD",
                            clearable=False
                        )
                    ], width=12, className="mb-3"),
                    dbc.Col([
                        dbc.Label("Amount ($)"),
                        dbc.Input(
                            id="trade-amount",
                            type="number",
                            value=100,
                            min=1,
                            step=1
                        )
                    ], width=12, className="mb-3"),
                    dbc.Col([
                        dbc.ButtonGroup([
                            dbc.Button("🟢 BUY", color="success", id="buy-btn", className="me-2"),
                            dbc.Button("🔴 SELL", color="danger", id="sell-btn")
                        ], className="w-100")
                    ], width=12)
                ])
            ])
        ], id="trading-card", className="mb-3 draggable-card")


class DraggableGrid:
    """Create a draggable grid layout"""
    
    def __init__(self):
        self.layout_file = "dash_layout.json"
    
    def save_layout(self, layout_data: Dict):
        """Save layout to file"""
        try:
            with open(self.layout_file, 'w') as f:
                json.dump(layout_data, f)
        except Exception as e:
            print(f"Error saving layout: {e}")
    
    def load_layout(self) -> Dict:
        """Load layout from file"""
        default_layout = {
            "lg": [
                {"i": "portfolio-card", "x": 0, "y": 0, "w": 4, "h": 3},
                {"i": "price-card-btc", "x": 4, "y": 0, "w": 4, "h": 3},
                {"i": "trading-card", "x": 8, "y": 0, "w": 4, "h": 3},
                {"i": "chart-card-btc", "x": 0, "y": 3, "w": 12, "h": 6}
            ]
        }
        
        try:
            if os.path.exists(self.layout_file):
                with open(self.layout_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading layout: {e}")
        
        return default_layout
    
    def create_grid_layout(self, cards: List[html.Div]):
        """Create responsive grid layout with draggable cards"""
        
        # Custom CSS for draggable cards
        custom_css = html.Style(children="""
            .draggable-card {
                cursor: move;
                transition: transform 0.2s;
                height: 100%;
            }
            .draggable-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
            }
            .react-grid-item {
                transition: all 200ms ease;
                transition-property: left, top;
            }
            .react-grid-item.react-grid-placeholder {
                background: rgba(0, 123, 255, 0.2);
                border-radius: 4px;
                z-index: 2;
                user-select: none;
            }
            .react-grid-layout {
                position: relative;
            }
        """)
        
        # For now, use a simple responsive layout (dash-draggable might need alternative)
        # We'll create a grid using Bootstrap instead
        return html.Div([
            custom_css,
            dbc.Container([
                dbc.Row([
                    dbc.Col(cards[0] if len(cards) > 0 else html.Div(), width=12, lg=4, className="mb-3"),
                    dbc.Col(cards[1] if len(cards) > 1 else html.Div(), width=12, lg=4, className="mb-3"),
                    dbc.Col(cards[2] if len(cards) > 2 else html.Div(), width=12, lg=4, className="mb-3"),
                ], className="mb-4"),
                dbc.Row([
                    dbc.Col(cards[3] if len(cards) > 3 else html.Div(), width=12, className="mb-3")
                ])
            ], fluid=True, id="dashboard-grid")
        ])


# Global instance
draggable_grid = DraggableGrid()
