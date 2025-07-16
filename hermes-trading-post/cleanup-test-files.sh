#!/bin/bash

echo "🧹 Cleaning up test files..."
echo ""

# List of test files to remove
TEST_FILES=(
  "test-*.html"
  "test-*.js"
  "verify-*.js"
  "simple-*.js"
  "debug-*.js"
  "cleanup-excessive-candles.html"
  "clear-cache*.html"
  "run-cache-api-tests.sh"
)

# Count files before deletion
TOTAL_FILES=0
for pattern in "${TEST_FILES[@]}"; do
  COUNT=$(ls $pattern 2>/dev/null | wc -l)
  TOTAL_FILES=$((TOTAL_FILES + COUNT))
done

if [ $TOTAL_FILES -eq 0 ]; then
  echo "No test files found to clean up."
  exit 0
fi

echo "Found $TOTAL_FILES test files to clean up:"
echo ""

# Show files that will be deleted
for pattern in "${TEST_FILES[@]}"; do
  ls $pattern 2>/dev/null | while read file; do
    echo "  - $file"
  done
done

echo ""
read -p "Do you want to delete these files? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Deleting files..."
  
  for pattern in "${TEST_FILES[@]}"; do
    rm -f $pattern 2>/dev/null
  done
  
  # Also remove test directories if empty
  rmdir test-reports 2>/dev/null
  rmdir test-screenshots 2>/dev/null
  
  echo "✅ Cleanup complete!"
else
  echo "❌ Cleanup cancelled."
fi