# Audit — TakeAds Affiliate Conversion Ingestion

**Commits reviewed:** `5e699e5c9` (ingestion cron + orchestrator) · `6c6bd2d8a` (custom-interaction routing)
**Branch:** `feat/takeads-affiliate-integration-plan`
**Scope:** the two commits above (orchestrator, sync-state/attribution repos, cron, wiring).
**Method:** 8 specialist reviewers in parallel across 3 lenses (simplification/dedup · standards · improvements). Findings below are **adjudicated** — I re-derived severity, deduped overlaps, verified the top items against the code, and flagged reviewer false-positives.

---

## Verdict

**GO with fixes.** The architecture, layering, idempotency model, error-isolation watermark, and advisory-locking are sound (standards lens: clean, 0 violations). But there are **2 confirmed HIGH latent bugs** that bite on a large/initial sync or a foreign-traffic batch, plus a cluster of cheap hardening + dedup wins. No BLOCKERs.

| Severity | Count | Headline items |
|---|---|---|
| HIGH | 2 | Watermark `Math.max(...array)` overflow stalls large syncs · skipped (foreign subId) actions pin the cursor |
| MEDIUM | 4 | Per-page checkpoint lost on mid-run API failure · weak external-boundary validation (amount/currency/ids) · currency-unit assumption unverified · `newInteraction` emit untested |
| LOW | ~6 | `ActionCounts` dedup · `externalId` recomputed · type-guard predicate · `watermarkConserved` naming · deadline granularity · observability |
| NIT | ~4 | test #7 ordering · test #3 missing assertion · lock-key registry · `orderDate`/`orderAmount` formatting |

---

## HIGH

### H-1 · `computeWatermark` uses `Math.max(...array)` — stack overflow stalls large syncs
`TakeAdsIngestionOrchestrator.ts:71,73,76`
```ts
return new Date(Math.max(...successTimestamps.map((d) => d.getTime())));
```
`successTimestamps`/`failedTimestamps` accumulate **every** action in a run. With `PAGE_CAP=1000 × limit=500 = 500k` actions possible on a first/catch-up sync, `Math.max(...arr)` throws `RangeError: Maximum call stack size exceeded` at ~120k elements (V8 arg limit). That rejects `ingestActions()` → no watermark persisted → next tick refetches the same set → **permanent stall**. (Also ~40 MB of transient `Date[]`.)
**Fix:** drop the arrays; track `maxSuccessMs` / `minFailedMs` as running scalars updated in `processAction`, and delete `computeWatermark`. This simultaneously resolves Simplicity-1 and Reliability-9. *(Confirmed in code.)*

### H-2 · Skipped (foreign-subId) actions never advance the watermark → cursor pin
`TakeAdsIngestionOrchestrator.ts:185-191` (early `return` before `successTimestamps.push`)
```ts
if (!attribution) { counts.skipped++; return; }   // never reaches the push below
```
A skipped action is fully handled (we deliberately don't care about it) but is excluded from the watermark timeline. A single unattributed action whose `updatedAt` is later than all attributed ones **pins the cursor** at the last attributed timestamp. Every run then refetches from the pin; as volume grows the run can exhaust `PAGE_CAP`/`RUN_BUDGET_MS` before reaching genuinely new actions → **missed rewards** (silently, with `errors: 0`).
**Fix:** treat skipped as processed for the cursor — push `actionTs` onto the success timeline (or a shared `processedTimestamps`). Safe: attribution rows are minted at link-generation (before any conversion), so an unmatched `subId` is genuinely foreign and won't become attributable later. Add a test asserting `advanceWatermark` is called for an all-skipped batch. *(Confirmed in code.)*

---

## MEDIUM

### M-1 · Mid-run `getActions` failure discards all accumulated progress
`TakeAdsIngestionOrchestrator.ts:143-152` — watermark is persisted once, after the page loop. If page N throws (retries exhausted / 5xx), pages 1…N-1 are thrown away and redone next run. Correctness holds (everything is idempotent) but throughput degrades and a persistently-failing page stalls progress.
**Fix:** checkpoint the watermark after each successful page inside the loop (the `GREATEST` upsert keeps it monotonic). Pairs naturally with the H-1 scalar refactor.

### M-2 · Weak validation at the external (TakeAds) boundary
`TakeAdsClient.ts` (pre-existing, out of strict scope) uses `ky.json<T>()` — a cast, not a runtime parse. Consequences land in *this* code: a stringy `orderAmount` silently routes a real SALE to the custom path (lost revenue); a `null` `actionId` yields `externalId="takeads:null"` (poisoned idempotency key); an out-of-range `orderAmount` flows straight into reward pricing (only a lower bound is checked). Security flagged unbounded amount + unvalidated currency as fund-safety items.
**Fix (scoped to this PR):** in `processAction`, guard `actionId` non-empty + length-bounded; in `isRewardablePurchase`, add a sane upper bound on `orderAmount` and validate `currencyCode` against a supported-fiat allowlist (not just `!!`). Ideally add a Zod parse in `TakeAdsClient.getActions` (separate, since that file predates these commits).

### M-3 · `orderAmount` currency-unit assumption is unverified
`TakeAdsIngestionOrchestrator.ts:211` — `totalPrice: String(action.orderAmount)`. If TakeAds reports minor units (cents) and downstream pricing assumes major units, every reward is 100× off. Tests use round numbers (`100`) that wouldn't expose it.
**Fix:** confirm the unit in the TakeAds Stats API docs, document the assumption inline, and add a normalization step if needed. **Action item, not necessarily a code change yet.**

### M-4 · The `newInteraction` emit (custom path) is untested
`TakeAdsIngestionOrchestrator.test.ts` mocks `eventEmitter.emit` with an anonymous `vi.fn()` the test can't reach. The emit is what wakes the reward cron for custom interactions; if it regresses, custom events pile up unprocessed. Sibling tests (`SettlementOrchestrator.test.ts`) use `vi.hoisted` to capture it.
**Fix:** capture via `vi.hoisted`, assert `emit("newInteraction")` in the custom-path test, `mockClear()` in `beforeEach`.

---

## LOW (cheap wins)

- **L-1 `ActionCounts` duplicates `IngestionSummary`** → `type ActionCounts = Omit<IngestionSummary, "pages" | "newWatermark">` (compiler-enforced consistency). *(Simplicity-3, Maintainability-2)*
- **L-2 `externalId` recomputed** in `recordCustomInteraction` instead of being passed in — divergence risk if the `takeads:` prefix ever changes. Pass it as a param. *(Maintainability-1)*
- **L-3 `isRewardablePurchase` should be a type predicate** `action is TakeAdsAction & { type: "SALE" }` — one word, zero runtime cost, gives downstream narrowing. *(Kieran-2)*
- **L-4 `watermarkConserved` flag is ambiguous** — `newWatermark === null` conflates "empty run", "all-skipped", and "all-failed". Rename to `watermarkAdvanced: newWatermark !== null` and/or add a distinct all-skipped signal. *(Maintainability, Reliability, Correctness all flagged)*
- **L-5 Deadline checked per-page only** — one 500-action page can overrun `RUN_BUDGET_MS`. Check the deadline between actions too. *(Reliability-3)*
- **L-6 No numeric metrics** — alerting is limited to the `warn` log. Consider emitting counters for `errors`/`skipped`. *(Reliability-8; optional)*

## NIT
- Test `#7` is physically after `#11` — reorder. (Flagged by ~6 reviewers.)
- Test `#3` (CANCELED) doesn't assert `summary.processed === 1`.
- Advisory-lock key `0xaff111` is a bare magic number — a small `advisoryLockKeys.ts` registry would prevent future collisions.
- `orderDate` isn't date-validated like `updatedAt` (stored verbatim); `String(orderAmount)` vs `toFixed(2)` for money.

---

## Adjudication — reviewer claims I am NOT actioning

- **"Drop `actionsClientFactory`, inject the client directly" (Simplicity-2): REJECTED.** The factory is deliberate: `() => getTakeAdsClient()` defers construction so the client is **never** built in environments without `TAKEADS_API_KEY` (the cron guards on the key before first call). Direct injection would eager-construct at module load everywhere. The standards reviewer independently confirmed the lazy factory is correct. *(Verified in `context.ts:125`.)*
- **Full `CustomPayload` discriminated-union refactor in `domain/rewards/types` (Kieran-1): OUT OF SCOPE / over-built.** Touches a shared pre-existing type; heavier than warranted. A local typed payload + the L-3 type guard captures most of the value. Revisit if/when a second `customType` producer appears.
- **Per-env cron config constant (Patterns-4): SKIP.** Sibling jobs (`notifications`, `pairing`) also hardcode their cron pattern; this is not an established standard.
- **Drop `PAGE_CAP` / `RUN_BUDGET_MS` as speculative (Simplicity-4): KEEP.** They are cheap safety rails on an unbounded external feed; the H-1 scalar refactor removes the only real cost (the arrays).
- **Return-value composition for `processAction` (multiple): NICE-TO-HAVE, deferred.** Mutable-accumulator is used by sibling orchestrators too; not worth the churn now beyond what H-1/H-2 already touch.

## Accepted risks (documented, low priority)
- **Invalid-`updatedAt` actions are dropped** (logged at `error`, counted) rather than freezing the cursor — intentional: an unparseable instant can't be placed on the timeline, and freezing on a permanently-malformed record would stall forever. Rare data anomaly.
- **`updatedAtFrom` is inclusive** → the boundary action is refetched each run. Harmless: all writes are idempotent (1 extra upsert/hr). Document it.

---

## Recommended fix plan

1. **Must-fix (this PR):** H-1 (scalar watermark + delete `computeWatermark`), H-2 (advance cursor past skipped). Add the two missing tests.
2. **Should-fix (this PR or fast-follow):** M-1 (per-page checkpoint), M-2 (boundary guards: actionId/amount-bound/currency-allowlist), M-4 (emit test). M-3 is a **doc/verification** action on the TakeAds unit.
3. **Easy wins:** L-1, L-2, L-3, L-4, plus the NIT test reorder/assertion.
4. **Defer:** L-5/L-6, lock-key registry, Zod boundary parse in `TakeAdsClient` (separate change), payload-type refactor.
