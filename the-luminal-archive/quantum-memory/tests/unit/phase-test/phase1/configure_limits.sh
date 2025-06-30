#!/bin/bash
# Script to configure system limits for quantum memory system
# Run with: sudo bash configure_limits.sh

echo "🔧 Configuring System Limits..."
echo "=================================================="

# Step 1: Check current limits
echo -e "\n📊 Current Limits:"
echo "File descriptors (soft): $(ulimit -Sn)"
echo "File descriptors (hard): $(ulimit -Hn)"

# Step 2: Update limits.conf
echo -e "\n📝 Updating /etc/security/limits.conf..."

# Backup original file
cp /etc/security/limits.conf /etc/security/limits.conf.backup

# Add quantum memory system limits
cat >> /etc/security/limits.conf << EOF

# Quantum Memory System Limits
* soft nofile 65536
* hard nofile 65536
* soft memlock unlimited
* hard memlock unlimited
* soft nproc 32768
* hard nproc 32768
* soft stack unlimited
* hard stack unlimited
EOF

echo "✅ Limits.conf updated"

# Step 3: Update systemd limits
echo -e "\n📝 Updating systemd limits..."
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/limits.conf << EOF
[Manager]
DefaultLimitNOFILE=65536
DefaultLimitMEMLOCK=infinity
EOF

echo "✅ Systemd limits updated"

# Step 4: Update sysctl for network and memory
echo -e "\n📝 Updating sysctl settings..."
cat > /etc/sysctl.d/99-quantum-memory.conf << EOF
# Quantum Memory System Optimizations
# File descriptors
fs.file-max = 2097152

# Network optimizations for WebSocket
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Memory optimizations
vm.max_map_count = 262144
vm.dirty_ratio = 5
vm.dirty_background_ratio = 2
EOF

# Apply sysctl settings
sysctl -p /etc/sysctl.d/99-quantum-memory.conf

echo "✅ Sysctl settings applied"

# Step 5: Configure log rotation for quantum logs
echo -e "\n📝 Setting up log rotation..."
cat > /etc/logrotate.d/quantum-memory << EOF
/var/log/quantum-memory/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        # Signal the quantum memory service to reopen logs
        pkill -USR1 -f "quantum-memory" || true
    endscript
}
EOF

mkdir -p /var/log/quantum-memory
chown $USER:$USER /var/log/quantum-memory

echo "✅ Log rotation configured"

# Step 6: Verify new settings
echo -e "\n✅ Verification:"
echo "File max: $(cat /proc/sys/fs/file-max)"
echo "Max map count: $(cat /proc/sys/vm/max_map_count)"

echo -e "\n=================================================="
echo "✅ System limits configuration complete!"
echo ""
echo "⚠️  Note: Logout and login again for user limits to take effect"
echo "    Or run: exec su -l $USER"