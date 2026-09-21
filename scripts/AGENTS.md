# AGENTS.md — `scripts/`

Standalone Bun scripts outside every workspace. Non-obvious knowledge only.

## Overview

Two kinds live here. **Gates** (`check-*.ts`) run inside `bun run lint` and fail the build on drift
between hand-maintained sites. **The dependency pipeline** (`dependency-inventory.ts`,
`dependency/`, `upsert-dependency-issue.ts`) resolves every pinned version against its upstream
registry weekly and hands the deltas to an agent that writes the report issue.

## Traps

- **`scripts/` is in no workspace.** `bun run typecheck` is `--filter '*' typecheck`, so nothing here
  is typechecked by the quality gate — `scripts/tsconfig.json` exists for the editor. Biome lints it,
  vitest runs `scripts/*.test.ts` as the `scripts-unit` project (registered explicitly in the root
  `vitest.config.ts`, because glob discovery only covers the workspace directories). To check types
  by hand, `fetch` needs a lib the root config does not carry:
  ```bash
  cat > /tmp/t.json <<EOF
  {"extends":"$PWD/tsconfig.json",
   "compilerOptions":{"lib":["es2023","dom"],"types":["node"],"typeRoots":["$PWD/node_modules/@types"]},
   "include":["$PWD/scripts/**/*.ts"]}
  EOF
  ./node_modules/.bin/tsgo -p /tmp/t.json --noEmit
  ```
  `types` and `typeRoots` are both load-bearing: without them every `node:` import reports as a
  missing name and the run is all false positives.
  `extract-android-fingerprint.ts` and `write-sandbox-env.ts` call `Bun.*` and need `bun-types`,
  which is why they are outside every include here.
- **`bun.d.ts` declares only the Bun surface these scripts use.** `bun-types` is a per-workspace
  devDependency; adding a root one to typecheck a handful of files is the thing it exists to avoid.
- **Test files must sit at `scripts/*.test.ts`.** `scripts/vitest.config.ts` includes
  `*.{test,spec}.ts` non-recursively, so a test written next to its module under `dependency/` is
  silently never run.

## The gates, and what each one is really protecting

| Script | Truth | Why it exists |
|---|---|---|
| `check-bun-version.ts` | `packageManager` in the root `package.json` | Seven Dockerfile `ARG BUN_VERSION` sites plus what `setup-bun` resolves in CI. A partial bump is silent — CI and the images just run different Bun versions |
| `native-version.ts` | `frak.sdk.version` / `FrakSDKVersion.swift` | 5 Android + 3 iOS sites move as one hand-written commit. A published version is immutable on Maven Central and the SwiftPM mirror, so drift caught after tagging ships uncorrectable |
| `check-ios-floor.ts` | `gen/apple/project.yml` | Twelve sites. A partial bump is not a warning: `.vN` needs the PackageDescription that shipped it, so an older `swift-tools-version` is a hard parse error while an older `.vN` links fine |
| `check-es-version.ts` | `BROWSER_TARGET_ECMA` | The only layer that sees what actually ships — `lib` cannot reject an ambient augmentation and `skipLibCheck` hides dependency `.d.ts` |
| `check-comments.ts` | `comment-budget-baseline.json` | A file may only ever get better. Pay some down, then `bun run lint:comments -- --update-baseline` |

## The dependency pipeline

```
dependency/types.ts      the contract: InventoryItem, Flag, Floor, semverDelta(), tierFor()
dependency/registry.ts   upstream lookups only — npm, crates.io, Docker Hub, GitHub
dependency/traps.ts      repo knowledge: the gated FLOORS and the per-package TRAPS table
dependency/collect-*.ts  one exported async collector each, resolving to InventoryItem[]
                         four surfaces: infra, ci, cargo, npm
dependency-inventory.ts  orchestrates, re-derives tiering, emits JSON   (`bun run deps:inventory`)
upsert-dependency-issue.ts  posts the agent's report + the mechanical appendix to one issue
.github/pi/              the agent's prompt and its CI-only model catalogue
.github/workflows/dependency-report.yml   Mondays 06:00 UTC
```

- **Never move version discovery into the report agent.** The agent is forbidden from introducing a
  version that is not in `dependency-inventory.json`, and that guarantee dies the moment it starts
  scanning files for versions itself. A collector that cannot resolve something emits
  `latest: null` with a `note` and the `lookup-failed` flag — it never guesses.
- **Scope is four surfaces, and the exclusions are deliberate.** `sdk/android`, `sdk/ios` and the
  PHP plugins are not collected: their gates (`check:native-versions`, `check:ios-floor`) already
  hold the version sites that matter, and a weekly writeup of the Gradle catalog was 689 lines of
  collector for 25 items nobody acts on. Tauri's Rust crates are in scope; its iOS `Package.swift`
  pins are not.
- **Tiering is what keeps the report finite.** ~900 npm and cargo entries are collected; only
  `tier: "research"` reaches the agent. Their minors and patches are `tier: "appendix"` and are
  rendered mechanically by `upsert-dependency-issue.ts` after the agent's body.
  `dependency-inventory.ts` re-derives every tier through `tierFor` rather than trusting the
  collectors.
- **Any `flags` entry promotes an item to `research` regardless of version delta.** That is how a
  mutable tag, a deprecation, or a tag-pinned action inside a workflow holding signing keys gets
  written up even when nothing moved.
- **Scope with `trackedFiles()`, never a filesystem glob.** `plugins/magento/vendor/` and
  `plugins/prestashop/.cache/` are gitignored vendored trees that flood any scanner — that is the
  47-vs-27 `package.json` gap.
- **Lean on the package managers, not on a parser.** `collect-npm.ts` shells out to `bun outdated
  --filter '*'`, which already resolves the workspace graph and the catalog; `collect-cargo.ts`
  shells out to `cargo metadata --format-version 1`, which hands back normalised reqs, kinds and
  targets. Both collectors were three to five times longer when they did that work themselves.
- **`bun outdated` has no `--json`.** The only output is a padded ASCII table with no stability
  guarantee, so `parseOutdated` asserts the header is exactly `Package | Current | Update | Latest |
  Workspace` and throws with the raw output when it is not. A Bun release that reshapes the table
  must break the build, never quietly report nothing outdated.
- **A deprecated package is usually not an outdated one**, so it never reaches that table.
  `deprecatedButCurrent()` sweeps the declared names — names only, no ranges, no resolution — and
  emits an item solely when the registry flags one. Workspace packages are skipped because they are
  unpublished and only ever 404.
- **Collectors must not throw.** One crashed collector is logged and skipped; the run still produces
  a report from the rest. `cargo` missing from a runner yields `[]`, not a failure.
- **Two collectors can legitimately reach the same pin.** `sst` and `@pulumi/kubernetes` are npm
  dependencies and infra pins at once, so `dependency-inventory.ts` merges items sharing a name and
  a location — earlier collectors win the surface and trap, later ones contribute locations — and
  throws on any surviving id collision.
- `GITHUB_TOKEN` is optional locally but caps at 60 requests/hour without it, which is not enough for
  the action pins alone.

## Anti-Patterns

`console.log` outside the JSON payload in `dependency-inventory.ts` (stdout must stay a clean
document — progress goes through `log()`) · hand-computing a tier instead of calling `tierFor` ·
a hand-maintained coordinate table where the Gradle catalog already declares `version.ref` ·
recommending work in `plugins/magento` · unifying `typescript` with `@typescript/native`.

## See Also

Root `AGENTS.md` · `packages/dev-tooling/src/es-version.ts` (the browser floor) ·
`docs/plans/dependency-report-pipeline.md` (why this pipeline is shaped the way it is).
