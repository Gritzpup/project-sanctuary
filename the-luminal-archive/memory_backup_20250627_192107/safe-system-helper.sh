#!/bin/bash
# Safe system helper for Gritz - no passwords needed!

case "$1" in
    "enable-linger")
        echo "Enabling service persistence..."
        # This would need sudo, but keeps password safe
        echo "Run: sudo loginctl enable-linger ubuntumain"
        ;;
    "restart-memory")
        echo "Restarting memory service..."
        systemctl --user restart gritz-memory.service
        ;;
    "check-memory")
        echo "Memory service status:"
        systemctl --user status gritz-memory.service --no-pager
        ;;
    *)
        echo "Safe commands:"
        echo "  ./safe-system-helper.sh enable-linger"
        echo "  ./safe-system-helper.sh restart-memory"
        echo "  ./safe-system-helper.sh check-memory"
        ;;
esac