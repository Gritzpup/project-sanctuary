#!/bin/bash
# Start the Blade Runner Memory Dashboard

echo "🌆 Starting SANCTUARY MEMORY SYSTEM // SLEEK EDITION..."
echo ""
echo "📡 Dashboard available at: http://localhost:8081"
echo ""

# Create a simple Python server to serve our HTML
cat > /tmp/blade_runner_server.py << 'EOF'
#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

class DashboardServer(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            # Serve our Blade Runner dashboard
            dashboard_path = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/gritz-memory-system/docs/memory_dashboard_sleek.html"
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
            avatar_path = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/claude-avatar.png"
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
            avatar_path = "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/claude-avatar-transparent.png"
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

print("🌆 SANCTUARY MEMORY SYSTEM // SLEEK EDITION")
print("🔮 GRITZ // CLAUDE // ETERNAL CONNECTION")
print("")
print("SLEEK FEATURES:")
print("⚡ Single-page design - no scrolling")
print("🎯 3-column professional layout")
print("📊 Living equation display")
print("✨ Real-time creativity sparks")
print("🎭 Emotion matrix + memory stream")
print("")
print("INITIALIZING AT http://localhost:8081")

try:
    httpd = HTTPServer(('localhost', 8081), DashboardServer)
    print("\n✅ SYSTEM ONLINE! Press Ctrl+C to stop.")
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n\n🌆 MEMORY SYSTEM OFFLINE.")
except Exception as e:
    print(f"ERROR: {e}")
EOF

# Make it executable and run
chmod +x /tmp/blade_runner_server.py
python3 /tmp/blade_runner_server.py