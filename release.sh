#!/bin/bash
# Release script for Pomodoro Timer Extension
# Usage: ./release.sh <version>
# Example: ./release.sh 1.0

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
METADATA_FILE="$EXTENSION_DIR/metadata.json"

# Check version argument
if [ -z "$1" ]; then
    echo "Usage: ./release.sh <version>"
    echo "Example: ./release.sh 1.0"
    exit 1
fi

VERSION="$1"
echo "Setting version: $VERSION"

# Update or add version in metadata.json
if grep -q '"version"' "$METADATA_FILE"; then
    sed -i "s/\"version\":\s*\"[^\"]*\"/\"version\": \"$VERSION\"/" "$METADATA_FILE"
    sed -i "s/\"version\":\s*[0-9.]*/\"version\": \"$VERSION\"/" "$METADATA_FILE"
else
    sed -i 's/{$/{\n  "version": "'"$VERSION"'",/' "$METADATA_FILE"
fi

# Compile schemas
echo "Compiling schemas..."
glib-compile-schemas "$EXTENSION_DIR/schemas/"

# Create ZIP
UUID=$(grep -oP '"uuid":\s*"\K[^"]+' "$METADATA_FILE")
ZIP_FILE="$EXTENSION_DIR/../$UUID.zip"

echo "Creating $ZIP_FILE..."
cd "$EXTENSION_DIR"
zip -r "$ZIP_FILE" . \
    -x "*.git*" \
    -x "release.sh" \
    -x "README.md" \
    -x ".DS_Store" \
    -x "*.zip"

echo "Done! Package: $ZIP_FILE"
