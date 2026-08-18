# Identity proof-of-possession

Bind every anonymous identity to a device-held P-256 keypair, so only the device that owns an
anonymous id can act on it.

**Status: shipped and enforcing.** Every route that could be talked into acting on an
`anonymousId` the caller does not hold a key for now refuses, unconditionally, with one exception
named below. This file is the only remaining document for the programme: what is still open, and
what a reader needs in order not to undo it. The planning documents that got it here (the surface
map, the admission plan, the progress log and the flip runbook) are deleted — everything in them
was either executed, recorded here, or wrong.

**Blocks:** native SDK work ([`../native-sdk/`](../native-sdk/)).

---

## 1. Why it exists

`anonymousId` (the `clientId`) is **not secret**. Every share link publishes it: it rides as field
`c` of the FrakContext, base64url-encoded into `?fCtx=`. Two unauthenticated endpoints hand it out
directly (`install-code/resolve`, `order-client`).

The merge machinery nonetheless treated *naming* an id as proof of *owning* it, on routes with no
session auth. And it is money, not bookkeeping: `SettlementOrchestrator` resolves the payout wallet
through the identity group, so whoever captures the group is the one paid.

The cryptographic core was never the problem. `IdentityProofService#check` derives the id from the
public key inside the proof and compares it to the id the caller claimed, rejecting `id_mismatch`
before the signature is checked. The defect was that the latch **failed open on ids that had never
proven** — precisely the pre-install population holding unsettled attribution.

## 2. What is still open

| # | Item | Why it is not done |
|---|---|---|
| 1 | **Prod migration for `checkout_token`** | `local/0039` and `dev/0043` are generated and committed; `drizzle/prod/` is still at `0020`. `InstallCodeRepository` names `checkout_token` in raw SQL, so a prod backend on the old schema raises `42703` on every `install-code/generate` and `install-code/resolve`. Generated on `dev` alongside the other prod migrations coming later — **must land before this reaches `main`** |
| 2 | **`/merge/execute` proof (T3.1b)** | The deliberate exception. See §3 |
| 3 | **`anonymousId` off `install-code/resolve`'s 200** | The wallet half shipped: the current wallet no longer reads it. The backend stops sending it in a later backend-only deploy — that order, never the reverse, so the persisted store stays readable by a rolled-back build |
| 4 | **AID-017 — bind `frak-ensure-v1`** | Its binding is empty, making it a 30-day bearer credential. Changing a signed message needs ~30 days of dual-accept across two native store binaries. Real, scheduled, not urgent |
| 5 | **AID-012 — the last mile of `fmt` retry** | The redemption retries a blip, but only while the page lives. A page closed mid-backoff still loses the merge, and the SDK→listener `postMessage` hop has no ack at all, so a send that never arrives is invisible to both sides. Closing either needs a durable queue, and the thing being queued is a token that stays replayable for 60 minutes — putting it at rest on disk makes AID-003 worse. Do these two together or not at all |
| 6 | **AID-003 / AID-019 — credential reuse windows** | A merge token is a 60-minute unlimited-use group-capture capability if captured; an install ticket is 7-day multi-use and one code yields up to 20. `jwt.ts` records the reasoning for the ticket (a burn-set deadlocks the wallet's retry loop). The merge token has no such defence and no ticket |
| 7 | **AID-013 — no cross-merchant proof-scoping test** | The property holds and is load-bearing; nothing pins it. Cheapest item on this list |
| 8 | **AID-005, AID-008, AID-015** | Client-side and codec findings, untouched by this programme. See the audit record |

## 3. The one route that must not be flipped

`/merge/execute` still admits an unproven **target** when that id has never latched. That is
deliberate: its subject *is* the keyless legacy id, baked into published `fCtx` links that can
never produce a proof. Flipping it writes off the permanent legacy tail — users who never return
and therefore never migrate.

The code enforces the exception structurally rather than by convention. `enforceProof` takes a
**required** `refuseUnproven` boolean; `initiateMerge` passes `true`, `executeMerge` passes `false`
with T3.1b named at the call site. Deleting the parameter to "simplify" flips it silently, so it is
a compile error instead.

Its exit criterion is `identity_merge_execute_credential_total{class="absent_unlatched"}` per
merchant trending to approximately zero — a counter, never a date. The migration runs on each
client's next visit, so the curve asymptotes and never reaches zero. Firing it is a human decision
about writing off the tail, not a threshold being crossed.

Legacy ids stay **resolvable** forever regardless; they only stop being usable as merge *targets*.

## 4. What to watch after the deploy

| Signal | Means |
|---|---|
| `400 PROOF_OR_TOKEN_REQUIRED` on `/identity/ensure` | The bare wallet arm. **Expect a burst on deploy day** — see below |
| `403 PROOF_REQUIRED` on `/merge/initiate` | An anon-source caller with no proof. Should be ~0: the listener refuses before sending |
| `403 PROOF_REQUIRED` / `PROOF_INVALID` on `/identity/ensure` | SDK arm unproven, or a bad install proof |
| `403` on `install-code/generate` | The anonymous arm without a valid proof. The wallet renders the codeless CTA, not an error |
| `merge_initiate_proofless` | Client-side refusals. The **only** view of them — no request reaches the backend |
| `merge_execute_target_source{fallback,proven_unproven}` | Merges the listener declines to attempt. Client-side only, same reason |

**The deploy-day burst is expected and must decay.** The original sequencing wanted the wallet
release that stops forwarding `a=` live, and its 7-day pending-ensure queue drained, *before* the
bare arm started refusing. All of it lands in one deploy instead, so queued actions written by the
currently deployed wallet — carrying neither ticket nor proof — take a `400`. They drop on first
attempt rather than retrying, because every refusal code is in `drainEnsures`' non-retryable set,
so the burst should fall to the floor within the store's 7-day TTL and never recover. What those
users lose is the pre-install attribution that action carried: not the install, not the wallet,
nothing on screen. **If it does not decay, something is still minting credential-less ensures** —
that is the bug to chase, not a reason to revert.

## 5. Two things not to re-propose

**A schema flip does not work here.** "Make `proof` required in the route schema" is the obvious
simplification and it was measured, not assumed. Two independent reasons: every one of these routes
has a legitimately proofless arm (wallet-session on `initiate`, the Gate 2 token arm on `generate`,
the ticket arm on `ensure`), so `proof` cannot be flatly required; and a discriminated-union body is
worse than useless, because Elysia strips unknown properties **before** validation — so
`{merchantId, sourceAnonymousId}` with no proof matches the looser variant, `sourceAnonymousId` is
silently dropped, and an anon-source request succeeds as a wallet-session one with a `200`.
Confirmed against the live version, with and without `additionalProperties: false`. Enforcement
belongs in the handler.

**Kill switches are not worth it here.** These flips shipped once behind four per-request env flags
and three build-time constants. That cost ~900 lines, of which ~770 were tests whose only job was
to prove both settings behave, to guard a decision the error log already shows: a refused request
answers `403`/`400` with a named code, per route, per merchant, in data that already exists. They
were deleted. The counters stayed — they measure, they no longer gate.

## 6. Invariants a future change can silently break

- **The counter emission precedes the throw.** On every arm. It is what makes the series a count of
  what *arrived* rather than what survived, and on the client it is the only record that a refusal
  happened at all.
- **The bare `ensure` arm reports `class="absent"`, not `absent_unlatched`.** It refuses without
  reading a latch, and a latched id reaches it routinely. Everywhere else those two names are
  decided by an actual latch read.
- **`ensure`'s `frak-install-v1` branch refuses an *invalid* proof** rather than falling through to
  the bare exit. Without that, closing the bare arm would refuse a caller who sends nothing while
  still admitting one who sends garbage.
- **The header→body promotion (`x-frak-client-id`) is kept.** It lands on the same bare exit, so it
  is no longer a proofless door, and deleting it would break a header caller that *does* carry a
  proof.
- **`install-code/generate` prefers `checkoutToken` over `anonymousId`.** The id reaching that page
  comes from a buyer-writable cart attribute; the token is derived from the order server-side. Get
  this backwards and Gate 2 ships inert.
- **The execute-side proof keeps its released key, `proofs.merge`.** The symmetric `mergeExecute`
  name was reverted before shipping: the SST and SDK pipelines fire concurrently, so renaming the
  one key a live listener reads would have dropped every in-app-browser merge until the CDN caught
  up. `mergeSource` is new and has no such constraint.
- **`ROLLOUT-STEP-3` markers** remain in six source files. They mark the bare-arm code that is now
  unreachable-by-policy but not yet deleted, and the one open decision recorded at `ensure.ts`:
  whether the install proof should keep being accepted directly or be exchanged for a ticket. It is
  taken — keep accepting it — because a leaked install proof costs one id its attribution, far less
  than the two-call capture the flips closed.

## 7. Audit record

[`../../audits/2026-08-15-anonymous-id-proof.md`](../../audits/2026-08-15-anonymous-id-proof.md)
holds the finding ids, severities and per-finding status. Other audit reports cite those numbers,
so it is kept as a record rather than folded in here.
