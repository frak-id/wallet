# Merge admission — implementation progress

**Tracks:** [`MERGE-ADMISSION-PLAN.md`](./MERGE-ADMISSION-PLAN.md) §6, buckets A–E.
**Branch:** `audit/shipped-scopes-review`. One commit per bucket.

| Bucket | State | Commit |
|---|---|---|
| **A** — security holes needing no flip | **done, fully verified** | `ca9b4d341` |
| **B** — the two correctness bugs | **done, fully verified** | `97ae336e9` |
| **C** — Shopify checkout-token work (Gate 2 Phase A) | **done, fully verified; waits on DB2** — see §3 | `6b4995320` |
| **D** — the plumbing and the provable flips | **done, enforcing** — see §4b/§4c | `8cdd4b8e4` |
| **E** — `/merge/execute`, alone | **deliberately out of scope**, counter-gated | — |

---

## 1. Decisions taken that deviate from the plan text

All deliberate, all ratified by an oracle pass against the tree. Anyone reading the plan
alone will find these surprising, so they are recorded here rather than only in commit
bodies.

**T1.1 counters.** Four backend counters named `identity_*_total` on a single four-value
taxonomy `IdentityCredentialClass = proven | invalid | absent_latched | absent_unlatched`.
- The plan's `merge_initiate_source{proof_presented}` boolean was **replaced** by that same
  taxonomy: a boolean cannot separate "absent because legacy" from "absent because the
  listener holds no key", which is exactly the T3.11/T3.1a gate.
- The plan's `caller` label on `/merge/execute` was **dropped** — the route has no auth
  macro and no honest signal exists. `x-frak-sdk-version` must not be substituted for it.
- The `merchant` label was **dropped from every counter**. `merchantId` arrives unvalidated
  in the body of an unauthenticated route and the emission necessarily precedes
  `validateToken` (`invalid` and `absent_latched` throw before it), so labelling it lets any
  caller mint unbounded Prometheus series. The per-merchant cut comes from a structured
  `absent_unlatched` log line instead. **§6 bucket E and §8 were amended to match.**
- The plan's fifth counter `merge_execute_target_source{proven,fallback}` **moved from the
  backend to the listener** (`lifecycleHandler.ts#resolveMergeTarget`). The backend sees
  byte-identical requests; the distinction only exists client-side.

**T1.1 plumbing.** `enforceLatchedProof` and `verifyProofUnenforced` gained a **required**
`onClass` callback, called exactly once on every path and *before* each throw.
`latchedProof.ts` keeps its no-`infraMetrics` property (type-only import).

**T2.8 (`weightCache` invalidation, G25/AID-010) is DONE — the note that it was "still owed"
was stale.** `invalidateWeight` is called from `IdentityOrchestrator` and `WalletMergeOrchestrator`
already. What was genuinely outstanding was only its AID-011 prerequisite — mounting the conflict
surface on the standalone `/install` entrypoint — and that ships in the bucket-D client commit
(§4c), measured against `assertEagerBundleBudget` rather than argued.

**Gate 2 counters (bucket-C fix round).** Two additions, both forced by the review.
- `install_credential_outcome_total{outcome,call_site}` over `resolved | deferred | unresolved`.
  Without it §8's bucket-D cutover condition — "Gate 2 live with a non-zero `checkout_token`
  share" — had **no metric behind it**, because the token arm returns before
  `identity_install_code_generate_credential_total` is ever emitted. It is emitted after the
  ladder returns and never in a `finally`, so its denominator excludes infrastructure failures —
  which matters when it is read as the `checkout_token`-share denominator.
- `install_credential_claim_arm_total` gained a `call_site` label (`generate` | `resolve`).
  `resolveDeferred` re-runs the same ladder at redeem time, so the two hits were conflated.
  It **keeps** its `merchant` label, against §1's blanket "dropped from every counter": it is
  unreachable until `getWebhookByMerchantId` returns a row, so only configured merchants can
  mint a series and the cardinality is bounded by that table.

**The client prefers `checkoutToken` over `anonymousId` (bucket-C fix round).** `useGenerateInstallCode`
sent the id whenever it had one, and that id comes from `useSharingIdentity`, which prefers the
buyer-writable `_frak-client-id` cart attribute. Since the backend 400s a body carrying both, the
order-derived arm never ran in S1/S2 — the states the ladder's step 1 exists to serve. The token
now wins, and no `proof` is sent on that arm because the route never reads one there.

**The SDK emits the execute proof under BOTH `merge` and `mergeExecute` (T2.3, bucket D).** The
plan (§2.1, §8) sequences the rename as two separate merges: the listener accepts both key shapes
first, the SDK emits the renamed key second. That ordering is unenforceable here — one `sst deploy`
ships backend+wallet+listener together while the SDK rides a *separate, concurrent* Changesets
pipeline, so nothing decides which lands first. If the SDK's renamed key wins the race,
`extractSdkProof(x, "merge")` returns `undefined`, `resolveMergeTarget` silently falls into its
unproven fallback, and every in-app-browser merge degrades to proofless with no error, no 403 and
no user-visible symptom — while inflating `merge_execute_target_source{source="fallback"}`, which
is the counter T3.4's own gate reads. So the SDK signs the execute proof **once** and emits the
same string under both keys, making the deploy order irrelevant. The listener reads
`mergeExecute ?? merge`. Dropping the `merge` alias is a later release, and it is now a one-line
SDK change gated on nothing but the listener's dual-accept being live everywhere.

**`mergeSource` is a genuinely new proof and is NOT aliased.** It is `frak-merge-v1` with an
**empty** binding; `mergeExecute` binds `SHA-256(mergeToken)`. Presenting either on the other's
route 403s, which is the domain separation §2.1 relies on instead of a new `ProofOp`. It is signed
on every `resolved-config` send — before any merge token exists, since minting one is what
`/merge/initiate` does — and re-signed on `visibilitychange` to keep it inside its 600 s window.
`PROOF_WINDOW_SECONDS` is unchanged.

**T1.5** made `RateLimitOptions.bucket` **required** rather than optional, so Elysia's silent
plugin dedupe becomes a compile error instead of a trap. Side effect worth knowing: two
identity-keyed referral limiters (`referral/code.ts`, `referral/redemption.ts`) that were
previously deduped away now actually run. That is a *tightening*, so the plan's "strictly
looser" UX-neutrality wording no longer covers the whole change. Both skip anonymous callers
(`identityKey` returns `null`), so the practical effect is nil.

**DB2 scope.** An oracle pass recommended adding `purchases (webhook_id, purchase_token)`,
since no index leads with `webhook_id` and Gate 2 makes that probe ladder step 1. **It was
added and then reverted.** `CREATE INDEX` inside the drizzle migrator cannot be
`CONCURRENTLY`, so it takes an `ACCESS EXCLUSIVE` lock on the highest-write table for the
build duration — the only statement in DB2 with real deploy cost. The query it serves is
already unindexed today on the same `/order-client` path and `generate` is rate-limited to
5/min per IP, so Gate 2 does not materially change its status. **Follow-up:** build it
`CONCURRENTLY` outside the migrator as an ops task.

---

## 2. What is in each commit

### Bucket A — `ca9b4d341`
T1.1 counters + shadow decision; T1.2 wallet-conflict counter on both swallowing branches
(`IdentityOrchestrator` and `ensure.ts`); T1.5 per-route limiter buckets; T1.6 narrowed
`ensureIdentityKey` catch; T1.7 `getMergeToken` signs the resolved merchant id; T1.8 pure-JS
`hashMergeToken` fallback; T1.9 retry classification (both halves); T1.10 guarded
`x-frak-sdk-version`; T1.11 doc corrections; T1.13 listener proofless counters; T2.2
alarm-only wallet-source counter; T2.9 auth on `GET /pairings/find/:id`.

**T1.6 ships before T1.7 and the order is load-bearing** — T1.7 makes the proof real, a real
proof latches the id via `markProofSeen` which never clears, and T1.6's old catch would
destroy the key of a just-latched id on a quota error, leaving a permanent 403.

### Bucket B — `97ae336e9`
T1.3 deletes the `merge` parameter from `PurchaseLinkingOrchestrator.claimPurchase` (making
`identityOrchestrator.associate` unreachable from the purchase path) and drops the
`/track/purchase` 200's `merged`; T1.12 adds `orderBy: asc(createdAt)` to
`findAnonymousFingerprint`.

### Bucket C — `6b4995320`
DB2 (**owed by the DB team**, not in this repo), the `checkoutToken` credential arm end to end, `InstallCredentialOrchestrator`
with the resolved-first ladder, T1.14's server-minted latched id, and the `/sharing` → `/install`
client hop. It also removed the generated migrations, recording the DDL at [`DB2.sql`](./DB2.sql),
and absorbed two review rounds. Detail in §3.

### Bucket D — `8cdd4b8e4`
T2.3's consent plumbing; the three backend flips; the three client refusals; the TTL decoupling;
T3.7's wallet half; AID-011. All of it enforcing — it shipped once behind per-request kill switches
and build-time constants, and a later round in the same commit deleted them. Detail in §4b and §4c.

---

## 3. Bucket C — what shipped, and the migration it waits on

### Shipped
- **DB2 is NOT in this repo — it is owed by the DB team.** Schema changes are theirs, so the
  generated migrations were removed. The DDL this branch's Drizzle schema requires is recorded
  verbatim at [`DB2.sql`](./DB2.sql): `anonymous_id` DROP NOT NULL, ADD `checkout_token`, two
  indexes, and the `install_codes_credential_present` CHECK.
  **It must be applied to `local`, `dev` AND `prod` before the backend image that names
  `checkout_token` deploys.** `install_codes` is selected with a full column list, so against a
  database missing it **every** `install-code/generate` and **every** `install-code/resolve`
  raises `42703` — both arms, not only the new one — and a deferred mint additionally raises
  `23502` while `anonymous_id` is still `NOT NULL`. Rollback is partial: re-adding `NOT NULL`
  fails once one deferred row exists.
  **All three folders matter:** `infra/gcp/dev.ts:32` sets `POSTGRES_SCHEMA:"local"`, so GCP
  dev/staging runs the `local` folder; `infra/gcp/secrets.ts:79` sets `"public"` and `STAGE`
  then picks dev vs prod. `drizzle/v2/` is dead — nothing sets a `_v2` schema.
- **`InstallCodeRepository.create`** takes a discriminated `InstallCodeCredential` so
  "neither credential" is unrepresentable at compile time rather than rejected by the DB
  CHECK at runtime. One CTE whose reuse predicate matches on **either** identifier — an
  exclusive `CASE` would miss a deferred row once its id resolved and mint a second code for the
  same order; every nullable
  interpolation is `::text`-cast (a bare null parameter makes Postgres raise
  `could not determine data type of parameter`). `anonymousId` wins outright when both are
  present, so an already-working caller cannot have its id changed by the Shopify arm.
- **`InstallCredentialOrchestrator`** owns the whole ladder: steps 1–3 (resolved purchase →
  counted claim → materialisation) **and** the `deferred` / `unresolved` outcomes. The route only
  maps them onto a 404 and a response field. `resolveDeferred` is
  the same ladder minus materialisation and **never writes**, because `/install-code/resolve`
  is unauthenticated.
- **T1.14** mints `` `frakmint_${crypto.randomUUID()}` `` — unguessable, so it cannot be used
  as a DoS primitive against a group — and latches it through a **distinct**
  `latchServerMintedProof`. Two corrections from the review, because the original claim was
  overstated: the guard is `LIKE 'frakmint\_%' ESCAPE '\'`, since a bare `_` is a single-char
  wildcard that also matches `frakmintX…` (the runbook `UPDATE` in the plan's §3/§8 needs the
  same escape); and the prefix is only a reserved namespace because `generate` and both `ensure`
  arms now 400 `RESERVED_IDENTITY` on a caller-supplied id carrying it. With those two, a
  miswired call site cannot latch a caller-supplied id. `markProofSeen`'s six call sites are
  untouched; they are the inventory the latch-retirement round depends on.
- **The client hop** — `checkoutToken` now survives `/sharing` → `/install`. Beyond the
  plan's four edits, two more were required and are the ones that would have broken silently:
  `buildInstallUrl`'s `clientId` had to become optional (it was required and unconditionally
  interpolated, so a token-only URL was impossible), and `useResolveInstallCode` had to
  tolerate an absent `anonymousId` or it would queue a malformed ensure action that retries
  for its full 7-day TTL.
  **The processing branch gets it for measurement only.** `InstallProcessing` — the Tauri /
  already-logged-in branch — receives the token but cannot resolve one to an id, so the id it
  ensures with is whatever `/order-client` published, which for a Gate 2 order is the
  server-minted one. The reserved-namespace guard is creation-scoped precisely so that keeps
  working. See §5.
- **The client prefers the token over the id**, and a refused credential now renders the download
  CTA rather than *"Failed to generate code. Please refresh."* — the shape T3.3 needs, brought
  forward because bucket C created a new way to reach that string (an unconfigured merchant, now
  `MERCHANT_NOT_CONFIGURED`, where refreshing never helps). A 5xx still throws and still retries.

### Verification status
The whole gate was run on a larger box, unfiltered. Nothing is outstanding.

| Check | Result |
|---|---|
| `bun run build:sdk` | clean |
| `bun run format` | clean |
| `bun run lint` (incl. `lint:comments`) | clean |
| `bun run typecheck` (every package) | **exit 0** |
| full `bun run test` | **584 files / 5669 tests pass** |

Two traps worth knowing before re-running it:
- **`apps/wallet`'s typecheck needs the TanStack route tree generated first.**
  `app/routeTree.gen.ts` is gitignored and emitted by the vite plugin, so on a clean checkout
  `tsc` reports ~50 phantom errors (`Cannot find module './routeTree.gen'`, then a cascade of
  `not assignable to parameter of type 'undefined'` on every `createFileRoute`). Run a wallet
  build, or generate the tree, before believing any of them.
- **Run the suite unfiltered.** A filtered `bun run test -- <path>` currently fails with
  `TypeError: React.act is not a function` across files this branch never touched; the full run
  is green. That is a project-setup artifact, not a regression.

`buildInstallUrl` returning `string | null` is now proven clean by `tsc` against its only
out-of-wallet consumer, `apps/listener/app/module/sharing/component/SharingPage/index.tsx:46-54`.

---

## 4. Bucket D — every row, as executed

Nothing in bucket D waited on the legacy population. It first shipped behind kill switches, on
the reasoning that §8 forbids flipping without a counter; that was reversed — the switches cost
~900 lines to guard a decision the error log already shows, so they are gone and every refusal is
on. §4b and §4c carry the detail; this is the index.

| Row | State | Where |
|---|---|---|
| **T2.3** merge-token consent plumbing | **shipped, enforcing** — purely additive on the wire | `8cdd4b8e4` |
| **T3.11** listener refuses proofless `initiate` | **shipped, enforcing** | `8cdd4b8e4`, §4c |
| **T3.1a** `proof` required on `/merge/initiate` | **shipped, enforcing** | `8cdd4b8e4`, §4b |
| **T3.2** `/identity/ensure`, both arms | **shipped, enforcing** — including its wallet prerequisite, `a=` no longer forwarded | `8cdd4b8e4`, §4b |
| **T3.3** `install-code/generate` strict | **shipped, enforcing** — with the claim-age bound and the codeless CTA | `8cdd4b8e4`, §4b |
| **T3.4** `resolveMergeTarget` | **shipped, enforcing** — both halves | `8cdd4b8e4`, §4c |
| **T3.5** install-ticket TTL | **decoupled and env-driven; value unchanged** | `8cdd4b8e4`, §4c |
| **T3.6** merge-token TTL | **env-driven; value unchanged, deliberately** — native `MergeSender` mirrors it | `8cdd4b8e4`, §4c |
| **T3.7** `anonymousId` off `resolve`'s 200 | **wallet half shipped**; the backend half is owed, in that order | `8cdd4b8e4`, §4c |
| **T2.6** install-code single-resolve | **DROPPED** — needs DB3, DDL is the DB team's, OQ4 unmeasured | §4c |
| **T3.8** fill the empty bindings | **deferred** — changes a signed message, needs 30 days of dual-accept | §4c |
| **T3.10** post-install recovery CTA | **deferred** — new optional surface, gated on OQ4 | §4c |
| **T2.8** `weightCache` invalidation | **already shipped** — §1's "still owed" was stale | §4c |
| **AID-011** conflict surface on `/install` | **shipped, enforcing**, with the bundle delta measured | `8cdd4b8e4`, §4c |

**The one ordering this does not honour**, stated so nobody discovers it in a graph: §7 wanted the
"no more `a=`" wallet release live and its 7-day pending-ensure queue drained *before* the bare arm
started refusing. All of it now lands in one deploy, so queued actions written by the currently
deployed wallet take a `400` on day one. They drop rather than retry — every refusal code is
non-retryable — and what is lost is the pre-install attribution those actions carried. §4b spells
out the lever if that turns out to matter.


**Bucket E (`T3.1b`) is deliberately not scheduled.** Its exit criterion is
`identity_merge_execute_credential_total{class="absent_unlatched"}` trending to ≈0, per
merchant, off the log line — a counter, never a date. Bucket A is what makes it measurable;
the clock starts when bucket A is deployed.

---

## 4b. Bucket D — the backend flips, enforcing

**Every flip is on.** They shipped once behind per-request env kill switches, on the reasoning that
§8 forbids flipping without a counter and no counter had been deployed. That was reversed
deliberately: the switches are deleted and the refusals are unconditional.

The argument for reversing it is that the flags bought nothing the route did not already give you.
A refused request answers `403` or `400` with a named error code, in the access log, per route,
per merchant — which is a better signal than a would-403 counter, and it is data that already
exists. What the flags cost was **~900 lines**, of which ~770 were tests that existed only to prove
both settings behave. A mechanism whose test burden is six times its own size, guarding a decision
already visible in the error log, is not a safety feature.

**A schema flip was measured and rejected — do not re-propose it.** The plan's "one schema field,
`t.Optional` → `t.String()`" is not implementable on any of these three routes: each has a
legitimately proofless arm (wallet-session on `initiate`, the Gate 2 token arm on `generate`, the
ticket arm on `ensure`), so `proof` cannot be flatly required. A discriminated union body is worse
than useless: Elysia strips unknown properties **before** validation, so
`{merchantId, sourceAnonymousId}` with no proof matches the looser variant, `sourceAnonymousId` is
silently stripped, and an anon-source request becomes a wallet-session one with a `200`. Verified
against the live Elysia version, both with and without `additionalProperties: false`. Enforcement
belongs in the handler.

### What each route now refuses, and what to watch

| Route / arm | Refuses | Watch |
|---|---|---|
| `/merge/initiate`, anon-source | `403 PROOF_REQUIRED` when `sourceAnonymousId` carries no proof | 403 rate on the route; `merge_initiate_proofless{source}` client-side, which now fires *instead of* a request |
| `/identity/ensure`, SDK arm | `403 PROOF_REQUIRED` when unproven | `identity_ensure_arm_total{arm="sdk"}` |
| `/identity/ensure`, wallet arm | `400 PROOF_OR_TOKEN_REQUIRED` at the bare exit; `403 PROOF_INVALID` for a bad install proof | `identity_ensure_arm_total{arm="wallet_bare"}` and `{arm="wallet_proof",class="invalid"}` |
| `install-code/generate`, anonymous arm | `403 PROOF_REQUIRED` / `PROOF_INVALID` | `identity_install_code_generate_credential_total{class}` |
| `/merge/execute` | **nothing — unchanged.** Bucket E | `{class="absent_unlatched"}`, which is still its exit criterion |

**`/merge/execute` is the one that must not move**, and the code says so structurally rather than
by convention: `enforceProof` takes a **required** `refuseUnproven` boolean, `initiateMerge` passes
`true` and `executeMerge` passes `false` with T3.1b named at the call site. A future author who
forgets it gets a compile error rather than a silent flip.

### The one cost this ordering does not pay

§7 required the wallet release that stops forwarding `a=`, then a **7-day pending-ensure queue
drain**, and only then the bare-arm refusal. With no flag, all three land in the same deploy. So on
deploy day, every queued ensure action written by the currently-deployed wallet — which carries
neither ticket nor proof — takes a `400` instead of a `200`, for as long as the store holds it.

That cost is bounded and was accepted knowingly. `PROOF_OR_TOKEN_REQUIRED` is in
`drainEnsures`'s non-retryable set, alongside `PROOF_REQUIRED`, `PROOF_INVALID`,
`MISSING_ANONYMOUS_ID`, `RESERVED_IDENTITY` and `INVALID_TICKET`, so each stale action drops on its
first attempt rather than retrying for a week. What those users lose is the pre-install attribution
that action carried — not the install, not the wallet, and nothing on screen. If that is worth
avoiding, the lever is not a flag: ship this branch with the bare-arm throw commented out, wait a
week, and uncomment it.



### The one property worth keeping from the flag round

Every throw sits **after** the credential class has been emitted, and none of them branches around
`verifyOrThrow`. That ordering was load-bearing when the flags existed — get it wrong and the
shadow counter never observes `invalid`, so a flip 403s a population that read zero — and it stays
load-bearing now for a simpler reason: it is what makes the counter a count of what *arrived*
rather than of what survived. Every arm still pins that an **invalid** proof is refused because
verification ran, not because the credential was absent.

That is also why the bare arm reports `class="absent"` and not `absent_unlatched`. Everywhere else
those two names are decided by an actual latch read; the bare arm refuses without doing one, and a
latched id reaches it too — a stale queued action for an id that has since proved itself. Emitting
`absent_unlatched` there would assert a fact nothing checked, and adding the lookup would buy a
database read on a refusal path for a number nobody acts on. The ticket arm's `n/a` is the same
kind of honesty: a receipt is not a credential class.


### The `ensure` door inventory, and why one throw closes three

Four proofless entries collapse onto two exits:

1. SDK arm (`isSdkCaller`) — latch-gated `frak-ensure-v1`. Now refuses when unproven.
2. Wallet arm via `ticket || bodyAnonymousId` — ticket ✅ / `frak-install-v1` ✅ / **bare** ❌.
3. Wallet arm via the header fall-through — always bare ❌.
4. The single bare `return bodyAnonymousId` that **2 and 3 both land on**.

The throw lives at exit 4 only, which is why one statement shuts both doors. The
header→body promotion is **kept**: under an enforcing wallet arm it is no longer a proofless
door, and deleting it would break a header caller that *does* carry a proof. The ticket branch is
untouched — it is a receipt for a credential already presented at `generate`, and its id may
legitimately be server-minted. The `frak-install-v1` branch is kept and refuses an *invalid* proof
rather than falling through to the bare exit — otherwise closing the bare arm would refuse a caller
who sends nothing while still admitting one who sends garbage.

All three refusal codes this creates — `PROOF_OR_TOKEN_REQUIRED`, `PROOF_REQUIRED` and
`PROOF_INVALID` — are in `drainEnsures`' `MISSING_CREDENTIAL_CODES`, so a stale queued action drops
on its first attempt instead of retrying for its full 7-day TTL.

### The wallet stops forwarding `a=` (unconditional)

`SharingView` and `routes/sharing.tsx` no longer put `clientId` in the `/install` hop. That page
holds no keypair, so the id it forwards can never carry a proof and would be refused the moment
ensure demands one; the same link is covered proof-carrying from the merchant origin by
`ensureIdentity`. `checkoutToken` forwarding is untouched — it is Gate 2's carrier.

### The claim-age bound (unconditional, ships with T3.3)

`CLAIM_MAX_AGE_MS = 1 hour`. The claim arm exists only to cover the pixel-before-webhook race,
whose normal latency is seconds, and the webhook deletes the row on reconcile; anything still
pending an hour later is a failed webhook, not a race, and that row is forgeable because the
tracking route writes it unauthenticated. An over-age claim is refused and the ladder falls
through to deferral rather than erroring.

**Follow-up 5 below ("`purchase_claims.created_at` is nullable, so the claim-age bound needs a
backfill first") is wrong, and this is why.** The column is `DEFAULT now()` and no writer passes
an explicit null, so a NULL is unreachable for any row Postgres has written — the nullability is
a Drizzle typing artefact. A NULL is therefore **accepted and counted**
(`install_claim_age_total{verdict="undated"}`) rather than refused, so no legitimate buyer pays
for a typing artefact. That counter is expected to read **zero**; if it ever does not, a writer
has started overriding the default and that is a DB-team task.

### `MIN_VERSION_*` — a live defect, and the workflow hunk that is not in this branch

`infra/gcp/secrets.ts` reads `MIN_VERSION_IOS` / `MIN_VERSION_ANDROID` and
`.github/workflows/deploy.yml` set **neither**, so both silently took their `"0.0.0"` default on
every deploy. The fix — those two plus every flag and TTL this bucket added, each as a repository
variable with its safe state as the fallback — **could not be pushed from this branch**: writing
`.github/workflows/**` needs a token scope the release credential does not carry. It ships as
[`deploy-env.patch`](./deploy-env.patch), which `git apply`s cleanly and is deleted once applied.

Nothing is broken until it lands: `secrets.ts` forwards every one of those variables with the same
default, so the pod receives exactly today's behaviour. What is missing is the ability to *change*
one without editing the workflow. No admission flip depends on it any more — the patch carries
`MIN_VERSION_*` and the two credential TTLs, nothing else.

Two guard tests (`services/backend/test/infra/deployEnvCoverage.test.ts`) keep the whole class
closed. The first parses every `process.env.X` out of `secrets.ts` and fails naming any that the
`Deploy Services` step does not set — reading the pending patch while it exists, so the invariant
holds either side of the apply. The second is the half that matters more: it parses every variable
the **backend** reads (`jwt.ts`'s `ttlSecondsFromEnv` literals) and fails any that `elysiaEnv` does
not forward. A value the backend reads and `secrets.ts` forgets is otherwise invisible and
permanently unsettable in production.

---

## 4c. Bucket D — the client refusals, the TTLs, and the conflict surface

### The three client refusals, enforcing

T3.11 and both halves of T3.4 shipped once as build-time constants defaulting off, and were made
unconditional in the same round that deleted the backend flags. The listener now refuses to mint a
merge token with no proof (RPC path and the modal/embed query path alike), refuses an unproven
`fallbackId` target, and refuses a proven id carrying no execute proof.

**Every refusal still emits its counter before returning**, and here that is not a nicety: no
request reaches the backend any more, so `merge_initiate_proofless{source}` and
`merge_execute_target_source{source}` are the *only* remaining visibility into the refused
population. There is no access log to fall back on, unlike the backend arms.

Degradation was verified rather than assumed: `getMergeToken` yields `null`/`undefined`,
`appendMergeToken` returns the URL unchanged on a falsy token, and `redirectToSafari` /
`computeRedirectUrl` guard identically — the escape still redirects, it just carries no `?fmt=`.
No throw, no spinner, no user-visible error; one hop of attribution lost.

One behaviour change beyond the three named sites, worth knowing: a `wallet_explorer` call that
carries a `sourceAnonymousId` is now refused too. The refusal is field-based, matching the backend,
which can only trust the field; the counter stays source-based. No live call site does this.

### T3.4 half A — a silent bug, fixed unconditionally

`resolveMergeTarget`'s proven branch attached whatever execute proof it found and sent the merge
regardless, so "proven id **with** its proof" and "proven id with **no** proof" were both counted
`proven` and were indistinguishable. The backend admits the second only while that id has never
latched, so it is exactly the population that breaks at T3.1b. `MergeExecuteTargetSource` gains
`proven_unproven`; `proven` and `fallback` keep their existing meanings, or the plan's own gate
would read the wrong number. The skip is now explicit and analytics-visible
(`identity_ensure_failed{error_type:"no_merge_target"}`) instead of an accidental `undefined`.

### T3.5 / T3.6 — decoupled, env-driven, and NO value changed

`INSTALL_TICKET_TTL_MS` was one constant serving both the server's ticket JWT and the wallet's
pending-action store. It is now `INSTALL_TICKET_CLIENT_TTL_MS` and `INSTALL_TICKET_SERVER_TTL_MS`,
**both still 7 days**. §8 requires the decoupling *before* any cut, and the cut itself is a
coordinated backend+wallet deploy: the client value is compiled into the store binary, so it can
never have a kill switch.

Both server TTLs are now resolved **per sign** (`INSTALL_TICKET_TTL_SECONDS`,
`MERGE_TOKEN_TTL_SECONDS`), so cutting one never waits on a pod restart — `buildJwtContext` accepts
a resolver function, since the old number was captured in a module-load closure. Both are plumbed
through `infra/gcp/secrets.ts` and `deploy.yml` at today's values, which keeps the
`deployEnvCoverage` guard test green.

**T3.6 is deliberately not cut.** `MergeSender.kt`'s `holdTimeoutMillis` is 60 min hard-coded to
mirror the backend and ships in a store binary; cutting the server side alone drops native merge
rows at 401. A comment at the constant names that coupling.

`clientTTL >= serverTTL` is enforced by a test — the honest place, since the two values live on
opposite sides of the wire and cross-importing to assert it would invert the dependency.

### T3.7 — the wallet half only

`useResolveInstallCode` no longer reads `anonymousId` off the resolve 200; the queued ensure
carries the **ticket alone**, which authenticates its own id server-side and 400s on a mismatch.
`PendingEnsureAction.anonymousId` becomes optional and `drainEnsures` omits it when absent. The
dedupe key already preferred the ticket, so nothing moved there.

**The backend still sends the field, and must keep sending it until a later deploy.** Ordering is
wallet-then-backend, never the reverse, so the store stays readable by a rolled-back build. The
`ROLLOUT-STEP-3` marker at the mint site now says exactly that. **The backend half is still owed.**

### AID-011 — mounted, and measured

`EnsureConflictToast` now renders on the standalone `/install` entry, which is the page that fires
the ensure and therefore the page the 409 has to land on. Bundle cost, measured with
`assertEagerBundleBudget`:

| Entry | Before | After | Budget |
|---|---|---|---|
| `install.html` | 73.49 KB gz | **74.85 KB gz** (+1.36 KB) | 105 KB |
| `sharing.html` | 90.75 KB gz | 91.58 KB gz | 105 KB |

It stays well inside the ceiling because the toast pulls only design-system primitives and a
zustand store already in the graph — no router, no blockchain client. The budget was **not** raised.

### Not done in this bucket, and why

- **T2.6 is DROPPED, not deferred.** It needs DB3, and DDL is the DB team's now; the plan itself
  calls it the lowest-value row in the bucket and says to drop it if OQ4's measurement does not
  arrive. It has not, and DB3 was the only reason it existed.
- **T3.8 is deferred.** It changes the signed message, so it needs a dual-accept window of one
  full `frak-ensure-v1` lifetime (30 days) — a *credential* lifetime, not a propagation gate. It
  must not ride along with the flips.
- **T3.10 is deferred.** A new optional wallet surface, gated on OQ4, never on a critical path,
  with no security value of its own.

---

## 5. Follow-ups this work created

1. **`purchases (webhook_id, purchase_token)` index**, built `CONCURRENTLY` outside the
   migrator (§1). Now a DB-team task like DB2 itself.
2. **`InstallProcessing` cannot resolve `checkoutToken` to an id.** The token now reaches that
   branch, but only for measurement: nothing there turns one into an id. A Shopify buyer who
   **already has the wallet** (Tauri, or logged in on web) therefore ensures with whatever
   `/order-client` published — the server-minted id on a Gate 2 order — and when it published
   nothing, `buildInstallProcessingEnsureAction` returns `undefined` and the attribution is
   silently lost. Sized, not fixed: `install_page_viewed` and `install_processing_triggered` now
   carry `has_checkout_token`. Closing the second case needs a token→id resolution that branch
   can call (reuse `GET /identity/order-client`, or accept `checkoutToken` on
   `/identity/ensure`) and is bucket-D-sized.
   **The reserved-namespace guard is creation-scoped for this reason:** it rejects a caller
   *minting* a `frakmint_` node and admits one *naming* a node that already exists, so the
   handoff above is not broken by it. `RESERVED_IDENTITY` is also classified non-retryable in
   `drainEnsures`, since nothing on the retry path can ever mint the missing node.
   **The Play-referrer CTA still prefers the buyer-writable `anonymousId`** while `generate` now
   prefers the token, so the two surfaces disagree about which credential is authoritative — to
   be reconciled at T3.3, not now.
3. **The claim arm is reachable at redeem time, not only at generate.** §3 of the plan bounds the
   forged-claim window to "the gap before the webhook lands", but `resolveDeferred` re-runs the
   same ladder, so for S7–S9 (webhook permanently failed or absent) that arm decides the group
   for the **whole 72 h life of the code**. Inside the accepted-risk envelope — the attacker
   still needs the `checkoutToken` — but it is a *different* window from the documented one, and
   it is why **the claim-age bound should land with the deferral rather than merely before
   T3.3**. `install_credential_claim_arm_total` is now labelled by call site so the two are
   separable; follow-up 5 below is its prerequisite.
4. **`PurchaseClaimRepository.upsert`'s `rebindExisting`** is now dead: after T1.3 its one
   caller always passes `false`, so the `onConflictDoUpdate` arm is unreachable and the doc
   block's claim about the webhook path overwriting is false. Same footgun T1.3 deleted, one
   layer down.
5. ~~**`purchase_claims.created_at` is nullable**, so the claim-age bound needs a backfill first.~~
   **Withdrawn** — the column is `DEFAULT now()` and no writer overrides it, so a NULL is
   unreachable for any row Postgres wrote. §4b carries the reasoning and the counter that would
   prove it wrong.
6. `PurchaseLinkingOrchestrator`'s CAS arm and `isCancelled` arm have no test coverage —
   pre-existing, not a regression from T1.3.
7. `services/backend/user-openapi.json` was stale at HEAD; regenerating it in bucket B pulled
   in unrelated drift (version bump, a 404 and a 401 that the routes already declared, three
   `sharingTimestamp` bound changes). Nothing there changes a live contract.
