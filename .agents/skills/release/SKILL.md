---
name: release
description: Run the Frak Wallet production release (MEP) end to end. Brings main into dev, opens the dev → main release PR through the "🚢 Release PR" workflow (pi writes the body), waits for CI and deploys, merges after a checklist review, then drives the follow-up releases (Version Packages/npm SDK, wallet OTA, mobile store release, Android/iOS SDK, PHP plugins, Shopify app deploy, native example apps). Use for /skill:release, "MEP", "release to prod", "ship dev to main", or to run any of those follow-up releases on its own.
---

# Release (MEP): `dev` → `main`, then everything after

You are the release driver. The user decides; you collect facts, run the
workflows, wait on them and report. `references/workflows.md` lists every release
workflow with its trigger, inputs, ref and the human step it ends with. Read it
before Phase 6, or before running any single release on its own.

## Rules

- **One explicit yes per irreversible step**: pushing to `dev`, dispatching a
  workflow, merging a PR, pushing a tag, approving an environment. Never fold two
  of them into one question. Ask with `ask_user` (or plainly in chat when the
  harness has none), with the facts in the question's context.
- **Merge with `gh pr merge <n> --merge` only.** The repo allows merge commits
  only. Never `--delete-branch` on the release PR: its head is `dev`. Never
  `--admin` unless the user asks for it by name.
- **Merge as the user, never with a bot token**: a merge made with
  GITHUB_TOKEN starts no `main` workflow, so nothing deploys.
- **Re-read GitHub state after every step**, never assume it. Runs take seconds
  to appear after their trigger.
- **Waiting**: `gh run watch <id> --exit-status --interval 20` blocks for the
  whole run (deploys take 10 to 30 minutes, mobile builds longer). In pi, launch
  it with `interactive_shell` in `dispatch` mode with
  `handsFree: { autoExitOnQuiet: false }` and a timeout, so you are woken when
  it ends, and keep talking to the user meanwhile.
- Work in a temporary worktree for any git change. The user's checkout is theirs.

Find the run a push or a merge started (it can take a while to appear):

```bash
run_for() { # <workflow file> <sha>
  for _ in $(seq 1 30); do
    id=$(gh run list --workflow "$1" --commit "$2" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
    [ -n "$id" ] && { echo "$id"; return 0; }
    sleep 10
  done
  return 1
}
```

## Phase 0: where things stand

```bash
gh auth status
git fetch origin --tags --prune --quiet
mkdir -p /tmp/frak-release
bun scripts/release-pr.ts collect --out /tmp/frak-release/context.md --facts /tmp/frak-release/facts.json
jq '{commits: .stats.commits, nonMerge: .stats.nonMerge,
     divergence: [.divergence.commits[] | .hash + " " + .subject], conflicts: .divergence.conflicts,
     ci: .ci, ota: .ota, changesets: [.changesets[] | .bumps],
     modules: [.modules[] | {label, latestTag, changedInRange, unreleased: (.unreleased != "")}],
     surfaces: [.surfaces[] | {label, files: (.files | length)}]}' /tmp/frak-release/facts.json
gh pr list --base main --head dev --state open --json number,title,url
```

`collect` is the same script the workflow runs, so this is what the PR body will
be written from. Tell the user in a few lines: commits ahead, divergence and
conflicts, CI on the `dev` head, whether a release PR is open, and what the
release looks like it will need (deploy only, OTA, store release, Version
Packages, modules with `[Unreleased]` entries).

Stop and say why when `dev` has nothing `main` lacks.

**Ask now about native SDK releases.** If the Android or iOS SDK has a non-empty
`[Unreleased]`, its version bump must land on `dev` *before* the release PR,
because the release workflow checks the version sites of the tagged tree
(`references/workflows.md` → native SDKs). Bump on a branch, PR into `dev`:
`bun scripts/native-version.ts bump <android|ios> <x.y.z>`, commit
`release(sdk): cut the <platform> SDK at <x.y.z>`. PHP plugins need nothing
here: their release PR targets `main` after the merge.

## Phase 1: bring `main` into `dev` (only with divergence)

`main` gets commits `dev` lacks from mobile store releases and Version Packages
PRs. With conflicts, the release PR cannot merge. Ask before doing anything.

Resolve automatically **only** when every conflict is a wallet version site:
`apps/wallet/package.json`, `apps/wallet/src-tauri/{tauri.conf.json,Cargo.toml,Cargo.lock}`,
`apps/wallet/src-tauri/gen/apple/{project.yml,app_iOS/Info.plist}`, `bun.lock`.
Anything else: list the files and hand the merge to the user.

```bash
WT=$(mktemp -d)/sync && git worktree add --detach "$WT" origin/dev && cd "$WT"
MAIN_V=$(git show origin/main:apps/wallet/package.json | jq -r .version)
DEV_V=$(git show origin/dev:apps/wallet/package.json | jq -r .version)
# Keep the higher wallet version on each conflicting hunk; non-conflicting changes from both sides stay.
SIDE=$([ "$(printf '%s\n%s\n' "$MAIN_V" "$DEV_V" | sort -V | tail -1)" = "$MAIN_V" ] && echo theirs || echo ours)
git merge origin/main --no-edit -X "$SIDE" -m "Merge remote-tracking branch 'origin/main' into dev"
jq -r .version apps/wallet/package.json          # the higher of the two
bun install --lockfile-only && git diff --exit-code bun.lock
git diff --stat origin/dev
```

Show the stat, ask, then `git push origin HEAD:dev`, and clean up
(`cd - && git worktree remove --force "$WT"`). Re-run `collect` afterwards.

## Phase 2: the `dev` head is green

```bash
SHA=$(git rev-parse origin/dev)
gh run list --commit "$SHA" --json databaseId,workflowName,status,conclusion,url
```

Wait for `✅ CI: Apps & SDK` and `☁️ Deploy` (`gcp-staging`). CI only runs when
its paths match, so its absence is fine. A failed one: show
`gh run view <id> --log-failed | tail -60` and ask whether to stop. A release PR
on a red `dev` needs the user to say so.

## Phase 3: open the release PR

If a release PR is already open, ask: keep it as is, or refresh it (rewrites the
title and body, and drops ticked boxes and hand edits).

```bash
gh workflow run release-pr.yml --ref dev            # add -f refresh=true to rewrite the open PR
gh run list --workflow release-pr.yml --limit 1 --json databaseId,url --jq '.[0]'
gh run watch <id> --exit-status --interval 20       # 5 to 20 minutes
gh pr list --base main --head dev --state open --json number,url,title
```

`--ref dev` runs dev's copy of the workflow and prompt. The workflow must also
exist on `main`, because GitHub only dispatches workflows the default branch
knows. If the run fails, show `gh run view <id> --log-failed | tail -80`. The
`release-pr` artifact holds the facts and the rejected draft. Offer a rerun, or
`-f model=claude-opus-latest` (the default is `claude-sonnet-5-5`).

## Phase 4: review with the user

```bash
gh pr view <n> --json title,body,mergeable,mergeStateStatus,url
```

1. Give the title and the "main changes" bullets in a few lines.
2. Go through **every unchecked item** of the `⚠️ Merge checklist`. Ask which are
   handled (one multi-select). For each one that is not, ask what to do: handle
   it now, accept it, or stop. Some items are post-merge actions (OTA, Version
   Packages, store release); record them for Phase 6 instead of blocking on them.
3. `mergeable` must be `MERGEABLE`. `CONFLICTING` → back to Phase 1. `UNKNOWN` →
   wait a few seconds and read it again.
4. Ask: "Merge #n into `main` now? This starts the production deploy." Options:
   merge / not yet / stop.

## Phase 5: merge and watch production

```bash
gh pr merge <n> --merge
MERGE_SHA=$(gh pr view <n> --json mergeCommit --jq .mergeCommit.oid)
```

The `main` push starts `☁️ Deploy` (`gcp-production`: services, prod apps,
example) and `🚀 Release SDK` (opens or updates the Version Packages PR when
changesets are pending, else redeploys the Shopify ambassador page). Watch the
deploy with `run_for deploy.yml "$MERGE_SHA"`. Report the result with its URL.
A failed production deploy comes before anything else: show the failed log and
stop.

The listener HTML is cached for 5 minutes, so a listener release (hotfix
included) reaches a returning user up to 5 minutes after the deploy is green.
In that window, a lazy chunk of the previous build (modal, sharing page) that
the user's browser has not cached returns 404, so that UI can fail to open.

## Phase 6: follow-up releases

Build one multi-select from the facts and the checklist, pre-selecting what the
PR says is due, and run each choice in this order: backend before the clients
that call it. Every entry is in `references/workflows.md`:

1. **Version Packages PR** (pending changesets): find it
   (`gh pr list --head changeset-release/main --state open`), show the versions
   it bumps, ask, merge, watch `🚀 Release SDK` on the new `main` commit (npm
   publish, `sdk-*` tags, jsDelivr, `sdk.frak.id` pointer).
2. **Wallet OTA**: only once the production deploy is green.
3. **Mobile store release** (`stage=prod` on `main`): its release PR carries the
   store notes. Review them with the user before merging.
4. **Android / iOS SDK**: the version must already be on `main` (Phase 0).
   Dry run first, then the real run.
5. **PHP plugins**: versions from each plugin's `[Unreleased]` and latest tag.
6. **Shopify `shopify app deploy`**: manual and interactive. Run it only on
   request, through `interactive_shell` so the user can answer the CLI.
7. **Native example apps**: internal only, safe to run any time.

## Phase 7: realign `dev`

Version Packages and mobile release PRs land on `main` only. Once they are
merged, offer Phase 1 again so the next release starts without divergence.

## Phase 8: report

One short list: what ran (each with its URL and result), and what is left to a
human, such as App Store / Play submission, the Central Portal publish, the
`ota-prod` approval, or a checklist item accepted as a risk.
