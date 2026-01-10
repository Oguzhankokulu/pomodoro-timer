#!/bin/bash
# Release script for Pomodoro Timer Extension
# Usage: ./release.sh <version>
# Example: ./release.sh 1

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
METADATA_FILE="$EXTENSION_DIR/metadata.json"

# Check version argument
if [ -z "$1" ]; then
    echo "Usage: ./release.sh <version>"
    echo "Example: ./release.sh 1"
    echo "Note: GNOME extensions require INTEGER versions (1, 2, 3...)"
    exit 1
fi

VERSION="$1"
echo "Setting version: $VERSION"

# Update version in metadata.json (must be integer, not string)
sed -i 's/"version":\s*[0-9]*/"version": '"$VERSION"'/' "$METADATA_FILE"

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
