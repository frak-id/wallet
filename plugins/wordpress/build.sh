#!/bin/bash

# WordPress Plugin Build Script for Frak Integration

PLUGIN_NAME="frak-integration"
VERSION=$(grep "Version:" frak-integration.php | awk '{print $2}')
BUILD_DIR="build"
DIST_DIR="dist"

echo "Building ${PLUGIN_NAME} version ${VERSION}..."

# Clean up previous builds
rm -rf ${BUILD_DIR} ${DIST_DIR}
mkdir -p ${BUILD_DIR}/${PLUGIN_NAME} ${DIST_DIR}

# Install composer dependencies
echo "Installing composer dependencies..."
composer install --no-dev --optimize-autoloader

# Copy all files to build directory
rsync -av --exclude-from='.distignore' \
  --exclude='build' \
  --exclude='dist' \
  --exclude='test' \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='.distignore' \
  --exclude='*.sh' \
  ./ ${BUILD_DIR}/${PLUGIN_NAME}/

# Create the zip file
cd ${BUILD_DIR}
zip -r ../${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip ${PLUGIN_NAME}
cd ..

# Clean up build directory
rm -rf ${BUILD_DIR}

echo "Build complete! Package created: ${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip"

# List package contents for verification
echo ""
echo "Package contents:"
unzip -l ${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip | grep -E "Name|----|----|${PLUGIN_NAME}/" | head -20
echo "..."
