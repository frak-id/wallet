# Billing Branch Audit — `feat/billing`

Scope: the 10 billing commits (`8cda69792..20bfefdb0`), ~44 files / ~7k LoC:
backend billing domain + orchestrators + admin/merchant routes, and the
business-app billing settings UI.

Status legend: 🔴 must fix · 🟠 should fix · 🟡 minor / deferred.

> **Resolution status:** all 🔴 and 🟠 findings below were fixed on this branch
> (commit following this audit). Remaining open items are the 🟡 entries
> explicitly marked *deferred*: `voidedBy` column (DB-team migration),
> nullable `currency` for monthly bills (schema change), `GET /documents`
> pagination, and the session-macro/double-JWT simplifications.

---

## 1. Latent bugs

### 1.1 🔴 Withdraw `distributedRatio` mixes currencies
`BillingOrchestrator.createWithdraw` calls
`AssetLogRepository.sumSettledAmountSince(merchantId, date)`, which sums
settled rewards across **all tokens** (no `tokenAddress` filter). That total
is divided by the linked deposit's `netAmount` (single currency). For a
merchant with e.g. EURe + USDC activity, USDC rewards inflate the ratio of a
EURe withdraw → under-restituted VAT/fee on a legal document.

**Fix:** use the in-Postgres asset conversion pattern already used elsewhere
(`orchestration/campaigns/rewards.ts` → `buildRewardsExpression`): a SQL
`CASE` over token addresses × spot prices so rewards in other stablecoins are
converted into the linked deposit's currency before summing. Same-token
rewards must count 1:1 exactly (normalise by the deposit token's own price);
unpriced tokens contribute 0.

### 1.2 🔴 Merchant-edited accounting fields silently dropped
`billingAccounting.ts` allowlists only contact fields
(`MERCHANT_EDITABLE_FIELDS`) for non-platform-admins, but `BillingInfoSheet`
requires **vatNumber** and **country** (both `rules: required`). A merchant
fills them in, gets a 204, and the values were never persisted — no error, no
feedback — and `country` drives VAT applicability.

**Fix:** accept those fields from merchants (vatNumber, country) and surface
them on the generated PDF buyer block (VAT number already drawn; add
country).

### 1.3 🔴 Voiding a deposit corrupts dependent documents
`voidDocument` has no handling for non-voided withdraws linking the deposit,
nor for monthly bills that folded it into their ledger. The ledger
aggregation then excludes the voided deposit but still counts the withdraw's
`bankSent` → permanently skewed monthly ledger; the withdraw's restitution
source disappears from the audit trail.

**Fix:** on voiding a deposit, cascade to documents generated after it:
- void the non-voided withdraws linked to it;
- for monthly bills whose period covers/postdates the deposit, only clear the
  cached PDF (delete stored object + reset `pdfStorageKey`/`pdfGeneratedAt`)
  so the next access regenerates the bill from current data.

### 1.4 🔴 Monthly-bill PDF failure is unrecoverable
PDF render/upload failure is tolerated by design, but
`BillingOrchestrator.regeneratePdf` early-returns for `monthly_bill` and
`MonthlyBillOrchestrator` has no regenerate path. Re-generating the bill
throws `MonthlyBillAlreadyExistsError` → a monthly bill whose PDF failed once
can never get a PDF.

**Fix:** PDF generation failure must never be a hard blocker. Add a
monthly-bill regeneration path (recomputes details for the stored period,
re-renders, re-uploads) and retry regeneration lazily on the next PDF
download when `pdfStorageKey` is missing (deposit/withdraw too).

### 1.5 🟠 December monthly bill gets next year's reference
`documentDate = periodEnd` (first instant of the *next* month) +
`create()` bucketing the reference counter by `documentDate.getUTCFullYear()`
→ a 2026-12 bill is referenced `BILL-2027-0001` and sorts/filters into 2027.

**Fix:** set `documentDate` to the last instant of the period
(`periodEnd − 1ms`) so both the reference year and date-range filters stay in
the billed year.

### 1.6 🟠 `sanitizeForWinAnsi` strips `€` despite claiming to keep it
`BillingPdfService` keeps only code points ≤ 0xFF; `€` (U+20AC) and `…`
(U+2026) are WinAnsi-1252-encodable but get replaced with `?` — on money
documents. **Fix:** whitelist the WinAnsi-1252 extras (0x80–0x9F mapping).

### 1.7 🟠 `drawPartyBlocks` can overlap subsequent sections
The comment says "continue below whichever block is taller" but the code
resumes from where the **right** (buyer) block ended. A short buyer block +
tall seller block → later sections overwrite seller lines. **Fix:** track
`min(leftY, rightY)`.

### 1.8 🟠 Annex fiat rows can disagree with frozen totals
`MonthlyBillOrchestrator.buildAnnexData` computes `fiatTotals` from one price
map; `generateAndStorePdf` **rebuilds a fresh price map**. If the 20-min
price cache expires in between, PDF annex rows won't sum to the frozen
`fiatTotals`. **Fix:** thread the price map from `buildAnnexData` into the
PDF step (also removes the duplicated fetch).

---

## 2. Deduplication

- 🟠 `StablecoinSchema` defined identically 3× (`billing.ts`,
  `domain/billing/schemas/index.ts`, `funding.ts`). Export once from the
  domain schema.
- 🟠 Route body→input mapping + withdraw error-mapping `try/catch`
  copy-pasted between POST/PUT deposits and POST/PUT withdrawals in
  `billing.ts`. Extract `toDepositInput` / `toWithdrawInput` /
  `mapWithdrawError` helpers.
- 🟠 `documentsQueryKey` defined in both `useBillingInfo.ts` and
  `useBillingAdmin.ts` — one drifting silently breaks invalidation. Share it.
- 🟡 `DECIMAL_PATTERN` duplicated in `AddDepositSheet` and
  `AddWithdrawSheet`.
- 🟠 `maskIban` exists FE + BE with *different* outputs (`FR76 …` vs
  `FR …`): the backend re-masking an already-masked value degrades it (drops
  the check digits). Make the backend a no-op on already-masked input (align
  formats).
- 🟡 Price-map fetch duplication in `MonthlyBillOrchestrator` — resolved by
  fix 1.8.

## 3. Simplification

- 🟠 `aggregateDepositWithdrawByCurrency` sums `details->>'bankSent'` for
  withdraws, but `createWithdraw` already stores `netAmount = bankSent` as a
  column. `SUM(net_amount) FILTER (WHERE kind='withdraw')` is simpler, faster
  and jsonb-shape-independent.
- 🟡 Each admin route re-checks `if (!businessSession) return 401` although
  `platformAdminAuthenticated` already gates it (needed only to read
  `wallet`). Acceptable; a session-narrowing macro would remove ~5 copies.
- 🟡 Double JWT verify per admin request (guard + `businessSessionContext`).
  Minor; acceptable for v1.

## 4. Standards / best practices

- 🟡 No `voidedBy` audit trail on void (a destructive action on a
  10-year-retention financial document). **Deferred**: requires a DB-team
  migration (new column).
- 🟠 Billing route ids validated as bare `t.String()` while columns are
  `uuid` — malformed ids surface as Postgres 500s. Use uuid-format params on
  the billing routes.
- 🟠 `txHash` cast to `` `0x${string}` `` without validation in both admin
  sheets — backend rejects it with a generic error. Add an inline hex pattern
  rule.
- 🟡 `GET /documents` unpaginated — fine for v1 volume, revisit later.
- 🟡 `BillingStorageRepository` hardcodes `region: "europe-west1"` — read
  from env with that default.
- 🟡 `monthly_bill.currency = currencies[0] ?? "eure"` stores an arbitrary
  currency on a multi-currency document. **Deferred**: making it nullable is
  a schema change.

## 5. Performance (minor)

- 🟡 `MonthlyBillOrchestrator` fetches the merchant twice per generation;
  each create ends with an extra `findById` round-trip. Thread loaded rows
  through where trivial.
- 🟡 Withdraw sums via jsonb cast prevent index-only aggregation — resolved
  by the §3 simplification.
- 🟡 Prices fetched with `Promise.all` over a mutex-serialised
  `getTokenPrice` — effectively sequential; fine given the LRU cache.

## 6. What's good

Money math via decimal.js strings throughout; merchant-scoped IDOR-safe
queries; counter-table reference allocation inside the insert transaction;
`isAddressEqual` for DB-sourced addresses; write-once PDF/void guards; clean
separation between the read-only platform-admin bypass and the mutation
guard. Well documented end to end.
