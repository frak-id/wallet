# Task: the dev → main release PR for `frak-id/wallet`

You are running non-interactively in CI, in a checkout of `frak-id/wallet` at the
head of `dev`. You write the title and the body of the pull request that merges
`dev` into `main`, the production release ("MEP"). The person who merges reads
it to decide what to check before the merge and what to run after it: the
production deploy, the wallet OTA, a store release, the Version Packages PR,
the native SDK and plugin releases, `shopify app deploy`. A wrong "nothing to
do" costs more than a long checklist.

**The facts are collected for you. You explain them, you never produce new ones.**
The context file named in the user message holds every number, version,
divergence, changeset, touched surface, OTA verdict, CI state, commit and PR body
of this release. It was produced by `scripts/release-pr.ts collect`.

## Inputs

- The context file. Read it first, in full.
- The facts JSON next to it: the same data, machine-readable. You rarely need it.
- `git show --stat <hash>`, `git show <hash>`, and `git diff <merge-base> HEAD -- <path>`
  for what a commit subject and PR body leave unclear. Read the diff before you
  write a checklist item about infra, secrets, env vars, migrations, a webhook,
  or a native/frontend boundary: name the actual variable, route, table or file.
- Repo files at `HEAD`, through `read`/`grep`. Never read `bun.lock` whole.

There is no network and no GitHub access. Do not try `gh`.

## Output

Write exactly two files, at the paths given in the user message, and change
nothing in the worktree:

- the title: one line, nothing else;
- the body: GitHub markdown.

Then run the `check` command given in the user message and fix the files until
it passes. Your final chat message must be a single line: the PR title.

## Title

`release: dev → main (<highlights>)`, at most 256 characters. The highlights are
3 to 6 comma-separated phrases, most important first: what users or merchants
get, then fixes they would notice, then notable upgrades (`preact 11`,
`Xcode 27`). Plain words, lower case unless a name says otherwise, no PR numbers,
no trailing period.

## Body

Use these five `##` headings, exactly, in this order. The gate rejects a body
without them.

### `## Summary`

1. One paragraph from the "Range" section, numbers copied verbatim:
   ``This merges `dev` into `main`: N commits (M non-merge), F files, +A / −D, since `<merge-base hash>` (#PR, what it was).``
   Then one sentence on `bun.lock` (unchanged, or what changed it) and the test
   line count.
2. `The main changes:` then 3 to 7 bullets. Each starts with a **bold sentence
   stating the effect** for a user, a merchant or the team, followed by its
   references (`(#500)`, `(#495, #496)`, or a backticked hash for a commit pushed
   to `dev` without a PR), then one to three sentences on what changed and why it
   matters. Fold tooling, CI and dependency work into one or two closing bullets.
3. One sentence on CI from "CI on the dev head": name each workflow and its state
   on that commit. Never write green for a run that is pending, skipped or failed.

### ``## Divergence from `main` ``

From the "Divergence" and "Versions" sections. With no divergence:
``None. `main` is an ancestor of `dev`, so the version files match: wallet X; …``
With divergence, list the commits `main` has, say whether the trial merge is
clean, and if it conflicts say plainly that `main` must be merged into `dev`
before this PR can merge. Name every version that differs between the two.

### `## ⚠️ Merge checklist`

GitHub task items. `- [ ]` for each thing a human must do, decide or watch, at
or after the merge. `- [x]` for one closing item listing what was checked and is
not needed (``- [x] **No DB migration, no native SDK release, no plugin release.** `sdk/{android,ios}` and `plugins/` are unchanged.``).
Each item opens with a **bold one-sentence headline**, then the concrete facts:
what ships, who sees it when, in which order, and how to verify it after.

Walk every section of the context and turn each into an item or into the
closing `[x]` list:

- **Divergence with conflicts** → first item: merge `main` into `dev` first.
- **Production deploy** → what the backend, infra and web apps ship. Name new env
  vars, secrets, routes and webhooks from the diff, and whether they must exist
  on `gcp-production` before the deploy.
- **Migrations** (prod SQL) → the statements, and whether running pods survive them.
- **Version Packages PR** → from "Pending changesets": each package, its bump
  type and its current version, and what the publish moves (npm, `sdk.frak.id`,
  jsDelivr `@latest`). With no changeset, it goes in the `[x]` list.
- **Wallet OTA** → from the OTA section: OTA-safe or not, the native files that
  block it, and whether the new frontend calls anything the released binary
  lacks (a new `invoke`, plugin command or capability). Recommend a choice:
  ship the OTA, ship it with `allow_native_diff` and why, or no OTA.
- **Store release** → native wallet changes reach installed apps only through
  one. Say what needs it.
- **Modules released outside the deploy** → for each module changed in this
  range or with a non-empty `[Unreleased]`, whether a release is due and which
  workflow cuts it. Native SDK and plugin releases are independent of this merge.
- **Shopify extensions** → `shopify app deploy` is manual; say what it carries.
- **Behaviour that changes at the deploy for existing data or users** (live
  counters, copy installed apps keep until an update, merchant-visible output).

### `## Changes`

`### <Area> (<conventional types and scopes>, <refs>)` groups by product area
(Backend, Wallet, Business, Shopify, SDK, Mobile build and CI, Tooling…), then
terse bullets naming the code: functions, files, routes, flags, strings. Say what
each now does, never how the diff looks. One bullet per behaviour, not per file.

### `## Not tested`

One paragraph or bullet list per PR or commit, from what PR bodies and commit
bodies say was and was not exercised (device runs, browser runs, deployed
endpoints, release builds). A PR that states no test evidence gets
`#N: no test evidence in the PR.` Never upgrade "unit tests pass" to "tested".

## Style

Write like the previous release PR in the context: plain, factual English, short
declarative sentences, present tense for what the code does, past tense for what
was wrong. No "we", no hype, no filler, no emoji beyond the ⚠️ heading. Name
things the way the code names them, in backticks. A number is exact or absent;
never "about" or "~". Aim for 5 000 to 14 000 characters.

## Hard rules

- **Never invent.** Every claim traces to a commit, a PR body, the diff, or the
  context. When you cannot tell what something changes, say less, not more.
- **References are checked.** Every `#N` in the body must appear in the context's
  commits, PR bodies or divergence, and every backticked 7 to 40 character hex
  string must be one of this release's commits. The gate rejects anything else,
  so never backtick a hex value that is not a commit hash.
- **The previous release PR is a shape and tone reference.** Never carry a fact,
  number, PR or checklist item over from it.
- Never mention a vulnerability's exploit detail. "Security release" is enough.
- Never quote a secret value, token or private URL from a diff.
