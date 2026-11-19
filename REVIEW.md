# Review instructions

Read by the PR reviewer (`.github/workflows/agent-review.yml`) on the PR's target branch. The
`AGENTS.md` files hold the repo's rules; this file holds what a review needs on top of them, mostly
what spans more than the directories a diff touches.

## Clients a deploy does not update

Deploying this repo updates the backend and the web apps. These keep running the code they shipped
with, so a change must keep accepting what they send and serving what they read. Breaking one in a
realistic case is major, even when the PR touches none of their code:

- **The published JS SDK** (`@frak-labs/core-sdk`, `react-sdk`, `components`, `frame-connector`,
  `nexus-sdk`): merchants pin npm versions, and the CDN bundle loads its exact release. The
  listener's RPC handlers (`apps/listener/app/module/hooks/`) and the backend routes the SDK calls
  must keep working with versions already published.
- **The native SDKs** (`id.frak.sdk:*`, `FrakSDK`) inside merchant app binaries:
  `docs/native-sdk/contract.md` is their wire contract with `/sharing`, `/install` and the backend.
- **The Tauri wallet's store binaries**: an OTA bundle runs on the binary it was built for
  (`apps/wallet/AGENTS.md`).
- **The WordPress and PrestaShop plugins** in merchant stores: the merchant lookup and the order
  webhooks they call, and the error-as-body shapes they parse (`services/backend/AGENTS.md`).

## Published surface

- A fix or feature in a published JS package (above) needs a `.changeset/` entry, or the release
  does not ship it: a minor finding when missing. Tests, docs and internal refactors need none.
- A diff in `sdk/android/frak-sdk*/api/*.api` is a change to the public Android API: check that it
  only adds, or that the PR moves to a major.

## What CI already catches

Don't report what the PR checks in `.github/workflows/apps.yaml` catch: biome, `bun run typecheck`,
the unit tests, `bun run lint:comments`, the `check:*` gates, ktlint, `swift format`, Android Lint,
`apiCheck`. Do report a PR that gets past one by loosening it: a count raised in
`scripts/comment-budget-baseline.json` (`--update-baseline` writes increases too, and a file may only
get better), a rule turned off in a `biome.json`, a test skipped or deleted with nothing in its place.

## Severity here

- Dev tooling or a script that can wipe a device, a database or a merchant's store data is major,
  even if only developers run it.
- `plugins/magento` has no user: a defect there is minor at most. Never suggest porting a feature to
  it.
