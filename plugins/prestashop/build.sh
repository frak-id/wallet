#!/bin/bash
#
# PrestaShop Module Build Script for Frak Integration
#
# Produces a distributable zip of the Frak PrestaShop module.
# Version is read (in order of priority):
#   1. First CLI argument               -> ./build.sh 1.2.3
#   2. $VERSION environment variable    -> VERSION=1.2.3 ./build.sh
#   3. composer.json "version" field    -> fallback (canonical source of truth)
#
# composer.json is the canonical version source. The build propagates the
# resolved version into config.xml (`<version>`) and frakintegration.php
# (`$this->version`) inside the staged build directory only — the source tree
# carries the last-released values, the released zip always reflects $VERSION.
#
set -euo pipefail

PLUGIN_NAME="frakintegration"
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

# Install production composer dependencies. PrestaShop modules ship vendor/
# inside the zip (merchants install via the admin uploader, not composer).
echo "Installing composer dependencies..."
composer install --no-dev --no-interaction --optimize-autoloader

# Stage files via .distignore
rsync -av --exclude-from='.distignore' \
  --exclude='build' \
  --exclude='dist' \
  ./ "${BUILD_DIR}/${PLUGIN_NAME}/"

# Propagate canonical version into PrestaShop's runtime version files.
# Use a temp suffix to keep sed portable across BSD (macOS) and GNU.
sed -i.bak -E "s|<version><!\[CDATA\[[^]]*\]\]></version>|<version><![CDATA[${VERSION}]]></version>|" \
  "${BUILD_DIR}/${PLUGIN_NAME}/config.xml"
sed -i.bak -E "s|(\\\$this->version[[:space:]]*=[[:space:]]*')[^']*(';)|\\1${VERSION}\\2|" \
  "${BUILD_DIR}/${PLUGIN_NAME}/frakintegration.php"
rm -f "${BUILD_DIR}/${PLUGIN_NAME}/config.xml.bak" "${BUILD_DIR}/${PLUGIN_NAME}/frakintegration.php.bak"

# PrestaShop expects an override/ directory to exist even when empty.
mkdir -p "${BUILD_DIR}/${PLUGIN_NAME}/override"

# Create the zip
(cd "${BUILD_DIR}" && zip -r "../${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip" "${PLUGIN_NAME}")

# Clean up staging directory
rm -rf "${BUILD_DIR}"

echo "Build complete! Package created: ${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip"
echo ""
echo "Package contents:"
unzip -l "${DIST_DIR}/${PLUGIN_NAME}-${VERSION}.zip" | head -30
