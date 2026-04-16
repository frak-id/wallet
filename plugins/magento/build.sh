#!/bin/bash
#
# Magento Module Build Script for Frak Integration
#
# Produces a distributable zip of the Frak Magento module.
# Version is read (in order of priority):
#   1. First CLI argument               -> ./build.sh 1.2.3
#   2. $VERSION environment variable    -> VERSION=1.2.3 ./build.sh
#   3. composer.json "version" field    -> fallback
#
set -euo pipefail

PLUGIN_NAME="frak-magento2-module"
BUILD_DIR="build"
DIST_DIR="dist"

# Resolve version
VERSION="${1:-${VERSION:-}}"
if [ -z "$VERSION" ]; then
  VERSION=$(grep -E '"version"\s*:' composer.json | head -n1 | sed -E 's/.*"version"\s*:\s*"([^"]+)".*/\1/')
fi
if [ -z "$VERSION" ]; then
  echo "::error::Unable to resolve module version (pass as arg, VERSION env var, or add to composer.json)"
  exit 1
fi

echo "Building ${PLUGIN_NAME} version ${VERSION}..."

# Clean up previous builds
rm -rf "${BUILD_DIR}" "${DIST_DIR}"
mkdir -p "${BUILD_DIR}/${PLUGIN_NAME}" "${DIST_DIR}"

# Copy files to staging directory using .distignore
# Note: we do NOT run `composer install --no-dev` here because Magento modules
# are typically installed via composer in the target project, which resolves
# dependencies on its own. We ship only the module source.
rsync -av --exclude-from='.distignore' \
  --exclude='build' \
  --exclude='dist' \
  ./ "${BUILD_DIR}/${PLUGIN_NAME}/"

# Create the zip
(cd "${BUILD_DIR}" && zip -r "../${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip" "${PLUGIN_NAME}")

# Clean up staging directory
rm -rf "${BUILD_DIR}"

echo "Build complete! Package created: ${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip"
echo ""
echo "Package contents:"
unzip -l "${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip" | head -30
