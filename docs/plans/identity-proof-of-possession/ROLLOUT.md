# Rollout — identity proof-of-possession

Everything is shipped and permissive. What remains is making the wallet-facing arms
mandatory, which is gated on the store binary.

```
grep -rn "ROLLOUT-STEP-3" --include=*.ts --include=*.tsx .
```

## Why it is gated

`apps/wallet` builds both the web app and the Tauri store binary from the same source. Web
deploys in minutes and the SDK ships via jsDelivr `@latest` in hours, but an installed
binary sits behind store review *and* a user opting into the update — weeks to never.

So anything the binary touches must keep working unchanged until `minVersion` excludes
every old build.

## Current state

**Latch-gated** — proof present ⇒ verified; proof absent ⇒ allowed unless that id has
latched before:

- `/merge/execute`
- `/merge/initiate`, `sourceAnonymousId` arm
- `/identity/ensure`, SDK arm

These three share one policy function, `enforceLatchedProof`.

**Permissive** — everything the binary touches, plus:

- `/identity/ensure`, wallet arm. An old binary POSTs `{merchantId, anonymousId}` with
  neither ticket nor proof. A new one also forwards the install proof when the flow carried
  one; it is verified and logged, never required.
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

**1. The submitted binary must contain the client half** — reading the `#p=` fragment and
carrying the ticket. Without it there is nothing for `minVersion` to gate to, and a full
review cycle is burned arriving back here.

**2. `TODO(merge-initiate-proof)` must be closed.** The listener's modal / embedded-wallet
path still calls `/merge/initiate` with no proof at all, so those ids never latch.
Enforcing before this is fixed 403s that flow for *every* client, not just legacy ones.

**3. The legacy → derived migration must have drained.** It runs on each client's next
visit, so this is a matter of elapsed time and return traffic — worth measuring rather than
assuming. Do not flip on the strength of this alone; (2) matters just as much.

**4. Migrations must be applied before the branch is deployed anywhere.**
`findNodeByIdentity` and `markProofSeen` name `proof_seen_at` explicitly, so against a
database missing the column Postgres raises `42703` and the query throws — every
proof-absent `/merge/execute` 500s instead of returning 200. The column ships in
`prod/0020_gigantic_black_crow.sql`, `dev/0040_yummy_amphibian.sql` and
`local/0035_natural_carlie_cooper.sql`; confirm each is applied, not just generated.

## Step 3 — after store approval

1. Confirm approval on **both** platforms.
2. Bump `MIN_VERSION_IOS` / `MIN_VERSION_ANDROID` (env, read by
   `api/common/version.ts`, needs a pod restart) to the version containing the client half.
   `VersionGate`/`HardUpdateGate` then hard-blocks anything older.
3. Only now flip the wallet arms to mandatory — `ROLLOUT-STEP-3` marks each site.
4. Delete the bare-`anonymousId` arm of `/identity/ensure`. At the same time decide whether
   the forwarded install proof becomes sufficient on its own, or must be exchanged for a
   ticket first: it is redundant with the open bare arm today, and stops being redundant
   the moment that arm goes.

> Do not do 3 before 2. Store approval alone does not guarantee no installed binary is
> still on the old path — users update on their own schedule.

## What stays permissive forever

Legacy ids can never produce a proof and are baked into published `fCtx` links. They stay
resolvable, remain usable as merge targets, and never latch. Accepted, not a gap.

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
