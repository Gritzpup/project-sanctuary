#!/usr/bin/env python3
"""
Advanced logging removal script that handles:
- Multiline console.log statements
- Embedded logging calls
- Logger service calls
- Preserves code structure and important error handling
"""

import os
import re
from pathlib import Path

PROJECT_DIR = Path("/home/ubuntubox/Documents/Github/project-sanctuary/hermes-trading-post")

# Patterns to match various logging statements
CONSOLE_PATTERNS = [
    # Single line console statements
    r'^\s*console\.(log|info|warn|error|debug)\([^)]*\);?\s*$',
    # Multiline console statements
    r'^\s*console\.(log|info|warn|error|debug)\([^;]*$',
]

LOGGER_PATTERNS = [
    # Logger service calls
    r'^\s*(?:this\.)?logger\.(log|info|warn|error|debug)\([^)]*\);?\s*$',
    # Multiline logger statements
    r'^\s*(?:this\.)?logger\.(log|info|warn|error|debug)\([^;]*$',
]

def remove_logging_from_file(filepath):
    """Remove all logging statements from a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return 0

    new_lines = []
    skip_multiline = False
    removed_count = 0
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this is a console.* or logger.* statement
        is_console = any(re.match(pattern, line) for pattern in CONSOLE_PATTERNS)
        is_logger = any(re.match(pattern, line) for pattern in LOGGER_PATTERNS)

        if is_console or is_logger:
            # Check if it's a multiline statement (no closing paren or semicolon)
            if '(' in line and (')' not in line or (')' in line and ');' not in line and line.rstrip()[-1] != ')')):
                # Skip lines until we find the closing parenthesis
                removed_count += 1
                i += 1
                depth = line.count('(') - line.count(')')
                while i < len(lines) and depth > 0:
                    depth += lines[i].count('(') - lines[i].count(')')
                    i += 1
                continue
            else:
                # Single line statement, skip it
                removed_count += 1
                i += 1
                continue

        # Keep this line
        new_lines.append(line)
        i += 1

    # Write back if changes were made
    if removed_count > 0:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
        except Exception as e:
            print(f"Error writing {filepath}: {e}")
            return 0

    return removed_count

def process_directory(directory, extensions):
    """Process all files with given extensions in directory."""
    total_removed = 0
    files_processed = 0

    for ext in extensions:
        for filepath in directory.rglob(f"*.{ext}"):
            # Skip backup files
            if filepath.suffix == '.backup' or '.backup' in str(filepath):
                continue

            # Skip node_modules, dist, build directories
            if any(part in filepath.parts for part in ['node_modules', 'dist', 'build', '.backup']):
                continue

            removed = remove_logging_from_file(filepath)
            if removed > 0:
                files_processed += 1
                total_removed += removed
                print(f"Removed {removed} statements from {filepath.relative_to(PROJECT_DIR)}")

    return total_removed, files_processed

def main():
    print("Advanced logging removal starting...")
    print("=" * 60)

    # Process frontend files
    print("\nProcessing frontend files...")
    src_dir = PROJECT_DIR / "src"
    frontend_removed, frontend_files = process_directory(src_dir, ['ts', 'js', 'svelte'])

    # Process backend files
    print("\nProcessing backend files...")
    backend_dir = PROJECT_DIR / "backend"
    backend_removed, backend_files = process_directory(backend_dir, ['ts', 'js'])

    print("\n" + "=" * 60)
    print(f"Advanced logging removal complete!")
    print(f"Frontend: {frontend_removed} statements removed from {frontend_files} files")
    print(f"Backend: {backend_removed} statements removed from {backend_files} files")
    print(f"Total: {frontend_removed + backend_removed} statements removed from {frontend_files + backend_files} files")

if __name__ == "__main__":
    main()
