"""
Simple test page to verify multi-page setup
"""
import dash
from dash import html

dash.register_page(__name__, path='/test', title='Test Page')

layout = html.Div([
    html.H1("Test Page"),
    html.P("If you can see this, the multi-page setup is working!"),
    html.P("The dashboard should be available at the root path: /")
])