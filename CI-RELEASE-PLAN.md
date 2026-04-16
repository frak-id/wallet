# CI Release Reorganization

Goal: split the monorepo's release pipelines by concern, and re-introduce
tag-based GitHub releases with built assets & changelogs.

## Target state

| Concern | Trigger | Workflow file |
|---|---|---|
| SDK releases (npm + GH release) | push to `main` (changesets) | `.github/workflows/release.yml` |
| Beta SDK releases (npm only) | push to `dev` | `.github/workflows/beta-release.yml` *(unchanged)* |
| App deploys (services + apps) | push to `main`/`dev` | `.github/workflows/deploy.yml` *(unchanged)* |
| WordPress plugin release | tag `wordpress-*` | `.github/workflows/release-wordpress.yml` *(new)* |
| Magento plugin release | tag `magento-*` | `.github/workflows/release-magento.yml` *(new)* |
| Tauri mobile release | `workflow_dispatch` (+ GH release step) | `.github/workflows/tauri-mobile-release.yml` |
| PHP plugin CI (lint/phpstan) | PR / push on `plugins/**` | `.github/workflows/php-plugins.yaml` *(unchanged)* |

Tag conventions produced:
- `sdk-core-1.2.3`, `sdk-react-...`, `sdk-components-...`, `sdk-legacy-...`, `sdk-frame-connector-...` *(auto-created by the SDK workflow after changesets publishes)*
- `wordpress-1.0.1` *(developer creates)*
- `magento-1.0.1` *(developer creates)*
- `app-1.0.28` *(created by the tauri workflow after a successful release build)*

Changelog strategy for every release:
1. Try to extract the `## {version}` section from a `CHANGELOG.md` in the relevant directory.
2. Fall back to GitHub's auto-generated release notes.

---

## Non-workflow files already applied in this branch

These are committed directly (no `workflow` scope needed):

- `plugins/magento/build.sh` — new, mirrors `plugins/wordpress/build.sh`
- `plugins/magento/.distignore` — defines what goes into the release zip
- `plugins/magento/composer.json` — added a `"version"` field (source of truth for the tag)
- `plugins/wordpress/build.sh` — fixed `awk '{print $2}'` bug that returned the literal string `"Version:"` instead of the version

---

## 1. `.github/workflows/release.yml` — REPLACE

Replaces the existing file. Keeps the changesets flow, adds per-package GitHub
releases with tags shaped as `sdk-{id}-{version}`, reading the matching section
out of each package's changeset-generated `CHANGELOG.md`.

```yaml
name: 📦 SDK Release

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  id-token: write
  contents: write
  pull-requests: write

jobs:
  release:
    name: Release SDK packages
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: "🔨 Install dependencies"
        run: bun install --frozen-lockfile

      - name: Create Release Pull Request or Publish to npm
        uses: changesets/action@v1
        id: changesets
        with:
          publish: bun changeset:release
          version: bun changeset:version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_CONFIG_TOKEN: ${{ secrets.NPM_TOKEN }}
          STAGE: production

      - name: "🏷️ Create GitHub releases per published package"
        if: steps.changesets.outputs.published == 'true'
        uses: actions/github-script@v8
        env:
          PUBLISHED_PACKAGES: ${{ steps.changesets.outputs.publishedPackages }}
        with:
          script: |
            const fs = require('fs');
            const path = require('path');

            // Map npm package name → short identifier used in the git tag
            const idMap = {
              '@frak-labs/core-sdk': 'core',
              '@frak-labs/react-sdk': 'react',
              '@frak-labs/components': 'components',
              '@frak-labs/nexus-sdk': 'legacy',
              '@frak-labs/frame-connector': 'frame-connector',
            };

            // Map npm package name → local directory (for CHANGELOG.md lookup)
            const dirMap = {
              '@frak-labs/core-sdk': 'sdk/core',
              '@frak-labs/react-sdk': 'sdk/react',
              '@frak-labs/components': 'sdk/components',
              '@frak-labs/nexus-sdk': 'sdk/legacy',
              '@frak-labs/frame-connector': 'packages/rpc',
            };

            function extractChangelog(dir, version) {
              if (!dir) return '';
              const file = path.join(dir, 'CHANGELOG.md');
              if (!fs.existsSync(file)) return '';
              const content = fs.readFileSync(file, 'utf8');
              const lines = content.split('\n');
              const esc = version.replace(/\./g, '\\.');
              const startRe = new RegExp(`^##\\s*\\[?${esc}\\]?`);
              const nextRe = /^##\s/;
              let start = -1;
              for (let i = 0; i < lines.length; i++) {
                if (startRe.test(lines[i])) { start = i + 1; break; }
              }
              if (start === -1) return '';
              let end = lines.length;
              for (let i = start; i < lines.length; i++) {
                if (nextRe.test(lines[i])) { end = i; break; }
              }
              return lines.slice(start, end).join('\n').trim();
            }

            const published = JSON.parse(process.env.PUBLISHED_PACKAGES || '[]');
            core.info(`Creating releases for ${published.length} packages`);

            for (const pkg of published) {
              const id = idMap[pkg.name];
              if (!id) {
                core.warning(`No tag identifier mapped for ${pkg.name}, skipping release`);
                continue;
              }
              const tag = `sdk-${id}-${pkg.version}`;
              const body = extractChangelog(dirMap[pkg.name], pkg.version);

              try {
                await github.rest.repos.createRelease({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  tag_name: tag,
                  name: `${pkg.name}@${pkg.version}`,
                  body: body || undefined,
                  generate_release_notes: !body,
                });
                core.info(`✅ Created release ${tag}`);
              } catch (err) {
                if (err.status === 422) {
                  core.warning(`Release ${tag} already exists, skipping`);
                } else {
                  core.setFailed(`Failed to create release ${tag}: ${err.message}`);
                }
              }
            }

      - uses: gacts/purge-jsdelivr-cache@v1
        if: steps.changesets.outputs.published == 'true'
        with:
          url: |
            https://cdn.jsdelivr.net/npm/@frak-labs/nexus-sdk@latest/dist/bundle/bundle.js
            https://cdn.jsdelivr.net/npm/@frak-labs/core-sdk@latest/cdn/bundle.js
            https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/components.js
            https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/loader.js
            https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/loader.css
```

### Notes
- `changesets/action@v1` already creates tags in the form `@frak-labs/core-sdk@1.2.3`. The new `sdk-{id}-{version}` tag is created as a **second** tag by the release step (GitHub creates the tag when `createRelease` is called with a new `tag_name`).
- If you'd prefer to **replace** the changeset-created tags instead of having both, add `createGithubReleases: false` to the changesets action config (the `changesets/action` option for skipping its own release creation — already the default) and also pass `--no-git-tag` to `changeset publish` via your `changeset:release` script. Worth doing in a follow-up, not blocking.

---

## 2. `.github/workflows/release-wordpress.yml` — NEW

```yaml
name: 🚀 Release WordPress Plugin

on:
  push:
    tags:
      - 'wordpress-*'

permissions:
  contents: write

concurrency:
  group: release-wordpress-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release:
    name: Build & publish
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.4'
          tools: 'composer:v2'
          coverage: none

      - name: "🏷️ Extract version from tag"
        id: version
        run: |
          VERSION="${GITHUB_REF_NAME#wordpress-}"
          VERSION="${VERSION#v}"
          if [ -z "$VERSION" ]; then
            echo "::error::Could not extract version from tag $GITHUB_REF_NAME"
            exit 1
          fi
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "Releasing WordPress plugin version $VERSION"

      - name: "✅ Validate plugin header matches tag"
        working-directory: plugins/wordpress
        run: |
          PLUGIN_VERSION=$(grep -E '^\s*\*\s*Version:' frak-integration.php | head -n1 | awk '{print $3}')
          if [ "$PLUGIN_VERSION" != "${{ steps.version.outputs.version }}" ]; then
            echo "::error::Tag version '${{ steps.version.outputs.version }}' does not match 'Version: $PLUGIN_VERSION' in frak-integration.php"
            exit 1
          fi

      - name: "📦 Build plugin zip"
        working-directory: plugins/wordpress
        run: |
          chmod +x build.sh
          ./build.sh

      - name: "📝 Extract changelog section (if present)"
        id: changelog
        working-directory: plugins/wordpress
        shell: bash
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          NOTES=""
          if [ -f CHANGELOG.md ]; then
            NOTES=$(awk -v v="$VERSION" '
              BEGIN { IGNORECASE=0; found=0 }
              $0 ~ "^##[[:space:]]*\\[?"v"\\]?([[:space:]]|$)" { found=1; next }
              found && /^##[[:space:]]/ { exit }
              found { print }
            ' CHANGELOG.md | sed -e '/./,$!d' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')
          fi
          if [ -n "$NOTES" ]; then
            echo "has_notes=true" >> "$GITHUB_OUTPUT"
            {
              echo "notes<<CHANGELOG_EOF"
              echo "$NOTES"
              echo "CHANGELOG_EOF"
            } >> "$GITHUB_OUTPUT"
          else
            echo "has_notes=false" >> "$GITHUB_OUTPUT"
          fi

      - name: "🚀 Create GitHub release"
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: WordPress Plugin ${{ steps.version.outputs.version }}
          files: plugins/wordpress/dist/frak-integration-*.zip
          body: ${{ steps.changelog.outputs.has_notes == 'true' && steps.changelog.outputs.notes || '' }}
          generate_release_notes: ${{ steps.changelog.outputs.has_notes != 'true' }}
          fail_on_unmatched_files: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### How to release
```bash
# 1. Bump "Version:" in plugins/wordpress/frak-integration.php
# 2. Optionally add a "## 1.0.1" section to plugins/wordpress/CHANGELOG.md
# 3. Commit & push on main
# 4. Create + push the tag
git tag wordpress-1.0.1
git push origin wordpress-1.0.1
```

---

## 3. `.github/workflows/release-magento.yml` — NEW

```yaml
name: 🚀 Release Magento Plugin

on:
  push:
    tags:
      - 'magento-*'

permissions:
  contents: write

concurrency:
  group: release-magento-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release:
    name: Build & publish
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.4'
          tools: 'composer:v2'
          coverage: none

      - name: "🏷️ Extract version from tag"
        id: version
        run: |
          VERSION="${GITHUB_REF_NAME#magento-}"
          VERSION="${VERSION#v}"
          if [ -z "$VERSION" ]; then
            echo "::error::Could not extract version from tag $GITHUB_REF_NAME"
            exit 1
          fi
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "Releasing Magento module version $VERSION"

      - name: "✅ Validate composer.json matches tag"
        working-directory: plugins/magento
        run: |
          COMPOSER_VERSION=$(grep -E '"version"[[:space:]]*:' composer.json | head -n1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
          if [ "$COMPOSER_VERSION" != "${{ steps.version.outputs.version }}" ]; then
            echo "::error::Tag version '${{ steps.version.outputs.version }}' does not match composer.json version '$COMPOSER_VERSION'"
            exit 1
          fi

      - name: "📦 Build module zip"
        working-directory: plugins/magento
        run: |
          chmod +x build.sh
          ./build.sh "${{ steps.version.outputs.version }}"

      - name: "📝 Extract changelog section (if present)"
        id: changelog
        working-directory: plugins/magento
        shell: bash
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          NOTES=""
          if [ -f CHANGELOG.md ]; then
            NOTES=$(awk -v v="$VERSION" '
              BEGIN { IGNORECASE=0; found=0 }
              $0 ~ "^##[[:space:]]*\\[?"v"\\]?([[:space:]]|$)" { found=1; next }
              found && /^##[[:space:]]/ { exit }
              found { print }
            ' CHANGELOG.md | sed -e '/./,$!d' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')
          fi
          if [ -n "$NOTES" ]; then
            echo "has_notes=true" >> "$GITHUB_OUTPUT"
            {
              echo "notes<<CHANGELOG_EOF"
              echo "$NOTES"
              echo "CHANGELOG_EOF"
            } >> "$GITHUB_OUTPUT"
          else
            echo "has_notes=false" >> "$GITHUB_OUTPUT"
          fi

      - name: "🚀 Create GitHub release"
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: Magento Module ${{ steps.version.outputs.version }}
          files: plugins/magento/dist/frak-magento2-module-*.zip
          body: ${{ steps.changelog.outputs.has_notes == 'true' && steps.changelog.outputs.notes || '' }}
          generate_release_notes: ${{ steps.changelog.outputs.has_notes != 'true' }}
          fail_on_unmatched_files: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### How to release
```bash
# 1. Bump "version" in plugins/magento/composer.json
# 2. Optionally add a "## 1.0.1" section to plugins/magento/CHANGELOG.md
# 3. Commit & push on main
# 4. Create + push the tag
git tag magento-1.0.1
git push origin magento-1.0.1
```

---

## 4. `.github/workflows/tauri-mobile-release.yml` — MODIFY

Keeps the existing `workflow_dispatch` flow (iOS + TestFlight, Android + Play Store, version-commit PR). Only adds:

1. A new final job `github-release` that runs after iOS+Android succeed.
2. That job downloads the `ios-ipa` / `android-aab` artifacts, creates tag `app-{version}`, and publishes a GitHub release with both assets and a changelog.

Replace the file by appending the following job (or adjust the existing
`commit-version` dependency). **Full file** — everything before is identical
to your current one; only the last job is new:

```yaml
# ...[existing validate / prepare / ios / android / commit-version jobs stay as-is]...

  github-release:
    name: "🏷️ GitHub Release"
    needs: [ios, android]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: "📥 Checkout"
        uses: actions/checkout@v6

      - name: "📥 Download iOS artifact"
        uses: actions/download-artifact@v8
        with:
          name: ios-ipa
          path: release-assets/ios

      - name: "📥 Download Android artifact"
        uses: actions/download-artifact@v8
        with:
          name: android-aab
          path: release-assets/android

      - name: "📝 Extract changelog section (if present)"
        id: changelog
        shell: bash
        run: |
          VERSION="${{ inputs.version }}"
          NOTES=""
          for f in apps/wallet/CHANGELOG.md CHANGELOG.md; do
            if [ -f "$f" ]; then
              NOTES=$(awk -v v="$VERSION" '
                BEGIN { found=0 }
                $0 ~ "^##[[:space:]]*\\[?"v"\\]?([[:space:]]|$)" { found=1; next }
                found && /^##[[:space:]]/ { exit }
                found { print }
              ' "$f" | sed -e '/./,$!d')
              if [ -n "$NOTES" ]; then break; fi
            fi
          done
          if [ -n "$NOTES" ]; then
            echo "has_notes=true" >> "$GITHUB_OUTPUT"
            {
              echo "notes<<CHANGELOG_EOF"
              echo "$NOTES"
              echo "CHANGELOG_EOF"
            } >> "$GITHUB_OUTPUT"
          else
            echo "has_notes=false" >> "$GITHUB_OUTPUT"
          fi

      - name: "🚀 Create GitHub release"
        uses: softprops/action-gh-release@v2
        with:
          tag_name: app-${{ inputs.version }}
          name: Frak Wallet ${{ inputs.version }}
          target_commitish: ${{ github.sha }}
          prerelease: ${{ inputs.stage == 'dev' }}
          files: |
            release-assets/ios/*.ipa
            release-assets/android/*.aab
          body: ${{ steps.changelog.outputs.has_notes == 'true' && steps.changelog.outputs.notes || '' }}
          generate_release_notes: ${{ steps.changelog.outputs.has_notes != 'true' }}
          fail_on_unmatched_files: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Notes
- `prerelease: ${{ inputs.stage == 'dev' }}` marks internal/testing builds as pre-releases.
- `fail_on_unmatched_files: false` because the matrix may be extended later (e.g. skip-ios / skip-android inputs).
- If you'd prefer a **tag-driven** trigger (push `app-1.0.28` → run the whole pipeline), that's a bigger refactor — I can do it in a follow-up. This one just adds the release step to your current flow.

---

## Summary of what ends up in each GitHub release

| Tag | Assets | Body |
|---|---|---|
| `sdk-core-1.2.3` etc. | *(none — npm is the distribution)* | `sdk/core/CHANGELOG.md` section, or auto-generated |
| `wordpress-1.0.1` | `frak-integration-1.0.1.zip` | `plugins/wordpress/CHANGELOG.md` section, or auto-generated |
| `magento-1.0.1` | `frak-magento2-module-1.0.1.zip` | `plugins/magento/CHANGELOG.md` section, or auto-generated |
| `app-1.0.28` | `Frak Wallet.ipa`, `app-universal-release.aab` | `apps/wallet/CHANGELOG.md` section, or auto-generated |
