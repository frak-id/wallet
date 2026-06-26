# Affiliate / TakeAds Integration — Code Audit

Scope: commits `3b4ea56e7..caa8d4729` on `feat/takeads-affiliate-integration-plan`; lenses: simplification, code quality, codebase matching, deduplication, bugs/correctness, security.

## Executive Summary

The affiliate domain is architecturally sound and well-scoped. Provider strings are centralised (`provider.ts` / `PROVIDER_SUBID_PARAM`), the token module is clean (~142-bit entropy), the race-safe find-or-create attribution pattern is correct, and the security-critical paths all hold: wallet auth + server-resolved `identityGroupId`, platform-admin SIWE gating with admin-only fields silently ignored for non-admins, and attribution cross-binding enforced by a DB unique index. There are **no blockers**. The dominant theme across reviewers is a single layer violation — affiliate brand-linking logic inlined in the `POST /register` route handler instead of a service — plus a **Medium** data-validation gap: `trackingLink` is stored with no URL-scheme validation, which is simultaneously a crash path (`new URL()` TypeError → 500) and a stored-XSS / open-redirect vector if an admin credential is compromised. Remaining items are low-severity naming, typing, and pattern-drift nits.

### Findings ranked by severity

| Severity | Area | File:Line | Finding |
|----------|------|-----------|---------|
| **High** | Maintainability / Patterns | `registration.ts:78–127` | Affiliate brand dedup-check + link logic inlined in HTTP route, calling repos directly instead of a service (flagged by 2 lenses) |
| **Medium** | Correctness / Security | `AffiliateLinkService.ts:58–67`, `registration.ts` body schema | `trackingLink` stored with no scheme validation → `new URL()` throws 500 **and** `javascript:`/`data:` URL → stored XSS / open-redirect (flagged by 2 lenses) |
| **Medium** | Maintainability / Patterns | `registration.ts:78`, `AffiliateLinkService.ts:43` | `"takeads" as const` hardcoded, not typed against `AffiliateProvider` (flagged by 2 lenses) |
| **Medium** | Correctness | `AffiliateLinkService.ts:53–68` | `couponCode` returned from cached attribution row can go stale vs. brand (latent) |
| Low | TypeScript | `AffiliateBrandRepository.ts:21,43` | `link()` returns unguarded `result` (`T\|undefined`) while declaring `Promise<T>` |
| Low | Simplification | `AffiliateBrandRepository.ts:22–51` | `.returning()` (`RETURNING *`) round-trip discarded by sole caller |
| Low | Simplification | `TakeAdsClient.ts:67–72`, `config.ts:75–99` | `resolveLinks()` + 3 types are unreachable dead code (deferred feature) |
| Low | Patterns | `db/schema.ts` (eof) | Missing named `Select`/`Insert` type exports every other domain provides |
| Low | Patterns | `AffiliateAttributionRepository.ts:20` | `mint` is a domain verb at the repo layer; convention is `create`/`findOrCreate` |
| Low | Patterns | `AffiliateAttributionRepository.ts:58–62` | Invariant uses bare `Error` instead of `HttpError.internal(...)` → unclassified 500 |
| Low | Maintainability | `AffiliateLinkService.ts:43` | `provider ?? "takeads"` silent default is a footgun on union growth |
| Low | Maintainability | `db/schema.ts` (`affiliateBrandTable.updatedAt`) | `defaultNow()` with no `$onUpdateFn`/trigger; callers must set `updatedAt` manually |
| Low | TypeScript | `api/user/affiliate/index.ts:36` | `provider: t.String()` in 200 response loosens the `AffiliateProvider` contract |
| Low | TypeScript / Maintainability / Correctness | `ExplorerOrchestrator.ts:52–68` | Manual `sql<"native"\|"affiliate">` cast + bare SQL literals; TS won't catch SQL refactors/aliasing (flagged by 3 lenses) |
| Low | TypeScript | `MerchantWizard/index.tsx:118` | Falsy guard on numeric `takeadsMerchantId` excludes `0` |
| Low | Correctness / Security | `TakeAdsClient.ts:95–104` | `getTakeAdsClient()` singleton caches API key/client; stale after key rotation, no reset (flagged by 2 lenses) |
| Low | Correctness | `AffiliateBrandRepository.ts:28–40`, `registration.ts:95–112` | Concurrent admin registrations can hit `(provider,externalId)` unique constraint; error swallowed silently |
| Low | Security | `api/user/affiliate/index.ts` | No `rateLimitMiddleware` on share-link endpoint |
| Low | Security | `MerchantRegistrationService.ts:109` | Absent `Origin` header → `new URL("")` uncaught 500 instead of clean 400 |
| Nit | Simplification | `token.ts:11` | `TOKEN_LENGTH` exported but used only locally |
| Nit | Simplification | `AffiliateBrandRepository.ts:14,34,44` | `metadata?` param never passed by any caller |
| Nit | Simplification | `AffiliateLinkService.ts:63–69` | `buildShareUrl` private method wraps a single-use 3-line expression |
| Nit | Maintainability | `AffiliateLinkService.test.ts:20,30` | Stub repos cast `as never`, suppressing the type-checker |
| Nit | Maintainability | `registration.ts` (POST handler) | No explicit auth middleware; SIWE-in-service is the only (implicit) gate |
| Info | TypeScript | `AffiliateLinkService.ts:67` | `couponCode ?? null` no-op; `$inferSelect` already types it `string\|null` |
| Info | Correctness | `db/schema.ts:90–94` | `affiliateSyncStateTable.watermark` is `timestamp` (no tz); UTC unenforced |
| Info | Security | `TakeAdsClient.ts:33` | `TAKEADS_API_URL` env override has no production guard (SSRF if env attacker-controlled) |
| Info | Maintainability | `context.ts` | Module-level singletons force module-boundary mocking (consistent w/ existing pattern) |

## Blockers & High

### H-1 · Affiliate brand-linking logic inlined in the `POST /register` route handler
**Files:** `api/business/merchant/registration.ts:78–127` · `AffiliateBrandRepository`
**Severity:** High (Maintainability) / Medium (Patterns) → **High**

**Finding.** The route handler contains 25+ lines of domain logic: a `findByProviderAndExternalId` repo read, a duplicate-brand guard (`existing.merchantId !== merchantId`), the `link()` upsert, and a non-fatal `try/catch`. It calls `AffiliateContext.repositories.*` directly — no other route in the codebase calls a repository for writes. The canonical pattern (merchant creation in the same file) delegates to `MerchantContext.services.registration.register(...)`.

**Why it matters.** Domain policy living in the HTTP layer is harder to unit-test in isolation, can't be reused, and diverges from the established route→service→repository convention. It also concentrates the other findings below (hardcoded `"takeads"`, duplicated error-message coercion) in one hard-to-test block.

**Recommended fix.** Add a service method — `AffiliateLinkService.registerBrand({ merchantId, provider, externalId, trackingLink })` (or a new `AffiliateBrandService`) — that owns the dedup guard and the link upsert. The route calls the service inside the existing `try/catch`; only the non-fatal error wrapping stays in the handler.

## Medium

- **M-1 · `trackingLink` stored without URL-scheme validation** — `AffiliateLinkService.ts:58–67`, `registration.ts` body schema. The body schema accepts any `t.String()` and `buildShareUrl` passes it straight to `new URL(trackingLink)`. Two consequences from one root cause: (a) a non-URL string (`"not-a-url"`) throws a synchronous `TypeError` → unhandled 500 on **every** subsequent share-link request for that merchant; (b) a `javascript:`/`data:` URL is persisted and returned as `{ url: "javascript:...?s=<token>" }` with HTTP 200 — stored XSS / open-redirect if the wallet frontend renders it as `href`/`window.open`. Only reachable via a platform-admin (or compromised admin) wallet. **Fix:** constrain the schema (`trackingLink: t.String({ format: "uri", pattern: "^https://" })`) **and** defensively reject `url.protocol !== "https:"` in `buildShareUrl`.

- **M-2 · `"takeads" as const` hardcoded, not typed against `AffiliateProvider`** — `registration.ts:78`, `AffiliateLinkService.ts:43`. Bare literals bypass the centralised `AffiliateProvider` union; if it grows, these sites won't surface a type error. **Fix:** `const provider: AffiliateProvider = ...` (annotate) or derive from validated input. The `registration.ts` occurrence disappears once H-1 is extracted.

- **M-3 · Stale `couponCode` from cached attribution row** — `AffiliateLinkService.ts:53–68`. On the conflict path, `getOrCreateShareLink` returns `attribution.couponCode` from the original mint, not the current brand. `couponCode` has no path from the brand side today, so this is latent. **Fix:** if `couponCode` is ever surfaced on the brand, read `brand.couponCode` instead of `attribution.couponCode`.

## Low / Nits

- `AffiliateBrandRepository.link()` returns `result` (`T|undefined`) unguarded while declaring `Promise<T>`; add a null throw or widen the type (TypeScript, Low).
- `link()` uses `.returning()` (`RETURNING *`) but the sole caller discards it — drop `.returning()` and return `Promise<void>` to save a round-trip (Simplification, Low).
- `resolveLinks()` + `TakeAdsResolve*` types are dead code for a deferred deep-link feature (~30 lines); remove until scoped (Simplification, Low).
- `db/schema.ts` does not export `Affiliate*Insert`/`Select` types; both repos compensate with local aliases — add named exports + barrel re-exports to match every other domain (Patterns, Low).
- Repo method `mint` is a domain verb at the persistence layer; rename to `findOrCreate`/`upsert` to match convention and intent (Patterns + Maintainability, Low).
- `mint` invariant throws bare `Error` → unclassified 500; use `HttpError.internal("ATTRIBUTION_MINT_INVARIANT", ...)` (Patterns, Low).
- `provider ?? "takeads"` silent default will mis-route omitted-provider callers on union growth; make `provider` required (Maintainability, Low).
- `affiliateBrandTable.updatedAt` has `defaultNow()` but no `$onUpdateFn`/trigger; future upsert paths can leave stale timestamps with no compile signal (Maintainability, Low).
- `api/user/affiliate/index.ts:36` response uses `provider: t.String()` instead of `t.Union([t.Literal("takeads")])` (TypeScript, Low).
- `ExplorerOrchestrator.ts:52–68` uses a manual `sql<"native"|"affiliate">` cast and bare `'affiliate'`/`'native'` SQL literals duplicating the TypeBox schema; TS won't catch SQL refactors and Drizzle aliasing of `merchantsTable` could silently break the correlated `EXISTS`. Define shared literal constants and/or assert the emitted SQL in a test (TypeScript + Maintainability + Correctness, Low).
- `MerchantWizard/index.tsx:118` falsy `&&` guard excludes `takeadsMerchantId === 0`; use `!= null` (TypeScript, Low).
- `getTakeAdsClient()` singleton caches the client/API key; stale after key rotation and leaks across test suites — export `resetTakeAdsClient()` or read env per-request (Correctness + Security, Low).
- Concurrent admin registrations can both pass the dedup guard then collide on `(provider, externalId)`; the error is swallowed silently — add a WARN log with `externalId`/conflicting merchant, consider `tryWithAdvisoryLock` (Correctness, Low).
- No `rateLimitMiddleware` on `POST /user/affiliate/:merchantId/link` (contrast wallet auth: 10/60s) → DB read amplification (Security, Low).
- Absent `Origin` header → `new URL("")` uncaught 500 in `MerchantRegistrationService.ts:109`; guard for empty origin and return a clean 400 (Security, Low).
- `TOKEN_LENGTH` exported but only used locally — drop the `export` (Simplification, Nit).
- `link()`'s `metadata?` param is never passed by any caller — drop the param (column stays) (Simplification, Nit).
- `buildShareUrl` private method wraps a single-use 3-line expression — inline it (Simplification, Nit).
- Test stubs cast `as never`, suppressing the type-checker; use `Partial<Repo>` (Maintainability, Nit).
- `POST /register` has no explicit auth middleware — the SIWE check inside the service is the only gate; add a comment or extract to middleware (Maintainability, Nit).
- `couponCode ?? null` is a no-op given `$inferSelect` types it `string|null` (TypeScript, Info).
- `affiliateSyncStateTable.watermark` is `timestamp` without tz; enforce UTC before the conversion-ingestion cron lands (Correctness, Info).
- `TAKEADS_API_URL` override has no `NODE_ENV` guard — SSRF/key-exfil risk if env is attacker-controlled (Security, Info).
- `context.ts` module-level singletons force module-boundary mocking; consistent with existing contexts, no action (Maintainability, Info).

## By Lens

### Simplification
**Verdict:** Tightly scoped; no premature abstractions in the core design. Unique findings: dead `resolveLinks()` + types (Low), discarded `RETURNING *` round-trip (Low), `TOKEN_LENGTH` dead export, unused `metadata?` param, and single-use `buildShareUrl` (Nits). Deliberately kept (do **not** flag): `affiliateSyncStateTable`, the `AffiliateProvider` union / `PROVIDER_SUBID_PARAM`, JSONB `metadata` columns, `couponCode` column, `listMerchants`/`getActions` (back planned crons), and `tryWithAdvisoryLock` (already used by `jobs/settlement.ts`).

### Code Quality / Maintainability
**Verdict:** Solid domain design with one clear layer violation (H-1) and a handful of low/nit naming and coupling issues; no blockers. Unique findings: `provider ?? "takeads"` footgun, `updatedAt` lacking `$onUpdateFn`, `as never` test stubs, and the implicit-auth route comment.

### Codebase Matching
**Verdict:** Structurally consistent with repo patterns; reads use the standard `db.query.*.findFirst` API. Unique findings: missing named `Select`/`Insert` schema exports (D-1), bare `Error` vs `HttpError.internal` for a request-reachable invariant (D-5).

### Deduplication
**Verdict:** No meaningful logic duplication. Token generation (62-char vs `sixDigitCode`'s 31-char), URL param injection, the affiliate-vs-referral attribution concepts, and the find-or-create idiom were all examined and judged correctly separate / table-specific. The only repeated snippet is `error instanceof Error ? error.message : String(error)` (twice in `registration.ts`) — extract a small helper (Low/Nit).

### Bugs / Correctness
**Verdict:** One Medium crash path (M-1) and one silent-drop path (concurrent registration collision); the rest low/info. Unique findings: stale `couponCode` (M-3), the `EXISTS`/aliasing risk in `ExplorerOrchestrator`, the `getTakeAdsClient` cache, and `watermark` timezone (Info).

### Security
**Verdict:** Architecturally sound — auth, server-resolved identity binding, ~142-bit token entropy, admin gating (SIWE + env allow-list, admin-only fields ignored for non-admins), and DB-enforced attribution cross-binding all confirmed secure. The one real risk is M-1 (stored XSS via unvalidated `trackingLink`). Unique findings: no rate limiting (Low), absent-`Origin` 500 (Low), `TAKEADS_API_URL` SSRF (Info), stale API-key singleton (Info).

## Recommended Action Plan

**Must-fix before public rollout**
1. **M-1 — Validate `trackingLink`.** Constrain the `registration.ts` body schema to `https:` URLs **and** reject non-`https:` protocols in `buildShareUrl`. Closes both the 500 crash path and the stored-XSS / open-redirect vector. (Highest ROI: one root cause, two lenses.)
2. **H-1 — Extract affiliate brand-linking into a service.** Move the dedup guard + `link()` upsert out of the `POST /register` handler into `AffiliateLinkService` (or a new `AffiliateBrandService`). Resolves M-2's `registration.ts` occurrence and the duplicated error-coercion as a side effect.

**Should-fix soon (low cost, prevents latent breakage)**
3. M-2 — annotate remaining `provider` literals as `AffiliateProvider`.
4. `AffiliateBrandRepository.link()` — add a null guard (or `Promise<void>` + drop `.returning()`), reconciling the TypeScript and Simplification findings together.
5. Concurrent-registration collision — add a structured WARN log on swallowed link failures.
6. Add `rateLimitMiddleware` to the share-link route; guard the absent-`Origin` 500.
7. `mint` invariant → `HttpError.internal(...)`; export named `Affiliate*Select`/`Insert` schema types and drop local aliases.

**Defer / optional polish**
8. Rename `mint` → `findOrCreate`; remove dead `resolveLinks()` + types; drop unused `metadata?` param and `TOKEN_LENGTH` export; inline `buildShareUrl`.
9. M-3 (stale `couponCode`) and the `watermark` timezone — address when the conversion-ingestion / coupon features actually land.
10. `ExplorerOrchestrator` — add shared literal constants + a `toSQL()` assertion test for the `EXISTS` clause.
11. `TAKEADS_API_URL` production guard and `getTakeAdsClient` reset/per-request key — harden before relying on secret rotation.
12. Nits: typed test stubs, numeric `!= null` guard in `MerchantWizard`, `updatedAt` `$onUpdateFn`, auth-gate comment on the POST route.