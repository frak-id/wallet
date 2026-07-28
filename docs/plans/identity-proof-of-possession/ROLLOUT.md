# Rollout — identity proof-of-possession

How this branch goes from "shipped but permissive" to "proof mandatory", and what has to
happen in between. Every step below is keyed to a greppable marker in the code.

```
grep -rn "ROLLOUT-STEP-1\|ROLLOUT-STEP-2\|ROLLOUT-STEP-3" --include=*.ts --include=*.tsx .
```

## The shape of the problem

Two populations consume these endpoints, and they update at completely different speeds:

| Consumer | Ships how | Lag |
|---|---|---|
| SDK (`@frak-labs/components`) | jsDelivr `@latest`, unpinned, CDN purged on release | hours |
| Listener (`wallet.frak.id/listener`) | server deploy | minutes |
| **Wallet — web** (`wallet.frak.id`) | server deploy | minutes |
| **Wallet — Tauri binary** (iOS/Android) | **App Store / Play review, then user opt-in update** | **weeks to never** |

The Tauri binary is the whole reason this is phased. `apps/wallet` builds both the web app
and the store binary from the same source (`src-tauri/tauri.conf.json` → `frontendDist:
../dist`), so a change that is instant on web can sit unshipped in a user's installed
binary for months.

Anything the binary touches must therefore keep working unchanged until `minVersion`
excludes every old build. Anything it does *not* touch can be made mandatory immediately.

## What is already safe to enforce now

These never reach the Tauri binary, so they need no store wait:

- `/merge/initiate` — `sourceAnonymousId` arm. Listener only. **Enforced.**
- `/identity/ensure` — SDK arm. **Enforced.** The arm is selected by the
  `x-wallet-sdk-auth` credential, not by where the id sits in the request — routing on
  field placement would let an SDK caller skip the requirement by moving its id into the
  body.
- `/track/*`. SDK only, and already resolve-only. Unsigned by design (README §4.5).

`/merge/execute` is listener-only too, but stays **latch-gated deliberately**: its
`targetAnonymousId` is frequently a legacy id, which has no key, can never produce a
proof, and must keep working as a merge target forever (README §2.6, §7). The latch
already forces a proof for any id that has ever presented one.

`install-code/generate` also never reaches the binary (the install page's code view is
gated on `!IS_TAURI`), but stays permissive for a different reason: it is reachable with
no proof from the wallet's own sharing page, whose `clientId` comes from a URL param or a
backend lookup rather than from a signing key. Nothing there can sign, so requiring a
proof would break that arm rather than secure it. The install flow's protection is the
ticket `resolve` mints, not this proof.

## What must stay permissive until the binary ships

These are consumed by the installed app (README §6.1 freezes their contracts):

- `install-code/resolve` — the binary reads the response. `ticket` is additive; the
  binary's `anonymousId` arm must keep working. `ROLLOUT-STEP-3`.
- `/identity/ensure` — wallet arm. The binary POSTs `{merchantId, anonymousId}` with no
  ticket and no proof. `ROLLOUT-STEP-2`.
- `pendingActionsStore` shape — persisted on-device by the installed binary; a rehydrate
  must not throw. Unchanged in this branch, deliberately.

---

## Steps 1 and 2 — done, on this branch

Both landed together. There is no SDK propagation wait: `@frak-labs/components` ships via
jsDelivr `@latest` with aggressive cache eviction and few consumers, so an SDK release is
live in hours, not weeks. Only the Tauri binary has real lag, and neither step touches it.

State now:

- The SDK signs; the listener forwards the merge proof on both merge routes and appends
  the install proof to the install URL as a `#p=` fragment; the wallet reads that fragment
  and carries the install ticket through to `ensure`.
- **Mandatory:** `/merge/initiate`'s `sourceAnonymousId` arm, `/identity/ensure`'s SDK arm.
- **Latch-gated:** `/merge/execute` — deliberately, see above.
- **Permissive:** everything the binary touches, plus `install-code/generate`.

The wallet-session arm of `/merge/initiate` (no `sourceAnonymousId`) is authenticated by
session and is **never** gated — do not touch it.

**Still blocked on the db team** applying `proof_seen_at` + `install_codes.attempts` from
`DB-MIGRATION-REQUEST.md`. Until that lands the latch never sets, so `/merge/execute`
behaves as fail-open for every id — today's behaviour, safe to deploy ahead of the DDL,
just inert. The two mandatory arms above do not depend on the latch and are live
immediately.

## Before cutting the store build

The submitted binary must contain the client half above — reading `#p=`, carrying the
ticket. Without it the binary has no proof-producing code and Step 3 can never complete:
`minVersion` would have nothing to gate *to*, and you would burn a full review cycle to
arrive back here.

## Step 3 — after store approval + `minVersion` bump

1. Confirm approval on **both** platforms.
2. Bump `MIN_VERSION_IOS` / `MIN_VERSION_ANDROID` (env vars, read by
   `services/backend/src/api/common/version.ts`; requires a pod restart) to the version
   containing C12. The wallet's `VersionGate`/`HardUpdateGate` then hard-blocks anything
   older, so no un-updated binary can still call these endpoints.
3. Only now flip the wallet arms to mandatory. `ROLLOUT-STEP-3` marks each site.
4. Delete the legacy bare-`anonymousId` arm of `/identity/ensure` (README §5 step 2 — "a
   pure deletion").

> Do not do 3 before 2. `minVersion` is the only thing that guarantees no installed
> binary is still on the old path; store approval alone does not, because users update on
> their own schedule.

## What stays permissive forever

Legacy ids — those minted before derivation shipped — have no key and can never produce a
proof. They stay resolvable indefinitely because they are baked into already-published
`fCtx` links (README §2.6). They remain usable as merge *targets* and can never latch.
This is accepted, not a gap: §2.6 is explicit that there is no fix beyond shipping
derivation early so the legacy population stops growing.
