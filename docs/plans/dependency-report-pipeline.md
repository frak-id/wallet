# Porting the infra-core dependency report here

Assessment, 2026-09-19. Source: `infra-core@bba6359` — `.github/workflows/dependency-report.yml`,
`scripts/dependency-inventory.ts`, `scripts/upsert-dependency-issue.ts`, `.github/pi/`.

## Verdict

Relevant, but the shape has to invert. Port the agent half; do not port the collectors as they stand.

infra-core's pipeline exists because its dependencies are invisible to every bot: Helm chart
versions, container tags, Pulumi provider plugins and action SHAs are hand-pinned inside
`infra/**/*.ts`, with no lockfile and no registry client that could notice a move. A deterministic
scanner plus an agent reading changelogs is the only thing that can see them at all.

That premise mostly does not hold here. Its five collectors land like this:

| Collector | frak-wallet |
|---|---|
| `collectHelm` | zero hits — no `helm.v3` anywhere in `infra/` |
| `collectPulumiProviders` | 2 (`@pulumi/kubernetes`, `@pulumi/pulumi`) + `sst@4.14.3` |
| `collectImages` | 2 real: `oven/bun` via `ARG BUN_VERSION=1.4.2` **duplicated in 5 Dockerfiles**, `nginx:1.31.4-alpine` |
| `collectActions` | 25 distinct, **all tag-pinned (`@v6`), none SHA-pinned** — the opposite of infra-core's posture |
| `collectNpm` | **868 entries across 28 tracked `package.json`**, partly centralized by the Bun catalog |

The last row is the problem. infra-core's npm surface is small enough for an LLM to reason about
every outdated item weekly. 868 entries means the report is either enormous or shallow — and
Renovate/Dependabot already cover that class better, because they open PRs and this only opens an
issue.

## Tier 1 — a bot, which this repo has neither of

No `renovate.json`, no `dependabot.yml` today. Renovate covers npm, `libs.versions.toml`, composer
and Actions natively.

- **Scope via `git ls-files` semantics.** `plugins/magento/vendor/` and `plugins/prestashop/.cache/`
  are gitignored vendored trees — that is the 47-vs-28 `package.json` gap. Unscoped, they flood any
  scanner.
- **Encode the traps as rules, or it breaks the build in week one**: `typescript@6` alongside
  `@typescript/native` is deliberate; `@wagmi/connectors` is a resolutions stub; `plugins/magento`
  is dead scaffolding.

## Tier 2 — the agent report, aimed only at what no bot handles

- **Native SDK versions** — `scripts/native-version.ts` gates 5 Android + 3 iOS sites that must move
  as one hand-written commit, deliberately outside Changesets. Structurally bot-hostile, and the
  clearest case for a reasoning agent.
- **`BUN_VERSION` across 5 Dockerfiles** + `nginx:1.31.4-alpine`. Drift between the five is a silent
  finding today.
- **Action SHA pinning** — infra-core treats a moved tag as a supply-chain vector. Here 25 actions
  are tag-pinned, including release workflows that sign and publish to Maven Central and Google
  Play. Higher stakes than there.
- **Floor-coupled upgrades** — Safari 15.4 / iOS 16 / `ES2022` / Swift 6 / CDN bundle size. A bump
  that shifts an emitted construct above the floor is caught by `check:es-output` *after* the merge;
  flagging it beforehand is worth more here than in infra-core.

## Reuse verbatim

The invariant from `infra-core/scripts/AGENTS.md`: *don't move version discovery into the report
agent — the LLM half is forbidden from introducing a version that is not in
`dependency-inventory.json`*. That is what makes the pipeline trustworthy, and it is the first thing
a port loses.

## Resolved, and built — 2026-09-21

Tier 2 was stood up first and alone; Tier 1 still does not exist. The issue lives here, not in
infra-core: nothing in this pipeline reads a cluster, and the traps that make a bump expensive are
all local.

**npm was collected after all, against this document's own advice.** The reasoning that npm is
Renovate's job assumed Renovate. There is none, so nothing covered 868 entries at all. What actually
keeps the report finite is tiering rather than scope: everything is collected, and `tierFor` demotes
npm minors and patches to `tier: "appendix"`, which the agent is forbidden to read and which
`upsert-dependency-issue.ts` renders mechanically after the agent's body. Majors, deprecations and
anything floor-coupled still get full research. First live run: **263 tracked, 101 outdated, 70 to
research, 45 rendered mechanically, 0 unresolved.**

Two claims above were already stale when this was written, and the collectors were built against the
repo instead:

- `BUN_VERSION` drift across the Dockerfiles is **not** a silent finding — `scripts/check-bun-version.ts`
  has gated all 8 sites for a while. The only Bun finding is the upstream delta.
- The `collectNpm` count is 27 tracked `package.json`, not 28, and the Bun catalog sits at top-level
  `catalog`, not `workspaces.catalog`. The second one silently dropped `sst` from an early draft —
  exactly the failure mode the discovery invariant exists to prevent.

What the first run surfaced that nothing in the repo was watching:

- `@pulumi/kubernetes` is `^4.34.1` in `package.json` while `sst.config.ts` pins the `kubernetes`
  provider at `4.28.0` — six minors apart, on two pins that must move together.
- The Gradle wrappers disagree by a major: `8.14.3` under `src-tauri/gen/android` against `9.5.0` elsewhere.
- `org.ow2.asm:asm-tree` is pinned in `buildSrc` with no catalog key, so nothing tracked it; it has
  to move with `org.ow2.asm:asm`. Same for `com.android.tools.build:gradle` and
  `org.jetbrains.kotlin:kotlin-gradle-plugin`, which the catalog only carries under their plugin-marker spelling.
- Three deprecated packages sitting at their latest version, which no version delta would ever catch.
- `actions/upload-artifact` pinned at both `@v4` and `@v7` in different workflows.

**SHA-pinning is a class finding, not 25 of them.** `PUBLISH_SECRET` flags any action appearing in a
workflow that holds a signing credential, which is 17 of 25 pins — true, deterministic, and useless
as 17 near-identical entries. The collector keeps the flag on every one; the prompt consolidates them
into a single entry with one table. Editorial problems belong in the prompt, not in the collector.

## Still open

- Tier 1. Renovate would still cover npm, `libs.versions.toml`, composer and Actions with PRs
  instead of an issue, and the scoping and trap rules in the Tier 1 section above are unchanged.
- `CLIPROXY_API_KEY` has not been confirmed as visible to this repo. The workflow preflights it and
  fails in seconds with an actionable message, so the first scheduled run will say either way.
- `scripts/` is still outside every typecheck target (see `scripts/AGENTS.md` for the manual command).
