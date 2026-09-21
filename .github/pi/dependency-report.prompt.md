# Task: weekly dependency report

You are running non-interactively in CI, in a checkout of `frak-id/frak-wallet`.
A deterministic collector has already resolved every pinned version in this repo
against its upstream registry. **You do not discover versions — you explain
them.**

This is the invariant the whole pipeline rests on. A version, tag, sha or digest
that is not already in `dependency-inventory.json` must never appear in your
report. Do not scan the worktree for versions; read them from the inventory.

## Inputs

- `dependency-inventory.json` — the collector output. Read it first.
- `AGENTS.md` — the root compass. Read it. Its "Non-Obvious Patterns" section is
  where the real cost of an upgrade in this repo is written down.
- `scripts/AGENTS.md`, `sdk/AGENTS.md` — read when an item points into them.
- `$GITHUB_TOKEN` is exported — use it for GitHub API calls.

## Output

Write **one file**: `dependency-report.md`. Change nothing else in the worktree.
No preamble, no closing chatter in your final message — the file is the
deliverable. Your final chat message must be a single line: the count of items
you reported on.

## Inventory semantics

The top level carries `generatedAt`, `repo`, `floors`, `counts` and `items`.
Each item carries: `id`, `kind`, `name`, `surface`, `current`, `latest`,
`delta`, `needsUpdate`, `tier`, `flags`, `source`, `locations` (file + line),
and optional `homepage`, `meta`, `note`, `trap`.

### `tier` — read this before anything else

`tier` is `"research"` or `"appendix"`.

**Report on `tier: "research"` items only.** That is the entire scope of your
work.

`tier: "appendix"` is the npm and cargo minor/patch tail — hundreds of items. It
is rendered mechanically by `scripts/upsert-dependency-issue.ts` and appended
after your body. So:

- Do not read appendix items.
- Do not research them.
- Do not render them.
- Do not list, table, or summarise them beyond the count `counts.appendix`
  already gives you.

Filter the array once, up front, and work only the research tier. Reading the
appendix is the single biggest way to waste this run and blow the size limit.

### `surface`

`surface` is one of `infra`, `ci`, `cargo`, `npm`, and it selects the section an
item is written into. The mapping is in the report format below.

The Android and iOS SDK surfaces are deliberately not collected — `sdk/android`,
`sdk/ios` and the PHP plugins are outside this report's scope. Do not research
them, and do not note their absence.

### `delta`

`major` / `minor` / `patch` / `none` / `unknown`, computed from the versions.
Use it to set `Priority`, and say `unknown` plainly rather than guessing at a
shape the collector could not parse.

### `flags`

A flag promotes an item to the research tier regardless of version delta, and
each one obliges you to say something specific:

- `mutable-tag` — the pin can move under the repo without a commit. A
  reproducibility and supply-chain finding in its own right; write the entry
  even when `current` and `latest` are equal, and say what pinning it properly
  would take.
- `unpinned-action` — the action is tag-pinned rather than sha-pinned. This is
  a **class finding, not a per-item one**: most of these carry no version delta
  at all, and a dozen near-identical "sha-pin this" blocks is a list, not a
  report. See the consolidation rule in the CI section below.
- `publishes-artifacts` — the location is a workflow that signs or publishes to
  Maven Central, Google Play, the App Store, the SwiftPM mirror, or npm. These
  are the highest-stakes items in the report: a moved tag there is a
  supply-chain vector against a signing key. Never mark one `routine`.
- `deprecated` — upstream published a deprecation notice. Quote it, and name
  the successor package only if the registry data names one.
- `floor-coupled` — the bump can cross a gated floor. You **must** name which
  floor from `floors` it could cross, which `gate` command catches it, and
  whether that gate runs **before** the merge (a `lint`/`check` script, or a
  build that CI runs on the PR) or **after** it. That timing is the finding.
- `paired` — the item cannot move alone. Report it and its partner as a single
  paired action with one recommendation, never as two independent bumps.
- `lookup-failed` — the collector could not resolve `latest`. It belongs in
  **⚠️ Unresolved** as a single line. Never research around a failed lookup into
  a version you found elsewhere.

### `trap`

A repo rule that changes what this upgrade costs here. When an item carries a
`trap`, the **Risk here** line must engage with it — what it means for this
bump, in this repo — rather than restating the upstream changelog.

### `floors`

The top-level `floors` array is the set of gated floors: the browser ES target
(`es2022` / `safari15.4`), the CDN gzip budget and the single-parse-unit
constraint on the CDN bundles, iOS 16 for the Tauri wallet app, and the Bun pin.
Each floor names the `gate` command that fails when it is crossed. Treat these as
fact; do not restate a floor value you did not read from here.

### `meta`

- `meta.inRange: "true"` (npm) means the new version already satisfies the
  declared range: `bun install` picks it up, **no file edit is needed**. Say so
  in **Apply** instead of quoting an edit.
- `meta.latestSameMajor` (images) is the conservative alternative when `latest`
  crosses a major. Offer both.
- `meta.latestSha` (actions) is the commit a sha-pinned `uses:` must move to.
  Quote it in full.

## Research rules

For each research-tier item, spend a few HTTP calls establishing what actually
changed between `current` and `latest`. Useful, cheap sources:

```bash
curl -sSL -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/releases?per_page=20"
curl -sSL "https://registry.npmjs.org/<pkg>"          # times, deprecations
curl -sSL "https://raw.githubusercontent.com/<owner>/<repo>/<tag>/CHANGELOG.md"
curl -sSL "https://api.github.com/repos/<owner>/<repo>/compare/<a>...<b>"
```

If `curl` is missing, use Bun instead:
`bun -e 'console.log(await (await fetch(URL)).text())'`.

Hard rules:

- **Never invent a version, CVE id, date, sha, or release note.** If research
  fails or is inconclusive, write `research: inconclusive` for that item and
  move on. A short honest entry beats a confident wrong one.
- Only versions present in the inventory may appear as "current"/"latest".
- Attribute security claims: name the advisory (`GHSA-…`, `CVE-…`) or say
  "vendor release notes mention a security fix" — do not upgrade a vague
  changelog line into a CVE.
- Prefer the project's own release notes over blog posts or summaries.
- Budget: roughly 3 lookups per research-tier item. If the item spans many
  releases, read the newest few plus anything flagged breaking or security, and
  say that the span was summarised rather than read exhaustively.

## Repo-specific judgement (read AGENTS.md, then apply)

- **The Tauri crates move as a set.** `tauri` and `tauri-build` share an
  internal ABI; a manifest carrying two different versions of them does not
  build. `wry` and `tao` are the webview and windowing layer under the wallet,
  so a bump there lands on the passkey path and the iOS floor.
- **Seven `tauri-plugin-*` crates are first-party**, consumed by `path` from
  `apps/wallet/src-tauri/plugins/`. A crates.io package of the same name is a
  different dependency — never recommend replacing a path dependency with it.
- **A cargo bump inside the declared range needs `cargo update`, not an edit.**
  Cargo ranges are caret-by-default, so a bare `"1.0"` already accepts any
  `1.y.z`. Check `meta.inRange` and `meta.locked` before quoting a manifest edit.
- **Action pins in publishing workflows are the top of the report.** Workflows
  carrying signing secrets — Maven Central, Google Play, the App Store, the
  SwiftPM mirror deploy key, npm — are where a moved tag compromises a signing
  key. Rank these above a larger version delta somewhere harmless.
- **`typescript@6` alongside `@typescript/native` (TS 7) is deliberate.** tsdown,
  rolldown-plugin-dts and tsserver peer on TS ≤ 6; only the `typecheck` scripts
  use TS 7. Never recommend unifying or removing either.
- **`plugins/magento` is dead scaffolding.** No merchant has ever run it. Never
  recommend work there; if an item's only locations are under it, say so and
  mark it `hold`.
- **Bun drift is already gated.** `bun run check:bun-version` holds the seven
  Dockerfile `ARG BUN_VERSION` sites in step with `packageManager`. The only Bun
  finding worth writing is the upstream delta — never report drift between the
  Dockerfiles as if it were open.
- **The Bun catalog is the npm spine.** When a research-tier npm item is
  declared `catalog:` in a workspace, the edit is one line in the root
  `package.json` catalog, not one per workspace. Check `locations`.

## Report format

Exactly this structure, in this order:

````markdown
<!-- frak-dependency-report -->
## 📦 Dependency report — <YYYY-MM-DD>

<one paragraph: how many tracked, how many need research, and the single most
urgent thing to do this week. Plain sentences, no hedging.>

| Surface | Tracked | Needs research | Routine |
|---|---|---|---|
| ☁️ Infra & images | n | n | n |
| 🔧 CI & Actions | n | n | n |
| 🦀 Tauri (Rust) | n | n | n |
| 📦 npm | n | n | n |

### ☁️ Infra & images

#### `<name>` `<current>` → `<latest>`

- **Priority**: security / recommended / routine / hold
- **Security**: <advisory ids and what they fix, or "none found">
- **Changes**: <breaking changes first, then notable features — max 3 bullets>
- **Apply**: `<file>:<line>` — <exact edit or command>
- **Risk here**: <what this touches in *this* repo, one sentence engaging with
  the item's `trap` or the floor it could cross>

<repeat per research-tier item in this surface; then:>

_No further findings on this surface._

### 🔧 CI & Actions

<`surface: "ci"`, with one exception to the per-item shape.>

**Consolidate the pinning posture into a single entry.** Open this section with
one `#### 🔐 Action pins are tags, not shas` block covering every item flagged
`unpinned-action`: one paragraph on why it matters here (a moved tag in a
workflow holding a signing key), then one table — action, current ref,
`meta.latestSha`, and the publishing workflows from `meta.publishingWorkflows`.
That table is where `meta.latestSha` gets quoted in full, once per action.

Then write a normal per-item block **only** for CI items that have something
more to say than their pin style: a real version delta (`needsUpdate: true`),
a `mutable-tag` flag, or a major that changes behaviour. An action whose only
finding is "tag-pinned" appears in the table and nowhere else.

Two things worth checking against `locations` before you write this section:
the same action pinned at two different majors in different workflows is two
items and a real inconsistency, and a sha-pinned item is already compliant —
it belongs in the table only if its sha is stale.

### 🦀 Tauri (Rust)

<same shape — `surface: "cargo"`, research tier only. **Apply** is a
`cargo update -p <crate>` when `meta.inRange` is true, and a manifest edit at
`file:line` when it is not.>

### 📦 npm

<same shape — `surface: "npm"`, research tier only. The minor and patch tail is
appended mechanically after your body; do not reproduce it.>

### ⚠️ Unresolved

<items flagged `lookup-failed`, and items where your research was inconclusive.
One line each. Omit the section when empty. An item with `latest: null` and no
`lookup-failed` flag is not a failure — a `workspace:*` or floating range has
nothing upstream to resolve. Leave those out.>

---
<sub>Generated by pi (`claude-sonnet-5` via cliproxy) from
`dependency-inventory.json` · run `<workflow run url>`</sub>
````

Section order is fixed: `infra`, `ci`, `cargo`, `npm`, then Unresolved. Omit a
surface section entirely if it has no research-tier items.

Ordering inside a section: security first, then breaking, then routine.

## Size

Your body must stay **under 40,000 characters**. The mechanical appendix is
appended after it, and the combined issue body must fit GitHub's 65,536 limit.

The way to stay under it is tighter per-item blocks — shorter **Changes**
bullets, one-sentence **Risk here**. Never drop a research-tier item to save
space: every research-tier item must appear.
