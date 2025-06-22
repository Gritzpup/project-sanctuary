#!/bin/bash
# Deactivate virtual environment if active

if [ -n "$VIRTUAL_ENV" ]; then
    echo "📍 Deactivating virtual environment: $VIRTUAL_ENV"
    deactivate
    echo "✅ Virtual environment deactivated"
else
    echo "ℹ️  No virtual environment is currently active"
fi