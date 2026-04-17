#!/bin/bash

# WordPress Plugin Build Script for Frak Integration

PLUGIN_NAME="frak-integration"
VERSION="${1:-${VERSION:-$(grep -E '^\s*\*\s*Version:' frak-integration.php | head -n1 | awk '{print $3}')}}"
BUILD_DIR="build"
DIST_DIR="dist"

echo "Building ${PLUGIN_NAME} version ${VERSION}..."

# Clean up previous builds
rm -rf ${BUILD_DIR} ${DIST_DIR}
mkdir -p ${BUILD_DIR}/${PLUGIN_NAME} ${DIST_DIR}

# Install composer dependencies
echo "Installing composer dependencies..."
composer install --no-dev --optimize-autoloader

# Generate the translation template (.pot) when WP-CLI is available. Merchants
# self-hosting the plugin read translations from `languages/`; releasing an
# up-to-date template alongside the zip lets translators start immediately.
# Skipped silently when WP-CLI is not installed on the build host.
mkdir -p languages
if command -v wp >/dev/null 2>&1; then
  echo "Generating translation template (.pot)..."
  wp i18n make-pot . languages/frak.pot --slug=frak --exclude=vendor,test,dist,build 2>/dev/null \
    || echo "  (skipped: wp i18n unavailable)"
else
  echo "WP-CLI not found; skipping .pot generation."
fi

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
unzip -l ${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip | grep -E "Name|----|${PLUGIN_NAME}/" | head -20
echo "..."
