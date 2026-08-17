# Identity proof-of-possession — manual QA

What to exercise by hand before the deploy, and how to force each case. [`README.md`](./README.md)
§4 covers what to watch *after* it; this is the pass before that.

The shape of the risk: four admission arms went from fail-open to fail-closed in one commit. Every
test below exists because a legitimate caller that cannot produce a proof now gets a refusal where
it used to silently succeed.

**The failure mode to fear has no screen.** A user completes a flow, sees no error, and never gets
the reward. That is what `UNRESOLVED` was, and it shipped past review. So for every case below,
"no error shown" is not a pass — assert the *outcome*: the pending action was queued, the merge
landed, the counter moved on the arm you expected.

---

## 0. Preflight

| # | Step | Why |
|---|---|---|
| 0.1 | `git checkout bun.lock && bun install && bun run test` | `react` is not hoisted in a drifted checkout, so **every React/DOM suite fails** with `React.act is not a function` and the wallet/listener tests covering these flows are dark. Cheapest coverage available |
| 0.2 | Apply [`DB2.sql`](./DB2.sql) **tier 1** | Without `checkout_token`, every `install-code/generate` and `install-code/resolve` raises `42703`. Nothing below runs |
| 0.3 | Confirm `proof_seen_at` exists in the target environment | If the column is missing anywhere, every proof-absent merge 500s |
| 0.4 | `curl localhost:9464/metrics` responds | Separate internal port (`METRICS_PORT`, default 9464), never routed by the ingress. Several assertions below read it |

---

## 1. P0 — the flips

| # | Case | How to force it | Pass |
|---|---|---|---|
| 1.1 | **In-app-browser escape still merges** | Real Instagram / Facebook / LinkedIn webview on a merchant page, trigger the escape | The merge lands. This arm had **no proof at all** before and now depends on `mergeSource` arriving via `resolved-config`; if that plumbing is broken it 403s. Single most important case here |
| 1.2 | **Proof freshness — the timer half** | `frak-merge-v1` lives **600 s** (`IdentityProofService.ts:24`). Leave a tab **visible and untouched** for >11 min, then trigger | Still merges. This exercises the 5-min re-push timer, *not* `visibilitychange`. An expired-but-present proof 403s while `merge_initiate_proofless` reads zero for that population — worse than a missing one |
| 1.3 | **Proof freshness — the visibility half** | Background the tab >11 min, foreground it, trigger | Still merges |
| 1.4 | **Legacy migration still works** | Seed a legacy id into merchant-origin `localStorage`, load the page | Merge lands **with no proof**. `/merge/execute` is deliberately unflipped (README §3); a 403 here is a real bug |
| 1.5 | **Keyless client degrades, not breaks** | Delete `frak-client-key` from merchant-origin `localStorage` so `signProof` returns null | Clean refusal or CTA. No hang, no crash, no error dialog |
| 1.6 | **The `mergeExecute ?? merge` alias** | Make the SDK emit only the old `merge` key | Listener still reads it. This is the deploy-skew path: SDK ships via Changesets, backend/wallet/listener via one `sst deploy`, and nothing orders them |
| 1.7 | **`fmt` redemption survives a blip** | Fail `/merge/execute` with a 5xx or kill the network for ~2 s during the escape, then restore | The merge still lands, within ~5 s and two retries. Then check the other half: a **4xx must stay one request** — retrying a refusal would turn a decision into a storm |

New refusal codes to expect and recognise: `PROOF_REQUIRED`, `PROOF_INVALID`,
`PROOF_OR_TOKEN_REQUIRED`, `MISSING_CREDENTIAL`, `AMBIGUOUS_CREDENTIAL`.

---

## 2. P1 — Gate 2, live for the first time

The client used to prefer a buyer-writable cart-attribute `anonymousId` over the checkout token, so
the order-derived credential almost never fired. That preference is now inverted, which means these
paths have **never run in anger**.

| # | Case | How to force it | Pass |
|---|---|---|---|
| 2.1 | Webhook-first (resolved arm) | Normal Shopify post-purchase → `/sharing` → `/install` | Code renders, resolves, ensure queued |
| 2.2 | **Pixel-first (claim arm)** | Block or delay the webhook endpoint, complete a purchase, release it after | The warning log **and** the claim counter fire. This is the forgeable arm — it must be visibly degraded, never silent |
| 2.3 | **`UNRESOLVED`** | Never deliver the webhook, then enter the code | The unresolved message renders, the success modal does **not**, and **no** ensure action is queued. Assert all three; the bug was that the first two both happened |
| 2.4 | 4xx → CTA, not error | `merchantId` with no webhook configured | Codeless download CTA. Never `installCode.error` |
| 2.5 | **Cross-device** | Purchase on laptop → open `/install` on phone → type the code | Attribution lands on the phone. Run as one continuous scenario: the `/sharing` → `/install` hop is where `checkoutToken` gets dropped, and the drop is invisible until the wrong hero renders |
| 2.6 | Code reuse | Resolve the same code twice; and drive a deferred→resolved transition | Exactly one code per `(merchant, checkout_token)`. The reuse CTE **never executes real SQL in tests**, so this is hand-only |

---

## 3. P2 — regressions in code that did not change

| # | Case | Pass |
|---|---|---|
| 3.1 | Normal purchase attribution | Unchanged. Deleting the purchase-claim `merge` param promised *zero* behaviour change — the one live caller passed `merge: false` |
| 3.2 | SSO login merge | Unchanged |
| 3.3 | Native install — Android deep link | Attribution lands. Hits `ensure`'s wallet arm, which was just flipped |
| 3.4 | Native install — Play Install Referrer | Attribution lands. Same arm, different entry |
| 3.5 | Native install — iOS | Attribution lands |

No emulator or simulator exists in CI, so 3.3–3.5 are hand-only by construction.

---

## 4. UI / UX — three new visible states

Everything else that moved is plumbing (`useGetMergeToken("listener_modal")` and friends are
counter call-site labels, not renders). All three below ship with `en` **and** `fr`.

| # | State | Trigger | Pass |
|---|---|---|---|
| 4.1 | **Codeless install hero** — *"Don't lose your {{ estimatedReward }}!"* + download CTA, no code box, no `InstallCodeInfoCard` | Two distinct routes, test both: (a) `/install` with neither `a` nor `checkoutToken`; (b) a `merchantId` whose `generate` 4xxs (`InstallView.tsx:333`) | Hero renders as a CTA, never as an error, and never as a "copy this code" hero with no code beneath. **Check `{{ estimatedReward }}` interpolates** — a missing reward leaves a literal placeholder or a gap in the headline |
| 4.2 | **Unresolved code** — *"This code isn't linked to a purchase yet. Try again in a few minutes."* | Case 2.3 | Renders instead of the success modal. Deliberately not the "incorrect or expired" string, which would be false — the code is valid, the purchase simply has not landed |
| 4.3 | **Ensure-conflict toast on standalone `/install`** | Link a wallet to an id, then drive a second ensure for that id from the standalone install entry | Toast renders and is legible on that surface. Previously silent there (AID-011); it was styled for the wallet layout, which has different chrome |

---

## 5. Counters

Bucket E's go/no-go is read off these numbers, so they need to be right before they are trusted.

```bash
curl -s localhost:9464/metrics | grep -E 'identity_|install_'
```

After exercising §1 and §2, assert:

- The credential classes are **not conflated** — an invalid proof never lands as `absent_unlatched`.
- `identity_ensure_arm_total{arm="wallet_bare"}` reports `class="absent"`, which says a credential
  was absent and says nothing about a latch it never read.
- `identity_merge_execute_credential_total{class="absent_unlatched"}` moves for case 1.4 and only
  case 1.4. This is the counter §3 of the README gates the last flip on.
- **Cardinality:** count distinct `merchant` label values.
  `identity_merge_execute_wallet_source_unproven_total` and `install_credential_claim_arm_total`
  carry a caller-supplied `merchantId` with no existence check on the merge path, which the same
  file's doc block forbids for exactly that reason. Unbounded series per replica.

---

## 6. Known gaps this pass cannot close

| Gap | Why |
|---|---|
| The DB layer | The `frakmint_` guard, the DB2 `CHECK` and the reuse CTE **never execute real SQL** — the orchestrator test mocks the transaction away. Only case 2.6 touches them |
| Native | No emulator, no simulator, host/JVM tests only |
| Composed HTTP layer | Nearly all backend coverage is unit-level against orchestrators; the most serious findings in the audit were route-wiring mistakes no unit test could catch |
