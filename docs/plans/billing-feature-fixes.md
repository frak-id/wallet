# Fix plan — billing feature (deferred from walletless-auth branch audit)

> Findings against merge-base `03009a20`, scoped to the billing domain/orchestration/UI that
> rode along on `feat/business-walletless-auth`. Auth-surface fixes live in
> `docs/plans/business-auth-fixes.md`. None of these block the auth merge; the two "major"
> items should be scheduled before billing sees real volume.
>
> **Re-audit @ `b559ef3e9`:** full pass over backend (schema, repositories, both
> orchestrators, computation service, PDF layer, routes, cron) and frontend module.
> B1–B6 and B8 still open — B1's agreed interim `// PERF:` comment was never added.
> B7 is fixed. New findings appended as B9–B18.

## Major

### B1 · Monthly-bill annex loads every settled asset log into memory, unbounded
`domain/rewards/repositories/AssetLogRepository.ts` (`findByMerchantAndDateRange` — `SELECT *`,
no LIMIT) × `orchestration/billing/MonthlyBillOrchestrator.ts` (`buildAnnexData`).
Called per (merchant, month) by `generateMonthlyBill`, `regeneratePdf`, and the
`backfillAllMerchantBills` cron (up to `MAX_BACKFILL_MONTHS = 600` × all merchants in one run).
Fix: push fiat totals into a grouped SQL aggregation (pattern: `sumSettledByToken`), select
only the annex columns (`amount`, `tokenAddress`, `settledAt`, `onchainTxHash`), add a row cap
per annex. **Interim action on the auth branch: add a `// PERF:` comment on
`findByMerchantAndDateRange` + `buildAnnexData` pointing at this plan (agreed).**

### B2 · `GET /merchant/:id/documents` unbounded listing
`domain/billing/repositories/BillingDocumentRepository.ts` (`findByMerchant`) +
`api/business/merchant/billingDocuments.ts`. 10-year retention, no pagination — grows forever.
Fix: `limit`/`cursor` (or default date window) in repo + route query schema + frontend
`useBillingInfo` pagination.

## Minor

### B3 · `biome-ignore` non-null assertion in MonthlyBillOrchestrator
`MonthlyBillOrchestrator.ts:779` — `settledAt!` behind the branch's only `biome-ignore`
(house rule: none allowed). Replace the `.filter().map()` with a narrowing `.flatMap()` that
returns `[]` for rows without `settledAt`/`tokenAddress`. Quick fix — could land with the
auth branch since it's a standards violation, not a billing behavior change.

### B4 · Cross-orchestrator import contradicts its own docstring
`MonthlyBillOrchestrator.ts:29` imports `buildPdfBuyer` from `./BillingOrchestrator` while
`BillingOrchestrator`'s docstring says "neither calls the other". Move `buildPdfBuyer` to a
shared module (e.g. `orchestration/billing/shared.ts` or `domain/billing/schemas/pdfBuyer.ts`).

### B5 · `groupRewards` computed twice per monthly-bill PDF render
`domain/billing/services/pdf/MonthlyBillDocument.ts` — `drawRewardTable` and
`drawTvaAndRecap` each call `groupRewards(annexRows)`. Compute once in the render entry point,
pass to both.

### B6 · AddDepositSheet / AddWithdrawSheet ~85% duplicated
`apps/business/src/module/settings/billing/AddDepositSheet/index.tsx` (~640 lines) vs
`AddWithdrawSheet/index.tsx` (~440): identical sheet scaffolding, discard-guard wiring,
footer, and byte-identical `documentDate`/`txHash`/`note` field blocks. Extract a shared
`AdminBillingSheetShell` + `DocumentDateField`/`TxHashField`/`NoteField`.

### B7 · PdfDownloadButton auth-header duplication — ✅ FIXED
`BillingTable/index.tsx` now routes the PDF download through `businessAuthHeaders()` +
`stepUpAwareFetch` from `@/api/backendClient`. Residual nit folded into B17 (it still
re-derives `process.env.BACKEND_URL` instead of importing `backendBaseUrl`).

## Related (campaigns edit, same branch)

### B8 · `getCapPeriod` unsound cast
`apps/business/src/module/campaigns/utils/capPeriods.ts:14-17` — accepts `string`, casts
`as BudgetType`, can return `undefined` while typed `number | null`; flows into
`durationInSeconds` submitted by `ConfigTab`'s BudgetEditor. Narrow the param to
`BudgetType | undefined` (all call sites comply) and drop the cast.

## New findings (re-audit @ `b559ef3e9`)

### Major

### B9 · Multi-currency monthly bill produces wrong invoice totals
`MonthlyBillOrchestrator.computeBillData` sums `rewardBaseAmount` across ALL settled
reward tokens — different stablecoins AND non-stablecoin tokens — as if they were one
currency, then freezes it as `grossAmount`/`netAmount` labeled `currencies[0] ?? "eure"`.
The PDF compounds it: `MonthlyBillDocument.drawTvaAndRecap` sums `totalHt` across every
`groupRewards` group regardless of `group.currency` and formats the total in
`annexRows[0]`'s currency. "Bills are single-currency in practice" is only a comment —
nothing enforces it, and the moment one merchant rewards in two stablecoins (or a legacy
non-stablecoin token settles in the period) a legal document carries a cross-currency sum.
Fix: compute totals per currency (reuse the per-currency grouping the ledgers already do);
non-stablecoin tokens must be excluded from `rewardBaseAmount` the same way
`resolveLedgerCurrencies` excludes them from ledgers. At minimum, log loudly + pick only
the document currency's rewards until per-currency totals exist.

### B10 · `reissueDeposit` silently voids linked withdraws without re-emitting them
`PUT /deposits/:id` → `reissueDeposit` → `voidDocument(…, "deposit")` →
`cascadeDepositVoid` voids every non-voided withdraw linking the deposit. The re-emit
creates only the corrected deposit — the withdraws are gone, unmentioned by
`reissueDeposit`'s docstring, the route response, or the admin UI. Correcting a typo on a
deposit destroys its restitution documents. Fix: reject reissue with 409 when non-voided
linked withdraws exist (admin must void/reissue those explicitly), or carry them over;
either way document the behavior.

### Minor

### B11 · PDF-invalidation order can strand a dangling `pdfStorageKey` → download 500
`BillingOrchestrator.invalidateMonthlyBillsCovering` deletes the stored object FIRST, then
`clearPdf`. If the delete succeeds and `clearPdf` fails, the row still points at a deleted
object: the download route sees `pdfStorageKey`, skips regeneration, and
`billingStorage.read` throws an unhandled 500 — until a later create/void happens to retry
the invalidation. Fix: swap the order (`clearPdf` first, storage delete after — an orphaned
object is harmless, a dangling pointer isn't) and make the download route treat a failed
`read` as "missing" (regenerate or 404) instead of 500.

### B12 · BillingInfoSheet discards merchant edits on failed save
`BillingInfoSheet.onSubmit` calls `onSave(next)` (a fire-and-forget `mutation.mutate`),
then immediately `form.reset(next)` + `setOpen(false)`. A failed PUT closes the sheet,
shows nothing, and the merchant's edits are lost. `useBillingInfo` already exposes
`isSaving` (unused) and the mutation error (unexposed). Fix: keep the sheet open with a
loading state and close in the mutation's `onSuccess`, surfacing the error inline —
exactly the pattern `AddDepositSheet`/`AddWithdrawSheet` already implement.

### B13 · `rewardBaseAmount` recomputed from per-row annex logs it doesn't need
`computeBillData` filters + reduces `annexData.assetLogs` to get `rewardBaseAmount`, but
`rewardedInPeriodRows` (grouped SQL sums with the *identical* filter set: settled,
`tokenAddress IS NOT NULL`, `[periodStart, periodEnd)`) is already in scope from the same
`Promise.all`. Summing those totals with decimal.js gives the same number without touching
row data — and once B1 moves `fiatTotals`/`rowCount` into SQL, the data-only cron path
(`renderPdf: false`, the bulk of `backfillAllMerchantBills`' work) needs no per-row fetch
at all. (Interacts with B9: the per-currency version should also come from these rows.)

### B14 · Dead re-fetch after create in BillingOrchestrator
`createDeposit`/`createWithdraw` end with
`(await this.billingDocuments.findById(merchantId, document.id)) ?? document` — but
nothing mutates the just-created row between `create` and the re-fetch (PDF is lazy,
invalidation only touches monthly bills). Pure wasted round-trip; return `document`.

### B15 · `DecimalStringSchema` accepts unbounded digit strings
`api/business/merchant/billing.ts` — `t.String({ pattern: "^\\d+(\\.\\d+)?$" })` has no
length cap. A thousand-digit gross amount passes validation, survives decimal.js, and
blows up at insert time on `numeric(36,18)` as a 500. Add `maxLength` (~40) or bound the
pattern (`^\d{1,18}(\.\d{1,18})?$`). Same file: `CreateWithdrawBodySchema.linkedDepositId`
is `t.String()` without `format: "uuid"` — a malformed id reaches Postgres as a 500
instead of 404ing at the boundary (the param schemas already get this right).

### B16 · Withdraws rendered as "Deposit" rows in the billing table
`useBillingInfo.toBillingEntry` maps `withdraw` → `kind: "deposit"`, so a withdraw shows
under the Deposit tab with the "Deposit" badge and a positive amount — indistinguishable
from an actual deposit for the merchant reading their history. Add a third entry kind (or
at least a distinct tag/sign) — `rawKind` is already on `BillingEntry`.

### B17 · Frontend housekeeping / duplication grab-bag
- `DownloadPdfButton` re-derives `process.env.BACKEND_URL ?? "https://localhost:3030"`;
  `backendBaseUrl` is already exported from `@/api/backendClient`.
- `DECIMAL_PATTERN`/`TX_HASH_PATTERN` live in `queryKeys.ts` — wrong home; move to a
  `validation.ts` (or `types.ts`).
- `BillingTable` builds `new Intl.NumberFormat`/`DateTimeFormat` inline while
  `AddDepositSheet` uses the shared `getNumberFormat` intl cache — pick one.
- `AddDepositSheet`'s `STABLECOINS` const and `useBillingAdmin`'s hand-written
  `CreateDepositInput`/`CreateWithdrawInput` duplicate backend types that Eden/`Stablecoin`
  from `@frak-labs/app-essentials` already provide — drift risk.

### B18 · AddDepositSheet `defaultCountry` captured before accounting info loads
`BillingAdminPanel` passes `info?.country`, which arrives async; `useForm` captures
`defaultValues` on first render, so the country default is almost always empty in
practice. Either `form.reset` when `defaultCountry` resolves (if pristine) or drop the
prop. Also: `initialValues` is rebuilt every render and closed over by the discard guard —
harmless today, but hoist it.

## Suggested order

1. B3 (standards, trivial) — with the auth branch.
2. B9 + B10 (money-correctness / data-destruction) — next billing PR, before any
   multi-currency merchant or admin correction flow is exercised.
3. B1 real fix + B13 + B2 before billing GA / first high-volume merchant month
   (B13 falls out of B1's SQL-aggregation work).
4. B11, B12, B15, B16 — one robustness PR (backend order-of-ops + schema cap, frontend
   save/labeling fixes).
5. B4, B5, B8, B14 — one small cleanup PR.
6. B6 + B17 + B18 — refactor PR when billing UI is next touched.
