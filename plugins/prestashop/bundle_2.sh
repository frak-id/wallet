#!/bin/bash
set -e

# --- Configuration ---
MODULE_NAME="frakintegration"
VERSION="1.0.0" # You can automate this if you use git tags
BUILD_DIR="build"
DIST_DIR="dist"
ARCHIVE_NAME="${DIST_DIR}/${MODULE_NAME}-v${VERSION}.zip"

echo "🚀 Starting build for ${MODULE_NAME} v${VERSION}"

# --- Cleanup ---
echo "🧹 Cleaning up previous build artifacts..."
rm -rf "$BUILD_DIR"
rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

# --- Copy Source Files ---
echo "📋 Copying module source files to build directory..."
# Use rsync for powerful and flexible copying
rsync -av --progress . "$BUILD_DIR/" --exclude-from=.gitignore --exclude ".git" --exclude "$BUILD_DIR" --exclude "$DIST_DIR"

# --- Install Composer Dependencies ---
echo "📦 Installing Composer dependencies for production..."
# Run composer install inside the clean build directory
# --no-dev ensures you don't package testing or development libraries
# --no-interaction prevents it from asking questions
# --optimize-autoloader creates a faster autoloader for production
(cd "$BUILD_DIR" && composer install --no-dev --no-interaction --optimize-autoloader)

# --- Create Zip Archive ---
echo "🗜️ Creating zip archive: ${ARCHIVE_NAME}"
(cd "$BUILD_DIR" && zip -r "../${ARCHIVE_NAME}" . -x "*.DS_Store")

# --- Final Cleanup ---
echo "🧹 Cleaning up build directory..."
rm -rf "$BUILD_DIR"

echo "✅ Build complete! Your module is ready at ${ARCHIVE_NAME}"
