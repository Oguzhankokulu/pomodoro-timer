#!/bin/bash
# Release script for Pomodoro Timer Extension
# Usage: ./release.sh <version-name>
# Example: ./release.sh "1.2.0"

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
METADATA_FILE="$EXTENSION_DIR/metadata.json"
BUILD_DIR="$EXTENSION_DIR/build"

# Check version argument
if [ -z "$1" ]; then
    echo "Usage: ./release.sh <version-name>"
    echo "Example: ./release.sh \"1.2.0\""
    exit 1
fi

VERSION_NAME="$1"
echo "Setting version-name: $VERSION_NAME"

# 1. Update "version-name" in metadata.json
sed -i.bak 's/"version-name":\s*"[^"]*"/"version-name": "'"$VERSION_NAME"'"/' "$METADATA_FILE"

# 2. Remove "version": <int> field if it exists
sed -i.bak '/"version":/d' "$METADATA_FILE"

# 3. Extract UUID
UUID=$(grep -oP '"uuid":\s*"\K[^"]+' "$METADATA_FILE")

if [ -z "$UUID" ]; then
    echo "Error: Could not find UUID in metadata.json"
    exit 1
fi

ZIP_FILE="$EXTENSION_DIR/../${UUID}.zip"

# 4. Create build directory with flattened structure
echo "Creating flattened build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy root files
cp "$EXTENSION_DIR/metadata.json" "$BUILD_DIR/"
cp "$EXTENSION_DIR/stylesheet.css" "$BUILD_DIR/"

# Flatten src/ directory - copy files to root of build
cp "$EXTENSION_DIR/src/extension.js" "$BUILD_DIR/"
cp "$EXTENSION_DIR/src/indicator.js" "$BUILD_DIR/"
cp "$EXTENSION_DIR/src/timer.js" "$BUILD_DIR/"
cp "$EXTENSION_DIR/src/sound.js" "$BUILD_DIR/"
cp "$EXTENSION_DIR/src/constants.js" "$BUILD_DIR/"
cp "$EXTENSION_DIR/src/utils.js" "$BUILD_DIR/"
cp "$EXTENSION_DIR/src/suspendInhibitor.js" "$BUILD_DIR/"

# Copy prefs.js from root
cp "$EXTENSION_DIR/prefs.js" "$BUILD_DIR/"

# Copy schemas directory (excluding compiled schema)
mkdir -p "$BUILD_DIR/schemas"
cp "$EXTENSION_DIR/schemas"/*.xml "$BUILD_DIR/schemas/"

# Copy assets directory (excluding Screenshots)
mkdir -p "$BUILD_DIR/assets"
cp -r "$EXTENSION_DIR/assets/images" "$BUILD_DIR/assets/" 2>/dev/null || true
cp -r "$EXTENSION_DIR/assets/sounds" "$BUILD_DIR/assets/" 2>/dev/null || true

# 5. Create ZIP from build directory
echo "Creating $ZIP_FILE..."
cd "$BUILD_DIR"
zip -r "$ZIP_FILE" .

# 6. Cleanup
cd "$EXTENSION_DIR"
rm -rf "$BUILD_DIR"
rm -f "$METADATA_FILE.bak"

echo "Done! Package ready for upload: $ZIP_FILE"
echo ""
echo "Structure in ZIP (flattened, GNOME standard):"
echo "  extension.js (from src/)"
echo "  indicator.js (from src/)"
echo "  timer.js (from src/)"
echo "  etc..."