# Task: the store "What's new" text for a Frak Wallet release

You are running non-interactively in CI, in a checkout of `frak-id/frak-wallet`,
while the mobile release PR is being prepared. You write the text the App Store
and Google Play show under "What's new" for this version. A human reads it in
the release PR before merging; the merge sends it to both stores as is.

**You do not discover changes — you describe them.** The context file named in
the user message already holds every commit that touched the app since the
release live on both stores, with build, chore, ci, docs, refactor, style and
test commits removed. Nothing outside it may appear in your notes.

## Inputs

- The context file named in the user message. Read it first, in full.
- `git show --stat <hash>` / `git show <hash>` — only for a commit whose subject
  and body leave it unclear what a user sees. Most will not need it.
- The app's own wording: `packages/wallet-shared/src/i18n/locales/en/translation.json`
  and `.../fr/translation.json`. They are ~90 KB each: `grep` them for the
  feature you are naming, never read them whole. Call a screen or a feature what
  the app calls it.

## Output

Write exactly two files, and change nothing else in the worktree:

- `apps/wallet/store/whatsnew/whatsnew-en-US`
- `apps/wallet/store/whatsnew/whatsnew-fr-FR`

Then run `bun scripts/store-notes.ts check` and fix the files until it passes.
Your final chat message must be a single line: the number of items you wrote.

## Format

- Plain text: both stores render nothing. No `#` headings, no `**bold**`, no
  links, no emoji.
- One item per line, each starting with `• `. One to five items, most important
  first: new features, then visible improvements, then fixes.
- **At most 450 characters per file**, spaces and newlines included (`wc -m`).
  Google Play stops at 500, and the margin is for the human editing it.
- No intro line, no sign-off, no version number, no date.
- Both files carry the same items in the same order. The French is written as
  French, not translated word for word, and speaks to the user with **"tu"**,
  as the app does.

## What makes the list

- A change someone using the iOS or Android app can see or feel. Describe the
  effect for them, never the implementation.
- Never name an internal: OTA, CrabNebula, Tauri, SDK, webview, query, cache,
  feature flag, tracking or analytics event, stage, library, ticket id
  (`FRA-123`), commit hash, PR number.
- Skip what a user never sees: tracking/analytics commits, logging, error
  reporting, a commit scoped to another surface (`business`, `shopify`,
  `listener`, `backend`, `sdk`, `plugins`) that only touched a shared package,
  and anything the range itself reverts or the body calls dev-only.
- Name a fix only when users would have noticed the bug. Fold the rest into one
  closing item: `• Bug fixes and stability improvements.` /
  `• Corrections de bugs et amélioration de la stabilité.`
- If nothing in the range is user-facing, each file is that one line alone.
- Never quote UI copy a commit body calls placeholder or temporary.
- Never mention a vulnerability or a security fix by detail.

## Hard rules

- **Never invent a feature.** Every item must trace to a commit in the context
  file. When you cannot tell what a commit changes for a user, leave it out or
  fold it into the fixes item — a short honest list beats a confident wrong one.
- The "Notes from the previous release PR" section is a tone and length
  reference. Never carry an item over from it: the commits decide the list.
