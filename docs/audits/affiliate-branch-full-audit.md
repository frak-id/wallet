# Affiliate / TakeAds Branch — Full Audit

**Branch:** `feat/takeads-affiliate-integration-plan`
**Base:** `eb000335115fc3bbb0ee405c9ec6ea80fc356f72` (merge-base with `dev`)
**Method:** 8 parallel focused reviews (correctness, reliability, security, performance, data-integrity, simplicity, TypeScript, frontend). Top findings independently verified.

The code is already high quality and has been through prior audit rounds (see `affiliate-integration-audit.md`, `affiliate-ingestion-audit.md`). This pass surfaces what those rounds did not close, plus deployability blockers.

---

## Must-fix before merge/deploy

### B1 · CRITICAL · No migration for the 3 new affiliate tables — *verified*
`affiliate_brand`, `affiliate_attribution`, `affiliate_sync_state` exist only as Drizzle schema. `drizzle-kit generate` was never run; no SQL under `services/bootstrap/drizzle/{dev,prod}` references them (latest is `0036_majestic_slapstick`). The config glob (`../backend/src/domain/*/db/schema.ts`) *will* pick them up, but until a migration is generated + committed the tables do not exist in any environment — every affiliate code path fails with `relation does not exist`.
**Fix:** `cd services/bootstrap && bunx drizzle-kit generate`, commit the SQL + `meta/_journal.json`, ship the migration before/with the code.

### B2 · HIGH · Identity merge orphans `affiliate_attribution` → duplicate tokens — *verified*
`IdentityMergeService.runMergeInTrx` migrates purchases, interaction_logs, asset_logs, referral_links, purchase_claims, referral_codes, push_tokens, merchant tables — but **not `affiliate_attribution`** — then hard-deletes the loser `identity_group` (line 331). After a merge the loser's attribution rows are orphaned; the merged user's next `getShareLink` misses (queries by anchor id) and `mint` creates a **second token** for the same user+brand. Conversions can be mis-credited.
**Fix:** add an `affiliate_attribution` update step in `runMergeInTrx` (delete anchor-conflicting loser rows first, then bulk-update `identityGroupId → anchor`). Add a `migratedAffiliateAttributions` counter.

### B3 · HIGH · NaN `updatedAt` advances the cursor past a lost action
`TakeAdsIngestionOrchestrator.processAction`: an action with unparseable `updatedAt` does `counts.errors++; return` **without** pushing to `failedTimestamps`. If a valid action on the same page succeeds, `computeWatermark` advances past the bad action → it is never re-fetched. Contradicts the job log ("failed actions retried next tick").
**Fix:** push a sentinel (`new Date(0)`) to `failedTimestamps` so the page breaks and holds the cursor; add a test.

### B4 · HIGH/CRITICAL · Poison action pins the cursor forever (no max-retry / DLQ)
Any action whose `processAction` always throws is checkpointed-below and re-fetched every hour indefinitely; if it is first on its page the watermark freezes entirely, blocking all later actions. Only signal is an hourly `warn`.
**Fix:** per-action failure counter (persisted or in-run set); after N attempts, log `error` and skip past it (advance cursor) so one bad row can't wedge the pipeline. Pair with B7 alerting.

---

## Should-fix

### D1 · HIGH · Missing FK `merchantId → merchants` on both affiliate tables
`uuid("merchant_id").notNull()` with no `.references()`. Deleting a merchant leaves stale brand links + attribution rows (valid-looking tracking links for a non-existent merchant). Comment says "Links an internal merchants row…", so the relationship is intended.
**Fix:** add FK `onDelete: "cascade"` (needs migration).

### D2 · MEDIUM · Missing FK `identityGroupId → identity_groups`
No FK on `affiliate_attribution.identity_group_id`. This is precisely why B2 fails silently instead of raising on the merge's group delete.
**Fix:** FK `onDelete: "restrict"` — forces the merge to migrate rows first (surfaces B2 in tests).

### R1 · MEDIUM · TakeAds HTTP 500 not retried
`TakeAdsClient` retry `statusCodes: [429, 503]`. A transient 500 throws immediately, aborts the run, and (given the hourly cron) creates a 60-minute ingestion gap.
**Fix:** add `500` to `statusCodes`.

### S1 · MEDIUM · No runtime validation of the TakeAds response
`.json<TakeAdsActionListResponse>()` is a cast, not a validator, while the rest of the codebase uses TypeBox at boundaries. Malformed `orderAmount` → `"null"`/mis-price; missing `meta` → unhandled throw mid-run; `subId` > 64 chars → `varchar(64)` lookup error. (Overlaps the acknowledged M-2 TODO.)
**Fix:** TypeBox-decode the response at the client boundary; at minimum guard `resp.data`/`resp.meta`, bound `subId` to 64 chars, validate `currencyCode` `/^[A-Z]{3}$/`.

### C1 · MEDIUM · `cancelForRefund` result ignored → `counts.cancelled` inflated
Return `{ affectedCount }` is discarded; CANCELED events with no matching purchase still increment `cancelled` (and `processed`), misleading on-call.
**Fix:** only count when `affectedCount > 0`; `log.warn` on no-op cancel.

### C2 · MEDIUM · `registerBrand` TOCTOU → 500 instead of 409
Concurrent admin registrations of the same `externalId` for different merchants both pass the `findByProviderAndExternalId` check, then the second insert violates `affiliate_brand_provider_external_unique` → unhandled `23505`.
**Fix:** catch the unique-violation in `link()` and translate to `AFFILIATE_BRAND_TAKEN` (409).

### P1 · MEDIUM · N+1 attribution lookups in ingestion
`processAction` does one `findByToken` per action, serially — worst case 25k sequential round-trips (50 pages × 500), ~50s just on lookups at 2ms RTT, eating the 10-min budget.
**Fix:** add `findByTokens(subIds[])` (`WHERE token = ANY($1)`), pre-fetch per page into a `Map`.

### F1 · HIGH (frontend) · "Create link" button enabled during initial GET
`useAffiliateShareLink` never exposes `isLoading`; while the GET is in flight `link` is `undefined` so a returning user briefly sees "Create my sharing link" and a fast tap fires a redundant POST.
**Fix:** expose `query.isLoading`; `disabled={isCreating || isLoading}`.

### F2 · HIGH (frontend) · Mint failure is silent
`useMutation` has no `onError`; a failed POST just re-enables the button with no toast/feedback.
**Fix:** add `onError` + an i18n error key.

### F3 · MEDIUM (frontend) · "Share and Earn" no-ops on desktop
Primary CTA calls `handleShare`, which early-returns when `!canShare` (desktop). Button looks enabled but does nothing; only the demoted ghost "copy" works.
**Fix:** `disabled={!canShare}`, or fall back to copy, or make copy primary on desktop. (Pre-existing pattern, inherited by the affiliate step-2.)

### F4/F5 · MEDIUM (frontend) · Missing validation on admin TakeAds fields
`takeadsMerchantId` accepts fractional values (no `rules`, no `step="1"`); `takeadsTrackingLink` has no URL validation (unlike the `domain` field which uses `validateUrl`).
**Fix:** add `rules.validate` (positive integer / `validateUrl`) + i18n messages.

---

## Nice-to-have / low

- **R2** · `tryWithAdvisoryLock` `finally` can let a throwing `pg_advisory_unlock` mask the original task error → wrap unlock in its own try/catch. (`postgres.ts`)
- **R3** · `advanceWatermark`/`getActions` throws mid-loop bypass the summary log → wrap the job call in try/catch and log partial progress (`affiliateIngestion.ts`).
- **R4/B7** · No stall/alert escalation: poison-stall emits `warn` hourly forever. Escalate to `log.error` after N consecutive `errors>0 && watermark not advanced`; consider a watermark-age metric.
- **R5** · Advisory-lock key `0xaff111` shares the global bigint namespace → use two-arg `pg_try_advisory_lock(class, obj)` or a central lock-key registry.
- **Sec1** · `assertHttpsUrl` allows RFC-1918 / `169.254.169.254` hosts (open-redirect today; SSRF if `trackingLink` is ever server-fetched) → add a private-host blocklist. Admin-only, so low.
- **Sec2** · `TAKEADS_API_URL` override is an undocumented redirect vector → document as test-only / assert unset in prod.
- **TS1** · `sql<"native"|"affiliate">` in `ExplorerOrchestrator` is an unchecked cast fed straight to the API; narrow at the mapper: `row.integration === "affiliate" ? "affiliate" : "native"`.
- **TS2** · Model `TakeAdsAction` as a discriminated union on `type` (SALE-only `orderAmount`/`currencyCode`) instead of the flat type + intersection guard.
- **TS3** · `.$type<AffiliateProvider>()` is TS-only; add a DB CHECK / `pgEnum` before a 2nd provider lands.
- **C3** · Verify TakeAds `updatedAtFrom` inclusive vs exclusive; if `>=`, subtract 1ms to avoid re-processing boundary events every run. Document in `config.ts`.
- **C4** · `orderAmount` unit (major vs cents) still unconfirmed (M-3) — add a sanity log/threshold to catch a 100x mis-price on first live events.
- **P2** · `mint` conflict path is 2 round-trips; optional `onConflictDoUpdate` no-op + `returning()` (near-zero frequency, low priority).

### Simplification / YAGNI (safe, no behavior change)
- **Y1** · `PROVIDER_SUBID_PARAM` is a single-entry map behind a hardcoded `PROVIDER` — always resolves to `"s"`. Inline `const SUBID_PARAM = "s"` in `AffiliateLinkService`, drop the export.
- **Y2** · Dead schema columns never written/read: `metadata` (both tables) + `couponCode` (attribution). Drop them (or keep only with a real requirement).
- **Y3** · Unused `*Insert` type re-exports in `affiliate/index.ts`; remove.
- **Y4** · `AffiliateContext.repositories.affiliateBrand` is never consumed via the namespace (only injected into the service) — drop from the public bag to prevent service-bypassing direct use.
- **Y5** · Trim two aspirational/redundant comments (`provider.ts` "provider-agnostic by construction"; `registration.ts` parenthetical).

---

## Confirmed sound (ruled-out false positives)
- Endpoint authz: `identityGroupId` is server-derived from the verified JWT; no cross-identity minting.
- Platform-admin gating: `isPlatformAdmin` computed from the SIWE-verified wallet; body `takeads`/`skipDomainValidation`/`useFrakBank` ignored for non-admins.
- `advanceWatermark` `GREATEST(COALESCE(...,'-infinity'), EXCLUDED)` monotonic + NULL-safe.
- `mint` `onConflictDoNothing` + re-read converges concurrent same-triple mints.
- Token entropy (nanoid 24 / ~142 bits) sufficient; unique index is the real guarantee.
- `isRewardablePurchase` `Number.isFinite` correctly routes malformed SALEs to custom interactions.
- Advisory lock released on throw; `MutexCron` + advisory lock correctly layer single-replica + cross-replica mutex.
- Explorer correlated `EXISTS` (not a join) is the right choice to avoid fan-out; mitigated by 30s LRU cache.
- All affiliate query predicates are index-backed.
- React-query cache keys/staleness/`enabled` gating correct; no missing i18n keys for existing code.

---

## Priority order
1. **B1, B2** — deployability + money correctness (do first).
2. **B3, B4** — ingestion data-loss / wedge.
3. **D1, D2, C1, C2, S1, R1** — integrity, correctness, resilience.
4. **F1–F5** — user-facing affiliate flow.
5. **P1** — before any real backlog volume.
6. Lows + Y-simplifications — batch cleanup.
