# Frak wallet verification map

This directory is the maintained source for verifying the user-facing behavior of the Frak wallet (`apps/wallet`). Read this index before driving, then use the matching feature file as the recipe. The harness is `.pi/skills/verify-wallet/scripts/verify-wallet.sh`; `H` below stands for that path.

## Baseline preconditions

- `H doctor` exits 0 with every line `ok`.
- Every run starts its own instance; never point a flow at a server you started by hand or at `bun run dev`.
- SPA features run with `H flow spa <flow>`: Pixel 7, `en-US`, seeded mock session (wallet `0x1234…5678`), backend answered by `apps/wallet/tests-light/mocks/api.ts`.
- SPA features can also run with `--real-dev` (real gcp-dev account `0xa0f8…7a14`, no mocks); say which mode a proof used, and expect real data where the mocked recipes quote mock values.
- Standalone features run with `H flow standalone <flow> --logged-out` or `H check -- --project=standalone <spec>`.
- The mock merchant is `550e8400-e29b-41d4-a716-446655440000` ("Acme Store", referrer reward 12 €).

## Driving conventions

- Prefer `getByRole` with the accessible names quoted in the feature files; confirm a name against the latest `*.aria.yml` before trusting it.
- The tab bar is `navigation "Tab navigation"` with links `Wallet` (/wallet), `Explorer`, `Profile` under `en-US` (FRA-337). `?lng=fr` on any URL switches the app to French.
- Treat names, URLs and flags as literal.
- A failed drive writes `FAIL.png`, `FAIL.aria.yml` and the stack into `verdict.txt`, and exits 1. Exit 2 is a harness refusal (bad args, existing evidence dir, instance doctor failed).
- Mutations against the backend cannot be proven in `flow` mode unless the flow mocks the endpoint and asserts the request it sent; say which you did.

## Proof and skip reporting

- UI proof: an ARIA snapshot plus a screenshot per meaningful step (`step()` does both), with the asserted state visible.
- Network proof: the request assertion inside the flow, or the matching `network.log` line.
- Record the feature ID and the entry point used; the evidence directory name carries the flow name.
- Report an unreachable path with the command you ran and the unmet precondition. Do not report a skipped entry point as verified through a different one.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-wallet.sh` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command or Playwright call and the observable result.
4. `Gotchas` lists traps that can waste or invalidate a run.

## Features

- [Wallet home](./wallet-home.md) — rewards card, stat-card dialogs, welcome carousel, empty earnings history, path to the explorer.
- [Profile](./profile.md) — security progress, add email, notifications switch, favorites, logout.
- [Referral code](./referral-code.md) — create your own code and redeem someone else's, from Profile → Referrals.
- [Sharing page](./sharing-page.md) — standalone `/sharing`, as a web visit and as a native SDK sheet.
- [Install page](./install-page.md) — standalone `/install` and `/i`, the post-install code handoff.

Not mapped yet (add a file when you first verify one): register/login/recovery (passkey — real ceremony only in `apps/wallet/tests`), explorer merchant detail (`/explorer/$merchantId`), transfer to a crypto wallet (`/tokens/send`), notifications, pairing, Monerium bank transfer, reward code (`/reward-code`).
