# Release workflows: catalog

Every workflow the release skill drives or waits on, with its trigger, the ref to
dispatch it on, its inputs, and the human step it ends with. Workflow names below
are what `gh run list` shows. The truth is the workflow file: read it when a
detail here and the file disagree, then fix this page.

Branches and stages: `dev` deploys to `gcp-staging` + SST `dev`; `main` deploys
to `gcp-production` + SST `prod`.

## Triggered by pushes (wait on them, never dispatch them in the flow)

| Workflow | File | Runs on | What it does |
|---|---|---|---|
| `✅ CI: Apps & SDK` | `apps.yaml` | push to `main`/`dev`, PRs, path-filtered | Lint, types, tests, native SDK checks. Absent when no path matched |
| `☁️ Deploy` | `deploy.yml` | push to `main`/`dev` | `sst deploy` of services (GKE), apps, example. `force_deploy` input to redeploy by hand |
| `🚀 Release SDK` | `release.yml` | push to `main` | Pending changesets → opens/updates the **Version Packages** PR (`changeset-release/main`). None pending → publishes what is unpublished to npm, tags `sdk-<id>-<version>`, waits for jsDelivr, moves the `sdk.frak.id` pointer, purges jsDelivr. Else redeploys the Shopify ambassador page |
| `🚀 Release SDK (Beta)` | `beta-release.yml` | push to `dev` touching `sdk/**`/`packages/rpc/**` | Beta npm tags + `sdk-dev.frak.id` pointer |
| `📦 Dependency report` | `dependency-report.yml` | weekly, `dev` pushes touching manifests | Not part of a release |
| `🔬 Agent review (Atelier)` | `agent-review.yml` | PRs | Does not run on bot-opened PRs (the release PR) |

## `🚢 Release PR (dev → main)`: `release-pr.yml`

```bash
gh workflow run release-pr.yml --ref dev [-f refresh=true] [-f model=claude-opus-latest]   # default claude-sonnet-5-5
```

- Stops early, without spending tokens, when a dev → main PR is open and
  `refresh` is off. With `refresh`, the open PR's title and body are rewritten.
- Facts come from `scripts/release-pr.ts collect`, the body from pi with
  `.github/pi/release-pr.prompt.md`, then `release-pr.ts check` gates it.
  Artifact `release-pr`: context, facts, title and body.
- The PR is opened by `github-actions[bot]`: no CI or review runs on it. Its
  checks are the `dev` push runs of the same commit. A person merges it.

## Version Packages PR: `release.yml`, second pass

```bash
gh pr list --head changeset-release/main --state open --json number,title,url
gh pr diff <n> --name-only        # package.json + CHANGELOG.md per bumped package
gh pr merge <n> --merge
```

The merge pushes to `main` again: `🚀 Release SDK` now publishes. Watch it on
the new merge commit. The publish updates every merchant page that loads
`sdk.frak.id` or jsDelivr `@latest` at once.

## `📡 Ship Wallet OTA`: `wallet-ota-hotfix.yml`

```bash
gh workflow run wallet-ota-hotfix.yml --ref main -f platform=both \
  -f notes="…" [-f allow_native_diff=true -f native_diff_reason="…"]
```

- Only from `main`, after the production deploy is green: the new frontend
  calls the production backend.
- Patches the latest **non-prerelease** `app-*` GitHub release (live on the
  stores), not the version `main` carries.
- The guard refuses native changes under `apps/wallet/src-tauri` and Tauri
  plugin package bumps since that tag. `allow_native_diff` needs a reason, and
  only after checking the frontend calls nothing the released binary lacks (the
  release PR's OTA checklist item says which).
- The upload jobs wait on the `ota-prod` environment (required reviewers).
  Approve in the run page, or, after an explicit yes from a reviewer:

  ```bash
  gh api repos/frak-id/wallet/actions/runs/<id>/pending_deployments \
    --jq '.[] | {env: .environment.name, id: .environment.id, can: .current_user_can_approve}'
  gh api -X POST repos/frak-id/wallet/actions/runs/<id>/pending_deployments \
    -F 'environment_ids[]=<id>' -f state=approved -f comment="<reason>"
  ```

## `🚀 Release Mobile App`: `tauri-mobile-release.yml`

```bash
gh workflow run tauri-mobile-release.yml --ref main -f stage=prod [-f version=X.Y.Z]   # store release
gh workflow run tauri-mobile-release.yml --ref dev  -f stage=dev  [-f version=X.Y.Z]   # internal build
```

- Empty `version` = patch bump of the latest `app-*` tag.
- Dispatch opens a PR `release/mobile-<version>` into the dispatch ref, labelled
  `release:mobile` + `release:mobile:<stage>`. For `prod`, pi wrote the store
  "What's new" into `apps/wallet/store/whatsnew/whatsnew-{en-US,fr-FR}`. Review
  them with the user (plain text, 500 characters max each, `bun scripts/store-notes.ts check`).
- Merging that PR builds iOS and Android, uploads to TestFlight / Play, tags
  `app-<version>`, creates the GitHub release, and for `prod` drafts the App
  Store version and the Play production release.
- **Human step**: "Add for Review" in App Store Connect and "Send for review" in
  Play Console.
- The PR lands on `main` only: realign `dev` afterwards (skill Phase 7).

## Native SDKs: `release-android-sdk.yml`, `release-ios-sdk.yml`

The version bump must already be on `main`, through a dev → main release:
`bun scripts/native-version.ts bump <android|ios> <x.y.z>` moves every version
site and promotes `[Unreleased]` in `sdk/<platform>/CHANGELOG.md`. Both workflows
check the tree's version against the requested one and fail otherwise. Versions
are immutable once published: always dry run first.

```bash
# Android → Maven Central (id.frak.sdk:core + :ui, one deployment)
gh workflow run release-android-sdk.yml --ref main -f version=X.Y.Z -f dry_run=true
gh workflow run release-android-sdk.yml --ref main -f version=X.Y.Z -f dry_run=false -f publishing_type=USER_MANAGED

# iOS → SwiftPM mirror frak-id/frak-ios-sdk
gh workflow run release-ios-sdk.yml --ref main -f version=X.Y.Z -f dry_run=true
gh workflow run release-ios-sdk.yml --ref main -f version=X.Y.Z -f dry_run=false
```

- A real run creates the `android-v<version>` / `ios-v<version>` tag. Pushing
  that tag by hand does the same as a real run.
- Android `USER_MANAGED` (default): the deployment waits VALIDATED on the Central
  Portal and the GitHub release is a draft. **Human step**: publish both.
  `AUTOMATIC` goes live and cannot be undone.
- iOS: the real run force-pushes the mirror and tags it. There is no undo, only a
  newer version.

## `🚀 Release PHP Plugins`: `release-php-plugins.yml`

```bash
gh workflow run release-php-plugins.yml --ref main -f wordpress_version=X.Y.Z [-f prestashop_version=X.Y.Z]
```

- Pick versions from each plugin's `[Unreleased]` (semver: Added → minor, Fixed
  only → patch) and its latest tag (`wordpress-*`, `prestashop-*`). Never
  `magento_version`: `plugins/magento` is unused scaffolding.
- Dispatch opens `release/php-…` into `main` (version files + CHANGELOG promoted).
  Merging it tags `<plugin>-<version>`, builds the zip and publishes the GitHub
  release. Realign `dev` afterwards.

## Shopify `shopify app deploy`: manual, not a workflow

Needed only when `apps/shopify/extensions/**` or `apps/shopify/shopify.app.*.toml`
changed. The app server itself ships with `☁️ Deploy`. The CLI uploads the
working tree and is interactive (Shopify login, confirmation):

```bash
WT=$(mktemp -d)/shopify && git worktree add --detach "$WT" origin/main
cd "$WT" && bun install --frozen-lockfile
bun run --cwd apps/shopify shopify:deploy:prod      # through interactive_shell: the user answers the CLI
```

## `🧪 Release Native Example Apps`: `release-native-examples.yml`

```bash
gh workflow run release-native-examples.yml --ref main -f platform=both [-f version=1.2]
```

Internal only (TestFlight, Play internal track). No review, safe any time.
Ships the SDK harnesses built from the chosen ref's source.
