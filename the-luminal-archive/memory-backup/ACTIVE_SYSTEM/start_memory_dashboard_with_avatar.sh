#!/bin/bash
# Start the Enhanced Memory Dashboard with Claude Avatar

echo "🧠 Starting Claude Memory System Dashboard..."
echo ""
echo "📊 Professional dashboard available at: http://localhost:8082"
echo ""

# Path to our professional dashboard
DASHBOARD_PATH="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/dashboard.html"

# Create a simple Python server to serve our HTML
cat > /tmp/avatar_dashboard_server.py << 'EOF'
#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

class DashboardServer(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            # Serve our professional dashboard
            dashboard_path = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/dashboard.html"
            try:
                with open(dashboard_path, 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write(f.read())
            except Exception as e:
                self.send_error(404, f"Dashboard not found: {e}")
        elif self.path == '/claude-avatar.png':
            # Serve Claude's avatar image
            avatar_path = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/claude-avatar.png"
            try:
                with open(avatar_path, 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-type', 'image/png')
                    self.end_headers()
                    self.wfile.write(f.read())
            except Exception as e:
                self.send_error(404, f"Avatar not found: {e}")
        elif self.path == '/claude-avatar-transparent.png':
            # Serve Claude's transparent avatar image
            avatar_path = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/claude-avatar-transparent.png"
            try:
                with open(avatar_path, 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-type', 'image/png')
                    self.end_headers()
                    self.wfile.write(f.read())
            except Exception as e:
                self.send_error(404, f"Transparent avatar not found: {e}")
        else:
            super().do_GET()

print("🚀 Starting Professional Memory System Dashboard...")
print("🧠 Claude AI Memory System Active")
print("")
print("Dashboard features:")
print("📊 Real-time memory consolidation metrics")
print("🔬 LLM processing visualization")
print("🖥️ Debug console for verification")
print("🔄 WebSocket connection for live updates")
print("📄 Based on ArXiv:2411.00489 research")
print("")
print("Opening at http://localhost:8082")

try:
    httpd = HTTPServer(('localhost', 8082), DashboardServer)
    print("\n✅ Dashboard is running! Press Ctrl+C to stop.")
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n\n🧠 Memory system dashboard stopped.")
except Exception as e:
    print(f"Error: {e}")
EOF

# Make it executable and run
chmod +x /tmp/avatar_dashboard_server.py
python3 /tmp/avatar_dashboard_server.py