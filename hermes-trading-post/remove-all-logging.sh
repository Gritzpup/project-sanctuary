#!/bin/bash

# Comprehensive logging removal script for Hermes Trading Post
# This removes all console.log, console.info, console.warn, console.error, console.debug
# and logger.* calls to fix memory leak issues

set -e

PROJECT_DIR="/home/ubuntubox/Documents/Github/project-sanctuary/hermes-trading-post"
cd "$PROJECT_DIR"

echo "Starting comprehensive logging removal..."
echo "=========================================="

# Count total before
TOTAL_BEFORE=$(grep -r "console\.\(log\|info\|warn\|error\|debug\)" src/ backend/ --include="*.ts" --include="*.js" --include="*.svelte" 2>/dev/null | wc -l)
LOGGER_BEFORE=$(grep -r "logger\.\(log\|info\|warn\|error\|debug\)" src/ backend/ --include="*.ts" --include="*.js" --include="*.svelte" 2>/dev/null | wc -l)

echo "Found $TOTAL_BEFORE console.* statements"
echo "Found $LOGGER_BEFORE logger.* statements"
echo ""

# Function to remove logging from a file
remove_logging() {
    local file="$1"

    # Skip if file doesn't exist
    if [ ! -f "$file" ]; then
        return
    fi

    # Create backup
    cp "$file" "$file.backup"

    # Remove standalone console.log/info/warn/error/debug statements (with semicolon)
    sed -i '/^[[:space:]]*console\.\(log\|info\|warn\|error\|debug\)(.*);[[:space:]]*$/d' "$file"

    # Remove standalone console statements without semicolon
    sed -i '/^[[:space:]]*console\.\(log\|info\|warn\|error\|debug\)(.*)[[:space:]]*$/d' "$file"

    # Remove logger statements
    sed -i '/^[[:space:]]*logger\.\(log\|info\|warn\|error\|debug\)(.*);[[:space:]]*$/d' "$file"
    sed -i '/^[[:space:]]*logger\.\(log\|info\|warn\|error\|debug\)(.*)[[:space:]]*$/d' "$file"

    # Remove this.logger statements
    sed -i '/^[[:space:]]*this\.logger\.\(log\|info\|warn\|error\|debug\)(.*);[[:space:]]*$/d' "$file"
    sed -i '/^[[:space:]]*this\.logger\.\(log\|info\|warn\|error\|debug\)(.*)[[:space:]]*$/d' "$file"
}

# Process all TypeScript files
echo "Processing TypeScript files..."
find src/ -name "*.ts" -type f | while read file; do
    remove_logging "$file"
done

# Process all JavaScript files in backend
echo "Processing JavaScript files..."
find backend/ -name "*.js" -type f | while read file; do
    remove_logging "$file"
done

# Process all Svelte files
echo "Processing Svelte files..."
find src/ -name "*.svelte" -type f | while read file; do
    remove_logging "$file"
done

# Count total after
TOTAL_AFTER=$(grep -r "console\.\(log\|info\|warn\|error\|debug\)" src/ backend/ --include="*.ts" --include="*.js" --include="*.svelte" 2>/dev/null | wc -l || echo "0")
LOGGER_AFTER=$(grep -r "logger\.\(log\|info\|warn\|error\|debug\)" src/ backend/ --include="*.ts" --include="*.js" --include="*.svelte" 2>/dev/null | wc -l || echo "0")

echo ""
echo "=========================================="
echo "Logging removal complete!"
echo "Console statements removed: $((TOTAL_BEFORE - TOTAL_AFTER))"
echo "Logger statements removed: $((LOGGER_BEFORE - LOGGER_AFTER))"
echo "Remaining console statements: $TOTAL_AFTER"
echo "Remaining logger statements: $LOGGER_AFTER"
echo ""
echo "Backup files created with .backup extension"
echo "To restore: find . -name '*.backup' -exec bash -c 'mv \"\$0\" \"\${0%.backup}\"' {} \;"
