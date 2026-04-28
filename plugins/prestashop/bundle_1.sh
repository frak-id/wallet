#!/bin/bash

# PrestaShop Module Bundler Script
# This script creates a distributable zip file of the Frak Integration module

set -e  # Exit on any error

# Module configuration
MODULE_NAME="frakintegration"
VERSION="1.0.0"
BUNDLE_NAME="${MODULE_NAME}-v${VERSION}.zip"
TEMP_DIR="bundle_temp"

echo "🚀 Starting PrestaShop module bundling for ${MODULE_NAME} v${VERSION}"

# Clean up any previous bundle artifacts
if [ -f "$BUNDLE_NAME" ]; then
    echo "📦 Removing existing bundle: $BUNDLE_NAME"
    rm "$BUNDLE_NAME"
fi

if [ -d "$TEMP_DIR" ]; then
    echo "🧹 Cleaning up temporary directory"
    rm -rf "$TEMP_DIR"
fi

# Create temporary directory
echo "📁 Creating temporary bundle directory"
mkdir -p "$TEMP_DIR/$MODULE_NAME"

# Copy module files (excluding development/test files)
echo "📋 Copying module files..."

# Core module files
cp frakintegration.php "$TEMP_DIR/$MODULE_NAME/"
cp config.xml "$TEMP_DIR/$MODULE_NAME/"
cp logo.png "$TEMP_DIR/$MODULE_NAME/"

# Copy directories with their structure
cp -r classes/ "$TEMP_DIR/$MODULE_NAME/classes/"
cp -r controllers/ "$TEMP_DIR/$MODULE_NAME/controllers/"
cp -r views/ "$TEMP_DIR/$MODULE_NAME/views/"
cp -r vendor/ "$TEMP_DIR/$MODULE_NAME/vendor/"
cp -r uploads/ "$TEMP_DIR/$MODULE_NAME/uploads/"

# Copy override directory if it has content
if [ "$(ls -A override/ 2>/dev/null)" ]; then
    cp -r override/ "$TEMP_DIR/$MODULE_NAME/override/"
else
    # Create empty override directory as PrestaShop expects it
    mkdir -p "$TEMP_DIR/$MODULE_NAME/override"
fi

echo "✅ Files copied successfully"

# Create the zip bundle
echo "🗜️  Creating zip bundle: $BUNDLE_NAME"
cd "$TEMP_DIR"
zip -r "../$BUNDLE_NAME" "$MODULE_NAME/" -x "*.DS_Store" "*.git*" "*__pycache__*" "*.pyc"
cd ..

# Clean up temporary directory
echo "🧹 Cleaning up temporary files"
rm -rf "$TEMP_DIR"

# Display bundle information
if [ -f "$BUNDLE_NAME" ]; then
    BUNDLE_SIZE=$(du -h "$BUNDLE_NAME" | cut -f1)
    echo ""
    echo "🎉 Bundle created successfully!"
    echo "📦 File: $BUNDLE_NAME"
    echo "📏 Size: $BUNDLE_SIZE"
    echo ""
    echo "📋 Bundle contents:"
    unzip -l "$BUNDLE_NAME"
    echo ""
    echo "✅ Your module is ready for distribution!"
    echo "   Clients can upload this zip file directly to their PrestaShop admin panel"
    echo "   under Modules & Services > Upload a module"
else
    echo "❌ Error: Bundle creation failed"
    exit 1
fi 