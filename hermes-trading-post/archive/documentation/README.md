# Archived Documentation

**Status**: DEPRECATED - Historical reference only
**Last Updated**: October 6, 2025
**Reason**: Superseded by current documentation in `/docs/`

## Overview

This folder contains historical documentation from earlier development phases. These documents are **no longer actively maintained** and should **not be relied upon** for current development.

## Documents in This Archive

| Document | Date | Purpose | Status |
|----------|------|---------|--------|
| CLEANUP_COMPLETE.md | Oct 6 | Task completion report | Obsolete |
| CODEBASE_STRUCTURE.md | Oct 6 | Project structure notes | Superseded by README.md |
| CSS_CLEANUP_SUMMARY.md | Oct 6 | CSS refactoring notes | Reference only |
| EXTENSION_ERROR_FIX.md | Oct 6 | Bug fix documentation | Reference only |
| FILESYSTEM_IMPROVEMENTS.md | Oct 6 | Filesystem changes | Reference only |
| FILESYSTEM_REORGANIZATION_COMPLETE.md | Oct 6 | Task status | Obsolete |
| FOLDER_STRUCTURE.md | Oct 6 | Old folder structure | Outdated |
| IMMEDIATE_ACTIONS.md | Oct 6 | Old action items | Obsolete |
| MODULARIZATION_COMPLETE.md | Oct 6 | Task completion | Reference only |
| MODULARIZATION_SUMMARY.md | Sep 1 | Modularization notes | Reference only |
| PROJECT_STRUCTURE.md | Oct 6 | Project structure | Superseded by README.md |
| REFACTORING_STATUS.md | Oct 6 | Refactoring progress | Obsolete |

## Current Documentation

All active documentation has been consolidated in `/docs/`:

- **[docs/INDEX.md](../../docs/INDEX.md)** - Master documentation index
- **[docs/audit/](../../docs/audit/)** - Audit reports and analysis
- **[README.md](../../README.md)** - Main project documentation
- **[tools/README.md](../../tools/README.md)** - Development tools

## Why This Archive Exists

These documents were generated during development phases to track progress and decisions. They have been superseded by current, maintained documentation but are kept for historical reference and context.

## When to Use This Archive

- **Code archaeology**: Understanding why certain decisions were made
- **Historical context**: Tracing how the project evolved
- **Bug reference**: Finding old fixes if similar issues appear again
- **Never**: For current development decisions or architecture questions

## Migration Guide

If you're looking for information that was in these old documents:

| Old Document | New Location |
|--------------|--------------|
| CODEBASE_STRUCTURE.md, PROJECT_STRUCTURE.md, FOLDER_STRUCTURE.md | See [README.md #Project Structure](../../README.md#project-structure) |
| MODULARIZATION_*.md | See [docs/INDEX.md](../../docs/INDEX.md) |
| CSS_CLEANUP_SUMMARY.md | See [tools/clean-logging.sh](../../tools/clean-logging.sh) notes |
| REFACTORING_STATUS.md | See [docs/audit/](../../docs/audit/) for current status |

## Recommended Actions

1. **Do not edit** files in this folder
2. **Use current documentation** in `/docs/` instead
3. **Reference only** if needing historical context
4. **Update main docs** if you find outdated information

## Archive Retention Policy

These files are kept:
- ✅ For historical reference and context
- ✅ For understanding past decisions
- ✅ As backup in case old information is needed
- ❌ For current development (use `/docs/` instead)
- ❌ As active documentation (they are outdated)

## Cleanup Instructions

To completely remove this archive once current documentation is verified:

```bash
# After verifying all useful information has been migrated:
rm -rf archive/documentation/
```

**This has NOT been done yet** to preserve historical context until everything is fully migrated.

---

**Last Reviewed**: October 18, 2025
**Next Review**: When cleaning up old documentation
**Contact**: Refer to main project for current contacts
