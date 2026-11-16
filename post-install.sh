#!/bin/sh
set -e

# Check if we're in a git repository
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Running git commands..."
    git config blame.ignoreRevsFile .git-blame-ignore-revs
else
    echo "Not in a git repository, skipping git commands."
fi

# Backend images copy only their query-string interoperability patch; full
# workspace installs also apply the existing frontend patches.
if [ -d patches ]; then
    if [ -d node_modules/query-string ]; then
        npx --no-install patch-package
    else
        # Frontend-only images do not install the Polygon dependency tree.
        npx --no-install patch-package --exclude 'query-string'
    fi
fi
