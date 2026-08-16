# Rollout — identity proof-of-possession

Everything is shipped and permissive. What remains is making the admission routes require a
proof unconditionally. The scheduled work lives in
[`MERGE-ADMISSION-PLAN.md`](./MERGE-ADMISSION-PLAN.md); this file is the marker inventory and
the per-route state.

```
grep -rn "ROLLOUT-STEP-3" --include=*.ts --include=*.tsx .
```

## What gates it — and what does not

**The store binary does not gate this any more.** It is propagated. That closes the store-approval
dependency and nothing else; three separate blockers remain, and they are per-route.

**`apps/wallet`'s own `/sharing` → `/install` path holds no key and never will.** The comment at
`ensure.ts:78` claims the bare arm is "kept only because the installed Tauri binary POSTs exactly
this shape". That premise is false: the currently-deployed **wallet web build** lands on the same
arm with neither credential, via `SharingView.tsx:94-99` (in-file: *"this page has no SDK keypair
to sign with"*) → `routes/sharing.tsx:55-57` → `InstallView.tsx` → `drainEnsures.ts`. The wallet
origin holds no keypair, so this is permanent, not a propagation delay. A wallet-side change has
to stop forwarding `a=` before the arm can be deleted.

**The marker set is incomplete (AID-018).** A second, unmarked door into the same bypass is the
header fallback at `ensure.ts:213-225`: any wallet-session caller sending only `x-frak-client-id`
is routed into `resolveWalletEnsureAnonymousId` with a caller-named id, and there is no
`ROLLOUT-STEP-3` marker anywhere near it. Deleting `ensure.ts:78-88` and stopping there leaves
**G1 fully open**.

**SDK propagation gates nothing.** The CDN default is `@latest` and the listener URL is
unversioned, so the exposure is a 1–2 hour rollout deadzone, not a population.

**`/merge/execute` is the one genuine population gate**, and what it waits for is the legacy-id
population ageing out — not a binary, not `minVersion`. Its target *is* the keyless legacy id by
definition.

## Current state

**Latch-gated** — proof present ⇒ verified; proof absent ⇒ allowed unless that id has
latched before:

- `/merge/execute`
- `/merge/initiate`, `sourceAnonymousId` arm
- `/identity/ensure`, SDK arm

These three share one policy function, `enforceLatchedProof`.

**Permissive:**

- `/identity/ensure`, wallet arm. Three shapes, and they are not equivalent. The **ticket**
  branch is a receipt for a credential presented at `generate` and stays. The `frak-install-v1`
  **proof** branch verifies and latches a real proof — it is the landing site for Keystore- and
  Secure-Enclave-signed native installs and for the Play install referrer, both of which reach
  `ensure` directly and never touch `install-code/generate`; it is kept and made mandatory. Only
  the proofless **bare-id** variant and the `x-frak-client-id` header fallback are deleted. The
  bare variant is reached by the deployed wallet web build, not only by an old binary — see
  above.
- `install-code/generate`. Reachable with no proof from the wallet's own sharing page,
  whose `clientId` comes from a URL param or a backend lookup rather than a signing key.
  Nothing there can sign, so requiring a proof would break the arm rather than secure it.
  Its protection is the ticket `resolve` mints.
- `install-code/resolve`. The binary reads the response; `ticket` is additive and the
  `anonymousId` arm must keep working.
- `/track/*`, unsigned by design. See below.

**Never gated:** the wallet-session arm of `/merge/initiate` — already authenticated by
session.

## Prerequisites

**1. A wallet release must stop the keyless `/sharing` → `/install` hop forwarding `a=`**, and
the 7-day pending-ensure queue must drain behind it. That, not the store binary, is what the
bare arm waits on. Ship the retry classification (`drainEnsures#isNonRetryable`) at least one
wallet release earlier, or every stale old-shape action retries on every launch for a full week.

**2. `TODO(merge-initiate-proof)` must be closed.** The listener's modal / embedded-wallet
path still calls `/merge/initiate` with no proof at all, so those ids never latch.
Enforcing before this is fixed 403s that flow for *every* client, not just legacy ones.

**3. The legacy → derived migration must have drained — for `/merge/execute` only.** It runs on
each client's next visit, so a user who never returns is never migrated and the curve asymptotes
rather than reaching zero. The exit criterion is
`identity_merge_execute_credential_total{class="absent_unlatched"}` per merchant trending to
approximately zero, never a date. No other route waits on this.

**4. Migrations must be applied before the branch is deployed anywhere.**
`findNodeByIdentity` and `markProofSeen` name `proof_seen_at` explicitly, so against a
database missing the column Postgres raises `42703` and the query throws — every
proof-absent `/merge/execute` 500s instead of returning 200. The column ships in
`prod/0020_gigantic_black_crow.sql`, `dev/0040_yummy_amphibian.sql` and
`local/0035_natural_carlie_cooper.sql`; confirm each is applied, not just generated.

## Step 3 — the flips

The three flips are **not coupled**; they have different prerequisites and only one has a
population gate. Do not schedule them together.

1. **`/merge/initiate`.** Give the listener a proof it can present (the SDK signs an
   empty-binding `frak-merge-v1` and carries it on `resolved-config`), have the listener refuse
   without one, then make `proof` required on the backend's anon-source arm. Gate: the
   proofless-initiate counters flat on all three sources.
2. **`/identity/ensure`.** Ship the wallet release from prerequisite 1, let the 7-day queue
   drain, then in one deploy make the SDK arm's `proof` required, make the `frak-install-v1`
   branch mandatory, and delete **both** proofless doors — the bare-id variant *and* the
   `x-frak-client-id` header fallback. Deleting only the first leaves G1 fully open (AID-018).
   Gate: `identity_ensure_arm_total{arm="wallet_bare"}` at or near zero.
3. **`/merge/execute`, alone and last.** Gate: prerequisite 3's counter, never a date. Firing it
   writes off the permanent legacy tail — that is a human decision, not a threshold.

`install-code/generate` becomes a union body (proof required on the SDK arm, `checkoutToken` on
the order-derived arm) once the Shopify credential path exists. Its codeless-CTA wallet release
must ship **before or with** it, never after.

The `ensure.ts:101` marker — "should the install proof be exchanged for a ticket?" — is a
decision, not a dependency, and it is taken: keep accepting the install proof directly. A leaked
install proof costs one id its attribution, which is far cheaper than the two-call attack the
flips close. Record it and delete the marker.

> `MIN_VERSION_IOS` / `MIN_VERSION_ANDROID` remain useful for hard-blocking old builds, but no
> flip above is gated on them.

## What stays permissive forever

Legacy ids can never produce a proof and are baked into published `fCtx` links, so they stay
**resolvable** indefinitely and never latch. They stop being usable as merge *targets* the moment
`/merge/execute` flips — that is the write-off flip 3 above makes explicit, not an oversight.

## Later: an optional `frak-track-v1`

Not part of this rollout — it gates nothing, so it has no flip day.

`/track/*` is unsigned because tracking must work for every client, including keyless legacy
ids. The idea is an **optional** proof alongside a tracked interaction: never required, verified
when present, a weak humanity/non-bot signal. The value is that it is not a gate — a bot can omit
it, but then it is distinguishable.

Three things to settle first:

- **Binding.** The interaction's idempotency key is the obvious candidate, which would also make
  a captured proof useless for any other event. `arrival` carries no idempotency key today.
- **Window.** Shorter than install's 30 days, but events are queued offline and drained later, so
  it has to cover a realistic backlog rather than a request-response round trip.
- **Cost.** One ECDSA sign per event, on the native queue's drain path as well as the browser's.
  Measure before choosing per-event over per-drain.

It needs its own op string. Reusing an existing one throws away the domain separation.
