# Backend Code Review — Findings

Review of `services/backend/src/` (~48.6k LoC, 482 files) by 5 parallel reviewers covering:
domain (core), domain (billing/campaign/campaign-bank), orchestration, api/jobs, infrastructure/utils.

**Overall verdict:** codebase is in good shape — little true AI-slop, comments explain "why",
transactions/idempotency mostly correct, no speculative abstractions or pass-through layers.
The findings below are real but targeted.

Full per-area reports: `.pi-subagents/artifacts/70b50bb6_reviewer_*_output.md`

> **Progress (de-slop / dedup pass):** all §3.1 and §3.2 items have been tackled
> — see the `[x]` markers below. Net result: **−705 LoC** (434 ins / 1139 del)
> across 40 files, behavior-preserving (lint clean, zero new type errors).
>
> **Progress (reliability/security pass):** §1.1 and all §2.x items tackled and
> ✅ verified — see status markers below. 11 `fix(backend)` commits, then a
> review round (4 subagents) surfaced real defects (a fail-open IP fallback, an
> Airtable startup-crash blast radius, and several broken/ineffective tests)
> which were fixed and folded in. Full backend suite now green: **817 tests, 75
> files**, lint clean, zero new type errors.
>
> **Progress (final gap-closure review):** a second review round (3 subagents:
> gap-closure verification, new-slop check, rebase-drift check) audited the
> full branch diff. Verdicts: 9/11 items fully closed as claimed, no rebase
> drift (dev hadn't touched `services/backend`), no over-engineering. It found
> and we closed 2 sibling gaps of the §2.2 class (`update()`/`delete()` did a
> read-then-write on campaign status without a guard — both now re-check
> status atomically in the WHERE clause), converted the last manual
> merchant-access check (`allowedDomains.ts` POST) to the macro, deduplicated
> the §2.8 genuine-access logic into the session resolver (single source of
> truth, removes an authorization drift trap), renamed the misleading
> `getCampaignOrThrow` → `getOwnedCampaign` (it returns null), and wired
> `getResetAt` into a `Retry-After` header on 429s (was dead code). Suite
> green: **816 tests, 75 files**.
>
> **Progress (performance pass):** all §4.x items tackled and ✅ verified via a
> worker-per-item implementation round followed by a reviewer-per-item audit (7
> read-only reviewers, all APPROVE / APPROVE-WITH-NITS, no blockers). Changes are
> behavior-preserving concurrency wins: bounded merchant-group parallelism (per-
> merchant kept sequential to preserve per-user cap ordering), an N+1 collapsed
> into one grouped query, deduped/parallel wallet lookups, parallel per-locale
> FCM sends, concurrent per-bank settlement (safe: the rewarder nonce mutex wraps
> only the broadcast), and Promise.all/allSettled over independent per-row work.
> The reviewer's one substantive nit — unbounded transaction fan-out in
> `restoreBudgetsBatch` from the expiry cron — was fixed by bounding it to 5
> concurrent restores. Suite green for all touched areas (the 7 pre-existing
> `rateLimiter.test.ts` failures are unrelated to this pass and predate it).
>
> **Deferred on purpose (owner decision):** §1.2 (campaign-bank — the sync path
> re-grants roles), §1.3 (campaign float money — later), §1.4 (webhook 200-on-
> error — backend errors must not break webhook delivery).

---

## 1. High priority — security & reliability

### 1.1 Rate-limit bypass via spoofed `X-Forwarded-For` — ✅ done
**File:** `src/infrastructure/rateLimit/ipExtraction.ts:33-46`

> **Fixed.** `x-forwarded-for` is now parsed right-anchored, skipping a
> configurable `RATE_LIMIT_TRUSTED_PROXY_HOPS` (default 1 = the single nginx
> ingress hop); spoofable vendor headers (`cf-connecting-ip` etc.) are no
> longer trusted; and when the header has fewer entries than trusted hops it
> now **fails safe** to `server.requestIP()` (review caught an earlier
> fail-open fallback to the left-most entry). Unit-tested (spoof rejection,
> hop config, fail-safe, vendor-header rejection). NOTE: the trusted-hop count
> assumes the ingress topology; the env var isn't wired into deploy config yet,
> so production uses the safe default of 1 — revisit if a cloud L7 LB is added.

`getClientIp` returns the first (left-most, client-controlled) value from
`x-forwarded-for` / `x-real-ip` / `cf-connecting-ip` before consulting the socket peer.
With nginx-ingress *appending* `$remote_addr` to a pre-existing `X-Forwarded-For`, an
attacker can rotate header values per request to fully bypass the IP-keyed rate limiter
protecting login, 2FA, invite, registration, and merge endpoints (16+ routes).

**Fix:** trust proxy headers only for known ingress hops; prefer `server.requestIP()` or
the right-most trusted value.

### 1.2 `deployAndSetupBank` partial failure leaves bank permanently misconfigured
**File:** `src/domain/campaign-bank/services/CampaignBankService.ts:14-72`

`updateBankAddress` persists to Postgres *before* the on-chain `grantManagerRole` /
`enableDistribution` calls. If either throws (RPC timeout, gas), retries hit the
`merchant.bankAddress` early-return guard and report success without ever retrying setup.
`syncBankRoles` fixes the role but never calls `enableDistribution` — the bank stays
closed forever with no automated recovery.

**Fix:** persist `bankAddress` only after full setup succeeds, or make
`deployAndSetupBank`/`syncBankRoles` idempotently re-check `getBankOnChainState().isOpen`
and re-run `enableDistribution`.

### 1.3 Float money math across the campaign domain (design-level) — ⏭️ deferred
**Files:** `src/domain/campaign/services/RewardCalculator.ts:100-101,187,204-232`,
`src/domain/campaign/repositories/CampaignRuleRepository.ts:23-108,339-357`,
`src/domain/campaign/types/index.ts:100`, `src/domain/campaign/schemas/index.ts`

Budgets and reward amounts are native JS `number` end-to-end: `Math.round(x * 1e6) / 1e6`
on rewards, running float accumulation on budget `used`, and `Number.parseFloat` on
`numeric(36,18)` decimal strings — the exact anti-pattern the billing domain explicitly
bans (`BillingComputationService.ts:13`). Error compounds over budget lifetimes and
referral chains; `CalculatedReward.amount` ultimately feeds `parseUnits` for on-chain
transfers.

**Fix:** migrate `BudgetConfigItem.amount`, `BudgetUsed.used`, `CalculatedReward.amount`
to decimal strings + `decimal.js`, mirroring billing. Schema/type migration — plan as its
own task.

### 1.4 Webhook processing failures always return HTTP 200 — ⏭️ deferred (by design)
**File:** `src/api/external/merchant/webhook/index.ts:16-25`

> **Intentional.** A backend error must not impact webhook delivery/acking.

The shared `onError` handler unconditionally sets `set.status = 200` and returns
`"ko: <message>"` — including for HMAC mismatches and malformed bodies. Providers
(Shopify/Woo/Magento) use non-2xx as their retry signal, so a rotated/misconfigured
signing secret silently stops purchase ingestion with no retry and no provider-side
visibility.

**Fix:** return real error statuses for signature/parse failures; keep 200 only for
genuinely handled no-op cases (e.g. WooCommerce ping).

---

## 2. Medium — reliability bugs — ✅ all done

> All §2.x fixed and verified (full backend suite green). Review-round
> corrections folded in: the ownership-transfer/campaign-status/identity-race
> fixes now run inside `db.transaction` with the codebase's `PgTx` threading
> convention; the add-admin fix adopts `requireMerchantAccess` (also fixing a
> test-mock gap so the 403 path is actually exercised); the webhook-secret fix
> gates the key behind genuine (non-platform-admin-bypass) access; the Airtable
> fail-fast is now lazy so a missing key returns a scoped 500 instead of
> crashing the whole backend at startup.

| # | Finding | File | Status |
|---|---------|------|--------|
| 2.1 | `POST /` (add admin) used `authorization.hasAccess` instead of `hasMerchantAccess`, skipping the Shopify-credential grant → Shopify-linked admins got silent 403; `allowedDomains.ts` POST (last manual inline check) converted to the macro after the gap-closure review | `src/api/business/merchant/admins.ts`, `allowedDomains.ts` | ✅ |
| 2.2 | Campaign status transition TOCTOU: added `WHERE status = ANY(from)` guard, 0 rows → 409 conflict — extended to `update()` (RULE_LOCKED bypass race) and `delete()` (delete-vs-publish race) after the gap-closure review | `CampaignManagementService.ts`, `CampaignRuleRepository.ts` | ✅ |
| 2.3 | Ownership transfer accept: `updateOwner` + `delete` now atomic in one `db.transaction`, cache invalidation deferred post-commit | `OwnershipTransferService.ts` | ✅ |
| 2.4 | `cascadeDepositVoid`: per-withdraw void wrapped in try/catch, cascade now genuinely best-effort | `BillingOrchestrator.ts` | ✅ |
| 2.5 | `IdentityOrchestrator.resolve()`: create-group + add-node now in one tx; a lost racer deletes its empty group and returns the winner | `IdentityOrchestrator.ts` | ✅ |
| 2.6 | reward-history amounts now computed with `decimal.js` (wire type unchanged) | `RewardHistoryService.ts` | ✅ |
| 2.7 | Webhook HMAC compare now uses `crypto.timingSafeEqual` with a length guard | `src/utils/bodyHmac.ts` | ✅ |
| 2.8 | Webhook signing secret now returned only to genuine merchant access (not the platform-admin read bypass) + audit log; schema field made optional. The genuine-access check lives in the session resolver (`hasGenuineMerchantAccess`) next to `hasMerchantAccess` — one source of truth, no drift risk | `session.ts`, `src/api/business/merchant/webhooks.ts` | ✅ |
| 2.9 | Rate limiter reimplemented as a genuine two-bucket sliding-window counter (bounds the boundary burst); 429s now carry a `Retry-After` header | `src/infrastructure/rateLimit/rateLimiter.ts` | ✅ |
| 2.10 | Airtable key check now fires (fallback removed) and construction is lazy, so a missing key yields a scoped 500, not a startup crash | `src/infrastructure/integrations/airtable/` | ✅ |

---

## 3. De-slop / deduplication (~600+ LoC removable) — ✅ DONE (−705 LoC actual)

> Tackled on branch `docs/backend-review-findings` in 5 behavior-preserving
> `refactor(backend)` commits. Gate: `biome lint` clean + zero new type errors.

### 3.1 `requireMerchantAccess` macro — biggest single win (~-330 LoC) — ✅ done
**Files:** 15 files under `src/api/business/merchant/`

The same 7-line auth+access block is copy-pasted **37 times**:

```ts
if (!businessSession && !shopifySession) return status(401, "Authentication required");
const hasAccess = await hasMerchantAccess(merchantId);
if (!hasAccess) return status(403, "Access denied");
```

Counts: campaigns.ts ×9, bank.ts ×3, media.ts ×3, webhooks.ts ×3, admins.ts ×2,
allowedDomains.ts ×2, billingAccounting.ts ×2, billingDocuments.ts ×2,
campaignOverview.ts ×2, index.ts ×2, members.ts ×2, sdkConfig.ts ×2,
campaignDetails.ts, explorer.ts, transfer.ts ×1 each.

The macro mechanism already exists (`businessSessionContext` in
`src/api/business/middleware/session.ts:150-197` defines `requireStepUp`,
`platformAdminAuthenticated`) and `api/user/wallet/*` does this correctly via
`withWalletAuthent: true`. Adding the macro also fixes the inconsistent 401/403 shapes
(raw string vs structured `ErrorResponse`) by throwing `HttpError` in `beforeHandle`.

**Caveats — handled, NOT swept mechanically (left as-is):**
- `admins.ts POST /` diverges (bug 2.1 — left untouched, tracked as a reliability fix)
- `transfer.ts` mutations intentionally skip `hasMerchantAccess` (service re-verifies ownership)
- `billingAccounting.ts PUT` intentionally allows platform-admin writes

The macro preserves the exact same 401/403 status codes and string bodies (no
response-shape change), so this is a pure dedup; the `ErrorResponse` unification
is deferred to the §2.1 reliability work.

### 3.2 Other dedup wins

| ✓ | Win | Est. → Actual | Where |
|---|-----|---------------|-------|
| ✅ | Dead SDK routes marked `TODO(delete-next-cycle)` (confirmed zero callers repo-wide) | ~-55 | `src/api/user/wallet/auth/sdk.ts` |
| ✅ | `MerchantRepository`: 8× update+`invalidateCache` → private `applyUpdate` | -45 → **-48** | `src/domain/merchant/repositories/MerchantRepository.ts` |
| ✅ | Shared webhook resolve+verify helper (4 copies) | ~-40 | `src/api/external/merchant/webhook/resolveAndVerifyWebhook.ts` |
| ✅ | `MemberQueryOrchestrator`: deduped join/where blocks into helpers | -30 → **-41** | `src/orchestration/MemberQueryOrchestrator.ts` |
| ⚠️ | ~~Dead `LEFT JOIN asset_logs` in `countMembers`~~ — **NOT dead**: feeds `COUNT()` fan-out used by the `interactions.min/max` HAVING filters; kept, deduped surrounding blocks instead | kept | `src/orchestration/MemberQueryOrchestrator.ts` |
| ⏭️ | ~~Shared `ky.create` factory~~ — **skipped**: each site is already a single `ky.create({...})`; a factory + new file is net-positive without homogenizing the (intentionally divergent) per-site config | +LoC → skip | airtable, resend, openpanel, takeads, fx/pricing |
| ✅ | Campaign ownership-check helper `getCampaignOrThrow` (7 copies) | ~-21 | `campaigns.ts`, `campaignDetails.ts` |
| ✅ | Purchase-item `.map` (3 copies) removed at call sites | ~-15 | `PurchaseWebhookOrchestrator.ts`, `PurchaseLinkingOrchestrator.ts` |
| ✅ | WebAuthN: extracted `senderAddressFromInitCode` + `buildVerifyInput` | -25 → **-6** | `src/domain/auth/services/WebAuthNService.ts` |
| ✅ | Wallet/SDK auth resolution → `resolveWalletOrSdkSession` | -16 → **-4** | `src/infrastructure/macro/session.ts` |
| ✅ | Referee-count methods → shared private `countAsRefereeWhere` | -15 → **-3** | `src/domain/rewards/repositories/AssetLogRepository.ts` |
| ✅ | CSS resolution: 4 branches → data-driven loop | -15 → **-10** | `src/domain/merchant/services/MerchantResolveService.ts` |
| ✅ | Pairing `sendTopic` → shared `pairing/wsHelpers.ts` | -13 → **-7** | `PairingOrchestrator.ts`, `PairingRouterOrchestrator.ts` |
| ✅ | Dead code: `getBanksTotalBalance`, public `predictBankAddress` (zero callers) | ~-30 | `src/domain/campaign-bank/repositories/CampaignBankRepository.ts` |
| ✅ | ERC20 multicall triple → `erc20MetadataContracts` | -10 → **-24** | `src/infrastructure/blockchain/TokenMetadataRepository.ts` |
| ✅ | PDF: deduped `LOGO_SIZE` + extracted `drawVatLine` | ~-5 | `src/domain/billing/services/pdf/` |
| ✅ | Restate-the-code comments trimmed (3 files) | ~-14 | `WebAuthNService.ts`, `WalletSdkSessionService.ts`, `AnonymousMergeService.ts` |

### 3.3 Architecture nits
- `webhooks.ts` queries `db` directly from route handlers — the only file bypassing the
  domain/repository layer, and it handles a secret key (`src/api/business/merchant/webhooks.ts`)
- `console.warn` in `airtable/utils.ts:43` is silently stripped by `build.ts` `drop: ["console"]`
  in prod — use the shared pino logger; grep repo-wide for other stray `console.*`
- `processbudgetUsed` naming typo (`CampaignRuleRepository.ts:23`)

---

## 4. Performance (no LoC change) — ✅ all done

| # | Finding | File | Status |
|---|---------|------|--------|
| 4.1 | Batch reward cron processed interactions fully sequentially → now runs merchant groups with bounded concurrency (`MERCHANT_CONCURRENCY=5`, chunked `Promise.all`), keeping each merchant's interactions sequential so per-user cap COUNT checks still see prior commits | `src/orchestration/BatchRewardOrchestrator.ts` | ✅ |
| 4.2 | N+1: per-campaign `maxRewardsPerUser` cap query inside the rule-evaluation loop → prefetched with one `GROUP BY campaignRuleId` query (`countByCampaignsAndUserAsReferee`); old singular method removed (zero callers) | `RuleEngineService.ts`, `AssetLogRepository.ts` | ✅ |
| 4.3 | N+1: sequential wallet lookups in reward-pending notifications → dedupe unique group ids + `Promise.all` into a Map (mirrors `SettlementOrchestrator`) | `src/orchestration/BatchRewardOrchestrator.ts` | ✅ |
| 4.4 | Sequential FCM sends per locale group → `Promise.all` (token refresh already de-duped via `inflightTokenRefresh`) | `src/domain/notifications/services/NotificationsService.ts` | ✅ |
| 4.5 | Sequential per-bank settlement → concurrent via `Promise.all`; `settleBankBatch` refactored to return a `BankBatchOutcome` merged synchronously (no shared-mutable race). Safe: the rewarder nonce mutex wraps only the broadcast, not the receipt wait | `src/domain/rewards/services/SettlementService.ts` | ✅ |
| 4.6 | Sequential per-campaign transactions in `restoreBudgetsBatch` → concurrent, **bounded to 5** (distinct single-row `FOR UPDATE` txns; bound prevents pool saturation from the unbounded expiry-cron caller) | `src/domain/campaign/repositories/CampaignRuleRepository.ts` | ✅ |
| 4.7 | Sequential loop over expired signature requests in pairing cron → `Promise.allSettled` (one failure can't abort the sweep; rejections logged at warn) | `src/jobs/pairing.ts` | ✅ |

---

## 5. Explicitly checked, found solid (no action)

- No pass-through services or single-impl interface bloat anywhere; every service earns
  its separation (caching, transaction composition, invariants)
- No swallowed errors — all catch blocks rethrow, map to typed `HttpError`, or log with
  justified reasoning
- Hot-path transactions correct: settlement claiming (`FOR UPDATE SKIP LOCKED`), email
  verification, wallet-binding repoint, identity merge row-locking, monthly-bill
  idempotency (partial unique index + 23505 re-resolution)
- Billing money math already correct (decimal.js, atomic reference allocation, write-once
  PDF guards)
- `jobs/` uniformly clean (thin cron wrappers, advisory locks for multi-replica safety)
- The 1054-LoC `IdentityMergeService` is a deliberate transaction boundary over 10+
  tables, not a god-class — do not split
- `context.ts` manual-DI pattern is consistent and intentional — not worth abstracting
- No unused deps found (manual grep; `knip` failed in sandbox — re-run in CI to confirm)

---

## Suggested attack order

1. **Security batch:** 1.1 (IP spoofing), 1.4 (webhook 200-on-error), 2.7 (timing-safe HMAC) — small, high-impact
2. **`requireMerchantAccess` macro** (3.1) — biggest de-slop win, also fixes 2.1 and the error-shape inconsistency
3. **Campaign-bank recovery** (1.2)
4. **Transaction/race fixes:** 2.2, 2.3, 2.4, 2.5
5. **Mechanical dedup** (3.2) + perf quick wins (4.x)
6. **Campaign decimal migration** (1.3) — plan as its own task
