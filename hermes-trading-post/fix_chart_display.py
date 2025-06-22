#!/usr/bin/env python3
"""
Quick fix to ensure charts display properly
"""

# Read the dashboard integration file
with open('components/chart_acceleration/dashboard_integration.py', 'r') as f:
    content = f.read()

# Remove prevent_initial_call=True from the chart update callback
content = content.replace('prevent_initial_call=True', 'prevent_initial_call=False')

# Write it back
with open('components/chart_acceleration/dashboard_integration.py', 'w') as f:
    f.write(content)

print("✅ Fixed chart display issue - removed prevent_initial_call")
print("   Charts will now render immediately on page load!")
print("\n🚀 Restart the app to see the changes")