#!/bin/bash
# Release script for Pomodoro Timer Extension
# Usage: ./release.sh <version-name>
# Example: ./release.sh "1.2.0"

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
METADATA_FILE="$EXTENSION_DIR/metadata.json"

# Check version argument
if [ -z "$1" ]; then
    echo "Usage: ./release.sh <version-name>"
    echo "Example: ./release.sh \"1.2.0\""
    exit 1
fi

VERSION_NAME="$1"
echo "Setting version-name: $VERSION_NAME"

# 1. Update "version-name" in metadata.json
# This regex looks for "version-name": "something" and replaces it
sed -i 's/"version-name":\s*"[^"]*"/"version-name": "'"$VERSION_NAME"'"/' "$METADATA_FILE"

# 2. Remove "version": <int> field if it exists
# Extensions.gnome.org manages the integer version automatically.
sed -i '/"version":/d' "$METADATA_FILE"

# 3. Compile schemas (only if the directory exists)
if [ -d "$EXTENSION_DIR/schemas" ]; then
    echo "Compiling schemas..."
    glib-compile-schemas "$EXTENSION_DIR/schemas/"
else
    echo "No schemas directory found, skipping compilation."
fi

# 4. Create ZIP
# Extract UUID using grep (requires a simple "key": "value" format)
UUID=$(grep -oP '"uuid":\s*"\K[^"]+' "$METADATA_FILE")

if [ -z "$UUID" ]; then
    echo "Error: Could not find UUID in metadata.json"
    exit 1
fi

ZIP_FILE="$EXTENSION_DIR/../${UUID}.zip"

echo "Creating $ZIP_FILE..."
cd "$EXTENSION_DIR"

# Zip contents, excluding dev files and hidden git folders
zip -r "$ZIP_FILE" . \
    -x "*.git*" \
    -x ".github*" \
    -x "release.sh" \
    -x "README.md" \
    -x ".DS_Store" \
    -x "*.zip" \
    -x ".vscode/*" \
    -x ".idea/*" \
    -x "node_modules/*" \
    -x "assets/Screenshots/*" \
    -x "*.po" \
    -x "*.pot" \
    -x "package.json" \
    -x "package-lock.json" \
    -x "eslint.config.js"

echo "Done! Package ready for upload: $ZIP_FILE"