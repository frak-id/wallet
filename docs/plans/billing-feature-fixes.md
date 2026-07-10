# Fix plan — billing feature (deferred from walletless-auth branch audit)

> Findings against merge-base `03009a20`, scoped to the billing domain/orchestration/UI that
> rode along on `feat/business-walletless-auth`. Auth-surface fixes live in
> `docs/plans/business-auth-fixes.md`. None of these block the auth merge; the two "major"
> items should be scheduled before billing sees real volume.

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

### B7 · PdfDownloadButton auth-header duplication
`BillingTable/index.tsx:181-207` hand-rolls the `x-business-auth` header and bypasses
`stepUpAwareFetch`. Fix tracked as item 2.10 in the auth plan (shared helper) — referenced
here because the touched file is billing UI.

## Related (campaigns edit, same branch)

### B8 · `getCapPeriod` unsound cast
`apps/business/src/module/campaigns/utils/capPeriods.ts:14-17` — accepts `string`, casts
`as BudgetType`, can return `undefined` while typed `number | null`; flows into
`durationInSeconds` submitted by `ConfigTab`'s BudgetEditor. Narrow the param to
`BudgetType | undefined` (all call sites comply) and drop the cast.

## Suggested order

1. B3 (standards, trivial) — with the auth branch.
2. B1 comment (with the auth branch); B1 real fix + B2 before billing GA / first
   high-volume merchant month.
3. B4, B5, B8 — one small cleanup PR.
4. B6 — refactor PR when billing UI is next touched.
