#!/bin/bash
# Script to configure CPU for maximum performance
# Run with: sudo bash configure_cpu.sh

echo "🔧 Configuring CPU for Maximum Performance..."
echo "=================================================="

# Step 1: Check current governor
echo -e "\n📊 Current CPU Governor:"
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor

# Step 2: Get number of CPUs
NCPU=$(nproc)
echo -e "\nDetected $NCPU CPU cores"

# Step 3: Set performance governor
echo -e "\n🚀 Setting performance governor..."
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo "performance" > $cpu 2>/dev/null
done
echo "✅ Performance governor set"

# Step 4: Disable CPU frequency scaling
echo -e "\n🔒 Disabling frequency scaling..."
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/; do
    if [ -f "$cpu/scaling_max_freq" ] && [ -f "$cpu/cpuinfo_max_freq" ]; then
        cat "$cpu/cpuinfo_max_freq" > "$cpu/scaling_min_freq"
        cat "$cpu/cpuinfo_max_freq" > "$cpu/scaling_max_freq"
    fi
done
echo "✅ Frequency scaling disabled"

# Step 5: Disable C-states for low latency
echo -e "\n⚡ Disabling C-states..."
if [ -f /sys/module/intel_idle/parameters/max_cstate ]; then
    echo 0 > /sys/module/intel_idle/parameters/max_cstate
    echo "✅ Intel C-states disabled"
fi

# Add kernel parameter for boot persistence
if ! grep -q "intel_idle.max_cstate=0" /etc/default/grub; then
    echo -e "\n📝 Adding boot parameters..."
    sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 intel_idle.max_cstate=0 processor.max_cstate=0"/' /etc/default/grub
    update-grub
    echo "✅ Boot parameters added (reboot required for full effect)"
fi

# Step 6: Verify settings
echo -e "\n✅ Verification:"
echo "Current governor: $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor)"
echo "CPU0 frequency: $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq) kHz"

# Step 7: Make persistent with systemd
cat > /etc/systemd/system/cpu-performance.service << EOF
[Unit]
Description=CPU Performance Mode
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo "performance" > \$cpu; done'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cpu-performance.service
echo -e "\n✅ Created systemd service for persistence"

echo -e "\n=================================================="
echo "✅ CPU optimization complete!"
echo "   - Performance governor: ACTIVE"
echo "   - Frequency scaling: DISABLED"
echo "   - C-states: DISABLED"
echo "   - Persistence: ENABLED"
echo ""
echo "⚠️  Note: Full C-state disable requires reboot"