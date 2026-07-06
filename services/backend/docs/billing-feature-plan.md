# Billing Feature — Implementation Plan

> Status: **Proposal / reviewed** (feasibility, scope, security, coherence reviews incorporated — see §12 changelog).
> Scope: `services/backend` (new `billing` domain + API) wired to the existing `apps/business` billing UI stub.

## 1. Goal

Add merchant billing support to the backend, producing three kinds of downloadable PDF documents:

| Document (UI label) | `kind` enum | Who creates | How | Reverses |
|---|---|---|---|---|
| **Deposit note** | `deposit` | Frak platform admin (manual) | CRUD, VAT + Frak fee auto-computed | — |
| **Withdraw bill** | `withdraw` | Frak platform admin (manual) | CRUD, pro-rata restitution of VAT + fees | a `deposit` |
| **Monthly bill** | `monthly_bill` | Auto-generated (admin-triggered) | From `asset_logs` reward ledger + `deposit`/`withdraw` rows | — |

Merchant owners/admins can **view and download** their own documents in `Settings → Billing`. They cannot create/edit deposit or withdraw records.

### Terminology (canonical — used everywhere below)
- The `kind` enum values are exactly `deposit`, `withdraw`, `monthly_bill`. These strings are used verbatim in the DB, S3 keys, and API paths.
- "Deposit note" / "withdraw bill" / "monthly bill" are the human/UI labels only.
- **VAT** is used for all code/columns (`vatRate`, `vatAmount`) — matches the existing frontend `vatNumber` field. "TVA" (French) = VAT; used only in prose when quoting the spec.
- API path segments and reference prefixes: `deposit` → `DEP-`, `withdraw` → `WDR-`, `monthly_bill` → `BILL-`.

The `apps/business` billing UI already exists as an in-memory stub (`module/settings/billing/`) with explicit `TODO` comments to wire an Eden Treaty backend contract. This plan defines that contract.

## 2. Current state (verified in codebase)

### What exists
- **Merchant model** — `src/domain/merchant/db/schema.ts`. `merchantsTable` has jsonb config columns (`explorerConfig`, `sdkConfig`) but **no accounting/company/VAT/country fields**.
- **Platform admin vs merchant admin** — two independent systems:
  - `PlatformAdminService.isPlatformAdmin(wallet)` (`src/domain/auth/services/PlatformAdminService.ts`) — global Frak-team allow-list from `PLATFORM_ADMIN_WALLETS` env. **This is our "sys admin".**
  - `MerchantAuthorizationService.checkAccess(merchantId, wallet)` (`src/domain/merchant/services/MerchantAuthorizationService.ts`) — per-merchant `owner`/`admin`/`none`.
- **Business auth middleware** — `src/api/business/middleware/session.ts`. Business JWT path exposes `hasMerchantAccess(merchantId)`: merchant owner/admin get full access; platform admins get **read-only** cross-merchant access on **safe methods only** (GET/HEAD). The **Shopify session path** authenticates by shop domain (no wallet) and never grants platform-admin status.
- **Campaign bank** — `src/domain/campaign-bank/`. Per-merchant on-chain bank (`merchant.bankAddress`, nullable). Deposits/withdrawals happen **on-chain from the merchant wallet** (see `apps/business/.../useWithdrawFromBank.ts` building `campaignBankAbi.withdraw` calldata directly) — the backend only *reads* balances (live multicall, LRU-cached) and manages allowances/roles. **No fiat ledger, no balance history is persisted.**
- **Reward ledger** — `asset_logs` table (`src/domain/rewards/db/schema.ts:71`). Per-reward record: `merchantId` (indexed), `amount` `numeric(36,18)`, `tokenAddress`, `status` (`pending|processing|settled|cancelled|expired|bank_depleted`), `createdAt`, `settledAt`, `onchainTxHash`. `RewardHistoryService.buildRewardItems()` enriches rows with token symbol/decimals + eur/usd/gbp fiat values (currently wallet-side history only).
- **S3 / RustFS storage** — `src/domain/media/repositories/MediaStorageRepository.ts` uses Bun-native `S3Client` (`write`/`file`/`delete`/`list` only — **no presign usage anywhere yet**). One public bucket `images-${stage}`, provisioned by `services/bootstrap/src/ensure-buckets.ts` (idempotent, array-based). Public URLs are `RUSTFS_CDN_BASE_URL` string concatenation; the `S3Client` itself is built with the internal `RUSTFS_ENDPOINT`.
- **Stablecoins / currency** — `packages/app-essentials/.../addresses.ts`: `currentStablecoins` maps `eure/gbpe/usde/usdc` → addresses. Currency = which pegged stablecoin. **No fiat conversion or tax logic tied to it.**
- **Pricing** — `src/infrastructure/pricing/PricingRepository.ts` (`getTokenPrice → {eur,usd,gbp}`, **spot only**, no historical snapshots) + `FxRateRepository` (ECB FX).
- **KMS / key management** — `src/infrastructure/keys/` (used for admin wallets) — available for application-level field encryption.

### What is entirely missing (net-new)
1. No billing domain, table, repository, service, or route.
2. **No PDF generation library** anywhere in the monorepo.
3. **No merchant company/VAT/country data** persisted.
4. **No VAT-rate logic** and **no bank balance history**.

## 3. Design decisions

### 3.1 Merchant accounting info → jsonb column on `merchantsTable`
Add a nullable `accountingInfo jsonb` column, mirroring `explorerConfig`/`sdkConfig`. Shape matches the frontend `BillingInfo`:

```ts
type MerchantAccountingInfo = {
  companyName: string;
  vatNumber: string;        // stored as-is; format-checked (regex) but no VIES validation in v1
  streetAddress: string;
  city: string;
  postalCode: string;
  country: string;          // ISO-3166 alpha-2 — FR triggers VAT (§4); admin-writable only
  billingEmail: string;
};
```

**Rationale:** low-churn, 1:1 with merchant, always co-read → a column is idiomatic (a sibling table is only justified for high-churn/cron data). Invalidate the `MerchantRepository` LRU cache on write, following exactly how `updateSdkConfig`/`updateExplorer` already do it.

**Field-level write authorization (resolves security GAP-13 / coherence §2.5):** `country` and `vatNumber` are **tax-relevant** and writable **only by a platform admin**. A merchant owner/admin may edit the contact fields (`companyName`, address, `billingEmail`). Enforced by the service stripping tax fields from a non-admin payload (single endpoint, role-aware handler — see §5).

> **Alternative considered:** dedicated `merchant_billing_profile` table. Rejected for v1 (small, always co-read). Revisit if profiles need history/versioning.

### 3.2 One `billing_documents` table (discriminated)

```ts
// src/domain/billing/db/schema.ts  (NEW — migration written by the DB team)
export const billingDocumentsTable = pgTable("billing_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),        // FK → merchants.id (DB team adds constraint)
  kind: text("kind").$type<"deposit" | "withdraw" | "monthly_bill">().notNull(),

  // Human-facing reference (DEP-/WDR-/BILL- + year + counter). Unique PER MERCHANT.
  reference: text("reference").notNull(),

  // Event / period
  documentDate: timestamp("document_date").notNull(),
  periodStart: timestamp("period_start"),           // monthly_bill only
  periodEnd: timestamp("period_end"),               // monthly_bill only

  // Currency: the stablecoin the campaign bank holds (eure/gbpe/usde/usdc).
  currency: text("currency").$type<Stablecoin>().notNull(),

  // Money — numeric(36,18) to match asset_logs token precision.
  // NOTE: Drizzle returns these as strings; money arithmetic uses decimal.js (see §4.1).
  // Only the two amounts the fiat ledger (§6.2) aggregates are columns; VAT / fee breakdown
  // is display-only and lives in `details` (frozen at issue time).
  grossAmount: numeric("gross_amount", { precision: 36, scale: 18 }),  // amount deposited / withdrawn
  netAmount:   numeric("net_amount",   { precision: 36, scale: 18 }),  // reaches/leaves the bank

  // On-chain / banking proof
  txHash: customHex("tx_hash"),

  // Withdraw → the deposit it reverses (restitution sources original fee/VAT). Nullable.
  linkedDepositId: uuid("linked_deposit_id"),       // self-FK → billing_documents.id

  details: jsonb("details").$type<BillingDocumentDetails>(),  // typed, see below

  // Stored PDF (see 3.3). Null until generated.
  pdfStorageKey: text("pdf_storage_key"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),

  // Author + soft delete (retention — §3.6)
  createdBy: customHex("created_by").$type<Address>(),  // platform-admin wallet; null for auto monthly
  voidedAt: timestamp("voided_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("billing_documents_merchant_idx").on(t.merchantId),
  index("billing_documents_merchant_kind_idx").on(t.merchantId, t.kind),
  unique("billing_documents_merchant_reference_uq").on(t.merchantId, t.reference),
  // Prevents duplicate monthly bills for the same merchant+period (partial unique — DB team):
  //   UNIQUE (merchant_id, period_start) WHERE kind = 'monthly_bill'
]);
```

**`details` jsonb — explicitly typed per kind (resolves coherence §2.3, feasibility §6.4):**
```ts
type BillingDocumentDetails =
  | {
      kind: "deposit";
      vatAmount: string;             // decimal string; 0 when country !== FR
      frakFeeAmount: string;
      paymentPlatform?: "shopify" | "stripe";
      note?: string;
    }
  | {
      kind: "withdraw";
      remainingBankAmount: string;
      distributedRatio: string;      // 0..1
      restitutedVat: string;
      restitutedFrakFee: string;
      bankSent: string;              // total sent to the destination account
      maskedIban: string;            // e.g. "FR76 **** **** **** 123" — never a full IBAN (§3.5)
      note?: string;
    }
  | {
      kind: "monthly_bill";
      // Frozen at generation time (spot-priced — §6.3). Per-currency because a merchant
      // may run multiple stablecoins; each entry is one currency ledger.
      ledgers: Array<{
        currency: Stablecoin;
        openingBalance: string;      // at periodStart
        closingBalance: string;      // at periodEnd
        totalDeposited: string;
        totalWithdrawn: string;
        totalRewarded: string;       // settled rewards in period
      }>;
      annexRowCount: number;         // full annex rows live in a separate query at render time
      fiatTotals: { eur: string; usd: string; gbp: string };
    };
```
The reward **annex** (per-line rewards) is **not** copied into `details` (could be hundreds of rows). It is re-queried at PDF render time and baked into the stored PDF; only aggregate/frozen totals live in `details`.

**Uniqueness (resolves scope §4.1 / coherence §3.1):** `reference` is unique **per merchant** (composite constraint). Counters are generated by a Postgres `SEQUENCE` per `(kind, year)` — avoids the `SELECT MAX() FOR UPDATE` race under concurrent admin creates (DB team owns the sequence DDL).

> **Monthly bill: persist (recommended, resolves §8.4).** Store a row per generated month so downloads are stable and fiat totals frozen (pricing is spot-only, §6.3). `periodStart/End` + partial-unique constraint prevent duplicates.

### 3.3 PDF storage → S3 / RustFS; served via **backend-proxied download** (not presigned URL)
Store `pdfStorageKey` in postgres; PDF bytes live in a **new private bucket** `billing-${stage}`.

- Add `{ name: \`billing-${stage}\`, publicRead: false }` to `ensure-buckets.ts` (`ensureBucket` already skips the public policy when `publicRead: false`). **Phase 0 verifies the bucket is not publicly readable after provisioning.**
- `BillingStorageRepository` mirrors `MediaStorageRepository` (Bun `S3Client`, same `RUSTFS_*` creds, internal endpoint): `upload(key, buffer)`, `read(key) → bytes`, `delete(key)`. Key scheme includes the document UUID to defeat enumeration: `` `${merchantId}/${kind}/${id}.pdf` ``.
- **Download is proxied through the authenticated backend endpoint** (`GET .../documents/:id/pdf` streams `application/pdf` bytes) rather than returning a presigned URL. Rationale (resolves security GAP-7/8/10 + feasibility §2.2):
  - No capability-token URL to leak/forward/log; every download re-checks auth + merchant ownership.
  - Avoids the internal-vs-public endpoint problem: Bun `S3Client.presign` signs against the **internal** `RUSTFS_ENDPOINT`, which is unresolvable from a browser; a proxy sidesteps this entirely (no new `RUSTFS_PUBLIC_ENDPOINT`, no bucket CORS).
  - Cost: PDFs stream through the backend. Documents are small (single-digit MB) and downloads are infrequent → acceptable.

> Presigned URLs remain a possible optimization later **if** a public RustFS endpoint is introduced; not needed for v1.

### 3.4 New `billing` domain + BFF route
Standard DDD layout (`AGENTS.md`):
```
src/domain/billing/
├── db/schema.ts                    # billing_documents (above)
├── repositories/
│   ├── BillingDocumentRepository.ts   # CRUD; ALL queries scoped by merchantId (§ security)
│   └── BillingStorageRepository.ts    # S3 PDF upload/read/delete
├── services/
│   ├── BillingComputationService.ts   # VAT + fee + restitution math (pure, decimal.js)
│   └── BillingPdfService.ts           # render a pre-assembled DTO → PDF buffer (NO cross-domain imports)
├── schemas/index.ts                # TypeBox request/response contracts
├── context.ts                      # BillingContext singletons
└── index.ts
```
Cross-domain reads (merchant accounting info, `asset_logs`, live bank balance) go through **`src/orchestration/billing/BillingOrchestrator.ts`** per the flow rules. `BillingPdfService` stays domain-pure: it receives a fully-assembled DTO from the orchestrator (resolves feasibility §6.1) and never imports other domains.

Route file `src/api/business/merchant/billing.ts`, mounted under the existing `/:merchantId` business BFF, split by audience (§5).

### 3.5 IBAN handling — masked only, no encryption/KMS
We never persist a full IBAN, so there's nothing sensitive to encrypt. The actual bank transfer is done manually by finance (who hold the full RIB out-of-band); the withdraw bill only needs a **masked reference** to identify the destination account.
- **Frontend** captures the IBAN split and immediately obfuscates the middle characters — the full value never leaves the browser. Only the masked form (`FR76 **** **** **** 123`) is sent.
- **Backend (double security)** re-masks defensively: any inbound IBAN-shaped string is normalized to keep only country code + last 3–4 digits before store, so even a client that sends more is truncated. Stored in `details.maskedIban` (withdraw only).
- **PDF** renders the masked value as-is. No plaintext IBAN anywhere in DB, logs, or PDF.

### 3.6 Retention & soft delete (resolves security GAP-14/15, scope §4.2)
Financial documents (esp. French 10-year retention): **no hard delete.**
- `DELETE` routes perform a **void** (set `voidedAt`); reads filter `voidedAt IS NULL` by default.
- Once a PDF is issued (`pdfGeneratedAt IS NOT NULL`), edits are blocked — issue a corrective document instead.
- `createdBy` records the issuing admin. (A dedicated `billing_document_changes` audit table is a fast-follow only if compliance later demands full change history — not v1.)

## 4. Fee / VAT / restitution math

`BillingComputationService` — **pure, unit-tested**; money math via `decimal.js` (Drizzle returns `numeric` as strings; avoids `parseFloat` precision loss on large amounts). Rules are fixed — no tax engine, no EU rate map:

**VAT — France only.** Frak is FR-based, so we only declare VAT when the merchant is French. For any other country we do **not** compute VAT (reverse-charge / the merchant's own obligation), and the bill carries a standard "VAT reverse-charged / not applicable" mention.
```
vatRate = country === "FR" ? 0.20 : 0
```

**Deposit note** — admin enters `grossAmount` (the amount the merchant deposited, VAT-inclusive) + `currency`:
```
vatAmount     = grossAmount * vatRate / (1 + vatRate)   // extracted from gross; 0 when non-FR
frakFeeAmount = (grossAmount - vatAmount) * 0.20         // Frak 20% cut on gross - VAT
netAmount     = grossAmount - vatAmount - frakFeeAmount  // reaches the campaign bank
```
`vatAmount` + `frakFeeAmount` are frozen into `details.kind==="deposit"`; `grossAmount`/`netAmount` are columns.

> Example (FR, gross 1200): vat = 200, feeBase = 1000, frakFee = 200, net to bank = 800.
> Example (non-FR, gross 1000): vat = 0, frakFee = 200, net to bank = 800.

**Withdraw bill** — admin enters remaining bank amount; requires `linkedDepositId` (§3.2) to source the original fee/VAT:
```
distributedRatio  = rewardsDistributedSinceDeposit / linkedDeposit.netAmount   // 0..1, from asset_logs
restitutedFrakFee = linkedDeposit.frakFeeAmount * (1 - distributedRatio)
restitutedVat     = linkedDeposit.vatAmount     * (1 - distributedRatio)
bankSent          = remainingBankAmount + restitutedFrakFee + restitutedVat
```
Breakdown persisted in `details.kind==="withdraw"`.

## 5. API surface

All under the business BFF (`x-business-auth` JWT), reusing `businessSessionContext`. **All `BillingDocumentRepository` queries from any route MUST include `WHERE merchant_id = :merchantId`**, and every by-id fetch asserts `doc.merchantId === :merchantId` (resolves security GAP-4/5/6 — prevents IDOR across merchants, for admins too).

### Merchant-facing (owner/admin; platform admin read-only via safe-method bypass)
- `GET  /:merchantId/billing/accounting` → accounting info
- `PUT  /:merchantId/billing/accounting` → upsert; **role-aware**: non-admin payloads have tax fields (`country`, `vatNumber`) stripped (§3.1)
- `GET  /:merchantId/billing/documents?kind=&from=&to=` → list (scoped, excludes voided)
- `GET  /:merchantId/billing/documents/:id/pdf` → streams `application/pdf` (proxied, §3.3)

### Admin-only — guarded by `platformAdminAuthenticated` (NOT `hasMerchantAccess`)
- `POST   /:merchantId/billing/deposits` → create deposit note (auto VAT + fee)
- `PUT    /:merchantId/billing/deposits/:id` (blocked once PDF issued → corrective doc)
- `DELETE /:merchantId/billing/deposits/:id` → **void**
- `POST   /:merchantId/billing/withdrawals` (requires `linkedDepositId`; auto restitution)
- `PUT    /:merchantId/billing/withdrawals/:id`
- `DELETE /:merchantId/billing/withdrawals/:id` → **void**
- `POST   /:merchantId/billing/monthly-bills` `{ month }` → generate + store (409 if exists)

**`platformAdminAuthenticated` guard contract (resolves security GAP-1/2/3):**
```
beforeHandle:
  if (!businessSession) return 401          // Shopify path has no wallet → rejected here
  if (!AuthContext.services.platformAdmin.isPlatformAdmin(businessSession.wallet)) return 403
```
Admin mutation routes use **only** this guard — never `hasMerchantAccess` (whose platform-admin bypass is read-only/safe-method and must not authorize mutations). Merchant ownership of `:id` is still asserted separately in the handler.

## 6. Monthly bill auto-generation

### 6.1 Reward annex — feasible now
Add `AssetLogRepository.findByMerchantAndDateRange(merchantId, start, end, { statuses })`. Filter `eq(merchantId)` + `between(settledAt, start, end)` — **`settledAt`, not `createdAt`** (only settled rewards were actually paid; resolves coherence §3.6). The join to `merchantsTable` in the existing `findDetailedByIdentityGroup` is redundant here (merchant is known) → a lighter query. Enrich via `RewardHistoryService.buildRewardItems()` for token symbol/decimals + fiat → annex rows `{ settledAt, amount, currency, fiatValue, status, txHash }`. (`purchaseAmounts`/`referrerPurchases` enrichment inputs are not meaningful at monthly aggregate level — pass empty; resolves feasibility §4.2.)

### 6.2 Before/after balance — derived fiat ledger (with disclosed limits)
No bank balance history is persisted. Derive **per merchant AND per currency** (never sum across stablecoins — resolves feasibility §3.2, coherence §5):
```
balanceAt(T, currency) =
    Σ deposit.netAmount   WHERE currency, documentDate < T, not voided
  − Σ withdraw.bankSent   WHERE currency, documentDate < T, not voided
  − Σ assetLog.amount     WHERE tokenForCurrency, status='settled', settledAt < T
```
`openingBalance = balanceAt(periodStart)`, `closingBalance = balanceAt(periodEnd)`. Only `status='settled'` counts; `cancelled`/`expired`/`pending` excluded (resolves feasibility §3.3/§3.4).

**Accuracy limitation (must be surfaced in product/UI — resolves feasibility §3.1):** this ledger is only as complete as the admin-entered deposits/withdrawals. On-chain movements not captured as `billing_documents` rows will skew it. Mitigation for v1: on generation, compute the derived closing balance **and** read the live on-chain balance (`CampaignBankRepository.getBankOnChainState`); if they diverge beyond a threshold, flag the bill for admin review rather than publishing silently. On-chain-accurate history (snapshot at settlement) is deferred (heavier — schema + settlement-path change).

### 6.3 Pricing caveat
`PricingRepository` is **spot only**. Freeze computed fiat totals into `details.fiatTotals` and the stored PDF at generation time; never recompute on re-download. (For stablecoins the spot error is ~1:1/negligible; material only for non-stablecoin tokens.)

### 6.4 Trigger & idempotency
Manual admin trigger for v1. `POST .../monthly-bills` is idempotent via the partial-unique `(merchant_id, period_start) WHERE kind='monthly_bill'` constraint → on duplicate, catch and return **409** (or the existing document), not 500. A generation mutex (row `pdfGeneratedAt` set transactionally, or a `generating` flag) prevents concurrent double-render (resolves security GAP-16/17).

> Scheduled monthly cron (`src/jobs/`, generate previous month for all merchants) is **explicit future work — out of v1 scope**.

## 7. PDF generation

No library exists — introduce one, **backend-side** (generation must be reproducible/authenticated).

**Recommendation: `pdf-lib` (pure JS, no React, no native modules).** Rationale (resolves feasibility §1):
- The production binary is built via `bun build --compile` (`build:binary`), which **cannot embed native `.node` modules** and does **not** apply `build.ts` externals. `@react-pdf/renderer` pulls in `react` + `react-reconciler` + a yoga layout module (WASM/native depending on version) → high risk of breaking the compiled binary. `pdf-lib` is dependency-light pure JS and embeds cleanly.
- Trade-off: `pdf-lib` is lower-level (manual layout) vs `@react-pdf/renderer`'s JSX. For three fixed invoice templates this is acceptable. Custom fonts via `@pdf-lib/fontkit`; fonts provisioned as embedded assets (`Bun.embeddedFiles`) or read from disk — **validated in the Phase 0 spike**.

> `@react-pdf/renderer` reconsidered only if `pdf-lib` layout ergonomics prove too costly **and** the spike proves it survives `bun build --compile`. `pdfkit` is the other pure-JS fallback.

`BillingPdfService` receives the assembled DTO (document row + accounting info + reward annex for monthly) and returns a Buffer → `BillingStorageRepository.upload`. Generation happens **at create/update/generate time**; downloads just stream stored bytes.

## 8. Open questions / decisions needed

1. **VAT & fee math (§4)** — *decided*: FR merchants only → 20% VAT extracted from gross; Frak fee = 20% of (gross − VAT); non-FR → no VAT (reverse-charge). Confirm with finance that (a) gross is treated as VAT-inclusive, and (b) non-FR really carries no VAT line.
3. **Merchant self-edit**: confirmed model — contact fields merchant-editable, tax fields admin-only (§3.1). Confirm acceptable.
4. **Persist monthly bills**: recommended = persist (§3.2/§6.3). Confirm.
5. **Currency vs bank fiat currency**: spec mentions "currency for the deposit on the bank" (fiat landed after off-ramp). **Deferred out of the schema for v1** (no `bankCurrency` column). If needed, add a typed ISO-4217 column later. Confirm not needed for v1 documents.
6. **Reference numbering**: confirmed per-merchant sequence via Postgres `SEQUENCE` per `(kind, year)` (§3.2). Confirm format `DEP-YYYY-NNNN` / `WDR-` / `BILL-`.
8. **Retention/immutability**: v1 = soft-delete/void + no edit after PDF issued (§3.6). Confirm this satisfies legal; decide if a full audit-history table is required for launch.
9. **Ledger accuracy**: is admin-entry-accurate fiat balance acceptable for the monthly bill, or is on-chain-accurate (settlement snapshot) required for launch? (§6.2)

## 9. Phased implementation

**Phase 0 — spike (de-risk, mandatory before Phase 1):**
- Confirm `pdf-lib` renders a one-page PDF **and survives `bun build --compile`** (native-module/font check). Decide library before any template work.
- Confirm the `billing-${stage}` private bucket provisions and is **not** publicly readable.
- Confirm the VAT/fee assumptions (§8.1) and ledger-accuracy expectation (§8.9) with finance.

**Phase 1 — data + storage:**
- Migration (DB team): `merchants.accountingInfo` jsonb; `billing_documents` table + composite/partial-unique constraints + FK + `SEQUENCE`s.
- `billing` domain skeleton (schema, repositories, context, index); `BillingStorageRepository` (upload/read/delete).
- `billing-${stage}` bucket in `ensure-buckets.ts`.
- Accounting-info get/upsert endpoint (role-aware field auth) + `MerchantRepository` cache invalidation.

**Phase 2 — deposit & withdraw (admin):**
- `BillingComputationService` (VAT + fee + restitution, decimal.js) with unit tests.
- `platformAdminAuthenticated` guard.
- Admin CRUD (create/edit-with-void-guard/void) + `linkedDepositId` wiring.
- `BillingPdfService` deposit/withdraw templates; backend IBAN re-masking.

**Phase 3 — monthly bill:**
- `AssetLogRepository.findByMerchantAndDateRange` (settled, date range) + `BillingOrchestrator` generator.
- Per-currency fiat-ledger before/after (§6.2) + live-balance divergence check + reward annex + frozen totals.
- Monthly-bill template + generation endpoint (409 on dup, generation mutex).

**Phase 4 — merchant read + frontend wiring:**
- Merchant list + proxied PDF download endpoints.
- Replace `apps/business/.../useBillingInfo.ts` stub with Eden Treaty calls; enable the disabled PDF download button in `BillingTable`; wire `BillingInfoSheet` to the accounting endpoint.
- Admin "Manage the Budget" → deposit/withdraw CRUD entry points in the business dashboard.

## 10. File-change summary

| Area | Change | Type |
|---|---|---|
| `src/domain/merchant/db/schema.ts` | `accountingInfo` jsonb column | modify |
| `src/domain/merchant/repositories/MerchantRepository.ts` | read/write accounting + cache invalidation | modify |
| `src/domain/billing/**` | new domain (schema, repos, services, schemas, context, index) | new |
| `src/orchestration/billing/BillingOrchestrator.ts` | cross-domain monthly-bill assembly + DTO for PDF | new |
| `src/domain/rewards/repositories/AssetLogRepository.ts` | `findByMerchantAndDateRange` (settled) | modify |
| `src/api/business/merchant/billing.ts` | BFF routes (admin + merchant), IDOR-scoped | new |
| `src/api/business/middleware/session.ts` | `platformAdminAuthenticated` guard | modify |
| `services/bootstrap/src/ensure-buckets.ts` | `billing-${stage}` private bucket | modify |
| `package.json` (backend) | add `pdf-lib` (+ `@pdf-lib/fontkit`) and `decimal.js` | modify |
| `apps/business/src/module/settings/billing/**` | replace stub with Eden Treaty calls; enable PDF download | modify |

> Migrations are **human-written by the DB team** (per `AGENTS.md`) — this plan defines schema intent (columns, constraints, sequences), not the migration SQL.

## 11. Requirement → design traceability

| Spec requirement | Covered by |
|---|---|
| Deposit note, admin-only, on a given merchant | §5 admin routes + `platformAdminAuthenticated` (§5) |
| Deposit fields (amount, VAT, fees, note, date, currency, platform, merchant, txHash, bank currency) | §3.2 columns (bank fiat currency deferred, §8.5) |
| Auto-compute VAT + Frak fee | §4 `BillingComputationService` |
| Admin flow: select merchant → Manage Budget → CRUD deposits | §5 + Phase 4 dashboard wiring |
| Merchant sees billing table + downloads deposit note per month | §5 merchant routes + Phase 4 |
| Monthly bill: all rewards distributed, before/after statement, annex | §6 (§6.1 annex, §6.2 balances) |
| Withdraw bill: reverse of deposit, remaining, txHash, IBAN, fee/VAT restitution | §3.2 + §4 withdraw + §3.5 IBAN |
| Store PDF in s3 (rustfs) not postgres blob | §3.3 |
| One table for deposit/withdraw/monthly | §3.2 discriminated `billing_documents` |
| Merchant accounting info location | §3.1 `merchants.accountingInfo` jsonb |

## 12. Review changelog (v2)

Incorporated feasibility / scope / security / coherence reviews:
- **Terminology** standardized (`kind` enum, VAT vs TVA, path/reference prefixes) — §1.
- **PDF library** switched to `pdf-lib` (binary-build safety) — §7.
- **PDF download** switched from presigned URL to **backend-proxied stream** (drops URL-leak, CORS, internal-endpoint issues) — §3.3.
- **Schema hardening**: per-merchant `reference` uniqueness + `SEQUENCE`; partial-unique monthly bills; `linkedDepositId`; soft-delete (`voidedAt`); merchant FK; typed `BillingDocumentDetails`; no untyped `bankCurrency` — §3.2/§3.6.
- **Money math** uses `decimal.js` (no `parseFloat` on numeric strings) — §4.
- **Security**: `platformAdminAuthenticated` guard contract; IDOR scoping on all queries; field-level auth on accounting; explicit Shopify-path rejection — §3.1/§5.

### Simplification pass (v3)
- **Leaner table**: dropped `vatRate`/`vatAmount`/`frakFeeRate`/`frakFeeAmount`/`vatRateSource`/`updatedBy`/`voidedBy`/`pdfSha256`/`note` columns — VAT & fee breakdown and note now live in `details` (frozen at issue). Only `grossAmount`/`netAmount` (what the ledger aggregates) stay as columns — §3.2.
- **VAT simplified**: France-only (FR → 20%, else none/reverse-charge); no EU rate map, no admin override, no per-country tax engine — §4.
- **Frak fee**: fixed at 20% of (gross − VAT) — §4.
- **IBAN**: masked-only (frontend obfuscates, backend re-masks defensively); no KMS/encryption — §3.5.
- **Ledger** made per-currency, `settled`-only, point-in-time, with live-balance divergence check and disclosed accuracy limit — §6.2.
- **Annex** uses `settledAt` (not `createdAt`); reward rows re-queried at render, not stored in `details` — §6.1/§3.2.
- **Scope**: cron moved to explicit future work; open questions gated against phases — §6.4/§8/§9.
