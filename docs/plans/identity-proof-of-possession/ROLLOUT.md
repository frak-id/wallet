# Rollout — identity proof-of-possession

**Every flip is on.** Buckets A–D are in the tree and enforcing; there is no switch left to throw.
The work itself lives in [`MERGE-ADMISSION-PLAN.md`](./MERGE-ADMISSION-PLAN.md) and what shipped is
recorded in [`PROGRESS.md`](./PROGRESS.md); this file is what to watch after the deploy, and the
marker inventory.

```
grep -rn "ROLLOUT-STEP-3" --include=*.ts --include=*.tsx .
```

## Why there is nothing to flip

Bucket D first shipped behind four env kill switches and three build-time constants, all defaulting
to today's behaviour, because §8 says flip on a counter and no counter had been deployed. That was
reversed: **the switches cost ~900 lines — 770 of them tests proving both settings behave — to guard
a decision the error log already shows.** A refused request answers `403` or `400` with a named code,
per route, in data that already exists. The counters stay; they measure, they no longer gate.

**A schema flip is not the alternative, and was measured rather than assumed.** `proof` cannot be
flatly required on any of these routes — each has a legitimately proofless arm — and a discriminated
union body is actively dangerous: Elysia strips unknown properties *before* validation, so
`{merchantId, sourceAnonymousId}` with no proof matches the looser variant, `sourceAnonymousId` is
silently dropped, and an anon-source request succeeds as a wallet-session one. Enforcement lives in
the handler.

## What to watch after the deploy

| Signal | Means |
|---|---|
| `403 PROOF_REQUIRED` on `/merge/initiate` | an anon-source caller with no proof. Should be ~0: the listener now refuses before sending |
| `403 PROOF_REQUIRED` / `PROOF_INVALID` on `/identity/ensure` | SDK arm unproven, or a bad install proof |
| `400 PROOF_OR_TOKEN_REQUIRED` on `/identity/ensure` | the bare wallet arm. **Expect a burst on deploy day** — see below |
| `403` on `install-code/generate` | the anonymous arm without a valid proof. The wallet renders the codeless CTA, not an error |
| `merge_initiate_proofless{source}` | client-side refusals. This is the **only** view of them — no request reaches the backend |
| `merge_execute_target_source{fallback,proven_unproven}` | merges the listener now declines to attempt. Same: client-side only |
| `identity_merge_execute_credential_total{class="absent_unlatched"}` | unchanged. Still bucket E's exit criterion |

**Expect a `PROOF_OR_TOKEN_REQUIRED` burst on deploy day, and expect it to decay.** §7 wanted the
"no more `a=`" wallet release live and its 7-day pending-ensure queue drained *before* the bare arm
refused; all of it lands in one deploy instead. Queued actions written by the currently deployed
wallet carry neither ticket nor proof, so they take a `400`. They drop on first attempt rather than
retrying — every refusal code is in `drainEnsures`' non-retryable set — so the burst should fall to
the floor within the store's 7-day TTL and never recover. If it does not decay, something is still
minting credential-less ensures and that is the bug to chase.

`/merge/execute` is untouched and must stay that way until bucket E. The code enforces that
structurally: `enforceProof` takes a required `refuseUnproven`, `initiateMerge` passes `true`,
`executeMerge` passes `false` with T3.1b named at the call site.

## Configuration that is still owed

[`deploy-env.patch`](./deploy-env.patch) carries the workflow hunk this branch could not push —
writing `.github/workflows/**` needs a token scope the release credential lacks. It no longer
contains any flip; what is left is `MIN_VERSION_IOS`/`MIN_VERSION_ANDROID` (read by
`infra/gcp/secrets.ts` and set nowhere, so silently `0.0.0` since they were written) and the two
credential TTLs.

```
git apply docs/plans/identity-proof-of-possession/deploy-env.patch
git rm docs/plans/identity-proof-of-possession/deploy-env.patch
```

Nothing is broken until it lands: `secrets.ts` forwards each variable with the same default. What is
missing is the ability to change one without editing the workflow. The guard test reads the patch
while it exists, so a variable added and forgotten in both places is still a red build.

## What gates it — and what does not

**The store binary does not gate this.** It is propagated. That closed the store-approval
dependency and nothing else.

**`apps/wallet`'s own `/sharing` → `/install` path holds no key and never will.** That was the
premise the bare arm's old comment got wrong: it is not an old Tauri binary, it is the currently
deployed web build, and the wallet origin has no keypair to sign with. **Resolved in bucket D** —
`SharingView` no longer forwards `a=`, so nothing on that page produces a credential-less ensure.
The install hop itself stays live and codeless: the page still links to `/install?m=…`, which
renders the download CTA with no code rather than an error.

**The marker set used to be incomplete (AID-018).** The second, unmarked door was the
`x-frak-client-id` header fallback, which routes a wallet-session caller into the wallet arm with a
caller-named id. It is **not deleted**, deliberately: it lands on the same bare exit that now
refuses, so one throw shuts both doors, and deleting the header→body promotion would break a header
caller that *does* carry a proof.

**SDK propagation gates nothing.** The CDN default is `@latest` and the listener URL is unversioned,
so the exposure is a 1–2 hour rollout deadzone, not a population. Bucket D removed even that for the
proof rename: the SDK emits the execute proof under **both** `proofs.merge` and
`proofs.mergeExecute`, so neither pipeline can lose the race.

**`/merge/execute` is the one genuine population gate**, and what it waits for is the legacy-id
population ageing out — not a binary, not `minVersion`. Its target *is* the keyless legacy id by
definition.

## Current state, per route

**Mandatory proof** — verified when present, refused when absent:

- `/merge/initiate`, `sourceAnonymousId` arm — `403 PROOF_REQUIRED`
- `/identity/ensure`, SDK arm — `403 PROOF_REQUIRED`
- `/identity/ensure`, wallet arm — `400 PROOF_OR_TOKEN_REQUIRED` at the bare exit,
  `403 PROOF_INVALID` for a bad install proof
- `install-code/generate`, anonymous arm — `403 PROOF_REQUIRED` / `PROOF_INVALID`

**Still latch-gated, deliberately:** `/merge/execute`. Proof present ⇒ verified; absent ⇒ allowed
unless that id has latched before. It is bucket E and its subject *is* the keyless legacy id.

**Never gated, and staying that way:**

- `/identity/ensure`'s **ticket** branch — a receipt for a credential already presented at
  `generate`. Its id is server-derived and may legitimately be a `frakmint_` one.
- `install-code/generate`'s **`checkoutToken`** arm — Gate 2 derives the id from the order
  server-side, so there is nothing for a caller to prove. A refusal on the sibling arm renders the
  wallet's codeless CTA, not *"Failed to generate code. Please refresh."*
- `/merge/initiate`'s **wallet-session** arm — authenticated by session.
- `/track/*` — unsigned by design. See below.

`install-code/resolve` is unchanged: the current wallet no longer reads `anonymousId` from the 200
(T3.7), only pre-ticket binaries do, and the backend stops sending it in a later backend-only
deploy — that order, never the reverse, so the persisted store stays readable by a rolled-back
build.

## Still owed

**1. DB2 must be applied to `local`, `dev` and `prod`.** It is the DB team's, recorded verbatim at
[`DB2.sql`](./DB2.sql), and it gates the **backend image**: `install_codes` is selected with a full
column list, so against a database missing `checkout_token` every `install-code/generate` and every
`install-code/resolve` raises `42703` — both arms, not only the new one. The only ordering the
infrastructure guarantees is `bootstrapJob` → backend.

**2. `deploy-env.patch`**, for the reason above — no flip depends on it any more, but
`MIN_VERSION_*` and the two TTLs remain unsettable until it lands.

**3. The legacy → derived migration must drain — for `/merge/execute` only.** It runs on each
client's next visit, so a user who never returns is never migrated and the curve asymptotes rather
than reaching zero. The exit criterion is
`identity_merge_execute_credential_total{class="absent_unlatched"}` per merchant trending to
approximately zero, never a date. Nothing else waits on it.

## Order

Everything except bucket E is live in one deploy. What is left is a single decision, and it is the
one the whole programme was shaped around:

**`/merge/execute`, alone and last.** Firing T3.1b writes off the permanent legacy tail — ids of
users who never return, which never migrate at any horizon. That is a human decision on a counter,
never a date, and its code is not written.

The `ensure.ts` marker — "should the install proof be exchanged for a ticket?" — is a decision, not
a dependency, and it is taken: keep accepting the install proof directly. A leaked install proof
costs one id its attribution, far cheaper than the two-call attack the flips close. It is live now
that the bare exit refuses, since the proof is a sufficient credential.

> `MIN_VERSION_IOS` / `MIN_VERSION_ANDROID` remain useful for hard-blocking old builds, but no flip
> above is gated on them. They are read by `infra/gcp/secrets.ts` and set nowhere, so both have
> silently been `0.0.0` since they were written; `deploy-env.patch` fixes that. A test asserts every
> env var `secrets.ts` reads is set by the workflow, and that every var the backend reads is
> forwarded by `secrets.ts`.

## What stays permissive forever

Legacy ids can never produce a proof and are baked into published `fCtx` links, so they stay
**resolvable** indefinitely and never latch. They stop being usable as merge *targets* the moment
`/merge/execute` flips — that is the write-off bucket E makes explicit, not an oversight.

## Later: an optional `frak-track-v1`

Not part of this rollout — it gates nothing, so it has no flip day.

`/track/*` is unsigned because tracking must work for every client, including keyless legacy ids.
The idea is an **optional** proof alongside a tracked interaction: never required, verified when
present, a weak humanity/non-bot signal. The value is that it is not a gate — a bot can omit it, but
then it is distinguishable.

Three things to settle first:

- **Binding.** The interaction's idempotency key is the obvious candidate, which would also make a
  captured proof useless for any other event. `arrival` carries no idempotency key today.
- **Window.** Shorter than install's 30 days, but events are queued offline and drained later, so it
  has to cover a realistic backlog rather than a request-response round trip.
- **Cost.** One ECDSA sign per event, on the native queue's drain path as well as the browser's.
  Measure before choosing per-event over per-drain.

It needs its own op string. Reusing an existing one throws away the domain separation.
