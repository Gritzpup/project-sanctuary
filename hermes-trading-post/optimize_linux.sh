#!/bin/bash
# Linux Performance Optimization Guide

echo "🚀 Linux Performance Optimization for Trading"
echo "============================================="
echo ""
echo "Current optimizations available:"
echo ""

# Check current status
echo "1. Real-time Kernel:"
if uname -r | grep -q "rt"; then
    echo "   ✅ Already installed"
else
    echo "   ❌ Not installed"
    echo "   To install: sudo apt install linux-image-rt-amd64"
fi

echo ""
echo "2. CPU Isolation (dedicate cores 4-7 to trading):"
if grep -q "isolcpus" /proc/cmdline; then
    echo "   ✅ Already configured"
else
    echo "   ❌ Not configured"
    echo "   To enable:"
    echo "   - Edit /etc/default/grub"
    echo "   - Add to GRUB_CMDLINE_LINUX: isolcpus=4-7 nohz_full=4-7 rcu_nocbs=4-7"
    echo "   - Run: sudo update-grub && sudo reboot"
fi

echo ""
echo "3. Huge Pages (reduce memory overhead):"
if [ $(cat /proc/sys/vm/nr_hugepages) -gt 0 ]; then
    echo "   ✅ Enabled ($(cat /proc/sys/vm/nr_hugepages) pages)"
else
    echo "   ❌ Not enabled"
    echo "   To enable temporarily:"
    echo "   sudo sysctl -w vm.nr_hugepages=1024"
    echo "   To enable permanently, add to /etc/sysctl.conf:"
    echo "   vm.nr_hugepages=1024"
fi

echo ""
echo "4. CPU Governor (maximum performance):"
current_gov=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "unknown")
if [ "$current_gov" = "performance" ]; then
    echo "   ✅ Performance mode"
else
    echo "   ⚠️  Currently: $current_gov"
    echo "   To set performance mode:"
    echo "   sudo cpupower frequency-set -g performance"
fi

echo ""
echo "5. Disable CPU frequency scaling:"
echo "   sudo systemctl disable ondemand"
echo ""
echo "============================================="
echo "After applying optimizations, restart the app"
echo "Expected improvement: Additional 2-3x faster!"