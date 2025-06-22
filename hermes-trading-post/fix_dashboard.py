#!/usr/bin/env python3
"""
Fix dashboard to properly display charts
"""

import fileinput
import sys

print("🔧 Fixing dashboard chart display...")

# Read dashboard.py
with open('pages/dashboard.py', 'r') as f:
    content = f.read()

# Fix the import to use the fixed version
old_import = """from components.chart_acceleration.dashboard_integration import (
    AcceleratedChartComponent,
    create_bitcoin_chart,
    create_multi_symbol_charts,
    get_system_performance_summary
)"""

new_import = """from components.chart_acceleration.dashboard_integration_fixed import (
    AcceleratedChartComponent,
    create_bitcoin_chart,
    get_system_performance_summary,
    register_chart_callbacks
)"""

content = content.replace(old_import, new_import)

# Fix the callback registration
content = content.replace(
    "# Register chart callbacks\nbitcoin_chart.get_callbacks()",
    "# Register chart callbacks\nregister_chart_callbacks('btc-chart', bitcoin_chart)"
)

# Remove the print override that's hiding errors
content = content.replace(
    """# Disable verbose debug prints to reduce terminal spam
def print(*args, **kwargs):
    pass""",
    """# Enable debug prints for troubleshooting
import builtins
print = builtins.print"""
)

# Write back
with open('pages/dashboard.py', 'w') as f:
    f.write(content)

print("✅ Fixed dashboard.py")
print("\n📋 Changes made:")
print("   1. Using fixed dashboard integration module")
print("   2. Properly registering chart callbacks")
print("   3. Re-enabled print statements for debugging")
print("\n🚀 Restart the app to see the charts!")