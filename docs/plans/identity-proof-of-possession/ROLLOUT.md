# Rollout — identity proof-of-possession

How this branch goes from "shipped but permissive" to "proof mandatory", and what has to
happen in between. Every step below is keyed to a greppable marker in the code.

```
grep -rn "ROLLOUT-STEP-1\|ROLLOUT-STEP-3" --include=*.ts --include=*.tsx .
```

> `ROLLOUT-STEP-2` no longer marks any live code. It named the unconditional-mandatory
> regime described below, which was reverted — see
> [`DUAL-ARM-PLAN.md`](./DUAL-ARM-PLAN.md) and `DECISIONS.md` D9. The tag now only
> appears in historical comments explaining what was reverted and why (e.g.
> `AnonymousMergeOrchestrator.ts`, `ensure.ts`). Do not re-add it as a live marker.

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

## What is already latch-gated (not mandatory)

> **Revised.** These two arms shipped as *unconditionally* mandatory — the SDK/listener
> ship continuously, so it looked safe to require a proof outright. It was not: the SDK
> returns no proof for every pre-derivation legacy client
> (`sdk/core/src/identity/sign.ts` — `signProof` returns `null`, never throws, when no key
> is stored), and `DECISIONS.md` D6 ships derivation for *new* clients only, so legacy ids
> can never sign. Unconditional enforcement 403'd every legacy caller on these two arms.
> Reverted to **latch-gated** — see [`DUAL-ARM-PLAN.md`](./DUAL-ARM-PLAN.md) §0/D-A and
> `DECISIONS.md` D9. `ROLLOUT-STEP-2`, the marker for the old mandatory regime, is gone
> from live code.

Both of these never reach the Tauri binary, so they need no store wait — but "no store
 wait" means they *can* be enforced without a release, not that they are enforced
 unconditionally:

- `/merge/initiate` — `sourceAnonymousId` arm. Listener only.
  **Latch-gated.** `requireProof` (the old unconditional check) is deleted;
  `AnonymousMergeOrchestrator.ts` now calls the same `enforceLatchedProof` helper
  (`services/backend/src/orchestration/identity/latchedProof.ts`) that `/merge/execute`
  always used. A caller presenting a valid proof is verified; a caller presenting none is
  allowed unless that id previously latched.
- `/identity/ensure` — SDK arm. **Latch-gated.** `ensure.ts` now calls the same
  `enforceLatchedProof` helper instead of throwing unconditionally. The arm is still
  selected by the `x-wallet-sdk-auth` credential, not by where the id sits in the
  request — routing on field placement would let an SDK caller skip enforcement by
  moving its id into the body.
- `/track/*`. SDK only, and already resolve-only. Unsigned by design (README §4.5).
  Unaffected by this revision.

`/merge/execute` was always **latch-gated**, and is unchanged: its `targetAnonymousId` is
frequently a legacy id, which has no key, can never produce a proof, and must keep
working as a merge target forever (README §2.6, §7). All three merge/ensure proof arms
now share one policy function (`enforceLatchedProof`) rather than three separately-written
checks — this is itself part of the fix, since a second hand-written policy shape was
what let the two arms above drift from the intended behaviour in the first place.

**`markProofSeen` (the latch write) is gated on a proof having actually been verified, at
all three call sites** — `AnonymousMergeOrchestrator.ts` (`initiateMerge`, `executeMerge`)
and `ensure.ts` (SDK arm). Writing the latch for an id that was merely *allowed through*
on the fail-open path (no proof, not yet latched) would permanently lock that id out the
moment it tries to sign later — a one-way corruption, since the latch never clears. This
is the single highest-risk line in the revision; each site has a dedicated regression
test for it.

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
- `/identity/ensure` — wallet arm. An **old** binary POSTs `{merchantId, anonymousId}`
  with no ticket and no proof — still accepted, unchanged. A **new** binary (this branch)
  additionally forwards `proof` when the install flow carried one (`#p=` fragment or Play
  referrer `proof=`) — verified as `frak-install-v1`
  (`services/backend/src/api/user/identity/ensure.ts`) and logged, but never required and
  never rejected. `ROLLOUT-STEP-3` marks the point where this arm's bare-`anonymousId`
  fallback is deleted and `ticket`/`proof` become mandatory.
- `pendingActionsStore` shape — persisted on-device by the installed binary; a rehydrate
  must not throw. The store now carries `version: 1` and a defensive `migrate` that
  returns an unversioned or malformed payload as `{actions: []}` rather than throwing
  (`apps/wallet/app/module/pending-actions/stores/pendingActionsStore.ts`) — added
  precisely so a *future* `version: 2` (the one that drops `anonymousId` at Step 3) has a
  working hook to land on. The store's shape itself is otherwise unchanged: `ensure`
  actions gained an optional `proof` field, which an old payload simply omits.

---

## Steps 1 and 2 — done, on this branch (2 later revised — see below)

Both landed together. There is no SDK propagation wait: `@frak-labs/components` ships via
jsDelivr `@latest` with aggressive cache eviction and few consumers, so an SDK release is
live in hours, not weeks. Only the Tauri binary has real lag, and neither step touches it.

State now:

- The SDK signs; the listener forwards the merge proof on both merge routes and appends
  the install proof to the install URL as a `#p=` fragment; the wallet reads that
  fragment (and the Play referrer's `proof=`) and forwards the proof through to `ensure`
  directly — no ticket-exchange round-trip, see `DUAL-ARM-PLAN.md` D-B.
- **Latch-gated (revised from Mandatory):** `/merge/initiate`'s `sourceAnonymousId` arm,
  `/identity/ensure`'s SDK arm. See the section above.
- **Latch-gated (unchanged):** `/merge/execute`.
- **Permissive:** everything the binary touches, plus `install-code/generate` and
  `/identity/ensure`'s wallet arm.

The wallet-session arm of `/merge/initiate` (no `sourceAnonymousId`) is authenticated by
session and is **never** gated — do not touch it.

### The `proof_seen_at` DDL is a hard deploy prerequisite — ✅ applied

**Applied** in `services/bootstrap/drizzle/local/0035_natural_carlie_cooper.sql`
(journal entry `idx: 35`), which adds both columns exactly as
`DB-MIGRATION-REQUEST.md` specifies:

```sql
ALTER TABLE "identity_nodes" ADD COLUMN "proof_seen_at" timestamp;
ALTER TABLE "install_codes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;
```

The ordering constraint below is kept because it still governs every **other**
environment: the migration must be applied wherever this branch is deployed, before it
is deployed there.

This section previously claimed that deploying ahead of the DDL was "safe… just inert,
fail-open." **That claim was checked against the actual repository code and found
false.** `IdentityRepository.findNodeByIdentity` and `markProofSeen` use Drizzle's
relational query builder, which emits an explicit column list including `proof_seen_at`.
Against a database missing that column, Postgres raises an undefined-column error
(`42703`) — the query throws, it does not return `null`. No guard against this was added
(a scoped `42703` catch was considered and explicitly rejected — see
`DUAL-ARM-PLAN.md` D-G — as unnecessary scaffolding for what is fundamentally a deploy-
ordering problem, not a logic one).

**Concretely, deploying this branch against a database without the column:**

- every `/merge/execute` call with no proof (the common case) 500s inside
  `enforceLatchedProof`'s latch read, instead of the intended 200;
- every successful `/merge/initiate` anonymous-arm call 500s on the `markProofSeen`
  write.

This is strictly worse than the old 403 it replaces. **Do not deploy this branch to any
environment before migration `0035` is confirmed applied there.**

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
3. Only now flip the wallet arms to mandatory. `ROLLOUT-STEP-3` marks each site
   (`grep -rn "ROLLOUT-STEP-3" --include=*.ts --include=*.tsx .` — spans backend
   `ensure.ts`/`installCode.ts`/`AnonymousMergeOrchestrator.ts`, listener
   `lifecycleHandler.ts`, and wallet `install.tsx`/`useInstallReferrer.ts`/
   `pendingActionsStore.ts`/`useExecutePendingActions.tsx`/`types.ts`).
4. Delete the legacy bare-`anonymousId` arm of `/identity/ensure` (README §5 step 2 — "a
   pure deletion"). At the same site, decide whether the `frak-install-v1` proof forwarded
   from the install flow becomes a *sufficient* credential on its own once the bare arm is
   gone, or must be exchanged for a ticket first — it is currently redundant with the open
   bare arm, so accepting it costs nothing today; it stops being redundant the moment that
   arm is deleted (`DUAL-ARM-PLAN.md` D-B).

> Do not do 3 before 2. `minVersion` is the only thing that guarantees no installed
> binary is still on the old path; store approval alone does not, because users update on
> their own schedule.

## What stays permissive forever

Legacy ids — those minted before derivation shipped — have no key and can never produce a
proof. They stay resolvable indefinitely because they are baked into already-published
`fCtx` links (README §2.6). They remain usable as merge *targets* and can never latch.
This is accepted, not a gap: §2.6 is explicit that there is no fix beyond shipping
derivation early so the legacy population stops growing.
