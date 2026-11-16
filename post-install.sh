#!/bin/sh
set -e

# Check if we're in a git repository
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Running git commands..."
    git config blame.ignoreRevsFile .git-blame-ignore-revs
else
    echo "Not in a git repository, skipping git commands."
fi

# --exclude filters patch creation, not application. Select files explicitly.
if [ -d patches ]; then
    patch_dir=patches
    if [ -d node_modules/query-string ]; then
        :
    else
        patch_dir=$(mktemp -d .lajur-patches.XXXXXX)
        trap 'rm -rf "$patch_dir"' EXIT HUP INT TERM
        for patch in patches/*.patch; do
            [ -f "$patch" ] || continue
            case "$patch" in
                patches/query-string+7.1.3.patch) continue ;;
            esac
            cp "$patch" "$patch_dir/"
        done
    fi
    ./node_modules/.bin/patch-package --error-on-fail --patch-dir "$patch_dir"
fi

node scripts/check-provider-runtime.cjs --if-present
