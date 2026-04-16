# CI Release Reorganization

Goal: split the monorepo's release pipelines by concern, and re-introduce
tag-based GitHub releases with built assets and auto-generated changelogs.

## Target state

| Concern | Trigger | Workflow file |
|---|---|---|
| SDK releases (npm + GH release) | push to `main` (changesets) | `.github/workflows/release.yml` |
| Beta SDK releases (npm only) | push to `dev` | `.github/workflows/beta-release.yml` *(unchanged)* |
| App / service deploys | push to `main`/`dev` | `.github/workflows/deploy.yml` *(unchanged)* |
| WordPress plugin release | tag `wordpress-*` | `.github/workflows/release-wordpress.yml` *(new)* |
| Magento plugin release | tag `magento-*` | `.github/workflows/release-magento.yml` *(new)* |
| Tauri mobile release | `workflow_dispatch` | `.github/workflows/tauri-mobile-release.yml` |
| PHP plugin CI | push / PR on `plugins/**` | `.github/workflows/php-plugins.yaml` *(unchanged)* |

Tag conventions:
- `sdk-{id}-{version}` — created by the SDK workflow after changesets publishes (`sdk-core-1.2.3`, `sdk-react-...`, `sdk-components-...`, `sdk-legacy-...`, `sdk-frame-connector-...`)
- `wordpress-{version}` — developer creates
- `magento-{version}` — developer creates
- `app-{version}` — created by the tauri workflow after a successful release build

## Changelog strategy

**No `CHANGELOG.md` files to maintain.**

Every release uses GitHub's native auto-generated release notes (`gh release
create --generate-notes`) scoped to the previous tag with the **same prefix**
via `--notes-start-tag`. Example: releasing `wordpress-1.0.2` diffs against
`wordpress-1.0.1`, not against whichever tag was most recent chronologically.

Cleaner notes can be achieved by configuring `.github/release.yml` (categorise
PRs by label, exclude chore labels, etc.). That's a follow-up, not blocking.

---

## Non-workflow files already applied in this branch

Committed directly (no `workflow` scope needed):

- `plugins/magento/build.sh` — new, mirrors `plugins/wordpress/build.sh`
- `plugins/magento/.distignore` — defines what goes into the release zip
- `plugins/magento/composer.json` — added a `"version"` field as the tag source of truth
- `plugins/wordpress/build.sh` — fixed version extraction (`awk '{print $3}'` and CLI/env override)

---

## 1. `.github/workflows/release.yml` — REPLACE

Replaces the existing file. Keeps the changesets flow, adds per-package GitHub
releases tagged `sdk-{id}-{version}`. Each release uses `gh --generate-notes`
with the previous same-prefix tag as the starting point.

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
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PUBLISHED_PACKAGES: ${{ steps.changesets.outputs.publishedPackages }}
        run: |
          # npm name → short tag identifier
          declare -A ID_MAP=(
            ["@frak-labs/core-sdk"]="core"
            ["@frak-labs/react-sdk"]="react"
            ["@frak-labs/components"]="components"
            ["@frak-labs/nexus-sdk"]="legacy"
            ["@frak-labs/frame-connector"]="frame-connector"
          )

          echo "$PUBLISHED_PACKAGES" | jq -c '.[]' | while read -r pkg; do
            name=$(echo "$pkg" | jq -r .name)
            version=$(echo "$pkg" | jq -r .version)
            id="${ID_MAP[$name]:-}"
            if [ -z "$id" ]; then
              echo "::warning::No tag identifier for $name, skipping"
              continue
            fi

            tag="sdk-${id}-${version}"

            # Previous same-prefix tag (semver-sorted) to scope the auto-generated notes
            prev=$(git tag --list "sdk-${id}-*" --sort=-v:refname | grep -vFx "$tag" | head -n1 || true)

            args=(--generate-notes --title "${name}@${version}")
            [ -n "$prev" ] && args+=(--notes-start-tag "$prev")

            if gh release view "$tag" >/dev/null 2>&1; then
              echo "::notice::Release $tag already exists, skipping"
            else
              gh release create "$tag" "${args[@]}"
              echo "✅ Created release $tag"
            fi
          done

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

- `changesets/action@v1` creates its own `@frak-labs/core-sdk@1.2.3`-style tags in addition to the new `sdk-core-1.2.3` ones. Consolidating to a single convention is a follow-up (pass `--no-git-tag` to `changeset publish`).

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
        with:
          fetch-depth: 0  # needed for git tag --list

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

      - name: "🚀 Create GitHub release"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: ${{ github.ref_name }}
          VERSION: ${{ steps.version.outputs.version }}
        run: |
          # Previous wordpress-* tag for scoped auto-generated notes
          PREV=$(git tag --list 'wordpress-*' --sort=-v:refname | grep -vFx "$TAG" | head -n1 || true)

          args=(--generate-notes --title "WordPress Plugin ${VERSION}")
          [ -n "$PREV" ] && args+=(--notes-start-tag "$PREV")

          gh release create "$TAG" "${args[@]}" plugins/wordpress/dist/frak-integration-*.zip
```

### How to release
```bash
# 1. Bump "Version:" in plugins/wordpress/frak-integration.php
# 2. Commit & push on main
# 3. Tag + push
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
        with:
          fetch-depth: 0

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

      - name: "🚀 Create GitHub release"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: ${{ github.ref_name }}
          VERSION: ${{ steps.version.outputs.version }}
        run: |
          PREV=$(git tag --list 'magento-*' --sort=-v:refname | grep -vFx "$TAG" | head -n1 || true)

          args=(--generate-notes --title "Magento Module ${VERSION}")
          [ -n "$PREV" ] && args+=(--notes-start-tag "$PREV")

          gh release create "$TAG" "${args[@]}" plugins/magento/dist/frak-magento2-module-*.zip
```

### How to release
```bash
# 1. Bump "version" in plugins/magento/composer.json
# 2. Commit & push on main
# 3. Tag + push
git tag magento-1.0.1
git push origin magento-1.0.1
```

---

## 4. `.github/workflows/tauri-mobile-release.yml` — MODIFY

Keep the existing `workflow_dispatch` (validate / prepare / ios / android /
commit-version). Append one new job `github-release` that runs after iOS and
Android succeed, downloads the artifacts, and creates a GitHub release with
tag `app-{version}`.

Insert this as the last job in the file (leave everything above unchanged):

```yaml
  github-release:
    name: "🏷️ GitHub Release"
    needs: [ios, android]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: "📥 Checkout"
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

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

      - name: "🚀 Create GitHub release"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VERSION: ${{ inputs.version }}
          STAGE: ${{ inputs.stage }}
        run: |
          TAG="app-${VERSION}"
          PREV=$(git tag --list 'app-*' --sort=-v:refname | grep -vFx "$TAG" | head -n1 || true)

          args=(--generate-notes --title "Frak Wallet ${VERSION}")
          [ -n "$PREV" ] && args+=(--notes-start-tag "$PREV")
          [ "$STAGE" = "dev" ] && args+=(--prerelease)

          gh release create "$TAG" "${args[@]}" \
            release-assets/ios/*.ipa \
            release-assets/android/*.aab
```

---

## Summary

| Tag | Assets | Notes |
|---|---|---|
| `sdk-{id}-X.Y.Z` | *(npm only)* | Auto-generated, scoped to previous `sdk-{id}-*` tag |
| `wordpress-X.Y.Z` | `frak-integration-X.Y.Z.zip` | Auto-generated, scoped to previous `wordpress-*` tag |
| `magento-X.Y.Z` | `frak-magento2-module-X.Y.Z.zip` | Auto-generated, scoped to previous `magento-*` tag |
| `app-X.Y.Z` | `Frak Wallet.ipa`, `app-universal-release.aab` | Auto-generated, scoped to previous `app-*` tag; `prerelease` on stage=dev |

Optional polish (follow-up):
- Add `.github/release.yml` to categorise the auto-generated notes by PR label.
- Make changesets stop creating its own `@pkg@version` tags so only the `sdk-{id}-{version}` tags remain.
