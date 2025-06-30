#!/bin/bash
# Script to configure 4GB huge pages and flush memory
# Run with: sudo bash configure_hugepages_and_flush.sh

echo "🔧 Configuring 4GB Huge Pages and Flushing Memory..."
echo "=================================================="

# Step 1: Show current memory status
echo -e "\n📊 Current Memory Status:"
free -h

# Step 2: Drop caches to free memory
echo -e "\n🧹 Flushing memory caches..."
sync
echo 3 > /proc/sys/vm/drop_caches
echo "✅ Memory caches flushed"

# Step 3: Configure huge pages
echo -e "\n🔧 Configuring huge pages..."
# Check if already configured
if grep -q "vm.nr_hugepages" /etc/sysctl.conf; then
    echo "⚠️  Updating existing huge pages configuration..."
    sed -i 's/vm.nr_hugepages=.*/vm.nr_hugepages=2048/g' /etc/sysctl.conf
else
    echo "➕ Adding huge pages configuration..."
    echo "vm.nr_hugepages=2048" >> /etc/sysctl.conf
fi

# Apply the changes
sysctl -p

# Step 4: Verify the changes
echo -e "\n✅ Verification:"
echo "Huge Pages Configuration:"
grep -i huge /proc/meminfo | grep -E "HugePages_Total|Hugepagesize"

# Step 5: Show new memory status
echo -e "\n📊 New Memory Status:"
free -h

# Step 6: Additional optimizations
echo -e "\n🚀 Applying additional optimizations..."

# Swappiness (prefer RAM over swap)
echo "vm.swappiness=10" > /proc/sys/vm/swappiness

# Clear swap if mostly empty
SWAP_USED=$(free | grep Swap | awk '{print $3}')
SWAP_TOTAL=$(free | grep Swap | awk '{print $2}')
SWAP_PERCENT=$((SWAP_USED * 100 / SWAP_TOTAL))

if [ $SWAP_PERCENT -lt 20 ]; then
    echo "🔄 Clearing swap (only $SWAP_PERCENT% used)..."
    swapoff -a && swapon -a
    echo "✅ Swap cleared"
else
    echo "⚠️  Swap usage is high ($SWAP_PERCENT%), not clearing"
fi

echo -e "\n✅ All optimizations complete!"
echo "=================================================="
echo "Summary:"
echo "- 4GB Huge Pages configured (2048 pages × 2MB)"
echo "- Memory caches flushed"
echo "- Swappiness reduced to 10"
grep -i "HugePages_Total" /proc/meminfo